// ============================================
// Audit Log Middleware
// ============================================

const AuditService = require('../services/audit.service');
const { logError } = require('../utils/logger');

// Auto-log mutating requests
const autoAudit = (req, res, next) => {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return next();
  }

  const skipPaths = [
    '/api/audit-logs',
    '/api/health',
    '/api/payments/webhook',
  ];
  if (skipPaths.some((p) => req.originalUrl.startsWith(p))) {
    return next();
  }

  let logged = false;
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (!logged) {
      logged = true;

      setImmediate(() => {
        try {
          const resource =
            (req.baseUrl || '').replace(/^\/api\/?/, '').split('/')[0] || 'unknown';
          const success = body?.success !== false;

          AuditService.log({
            userId: req.user?.id || null,
            action: `${method}_${resource.toUpperCase()}`,
            resource,
            resourceId: req.params?.id || null,
            status: success ? 'SUCCESS' : 'FAILED',
            error: success ? null : body?.message,
            metadata: {
              path: req.originalUrl,
              method,
              params: req.params,
              query: req.query,
            },
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          }).catch((e) => logError('autoAudit failed', e));
        } catch (e) {
          logError('autoAudit wrapper failed', e);
        }
      });
    }

    return originalJson(body);
  };

  next();
};

// Manual log helper
const logAction = async (req, action, resource, resourceId = null, changes = null) => {
  try {
    return await AuditService.log({
      userId: req.user?.id || null,
      action,
      resource,
      resourceId,
      changes,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  } catch (e) {
    logError('logAction failed', e);
    return null;
  }
};

module.exports = { autoAudit, logAction };