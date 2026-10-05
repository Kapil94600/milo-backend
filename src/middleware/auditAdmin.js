// ============================================
// Admin Audit Middleware — Bond
// Logs every admin action with before/after
// ============================================

const { prisma } = require('../config/database');
const { logError, logInfo } = require('../utils/logger');

// ============================================
// Sensitive actions to always audit
// ============================================
const SENSITIVE_ACTIONS = [
  'BLOCK_USER',
  'UNBLOCK_USER',
  'DELETE_USER',
  'VERIFY_GIRL',
  'REJECT_GIRL',
  'PROCESS_RATE_CHANGE',
  'PROCESS_WITHDRAWAL',
  'PROCESS_REFUND',
  'UPDATE_GLOBAL_RATES',
  'UPDATE_PAYOUT_RATES',
  'BROADCAST_NOTIFICATION',
  'UPDATE_ADMIN',
  'REMOVE_ADMIN',
  'ENABLE_MAINTENANCE',
  'DISABLE_MAINTENANCE',
  'CREATE_PROMO',
  'UPDATE_PROMO',
  'DELETE_PROMO',
  'CREATE_SUBSCRIPTION_PLAN',
  'UPDATE_SUBSCRIPTION_PLAN',
  'DELETE_SUBSCRIPTION_PLAN',
];

// ============================================
// Helper: Extract resource info from path
// ============================================
const extractResourceInfo = (req) => {
  const method = req.method.toUpperCase();
  const path = req.originalUrl || req.url;
  const baseUrl = req.baseUrl || '';

  // Extract resource (users, girls, wallet, etc.)
  const pathParts = (baseUrl + path).split('/').filter(Boolean);
  const apiIndex = pathParts.indexOf('api');
  const resource = apiIndex >= 0 ? pathParts[apiIndex + 1] : pathParts[0];
  const resourceId = req.params?.id || req.params?.userId || null;

  return { method, path, resource, resourceId };
};

// ============================================
// MAIN: Log admin action
// ============================================
const logAdminAction = async (req, action, resource, resourceId, changes = null) => {
  try {
    if (!req.user?.id) return null;

    // Verify user is admin
    if (req.user.role !== 'ADMIN') return null;

    const log = await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action,
        resource,
        resourceId,
        changes,
        status: 'SUCCESS',
        metadata: {
          path: req.originalUrl,
          method: req.method,
          adminName: req.user.name,
          adminRole: req.user.role,
        },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return log;
  } catch (e) {
    logError('Admin audit log failed', e);
    return null;
  }
};

// ============================================
// MIDDLEWARE: Auto-log admin mutating requests
// ============================================
const auditAdminAction = (req, res, next) => {
  // Skip non-admin
  if (req.user?.role !== 'ADMIN') return next();

  // Only audit mutating methods
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return next();
  }

  // Skip certain paths
  const skipPaths = [
    '/admin/dashboard',
    '/admin/analytics',
    '/admin/wallet/stats',
    '/admin/wallet/withdrawal-stats',
  ];

  if (skipPaths.some((p) => req.originalUrl?.includes(p))) {
    return next();
  }

  // Capture response
  let capturedBody = null;
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (!capturedBody) {
      capturedBody = body;

      setImmediate(async () => {
        try {
          const { method, path, resource, resourceId } = extractResourceInfo(req);
          const success = body?.success !== false;

          // Build action name
          const action = `${method}_${resource.toUpperCase()}`;

          // Sanitize body — remove sensitive fields
          const sanitizedBody = sanitizeForAudit(req.body);

          // Sanitize response — remove tokens
          const sanitizedResponse = sanitizeForAudit(body?.data);

          await logAdminAction(
            req,
            action,
            resource,
            resourceId,
            {
              request: sanitizedBody,
              response: sanitizedResponse,
              success,
              error: success ? null : body?.message,
            }
          );

          // Extra log for critical actions
          if (SENSITIVE_ACTIONS.some((a) => action.includes(a))) {
            logInfo(`🔐 Admin sensitive action: ${action} by ${req.user.id}`);
          }
        } catch (e) {
          logError('auditAdminAction wrapper failed', e);
        }
      });
    }

    return originalJson(body);
  };

  next();
};

// ============================================
// Helper: Sanitize for audit
// ============================================
const SENSITIVE_KEYS = [
  'password',
  'token',
  'refreshToken',
  'accessToken',
  'apiKey',
  'apiSecret',
  'secret',
  'secretKey',
  'razorpay_signature',
  'signature',
  'fcmToken',
  'idToken',
];

const sanitizeForAudit = (obj, depth = 0) => {
  if (depth > 5) return '[deep]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map((v) => sanitizeForAudit(v, depth + 1));
  }

  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
      out[key] = '***';
    } else {
      out[key] = sanitizeForAudit(val, depth + 1);
    }
  }
  return out;
};

// ============================================
// Manual audit for specific actions
// ============================================
const logAction = async (req, action, resource, resourceId, changes = null) => {
  return logAdminAction(req, action, resource, resourceId, changes);
};

module.exports = {
  auditAdminAction,
  logAdminAction,
  logAction,
  sanitizeForAudit,
  SENSITIVE_ACTIONS,
};