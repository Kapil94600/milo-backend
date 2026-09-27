// ============================================
// Auth Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const AuthService = require('../services/auth.service');
const ApiResponse = require('../utils/response');

// ============================================
// POST /auth/request-otp  (LEGACY — MSG91 flow)
// ============================================
const requestOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  const result = await AuthService.generateOTP(
    phone,
    req.ip,
    req.headers['user-agent']
  );
  return ApiResponse.success(
    res,
    { expiresIn: result.expiresIn },
    'OTP sent successfully'
  );
});

// ============================================
// POST /auth/verify-otp  (LEGACY — MSG91 flow)
// ============================================
const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp, deviceInfo } = req.body;
  const result = await AuthService.verifyOTP(
    phone,
    otp,
    req.ip,
    req.headers['user-agent'],
    deviceInfo
  );
  return ApiResponse.success(res, result, 'Login successful');
});

// ============================================
// ✅ NEW: POST /auth/firebase-login
// Body: { idToken, deviceInfo }
// ============================================
const firebaseLogin = asyncHandler(async (req, res) => {
  const { idToken, deviceInfo } = req.body;

  const result = await AuthService.firebaseLogin(
    idToken,
    req.ip,
    req.headers['user-agent'],
    deviceInfo
  );

  return ApiResponse.success(res, result, 'Login successful');
});

// ============================================
// POST /auth/refresh-token
// ============================================
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const tokens = await AuthService.refreshAccessToken(
    refreshToken,
    req.ip,
    req.headers['user-agent']
  );
  return ApiResponse.success(res, tokens, 'Token refreshed successfully');
});

// ============================================
// POST /auth/logout
// ============================================
const logout = asyncHandler(async (req, res) => {
  await AuthService.logout(
    req.user.id,
    req.ip,
    req.headers['user-agent']
  );
  return ApiResponse.success(res, null, 'Logged out successfully');
});

// ============================================
// POST /auth/logout-all
// ============================================
const logoutAll = asyncHandler(async (req, res) => {
  await AuthService.logoutAll(
    req.user.id,
    req.ip,
    req.headers['user-agent']
  );
  return ApiResponse.success(res, null, 'Logged out from all devices');
});

// ============================================
// POST /auth/create-admin
// ============================================
const createAdmin = asyncHandler(async (req, res) => {
  const { phone, email, name, password, secretKey } = req.body;
  const admin = await AuthService.createAdmin({
    phone,
    email,
    name,
    password,
    secretKey,
  });
  return ApiResponse.created(res, admin, 'Admin created successfully');
});

// ============================================
// GET /auth/me
// ============================================
const me = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, req.user, 'Profile fetched');
});

// ============================================
// Exports
// ============================================
module.exports = {
  requestOTP,
  verifyOTP,
  firebaseLogin,  // ✅ NEW
  refreshToken,
  logout,
  logoutAll,
  createAdmin,
  me,
};