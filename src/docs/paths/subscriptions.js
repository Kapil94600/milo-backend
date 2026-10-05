// ============================================
// Swagger Paths — Subscriptions
// ============================================

module.exports = {
  '/subscriptions/plans': {
    get: {
      tags: ['Subscriptions'],
      summary: 'Get subscription plans',
      security: [],
      responses: {
        200: {
          description: 'Plans',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { $ref: '#/components/schemas/SubscriptionPlan' } },
                },
              },
            },
          },
        },
      },
    },
  },

  '/subscriptions/subscribe': {
    post: {
      tags: ['Subscriptions'],
      summary: 'Subscribe to plan',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['planId'],
              properties: {
                planId: { type: 'string' },
                autoRenew: { type: 'boolean', default: false },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Subscribed' },
      },
    },
  },

  '/subscriptions/subscribe-with-promo': {
    post: {
      tags: ['Subscriptions'],
      summary: 'Subscribe with promo code',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['planId'],
              properties: {
                planId: { type: 'string' },
                promoCode: { type: 'string' },
                autoRenew: { type: 'boolean', default: false },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Subscribed with discount' },
      },
    },
  },

  '/subscriptions/upgrade': {
    post: {
      tags: ['Subscriptions'],
      summary: 'Upgrade subscription (prorated)',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['planId'],
              properties: {
                planId: { type: 'string' },
                autoRenew: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Upgraded' },
      },
    },
  },

  '/subscriptions/upgrade/preview/{planId}': {
    get: {
      tags: ['Subscriptions'],
      summary: 'Preview upgrade cost',
      parameters: [
        { name: 'planId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Upgrade preview' },
      },
    },
  },

  '/subscriptions/my-subscription': {
    get: {
      tags: ['Subscriptions'],
      summary: 'Get my active subscription',
      responses: {
        200: { description: 'Active subscription' },
      },
    },
  },

  '/subscriptions/cancel': {
    post: {
      tags: ['Subscriptions'],
      summary: 'Cancel subscription',
      responses: {
        200: { description: 'Cancelled' },
      },
    },
  },
};