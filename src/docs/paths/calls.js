// ============================================
// Swagger Paths — Calls
// ============================================

module.exports = {
  '/calls/initiate': {
    post: {
      tags: ['Calls'],
      summary: 'Initiate call',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['receiverId'],
              properties: {
                receiverId: { type: 'string' },
                type: { type: 'string', enum: ['VOICE', 'VIDEO'], default: 'VOICE' },
                quality: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Call initiated' },
        400: { description: 'Insufficient coins or video gate' },
        409: { description: 'User already in call' },
      },
    },
  },

  '/calls/history': {
    get: {
      tags: ['Calls'],
      summary: 'Get call history',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['VOICE', 'VIDEO'] } },
        { name: 'status', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Call history' },
      },
    },
  },

  '/calls/rates': {
    get: {
      tags: ['Calls'],
      summary: 'Get call rates',
      responses: {
        200: { description: 'Rates fetched' },
      },
    },
  },

  '/calls/video-eligibility': {
    get: {
      tags: ['Calls'],
      summary: 'Check video call eligibility',
      responses: {
        200: { description: 'Eligibility checked' },
      },
    },
  },

  '/calls/{callId}/accept': {
    put: {
      tags: ['Calls'],
      summary: 'Accept call',
      parameters: [
        { name: 'callId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Call accepted' },
      },
    },
  },

  '/calls/{callId}/reject': {
    put: {
      tags: ['Calls'],
      summary: 'Reject call',
      parameters: [
        { name: 'callId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Call rejected' },
      },
    },
  },

  '/calls/{callId}/end': {
    put: {
      tags: ['Calls'],
      summary: 'End call',
      parameters: [
        { name: 'callId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Call ended and billed' },
      },
    },
  },

  '/calls/admin/all': {
    get: {
      tags: ['Calls'],
      summary: 'Get all calls (admin)',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'type', in: 'query', schema: { type: 'string' } },
        { name: 'status', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'All calls' },
        403: { $ref: '#/components/responses/ForbiddenError' },
      },
    },
  },
};