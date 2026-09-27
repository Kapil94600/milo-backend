// ============================================
// Express App Configuration
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

const config = require('./config');
const { logger } = require('./utils/logger');
const ApiResponse = require('./utils/response');
const errorHandler = require('./middleware/errorHandler');
const { notFoundHandler } = require('./middleware/errorHandler');
const checkMaintenance = require('./middleware/maintenance');
const { autoAudit } = require('./middleware/auditLog');
const setupSwagger = require('./docs/swagger');

// ============================================
// Import routes
// ============================================
const authRoutes = require('./routes/auth.route');
const userRoutes = require('./routes/user.route');
const girlRoutes = require('./routes/girl.route');
const walletRoutes = require('./routes/wallet.route');
const chatRoutes = require('./routes/chat.route');
const callRoutes = require('./routes/call.route');
const giftRoutes = require('./routes/gift.route');
const subscriptionRoutes = require('./routes/subscription.route');
const promoRoutes = require('./routes/promo.route');
const referralRoutes = require('./routes/referral.route');
const reportRoutes = require('./routes/report.route');
const supportRoutes = require('./routes/support.route');
const notificationRoutes = require('./routes/notification.route');
const adminRoutes = require('./routes/admin.route');
const uploadRoutes = require('./routes/upload.route');
const blockRoutes = require('./routes/block.route');
const favoriteRoutes = require('./routes/favorite.route');
const reviewRoutes = require('./routes/review.route');
const bannerRoutes = require('./routes/banner.route');
const appVersionRoutes = require('./routes/appVersion.route');
const auditRoutes = require('./routes/audit.route');
const paymentRoutes = require('./routes/payment.route');
const maintenanceRoutes = require('./routes/maintenance.route');

// ============================================
// Create app
// ============================================
const app = express();

// Trust proxy (for rate limiting + IP)
app.set('trust proxy', 1);

// Disable ETag (avoid caching issues with API)
app.set('etag', false);

// ============================================
// Security
// ============================================
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // ✅ ADD THIS
    crossOriginOpenerPolicy: false, // ✅ ADD THIS
  })
);
// After helmet middleware
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
// ============================================
// CORS
// ============================================
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (config.CORS_ORIGIN.includes('*') || config.CORS_ORIGIN.includes(origin)) {
        return callback(null, true);
      }
      if (!config.IS_PRODUCTION) return callback(null, true);
      return callback(new Error('CORS: Origin not allowed'), false);
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// ============================================
// Compression
// ============================================
app.use(compression());

// ============================================
// Razorpay webhook — RAW BODY (before express.json)
// ============================================
app.use(
  `${config.API_PREFIX}/payments/webhook`,
  express.raw({ type: 'application/json', limit: '1mb' })
);

// ============================================
// Body parsers
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// Sanitize
// ============================================
app.use(mongoSanitize());

// ============================================
// Logging
// ============================================
if (config.IS_PRODUCTION) {
  app.use(
    morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) },
      skip: (req) => req.path === '/health',
    })
  );
} else {
  app.use(morgan('dev', { skip: (req) => req.path === '/health' }));
}

// ============================================
// Static files
// ============================================
app.use('/uploads', express.static(path.resolve(process.cwd(), config.UPLOAD_DIR)));

// ============================================
// Health check
// ============================================
app.get('/health', (req, res) => {
  ApiResponse.success(
    res,
    {
      status: 'OK',
      uptime: process.uptime(),
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      },
    },
    'Server is healthy'
  );
});

// ============================================
// Maintenance check
// ============================================
app.use(checkMaintenance);

// ============================================
// Auto audit (POST/PUT/PATCH/DELETE)
// ============================================
app.use(autoAudit);

// ============================================
// API welcome
// ============================================
app.get(config.API_PREFIX, (req, res) => {
  ApiResponse.success(
    res,
    {
      name: config.APP_NAME,
      version: '1.0.0',
      environment: config.NODE_ENV,
      endpoints: {
        auth: `${config.API_PREFIX}/auth`,
        users: `${config.API_PREFIX}/users`,
        girls: `${config.API_PREFIX}/girls`,
        wallet: `${config.API_PREFIX}/wallet`,
        chats: `${config.API_PREFIX}/chats`,
        calls: `${config.API_PREFIX}/calls`,
        gifts: `${config.API_PREFIX}/gifts`,
        subscriptions: `${config.API_PREFIX}/subscriptions`,
        promos: `${config.API_PREFIX}/promos`,
        referrals: `${config.API_PREFIX}/referrals`,
        reports: `${config.API_PREFIX}/reports`,
        support: `${config.API_PREFIX}/support`,
        notifications: `${config.API_PREFIX}/notifications`,
        admin: `${config.API_PREFIX}/admin`,
        upload: `${config.API_PREFIX}/upload`,
        blocks: `${config.API_PREFIX}/blocks`,
        favorites: `${config.API_PREFIX}/favorites`,
        reviews: `${config.API_PREFIX}/reviews`,
        banners: `${config.API_PREFIX}/banners`,
        appVersions: `${config.API_PREFIX}/app-versions`,
        auditLogs: `${config.API_PREFIX}/audit-logs`,
        payments: `${config.API_PREFIX}/payments`,
      },
    },
    `Welcome to ${config.APP_NAME} API`
  );
});

// ============================================
// API Routes
// ============================================
app.use(`${config.API_PREFIX}/auth`, authRoutes);
app.use(`${config.API_PREFIX}/users`, userRoutes);
app.use(`${config.API_PREFIX}/girls`, girlRoutes);
app.use(`${config.API_PREFIX}/wallet`, walletRoutes);
app.use(`${config.API_PREFIX}/chats`, chatRoutes);
app.use(`${config.API_PREFIX}/calls`, callRoutes);
app.use(`${config.API_PREFIX}/gifts`, giftRoutes);
app.use(`${config.API_PREFIX}/subscriptions`, subscriptionRoutes);
app.use(`${config.API_PREFIX}/promos`, promoRoutes);
app.use(`${config.API_PREFIX}/referrals`, referralRoutes);
app.use(`${config.API_PREFIX}/reports`, reportRoutes);
app.use(`${config.API_PREFIX}/support`, supportRoutes);
app.use(`${config.API_PREFIX}/notifications`, notificationRoutes);
app.use(`${config.API_PREFIX}/admin`, adminRoutes);
app.use(`${config.API_PREFIX}/upload`, uploadRoutes);
app.use(`${config.API_PREFIX}/blocks`, blockRoutes);
app.use(`${config.API_PREFIX}/favorites`, favoriteRoutes);
app.use(`${config.API_PREFIX}/reviews`, reviewRoutes);
app.use(`${config.API_PREFIX}/banners`, bannerRoutes);
app.use(`${config.API_PREFIX}/app-versions`, appVersionRoutes);
app.use(`${config.API_PREFIX}/audit-logs`, auditRoutes);
app.use(`${config.API_PREFIX}/payments`, paymentRoutes);
app.use(`${config.API_PREFIX}/maintenance`, maintenanceRoutes);

// ============================================
// Swagger
// ============================================
setupSwagger(app);

// ============================================
// 404
// ============================================
app.use(notFoundHandler);

// ============================================
// Error handler (LAST)
// ============================================
app.use(errorHandler);

module.exports = app;