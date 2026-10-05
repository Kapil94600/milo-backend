// ============================================
// Swagger Paths — Admin
// ============================================

module.exports = {
  '/admin/dashboard/stats': {
    get: {
      tags: ['Admin'],
      summary: 'Get dashboard stats',
      responses: {
        200: { description: 'Dashboard stats' },
        403: { $ref: '#/components/responses/ForbiddenError' },
      },
    },
  },

  '/admin/dashboard/gender-chart': {
    get: {
      tags: ['Admin'],
      summary: 'Get gender distribution chart',
      responses: {
        200: { description: 'Gender chart' },
      },
    },
  },

  '/admin/dashboard/revenue-chart': {
    get: {
      tags: ['Admin'],
      summary: 'Get revenue timeline chart',
      parameters: [
        { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
      ],
      responses: {
        200: { description: 'Revenue chart data' },
      },
    },
  },

  '/admin/dashboard/calls-chart': {
    get: {
      tags: ['Admin'],
      summary: 'Get calls timeline chart',
      parameters: [
        { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
      ],
      responses: {
        200: { description: 'Calls chart data' },
      },
    },
  },

  '/admin/analytics/gifts': {
    get: {
      tags: ['Admin'],
      summary: 'Gift analytics',
      parameters: [
        { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
      ],
      responses: {
        200: { description: 'Gift analytics' },
      },
    },
  },

  '/admin/analytics/subscriptions': {
    get: {
      tags: ['Admin'],
      summary: 'Subscription analytics',
      parameters: [
        { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
      ],
      responses: {
        200: { description: 'Subscription analytics' },
      },
    },
  },

  '/admin/analytics/reports': {
    get: {
      tags: ['Admin'],
      summary: 'Report analytics',
      parameters: [
        { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
      ],
      responses: {
        200: { description: 'Report analytics' },
      },
    },
  },

  '/admin/analytics/support': {
    get: {
      tags: ['Admin'],
      summary: 'Support analytics',
      parameters: [
        { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
      ],
      responses: {
        200: { description: 'Support analytics' },
      },
    },
  },

  '/admin/users/bulk/block': {
    post: {
      tags: ['Admin'],
      summary: 'Bulk block users',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userIds'],
              properties: {
                userIds: { type: 'array', items: { type: 'string' } },
                reason: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Users blocked' },
      },
    },
  },

  '/admin/users/bulk/delete': {
    post: {
      tags: ['Admin'],
      summary: 'Bulk delete users',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userIds'],
              properties: {
                userIds: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Users deleted' },
      },
    },
  },

  '/admin/payout/rates': {
    get: {
      tags: ['Admin'],
      summary: 'Get payout rates',
      responses: {
        200: { description: 'Payout rates' },
      },
    },
    put: {
      tags: ['Admin'],
      summary: 'Update payout rates',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                coinToRupeeRate: { type: 'number', minimum: 0.01 },
                girlPayoutPercent: { type: 'number', minimum: 0, maximum: 100 },
                minWithdrawalAmount: { type: 'number', minimum: 0 },
                withdrawalFeePercent: { type: 'number', minimum: 0, maximum: 100 },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Rates updated' },
      },
    },
  },

  '/admin/sub-admins': {
    get: {
      tags: ['Admin'],
      summary: 'Get all sub-admins',
      responses: {
        200: { description: 'Sub-admins' },
      },
    },
    post: {
      tags: ['Admin'],
      summary: 'Create sub-admin',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['phone', 'email', 'name'],
              properties: {
                phone: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string', enum: ['ADMIN', 'MODERATOR'] },
                permissions: { type: 'object' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Sub-admin created' },
      },
    },
  },
};