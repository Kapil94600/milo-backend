// ============================================
// Swagger Paths — Notifications
// ============================================

module.exports = {
  '/notifications': {
    get: {
      tags: ['Notifications'],
      summary: 'Get my notifications',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        200: { description: 'Notifications' },
      },
    },
  },

  '/notifications/unread/count': {
    get: {
      tags: ['Notifications'],
      summary: 'Get unread count',
      responses: {
        200: { description: 'Count' },
      },
    },
  },

  '/notifications/read-all': {
    put: {
      tags: ['Notifications'],
      summary: 'Mark all as read',
      responses: {
        200: { description: 'All read' },
      },
    },
  },

  '/notifications/admin/send': {
    post: {
      tags: ['Notifications'],
      summary: 'Admin: send to single user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userId', 'title', 'body'],
              properties: {
                userId: { type: 'string' },
                title: { type: 'string' },
                body: { type: 'string' },
                type: { type: 'string' },
                priority: { type: 'string' },
                channel: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Sent' },
      },
    },
  },

  '/notifications/admin/broadcast': {
    post: {
      tags: ['Notifications'],
      summary: 'Admin: broadcast notification',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title', 'body'],
              properties: {
                role: { type: 'string', enum: ['USER', 'GIRL', 'ADMIN'] },
                title: { type: 'string' },
                body: { type: 'string' },
                image: { type: 'string' },
                priority: { type: 'string' },
                channel: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Broadcast sent' },
      },
    },
  },

  '/notifications/admin/schedule': {
    post: {
      tags: ['Notifications'],
      summary: 'Admin: schedule notification',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title', 'body', 'scheduledAt'],
              properties: {
                userIds: { type: 'array', items: { type: 'string' } },
                role: { type: 'string', enum: ['USER', 'GIRL', 'ADMIN'] },
                title: { type: 'string' },
                body: { type: 'string' },
                type: { type: 'string' },
                priority: { type: 'string' },
                channel: { type: 'string' },
                scheduledAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Scheduled' },
      },
    },
  },

  '/notifications/admin/scheduled': {
    get: {
      tags: ['Notifications'],
      summary: 'Admin: list scheduled',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'status', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Scheduled list' },
      },
    },
  },

  '/notifications/admin/history': {
    get: {
      tags: ['Notifications'],
      summary: 'Admin: notification history',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'type', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'History' },
      },
    },
  },
};