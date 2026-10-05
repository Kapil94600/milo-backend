// ============================================
// Test Auth Helpers — Bond
// ============================================

const jwt = require('jsonwebtoken');
const config = require('../../src/config');

/**
 * Generate a test JWT token for a user
 */
const generateTestToken = (user, expiresIn = '1h') => {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
    },
    config.JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Generate both access and refresh tokens
 */
const generateTestTokens = (user) => {
  const accessToken = jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
    },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    config.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

/**
 * Create Bearer auth header
 */
const authHeader = (token) => ({
  Authorization: `Bearer ${token}`,
});

/**
 * Create auth header for a user
 */
const userAuthHeader = (user) => {
  const token = generateTestToken(user);
  return authHeader(token);
};

/**
 * Generate an expired token (for testing)
 */
const generateExpiredToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
    },
    config.JWT_SECRET,
    { expiresIn: '-1h' }
  );
};

/**
 * Generate invalid token
 */
const generateInvalidToken = () => {
  return jwt.sign(
    { id: 'fake-id', phone: '0000000000', role: 'USER' },
    'wrong-secret',
    { expiresIn: '1h' }
  );
};

/**
 * Mock an authenticated user for middleware tests
 */
const mockUser = (overrides = {}) => ({
  id: overrides.id || 'user-test-id',
  _id: overrides.id || 'user-test-id',
  phone: overrides.phone || '9876543210',
  name: overrides.name || 'Test User',
  email: overrides.email || 'test@bond.test',
  role: overrides.role || 'USER',
  status: overrides.status || 'ACTIVE',
  isActive: overrides.isActive ?? true,
  isVerified: overrides.isVerified ?? true,
  ...overrides,
});

/**
 * Mock Express request with user
 */
const mockRequest = (user = null, overrides = {}) => ({
  user,
  headers: {},
  params: {},
  query: {},
  body: {},
  ip: '127.0.0.1',
  ...overrides,
});

/**
 * Mock Express response
 */
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Mock Express next
 */
const mockNext = () => jest.fn();

module.exports = {
  generateTestToken,
  generateTestTokens,
  authHeader,
  userAuthHeader,
  generateExpiredToken,
  generateInvalidToken,
  mockUser,
  mockRequest,
  mockResponse,
  mockNext,
};