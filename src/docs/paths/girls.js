// ============================================
// Swagger Paths — Girls
// ============================================

module.exports = {
  '/girls/available': {
    get: {
      tags: ['Girls'],
      summary: 'Get available girls (public)',
      security: [],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'category', in: 'query', schema: { type: 'string' } },
        { name: 'language', in: 'query', schema: { type: 'string' } },
        { name: 'search', in: 'query', schema: { type: 'string' } },
        { name: 'minRate', in: 'query', schema: { type: 'number' } },
        { name: 'maxRate', in: 'query', schema: { type: 'number' } },
        { name: 'minRating', in: 'query', schema: { type: 'number' } },
        { name: 'maxRating', in: 'query', schema: { type: 'number' } },
        { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['rating', 'priceLow', 'priceHigh', 'earnings', 'newest'] } },
        { name: 'onlineOnly', in: 'query', schema: { type: 'boolean' } },
      ],
      responses: {
        200: {
          description: 'Girls list',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Girl' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  '/girls/top': {
    get: {
      tags: ['Girls'],
      summary: 'Top-rated girls',
      security: [],
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
      ],
      responses: {
        200: { description: 'Top girls' },
      },
    },
  },

  '/girls/request': {
    post: {
      tags: ['Girls'],
      summary: 'Submit girl registration request',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['about', 'categories', 'languages'],
              properties: {
                about: { type: 'string', minLength: 20 },
                categories: { type: 'array', items: { type: 'string' } },
                languages: { type: 'array', items: { type: 'string' } },
                specialties: { type: 'array', items: { type: 'string' } },
                hourlyRate: { type: 'number', minimum: 50, maximum: 5000 },
                videoCallRate: { type: 'number', minimum: 100, maximum: 10000 },
                chatMessageRate: { type: 'number', minimum: 1, maximum: 50 },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Request submitted' },
        409: { description: 'Already a girl or request pending' },
      },
    },
  },

  '/girls/request/can-request': {
    get: {
      tags: ['Girls'],
      summary: 'Check if user can request to become girl',
      responses: {
        200: {
          description: 'Can-request info',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      canRequest: { type: 'boolean' },
                      reason: { type: 'string' },
                      message: { type: 'string' },
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

  '/girls/request/me': {
    get: {
      tags: ['Girls'],
      summary: 'Get my girl request',
      responses: {
        200: { description: 'Request fetched' },
      },
    },
    delete: {
      tags: ['Girls'],
      summary: 'Cancel pending request',
      responses: {
        200: { description: 'Request cancelled' },
        400: { description: 'Cannot cancel' },
      },
    },
  },

  '/girls/profile/me': {
    get: {
      tags: ['Girls'],
      summary: 'Get my girl profile',
      responses: {
        200: { description: 'Profile fetched' },
      },
    },
    put: {
      tags: ['Girls'],
      summary: 'Update my girl profile',
      responses: {
        200: { description: 'Profile updated' },
      },
    },
    delete: {
      tags: ['Girls'],
      summary: 'Delete my girl profile',
      responses: {
        200: { description: 'Profile deleted' },
      },
    },
  },

  '/girls/profile/rates': {
    get: {
      tags: ['Girls'],
      summary: 'Get my rates (current + pending)',
      responses: {
        200: { description: 'Rates fetched' },
      },
    },
    put: {
      tags: ['Girls'],
      summary: 'Update my rates (pending admin approval)',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                hourlyRate: { type: 'number' },
                videoCallRate: { type: 'number' },
                chatMessageRate: { type: 'number' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Rate change request submitted' },
      },
    },
  },

  '/girls/profile/earnings': {
    get: {
      tags: ['Girls'],
      summary: 'Get my earnings breakdown (coins + ₹)',
      responses: {
        200: { description: 'Earnings fetched' },
      },
    },
  },

  '/girls/{id}': {
    get: {
      tags: ['Girls'],
      summary: 'Get girl by ID',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Girl fetched' },
        404: { $ref: '#/components/responses/NotFoundError' },
      },
    },
  },
};