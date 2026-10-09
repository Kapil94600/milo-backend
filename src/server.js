// ============================================
// Server Entry Point
// ============================================

const http = require('http');
const app = require('./app');
const config = require('./config');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { closeRedis } = require('./config/redis');
const { initSocket } = require('./socket');
const { startJobs } = require('./jobs');
const { logInfo, logError } = require('./utils/logger');

// ============================================
// Create HTTP server
// ============================================
const server = http.createServer(app);

let io = null;
let isShuttingDown = false;

// ============================================
// ⭐ TEST: Google Play API Access
// ============================================
const testGooglePlayAccess = async () => {
  // Skip if credentials not configured
  if (
    !config.GOOGLE_PLAY?.SERVICE_ACCOUNT_EMAIL ||
    !config.GOOGLE_PLAY?.PRIVATE_KEY
  ) {
    console.log('⚠️  Google Play: credentials not configured, skipping test');
    return false;
  }

  try {
    const { google } = require('googleapis');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.GOOGLE_PLAY.SERVICE_ACCOUNT_EMAIL,
        private_key: config.GOOGLE_PLAY.PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    if (token && token.token) {
      console.log('✅ Google Play API access OK');
      console.log('   Service Account:', config.GOOGLE_PLAY.SERVICE_ACCOUNT_EMAIL);
      console.log('   Package Name:', config.GOOGLE_PLAY.PACKAGE_NAME);
      return true;
    }

    console.log('⚠️  Google Play: got client but no token');
    return false;
  } catch (error) {
    console.error('❌ Google Play API access FAILED');
    console.error('   Error:', error.message);

    if (error.message.includes('invalid_grant')) {
      console.error('   → Check: private_key format, client_email');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('   → Check: network connection');
    } else if (error.message.includes('invalid_scope')) {
      console.error('   → Check: Google Play Android Developer API enabled?');
    }

    return false;
  }
};

// ============================================
// Start server
// ============================================
const startServer = async () => {
  try {
    // 1. Connect to DB
    await connectDatabase();

    // ⭐ 2. Test Google Play API (after DB, before socket)
    await testGooglePlayAccess();

    // 3. Init Socket.IO
    io = await initSocket(server);

    // 4. Start HTTP server
    server.listen(config.PORT, () => {
      console.log('');
      console.log('============================================');
      console.log(`  🚀 Server running on port ${config.PORT}`);
      console.log(`  🌍 Environment: ${config.NODE_ENV}`);
      console.log(`  📚 API: http://localhost:${config.PORT}${config.API_PREFIX}`);
      console.log(`  🔌 Socket: ws://localhost:${config.PORT}${config.SOCKET.PATH}`);
      console.log(`  📖 Docs: http://localhost:${config.PORT}/api-docs`);
      console.log(`  ❤️  Health: http://localhost:${config.PORT}/health`);
      console.log('============================================');
      console.log('');

      logInfo(`Server started on port ${config.PORT} (${config.NODE_ENV})`);

      // 5. Start cron jobs
      if (config.NODE_ENV !== 'test') {
        startJobs();
      }
    });

    server.on('error', (error) => {
      logError('Server error', error);
      process.exit(1);
    });
  } catch (error) {
    logError('Failed to start server', error);
    process.exit(1);
  }
};

// ============================================
// Graceful shutdown
// ============================================
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logInfo(`Received ${signal}, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    logError('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    await new Promise((resolve) => {
      server.close(() => {
        logInfo('HTTP server closed');
        resolve();
      });
    });

    if (io) {
      await new Promise((resolve) => {
        io.close(() => {
          logInfo('Socket.IO closed');
          resolve();
        });
      });
    }

    await disconnectDatabase();
    await closeRedis();

    clearTimeout(forceExit);
    logInfo('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (e) {
    logError('Shutdown error', e);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logError('Uncaught Exception', error);
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
  logError('Unhandled Rejection', { reason });
});

// ============================================
// Start
// ============================================
startServer();

module.exports = server;