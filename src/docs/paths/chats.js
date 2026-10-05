// ============================================
// Swagger Paths — Chats
// ============================================

module.exports = {
  '/chats': {
    get: {
      tags: ['Chats'],
      summary: 'Get user chats',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        200: {
          description: 'Chats list',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Chat' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  '/chats/direct': {
    post: {
      tags: ['Chats'],
      summary: 'Create or get direct chat',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userId'],
              properties: { userId: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        201: { description: 'Chat ready' },
        403: { description: 'Blocked' },
      },
    },
  },

  '/chats/{chatId}/messages': {
    get: {
      tags: ['Chats'],
      summary: 'Get messages',
      parameters: [
        { name: 'chatId', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
      ],
      responses: {
        200: {
          description: 'Messages',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Message' },
                  },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['Chats'],
      summary: 'Send message',
      parameters: [
        { name: 'chatId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                content: { type: 'string' },
                type: { type: 'string', enum: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'GIF', 'FILE'] },
                mediaUrl: { type: 'string' },
                replyToId: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Message sent' },
        400: { description: 'Insufficient coins' },
      },
    },
  },

  '/chats/costs': {
    get: {
      tags: ['Chats'],
      summary: 'Get chat costs',
      responses: {
        200: {
          description: 'Costs',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      messageCost: { type: 'integer' },
                      mediaCost: { type: 'integer' },
                      girlEarningPercent: { type: 'integer' },
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

  '/chats/starred': {
    get: {
      tags: ['Chats'],
      summary: 'Get starred messages',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        200: { description: 'Starred messages' },
      },
    },
  },

  '/chats/messages/{messageId}/star': {
    post: {
      tags: ['Chats'],
      summary: 'Toggle star on message',
      parameters: [
        { name: 'messageId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Starred/unstarred' },
      },
    },
  },

  '/chats/messages/{messageId}/forward': {
    post: {
      tags: ['Chats'],
      summary: 'Forward message to chats',
      parameters: [
        { name: 'messageId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['targetChatIds'],
              properties: {
                targetChatIds: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Forwarded' },
      },
    },
  },

  '/chats/{chatId}/export': {
    get: {
      tags: ['Chats'],
      summary: 'Export chat as JSON',
      parameters: [
        { name: 'chatId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Chat exported' },
      },
    },
  },
};