// ============================================
// Swagger Paths — Health
// ============================================

module.exports = {
  '/health': {
    get: {
      tags: ['Health'],
      summary: 'System health check',
      security: [],
      responses: {
        200: {
          description: 'Server healthy',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'OK' },
                      uptime: { type: 'number' },
                      environment: { type: 'string' },
                      database: { type: 'string', example: 'connected' },
                      memory: {
                        type: 'object',
                        properties: {
                          used: { type: 'string' },
                          total: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  '/api': {
    get: {
      tags: ['Health'],
      summary: 'API welcome',
      security: [],
      responses: {
        200: { description: 'API info with endpoints list' },
      },
    },
  },
};