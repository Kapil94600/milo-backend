// ============================================
// Swagger API Documentation — Bond (Complete)
// ============================================

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const config = require('../config');

// ============================================
// Reusable schemas
// ============================================
const schemas = {
  // Standard responses
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
  Pagination: {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer', example: 150 },
      totalPages: { type: 'integer', example: 8 },
      hasNext: { type: 'boolean', example: true },
      hasPrev: { type: 'boolean', example: false },
    },
  },
  // Auth
  AuthTokens: {
    type: 'object',
    properties: {
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
    },
  },
  User: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      phone: { type: 'string', example: '9876543210' },
      name: { type: 'string', example: 'John Doe' },
      email: { type: 'string', nullable: true },
      profileImage: { type: 'string', nullable: true },
      role: { type: 'string', enum: ['USER', 'GIRL', 'ADMIN'] },
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED'] },
      isOnline: { type: 'boolean' },
      isVerified: { type: 'boolean' },
      totalCoins: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Girl: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      userId: { type: 'string' },
      isOnline: { type: 'boolean' },
      isAvailable: { type: 'boolean' },
      isVerified: { type: 'boolean' },
      rating: { type: 'number' },
      totalReviews: { type: 'integer' },
      hourlyRate: { type: 'number' },
      videoCallRate: { type: 'number' },
      chatMessageRate: { type: 'number' },
      rateApproved: { type: 'boolean' },
      categories: { type: 'array', items: { type: 'string' } },
      languages: { type: 'array', items: { type: 'string' } },
      about: { type: 'string' },
    },
  },
  Call: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      callerId: { type: 'string' },
      receiverId: { type: 'string' },
      type: { type: 'string', enum: ['VOICE', 'VIDEO'] },
      status: { type: 'string', enum: ['INITIATED', 'CONNECTED', 'ENDED', 'MISSED', 'REJECTED', 'CANCELLED', 'FAILED'] },
      duration: { type: 'integer' },
      cost: { type: 'number' },
      coinRate: { type: 'integer' },
      startedAt: { type: 'string', format: 'date-time' },
      endedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  Chat: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: { type: 'string', enum: ['DIRECT', 'GROUP'] },
      name: { type: 'string', nullable: true },
      lastMessageAt: { type: 'string', format: 'date-time' },
      unreadCount: { type: 'integer' },
    },
  },
  Message: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      chatId: { type: 'string' },
      senderId: { type: 'string' },
      content: { type: 'string' },
      type: { type: 'string', enum: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'GIF', 'FILE', 'STICKER'] },
      mediaUrl: { type: 'string', nullable: true },
      isRead: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Wallet: {
    type: 'object',
    properties: {
      balance: { type: 'number', example: 500.50 },
      coins: { type: 'integer', example: 1500 },
      totalEarned: { type: 'number' },
      totalSpent: { type: 'number' },
      totalWithdrawn: { type: 'number' },
      pendingBalance: { type: 'number' },
    },
  },
  Transaction: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: { type: 'string', enum: ['CREDIT', 'DEBIT'] },
      category: { type: 'string' },
      amount: { type: 'number' },
      coins: { type: 'integer' },
      description: { type: 'string' },
      status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Gift: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      image: { type: 'string' },
      coins: { type: 'integer' },
      price: { type: 'number' },
      category: { type: 'string' },
      rarity: { type: 'string' },
    },
  },
  SubscriptionPlan: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      price: { type: 'number' },
      duration: { type: 'string' },
      durationDays: { type: 'integer' },
      features: { type: 'array', items: { type: 'string' } },
      isPopular: { type: 'boolean' },
    },
  },
  Error: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      message: { type: 'string' },
      error: { type: 'string', nullable: true },
    },
  },
};

// ============================================
// Tags
// ============================================
const tags = [
  { name: 'Auth', description: 'Authentication — Firebase OTP + JWT' },
  { name: 'Users', description: 'User profile, preferences, settings' },
  { name: 'Girls', description: 'Girl profiles and requests' },
  { name: 'Chats', description: 'Chats, messages, reactions' },
  { name: 'Calls', description: 'Voice and video calls' },
  { name: 'Wallet', description: 'Wallet, coins, withdrawals' },
  { name: 'Gifts', description: 'Gift catalog and transactions' },
  { name: 'Subscriptions', description: 'Subscription plans and upgrades' },
  { name: 'Promos', description: 'Promo codes' },
  { name: 'Referrals', description: 'Referral program' },
  { name: 'Reports', description: 'User reports and moderation' },
  { name: 'Support', description: 'Support tickets' },
  { name: 'Notifications', description: 'Notifications and scheduling' },
  { name: 'Admin', description: 'Admin panel — dashboard, users, analytics' },
  { name: 'Upload', description: 'File uploads' },
  { name: 'Health', description: 'System health and info' },
];

// ============================================
// OpenAPI definition
// ============================================
const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: `${config.APP_NAME} API`,
      version: '1.0.0',
      description: `
Social Communication Platform — REST API + Socket.IO Documentation.

**Authentication:** Firebase Phone Auth → Server JWT
- Send Firebase ID token to \`POST /auth/firebase-login\`
- Receive JWT access + refresh tokens
- Use access token in \`Authorization: Bearer <token>\` header

**Rate Limiting:** Applied on auth, uploads, payments.
      `.trim(),
      contact: {
        name: 'Bond Support',
        email: 'support@bond.app',
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
        url: `https://api.bond.app${config.API_PREFIX}`,
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT access token (without "Bearer " prefix)',
        },
      },
      schemas,
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags,
  },
  apis: [
    path.join(__dirname, 'paths/*.js'),
    path.join(__dirname, '../routes/*.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

// ============================================
// Setup function
// ============================================
const setupSwagger = (app) => {
  // Custom CSS
  const customCss = `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #7C3AED; }
    .swagger-ui .info { margin: 30px 0; }
    .swagger-ui .scheme-container { background: #F5F3FF; }
    .swagger-ui .btn.authorize { background: #7C3AED; border-color: #7C3AED; }
    .swagger-ui .btn.authorize svg { fill: #fff; }
  `;

  // Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customCss,
      customSiteTitle: `${config.APP_NAME} API Docs`,
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        displayRequestDuration: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    })
  );

  // JSON spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Yaml spec (optional)
  app.get('/api-docs.yaml', (req, res) => {
    res.setHeader('Content-Type', 'text/yaml');
    res.send(swaggerSpec);
  });

  console.log(`📖 Swagger docs: http://localhost:${config.PORT}/api-docs`);
};

module.exports = setupSwagger;
module.exports.swaggerSpec = swaggerSpec;