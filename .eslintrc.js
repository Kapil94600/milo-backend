// ============================================
// ESLint Config — Bond Backend
// ============================================

module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: ['eslint:recommended'],
  rules: {
    // Possible errors
    'no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_|^next$|^req$|^res$',
        varsIgnorePattern: '^_',
      },
    ],
    'no-console': 'off', // Allow console for dev
    'no-undef': 'error',

    // Best practices
    eqeqeq: ['warn', 'smart'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-return-await': 'warn',

    // Style
    semi: ['warn', 'always'],
    quotes: ['warn', 'single', { avoidEscape: true }],
    indent: ['warn', 2, { SwitchCase: 1 }],
    'comma-dangle': ['warn', 'always-multiline'],
  },
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'dist/',
    'logs/',
    'uploads/',
    'prisma/migrations/',
  ],
};