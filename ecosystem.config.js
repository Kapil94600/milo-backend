// ============================================
// PM2 Ecosystem Configuration
// ============================================

module.exports = {
  apps: [
    {
      // ============================================
      // Main API Server
      // ============================================
      name: 'vibe-api',
      script: './src/server.js',

      // ============================================
      // Cluster Mode
      // ============================================
      instances: 'max',        // use all CPU cores
      exec_mode: 'cluster',    // load balancing
      watch: false,            // don't restart on file changes in production
      max_memory_restart: '1G',

      // ============================================
      // Environment
      // ============================================
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 5000,
      },

      // ============================================
      // Logging
      // ============================================
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,

      // ============================================
      // Auto Restart
      // ============================================
      autorestart: true,
      max_restarts: 10,
      min_uptime: '60s',       // must stay up 60s to be considered stable
      restart_delay: 4000,     // wait 4s between restarts

      // ============================================
      // Graceful Shutdown
      // ============================================
      kill_timeout: 10000,     // 10s for graceful shutdown
      listen_timeout: 10000,   // 10s to start listening
      shutdown_with_message: true,

      // ============================================
      // Advanced
      // ============================================
      wait_ready: false,
      instance_var: 'INSTANCE_ID',
      source_map_support: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', '.git'],

      // ============================================
      // Node.js Options
      // ============================================
      node_args: '--max-old-space-size=2048',
    },
  ],

  // ============================================
  // Deploy configuration (optional)
  // ============================================
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/your-repo.git',
      path: '/var/www/vibe-backend',
      'pre-deploy-local': '',
      'post-deploy':
        'npm ci --omit=dev && npx prisma generate && npx prisma migrate deploy && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production',
      },
    },
  },
};