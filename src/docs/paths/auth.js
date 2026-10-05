// ============================================
// Swagger Paths — Auth
// ============================================

module.exports = {
  // ============================================
  // Firebase Login
  // ============================================
  '/auth/firebase-login': {
    post: {
      tags: ['Auth'],
      summary: 'Login with Firebase phone auth',
      description: 'Send Firebase ID token, receive JWT tokens',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['idToken'],
              properties: {
                idToken: { type: 'string', description: 'Firebase ID token' },
                deviceInfo: {
                  type: 'object',
                  properties: {
                    deviceId: { type: 'string' },
                    platform: { type: 'string', enum: ['ios', 'android', 'web', 'unknown'] },
                    version: { type: 'string' },
                    model: { type: 'string' },
                    fcmToken: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      user: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                      isNewUser: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        429: { description: 'Rate limit exceeded or account locked' },
      },
    },
  },

  // ============================================
  // Request OTP (legacy)
  // ============================================
  '/auth/request-otp': {
    post: {
      tags: ['Auth'],
      summary: 'Request OTP (legacy MSG91)',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['phone'],
              properties: {
                phone: { type: 'string', example: '9876543210' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'OTP sent',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessResponse' },
            },
          },
        },
        429: { description: 'Too many OTP requests' },
      },
    },
  },

  // ============================================
  // Verify OTP (legacy)
  // ============================================
  '/auth/verify-otp': {
    post: {
      tags: ['Auth'],
      summary: 'Verify OTP (legacy MSG91)',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['phone', 'otp'],
              properties: {
                phone: { type: 'string' },
                otp: { type: 'string', example: '123456' },
                deviceInfo: { type: 'object' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Login successful' },
        400: { description: 'Invalid OTP' },
        429: { description: 'Account locked' },
      },
    },
  },

  // ============================================
  // Refresh Token
  // ============================================
  '/auth/refresh-token': {
    post: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['refreshToken'],
              properties: {
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'New tokens',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/AuthTokens' },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
      },
    },
  },

  // ============================================
  // Logout
  // ============================================
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Logout current device',
      responses: {
        200: { description: 'Logged out' },
        401: { $ref: '#/components/responses/UnauthorizedError' },
      },
    },
  },

  '/auth/logout-all': {
    post: {
      tags: ['Auth'],
      summary: 'Logout from all devices',
      responses: {
        200: { description: 'Logged out from all devices' },
        401: { $ref: '#/components/responses/UnauthorizedError' },
      },
    },
  },

  // ============================================
  // Create Admin (with secret key)
  // ============================================
  '/auth/create-admin': {
    post: {
      tags: ['Auth'],
      summary: 'Create admin (requires secret key)',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['phone', 'email', 'name', 'secretKey'],
              properties: {
                phone: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                secretKey: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Admin created' },
        403: { description: 'Invalid secret key' },
        409: { description: 'User already exists' },
      },
    },
  },

  // ============================================
  // Me
  // ============================================
  '/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Get current user profile',
      responses: {
        200: {
          description: 'Current user',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
      },
    },
  },
};