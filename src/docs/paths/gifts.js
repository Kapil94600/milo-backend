// ============================================
// Swagger Paths — Gifts
// ============================================

module.exports = {
  '/gifts/active': {
    get: {
      tags: ['Gifts'],
      summary: 'Get active gifts',
      security: [],
      parameters: [
        { name: 'category', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Active gifts',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { $ref: '#/components/schemas/Gift' } },
                },
              },
            },
          },
        },
      },
    },
  },

  '/gifts/send': {
    post: {
      tags: ['Gifts'],
      summary: 'Send gift',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['receiverId', 'giftId'],
              properties: {
                receiverId: { type: 'string' },
                giftId: { type: 'string' },
                message: { type: 'string', maxLength: 200 },
                isAnonymous: { type: 'boolean', default: false },
                chatId: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Gift sent' },
        400: { description: 'Insufficient coins' },
      },
    },
  },

  '/gifts/unread/count': {
    get: {
      tags: ['Gifts'],
      summary: 'Get unread gift count',
      responses: {
        200: { description: 'Count' },
      },
    },
  },

  '/gifts/transactions': {
    get: {
      tags: ['Gifts'],
      summary: 'Get my gift transactions',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['sent', 'received'] } },
      ],
      responses: {
        200: { description: 'Transactions' },
      },
    },
  },
};