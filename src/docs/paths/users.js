// ============================================
// Swagger Paths — Users
// ============================================

module.exports = {
  '/users/profile': {
    get: {
      tags: ['Users'],
      summary: 'Get own profile',
      responses: {
        200: {
          description: 'User profile',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { data: { $ref: '#/components/schemas/User' } },
              },
            },
          },
        },
      },
    },
    put: {
      tags: ['Users'],
      summary: 'Update own profile',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                bio: { type: 'string' },
                city: { type: 'string' },
                profileImageFile: { type: 'string', format: 'binary' },
                coverImageFile: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Profile updated' },
      },
    },
  },

  '/users/search': {
    get: {
      tags: ['Users'],
      summary: 'Search users',
      parameters: [
        { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
      ],
      responses: {
        200: {
          description: 'Search results',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  '/users/preferences': {
    get: {
      tags: ['Users'],
      summary: 'Get user preferences',
      responses: {
        200: { description: 'Preferences' },
      },
    },
    put: {
      tags: ['Users'],
      summary: 'Update preferences',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                language: { type: 'string' },
                darkMode: { type: 'boolean' },
                notificationPreferences: {
                  type: 'object',
                  properties: {
                    chat: { type: 'boolean' },
                    calls: { type: 'boolean' },
                    coins: { type: 'boolean' },
                    system: { type: 'boolean' },
                    marketing: { type: 'boolean' },
                  },
                },
                privacyPreferences: {
                  type: 'object',
                  properties: {
                    showOnline: { type: 'boolean' },
                    showLastSeen: { type: 'boolean' },
                    allowCalls: { type: 'boolean' },
                    allowMessages: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Preferences updated' },
      },
    },
    delete: {
      tags: ['Users'],
      summary: 'Reset preferences to defaults',
      responses: {
        200: { description: 'Preferences reset' },
      },
    },
  },

  '/users/stats': {
    get: {
      tags: ['Users'],
      summary: 'Get user stats',
      responses: {
        200: { description: 'Stats fetched' },
      },
    },
  },

  '/users/{id}': {
    get: {
      tags: ['Users'],
      summary: 'Get user by ID (public profile)',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'User fetched' },
        404: { $ref: '#/components/responses/NotFoundError' },
      },
    },
  },
};