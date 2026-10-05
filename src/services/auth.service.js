// ============================================
// Auth Service — Bond (OTP-based, no password)
// Firebase + OTP + JWT
// ============================================

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const config = require('../config');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const { logInfo, logError, logWarn } = require('../utils/logger');
const {
  ROLES,
  OTP_PURPOSE,
  AuthAction,
  AuditStatus,
} = require('../common/enums');
const WalletService = require('./wallet.service');
const SmsService = require('./sms.service');
const EmailService = require('./email.service');
const { verifyFirebaseToken, isFirebaseAvailable } = require('../config/firebase');
const {
  recordOtpFailure,
  recordOtpRequest,
  clearOtpAttempts,
} = require('../middleware/loginLockout');

class AuthService {
  // ============================================
  // 1. REQUEST OTP (legacy MSG91)
  // ============================================
  static async generateOTP(phone, ip = null, userAgent = null) {
    if (!helpers.isValidPhone(phone)) {
      throw AppError.badRequest('Invalid phone number');
    }

    const normalizedPhone = helpers.normalizePhone(phone);

    // ⭐ Rate limit: 5 per 15 min
    const recentCount = await prisma.otp.count({
      where: {
        phone: normalizedPhone,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });

    if (recentCount >= 5) {
      throw AppError.tooMany('Too many OTP requests. Please wait 15 minutes.');
    }

    const otp = helpers.generateOTP(config.OTP_LENGTH);
    const expiresAt = new Date(Date.now() + config.OTP_EXPIRE * 1000);

    await prisma.otp.create({
      data: {
        phone: normalizedPhone,
        otp,
        purpose: OTP_PURPOSE.LOGIN,
        expiresAt,
        ip,
        userAgent,
      },
    });

    const existingUser = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true },
    });

    await prisma.authLog.create({
      data: {
        userId: existingUser?.id || null,
        phone: normalizedPhone,
        action: AuthAction.OTP_REQUEST,
        status: AuditStatus.SUCCESS,
        ip,
        userAgent,
      },
    });

    // ⭐ Record OTP request (for lockout tracking)
    await recordOtpRequest(normalizedPhone);

    await SmsService.sendOTP(normalizedPhone, otp);

    logInfo(`OTP generated for ${normalizedPhone}`);

    return { expiresIn: config.OTP_EXPIRE };
  }

  // ============================================
  // 2. VERIFY OTP (legacy)
  // ============================================
  static async verifyOTP(phone, otp, ip = null, userAgent = null, deviceInfo = null) {
    if (!helpers.isValidPhone(phone)) {
      throw AppError.badRequest('Invalid phone number');
    }
    if (!/^\d{6}$/.test(otp)) {
      throw AppError.badRequest('OTP must be 6 digits');
    }

    const normalizedPhone = helpers.normalizePhone(phone);

    const otpRecord = await prisma.otp.findFirst({
      where: {
        phone: normalizedPhone,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      await this.logAuthAction(
        null,
        normalizedPhone,
        AuthAction.OTP_VERIFY,
        AuditStatus.FAILED,
        'OTP expired or invalid',
        ip,
        userAgent
      );
      // ⭐ Record failed attempt
      await recordOtpFailure(normalizedPhone);
      throw AppError.badRequest('OTP expired or invalid');
    }

    if (otpRecord.otp !== otp) {
      const newAttempts = otpRecord.attempts + 1;

      if (newAttempts >= config.OTP_MAX_ATTEMPTS) {
        await prisma.otp.delete({ where: { id: otpRecord.id } });
        await this.logAuthAction(
          null,
          normalizedPhone,
          AuthAction.OTP_VERIFY,
          AuditStatus.FAILED,
          'Too many attempts',
          ip,
          userAgent
        );
        // ⭐ Record failed attempt
        await recordOtpFailure(normalizedPhone);
        throw AppError.badRequest('Too many invalid attempts. Request new OTP.');
      }

      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { attempts: newAttempts },
      });

      await this.logAuthAction(
        null,
        normalizedPhone,
        AuthAction.OTP_VERIFY,
        AuditStatus.FAILED,
        'Invalid OTP',
        ip,
        userAgent
      );

      // ⭐ Record failed attempt
      await recordOtpFailure(normalizedPhone);
      throw AppError.badRequest('Invalid OTP');
    }

    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // ⭐ Clear failed attempts on success
    await clearOtpAttempts(normalizedPhone);

    return this._loginOrCreateUser(normalizedPhone, deviceInfo, ip, userAgent);
  }

  // ============================================
  // 3. FIREBASE LOGIN
  // ============================================
  static async firebaseLogin(idToken, ip = null, userAgent = null, deviceInfo = null) {
    if (!idToken) {
      throw AppError.badRequest('Firebase ID token is required');
    }

    if (!isFirebaseAvailable()) {
      throw AppError.badRequest('Firebase not configured on server');
    }

    let decoded;
    try {
      decoded = await verifyFirebaseToken(idToken);
    } catch (error) {
      await this.logAuthAction(
        null,
        null,
        AuthAction.LOGIN,
        AuditStatus.FAILED,
        'Firebase token invalid',
        ip,
        userAgent
      );
      throw AppError.unauthorized('Invalid Firebase token');
    }

    const phoneNumber = decoded.phone_number;
    if (!phoneNumber) {
      throw AppError.badRequest('Firebase token does not contain phone number');
    }

    const normalizedPhone = helpers.normalizePhone(phoneNumber);
    if (!helpers.isValidPhone(normalizedPhone)) {
      throw AppError.badRequest('Invalid phone number in Firebase token');
    }

    logInfo(`Firebase login: ${normalizedPhone} (uid: ${decoded.uid})`);

    // ⭐ Clear any lockout on successful Firebase verification
    await clearOtpAttempts(normalizedPhone);

    return this._loginOrCreateUser(
      normalizedPhone,
      deviceInfo,
      ip,
      userAgent,
      decoded.uid
    );
  }

  // ============================================
  // 4. LOGIN OR CREATE USER (helper)
  // ============================================
  static async _loginOrCreateUser(
    normalizedPhone,
    deviceInfo,
    ip,
    userAgent,
    firebaseUid = null
  ) {
    let user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      include: { wallet: true },
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      const referralCode = helpers.generateReferralCode('USER');

      try {
        user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              phone: normalizedPhone,
              name: `User_${normalizedPhone.slice(-4)}`,
              role: ROLES.USER,
              isVerified: true,
              isActive: true,
              referralCode,
              wallet: {
                create: { balance: 0, coins: 0 },
              },
            },
            include: { wallet: true },
          });

          return newUser;
        });
      } catch (error) {
        if (error.code === 'P2002') {
          user = await prisma.user.findUnique({
            where: { phone: normalizedPhone },
            include: { wallet: true },
          });
          isNewUser = false;
        } else {
          throw error;
        }
      }

      // Give signup bonus
      if (isNewUser && config.BUSINESS.SIGNUP_BONUS_COINS > 0) {
        await WalletService.addCoins(
          user.id,
          config.BUSINESS.SIGNUP_BONUS_COINS,
          'SIGNUP_BONUS',
          'Welcome bonus'
        );
      }

      // Welcome email
      if (isNewUser && user.email) {
        EmailService.sendWelcome(user).catch((e) =>
          logError('Welcome email failed', e)
        );
      }

      if (isNewUser) {
        await this.logAuthAction(
          user.id,
          normalizedPhone,
          AuthAction.REGISTER,
          AuditStatus.SUCCESS,
          null,
          ip,
          userAgent
        );
        logInfo(
          `New user registered via ${firebaseUid ? 'Firebase' : 'OTP'}: ${normalizedPhone}`
        );
      }
    }

    if (!user.isActive || user.status === 'BLOCKED') {
      await this.logAuthAction(
        user.id,
        normalizedPhone,
        AuthAction.LOGIN,
        AuditStatus.FAILED,
        'Account blocked',
        ip,
        userAgent
      );
      throw AppError.forbidden('Account is blocked or inactive');
    }

    const tokens = await this.generateTokens(user);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        isOnline: true,
        lastSeen: new Date(),
        fcmToken: deviceInfo?.fcmToken || user.fcmToken,
      },
    });

    // Register device
    if (deviceInfo?.fcmToken) {
      await prisma.device.upsert({
        where: { token: deviceInfo.fcmToken },
        update: {
          userId: user.id,
          platform: deviceInfo.platform || 'unknown',
          deviceId: deviceInfo.deviceId,
          model: deviceInfo.model,
          version: deviceInfo.version,
          isActive: true,
        },
        create: {
          userId: user.id,
          token: deviceInfo.fcmToken,
          platform: deviceInfo.platform || 'unknown',
          deviceId: deviceInfo.deviceId,
          model: deviceInfo.model,
          version: deviceInfo.version,
        },
      });
    }

    await this.logAuthAction(
      user.id,
      normalizedPhone,
      AuthAction.LOGIN,
      AuditStatus.SUCCESS,
      null,
      ip,
      userAgent
    );

    const userData = this.sanitizeUser(user);

    return {
      user: userData,
      ...tokens,
      isNewUser,
    };
  }

  // ============================================
  // 5. GENERATE TOKENS
  // ============================================
  static async generateTokens(user) {
    const payload = {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRE,
    });

    const refreshToken = jwt.sign(
      { id: user.id },
      config.REFRESH_TOKEN_SECRET,
      { expiresIn: config.REFRESH_TOKEN_EXPIRE }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return { accessToken, refreshToken };
  }

  // ============================================
  // 6. REFRESH ACCESS TOKEN
  // ============================================
  static async refreshAccessToken(refreshToken, ip = null, userAgent = null) {
    if (!refreshToken) {
      throw AppError.badRequest('Refresh token is required');
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET);
    } catch (error) {
      await this.logAuthAction(
        null,
        null,
        AuthAction.REFRESH,
        AuditStatus.FAILED,
        'Invalid refresh token',
        ip,
        userAgent
      );
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || user.refreshToken !== refreshToken) {
      await this.logAuthAction(
        user?.id || null,
        user?.phone,
        AuthAction.REFRESH,
        AuditStatus.FAILED,
        'Token mismatch',
        ip,
        userAgent
      );
      throw AppError.unauthorized('Invalid refresh token');
    }

    if (!user.isActive || user.status === 'BLOCKED') {
      throw AppError.forbidden('Account is blocked or inactive');
    }

    const tokens = await this.generateTokens(user);

    await this.logAuthAction(
      user.id,
      user.phone,
      AuthAction.REFRESH,
      AuditStatus.SUCCESS,
      null,
      ip,
      userAgent
    );

    return tokens;
  }

  // ============================================
  // 7. LOGOUT
  // ============================================
  static async logout(userId, ip = null, userAgent = null) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (user) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          refreshToken: null,
          isOnline: false,
          lastSeen: new Date(),
        },
      });

      await this.logAuthAction(
        userId,
        user.phone,
        AuthAction.LOGOUT,
        AuditStatus.SUCCESS,
        null,
        ip,
        userAgent
      );
    }

    return { message: 'Logged out successfully' };
  }

  // ============================================
  // 8. LOGOUT ALL DEVICES
  // ============================================
  static async logoutAll(userId, ip = null, userAgent = null) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');

    await prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        isOnline: false,
        lastSeen: new Date(),
      },
    });

    await prisma.device.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    await this.logAuthAction(
      userId,
      user.phone,
      AuthAction.LOGOUT,
      AuditStatus.SUCCESS,
      'Logged out from all devices',
      ip,
      userAgent
    );

    return { message: 'Logged out from all devices' };
  }

  // ============================================
  // 9. CREATE ADMIN
  // ⭐ Simple — no password, only phone/email/name
  // ⭐ Admin OTP se hi login karega (jaise user)
  // ============================================
  static async createAdmin({ phone, email, name, secretKey }) {
    if (secretKey !== config.ADMIN_SECRET_KEY) {
      throw AppError.forbidden('Invalid admin secret key');
    }

    if (!helpers.isValidPhone(phone)) {
      throw AppError.badRequest('Invalid phone number');
    }

    if (!helpers.isValidEmail(email)) {
      throw AppError.badRequest('Invalid email');
    }

    const normalizedPhone = helpers.normalizePhone(phone);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ phone: normalizedPhone }, { email }],
      },
    });

    if (existing) {
      throw AppError.conflict('User with this phone or email already exists');
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: normalizedPhone,
          email,
          name,
          role: ROLES.ADMIN,
          isVerified: true,
          isActive: true,
          wallet: { create: { balance: 0, coins: 0 } },
        },
      });

      const admin = await tx.admin.create({
        data: {
          userId: user.id,
          role: 'ADMIN',
        },
      });

      return { user, admin };
    });

    logInfo(`Admin created: ${normalizedPhone}`);

    return this.sanitizeUser(result.user);
  }

  // ============================================
  // 10. LOG AUTH ACTION
  // ============================================
  static async logAuthAction(
    userId,
    phone,
    action,
    status,
    error = null,
    ip = null,
    userAgent = null
  ) {
    try {
      await prisma.authLog.create({
        data: {
          userId: userId || null,
          phone: phone || 'unknown',
          action,
          status,
          error,
          ip,
          userAgent,
        },
      });
    } catch (e) {
      logError('AuthLog failed', e);
    }
  }

  // ============================================
  // 11. SANITIZE USER
  // ============================================
  static sanitizeUser(user) {
    if (!user) return null;
    const { password, refreshToken, ...safe } = user;
    return safe;
  }
}

module.exports = AuthService;