// ============================================
// Swagger API Documentation
// ============================================

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const config = require('../config');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: `${config.APP_NAME} API`,
      version: '1.0.0',
      description: 'Social Communication Platform — REST API + Socket.IO Documentation',
      contact: {
        name: 'API Support',
        email: 'support@socialplatform.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}${config.API_PREFIX}`,
        description: 'Development Server',
      },
      {
        url: `https://api.socialplatform.com${config.API_PREFIX}`,
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token (without "Bearer " prefix)',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Success' },
            data: { type: 'object', nullable: true },
            error: { type: 'string', nullable: true },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
            data: { type: 'object', nullable: true },
            error: { type: 'string', nullable: true },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication & OTP' },
      { name: 'Users', description: 'User profile & settings' },
      { name: 'Girls', description: 'Girl profiles' },
      { name: 'Wallet', description: 'Wallet & coins' },
      { name: 'Chats', description: 'Chats & messages' },
      { name: 'Calls', description: 'Voice & video calls' },
      { name: 'Gifts', description: 'Gift catalog & transactions' },
      { name: 'Subscriptions', description: 'Subscription plans' },
      { name: 'Promos', description: 'Promo codes' },
      { name: 'Referrals', description: 'Referral system' },
      { name: 'Reports', description: 'User reports' },
      { name: 'Support', description: 'Support tickets' },
      { name: 'Notifications', description: 'Notifications' },
      { name: 'Admin', description: 'Admin dashboard' },
      { name: 'Upload', description: 'File uploads' },
    ],
  },
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../controllers/*.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

const setupSwagger = (app) => {
  // Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: `${config.APP_NAME} API Docs`,
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        displayRequestDuration: true,
      },
    })
  );

  // JSON spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

module.exports = setupSwagger;