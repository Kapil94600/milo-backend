// ============================================
// Integration Tests — Auth
// ============================================

const request = require('supertest');
const app = require('../../src/app');
const {
  cleanDatabase,
  createTestUser,
} = require('../helpers/db');

describe('Auth — Integration Tests', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  // ==========================================
  // POST /api/auth/request-otp
  // ==========================================
  describe('POST /api/auth/request-otp', () => {
    it('should request OTP for valid phone', async () => {
      const res = await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: '9876543210' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('expiresIn');
    });

    it('should reject invalid phone', async () => {
      const res = await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: '123' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing phone', async () => {
      const res = await request(app)
        .post('/api/auth/request-otp')
        .send({});

      expect(res.status).toBe(422);
    });
  });

  // ==========================================
  // POST /api/auth/verify-otp
  // ==========================================
  describe('POST /api/auth/verify-otp', () => {
    it('should reject invalid OTP', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: '9876543210', otp: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject malformed OTP', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: '9876543210', otp: 'abc' });

      expect(res.status).toBe(422);
    });
  });

  // ==========================================
  // POST /api/auth/firebase-login
  // ==========================================
  describe('POST /api/auth/firebase-login', () => {
    it('should reject missing idToken', async () => {
      const res = await request(app)
        .post('/api/auth/firebase-login')
        .send({});

      expect(res.status).toBe(422);
    });

    it('should reject invalid idToken', async () => {
      const res = await request(app)
        .post('/api/auth/firebase-login')
        .send({ idToken: 'invalid-token' });

      // Either 400 or 401 depending on Firebase availability
      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // GET /api/auth/me
  // ==========================================
  describe('GET /api/auth/me', () => {
    it('should reject without token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // POST /api/auth/refresh-token
  // ==========================================
  describe('POST /api/auth/refresh-token', () => {
    it('should reject missing refreshToken', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({});

      expect(res.status).toBe(422);
    });

    it('should reject invalid refreshToken', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // GET /health
  // ==========================================
  describe('GET /health', () => {
    it('should return 200 with health info', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status', 'OK');
      expect(res.body.data).toHaveProperty('database');
    });
  });

  // ==========================================
  // 404
  // ==========================================
  describe('404 Handler', () => {
    it('should return 404 for unknown route', async () => {
      const res = await request(app).get('/api/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // Rate Limiting
  // ==========================================
  describe('Rate Limiting', () => {
    it('should allow requests under limit', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });
  });
});