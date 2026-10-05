// ============================================
// Jest Configuration — Bond
// ============================================

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Roots
  roots: ['<rootDir>/tests'],

  // Test pattern
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js',
  ],

  // Ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],

  // Coverage
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/docs/**',
    '!src/**/*.test.js',
    '!src/prisma/**',
  ],

  coverageDirectory: 'coverage',

  coverageReporters: ['text', 'lcov', 'html'],

  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },

  // Setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Timeouts
  testTimeout: 30000,

  // Verbose
  verbose: true,

  // Transform
  transform: {},

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,

  // Max workers
  maxWorkers: '50%',

  // Detect open handles
  detectOpenHandles: true,

  // Force exit after tests
  forceExit: true,
};