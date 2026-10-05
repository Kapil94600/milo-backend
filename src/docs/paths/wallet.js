// ============================================
// Swagger Paths — Wallet
// ============================================

module.exports = {
  '/wallet': {
    get: {
      tags: ['Wallet'],
      summary: 'Get my wallet',
      responses: {
        200: {
          description: 'Wallet',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { data: { $ref: '#/components/schemas/Wallet' } },
              },
            },
          },
        },
      },
    },
  },

  '/wallet/transactions': {
    get: {
      tags: ['Wallet'],
      summary: 'Get my transactions',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['CREDIT', 'DEBIT'] } },
        { name: 'category', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Transactions' },
      },
    },
  },

  '/wallet/withdraw': {
    post: {
      tags: ['Wallet'],
      summary: 'Request withdrawal',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'method'],
              properties: {
                amount: { type: 'number', minimum: 100 },
                method: { type: 'string', enum: ['BANK', 'UPI', 'PAYPAL'] },
                accountName: { type: 'string' },
                accountNumber: { type: 'string' },
                ifscCode: { type: 'string' },
                upiId: { type: 'string' },
                bankName: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Withdrawal requested' },
        400: { description: 'Insufficient balance or below min' },
      },
    },
  },

  '/wallet/coin-packages': {
    get: {
      tags: ['Wallet'],
      summary: 'Get coin packages',
      responses: {
        200: { description: 'Coin packages' },
      },
    },
  },

  '/wallet/admin/add-coins': {
    post: {
      tags: ['Wallet'],
      summary: 'Admin: add coins to user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userId', 'coins'],
              properties: {
                userId: { type: 'string' },
                coins: { type: 'integer', minimum: 1 },
                reason: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Coins added' },
      },
    },
  },

  '/wallet/admin/withdrawals': {
    get: {
      tags: ['Wallet'],
      summary: 'Admin: get all withdrawals',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'status', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Withdrawals' },
      },
    },
  },

  '/wallet/admin/withdrawals/{id}': {
    put: {
      tags: ['Wallet'],
      summary: 'Admin: process withdrawal',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['status'],
              properties: {
                status: { type: 'string', enum: ['APPROVED', 'REJECTED', 'COMPLETED'] },
                failureReason: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Withdrawal processed' },
      },
    },
  },
};