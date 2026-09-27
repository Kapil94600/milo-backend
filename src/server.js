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
// Start server
// ============================================
const startServer = async () => {
  try {
    // 1. Connect to DB
    await connectDatabase();

    // 2. Init Socket.IO (after DB connect)
    io = await initSocket(server);

    // 3. Start HTTP server
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

      // 4. Start cron jobs (skip in test)
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

  // Force exit after 10 seconds
  const forceExit = setTimeout(() => {
    logError('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    // 1. Stop accepting new connections
    await new Promise((resolve) => {
      server.close(() => {
        logInfo('HTTP server closed');
        resolve();
      });
    });

    // 2. Close socket
    if (io) {
      await new Promise((resolve) => {
        io.close(() => {
          logInfo('Socket.IO closed');
          resolve();
        });
      });
    }

    // 3. Close DB
    await disconnectDatabase();

    // 4. Close Redis
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

// ============================================
// Handle uncaught exceptions
// ============================================
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