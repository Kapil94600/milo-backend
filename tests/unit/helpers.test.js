// ============================================
// Unit Tests — Helpers
// ============================================

const helpers = require('../../src/utils/helpers');

describe('Helpers — Unit Tests', () => {
  // ==========================================
  // Phone Normalization
  // ==========================================
  describe('normalizePhone', () => {
    it('should remove non-digits', () => {
      expect(helpers.normalizePhone('987-654-3210')).toBe('9876543210');
    });

    it('should strip +91 country code', () => {
      expect(helpers.normalizePhone('+919876543210')).toBe('9876543210');
    });

    it('should strip 91 prefix', () => {
      expect(helpers.normalizePhone('919876543210')).toBe('9876543210');
    });

    it('should handle empty', () => {
      expect(helpers.normalizePhone('')).toBe('');
      expect(helpers.normalizePhone(null)).toBe('');
    });

    it('should keep 10-digit as-is', () => {
      expect(helpers.normalizePhone('9876543210')).toBe('9876543210');
    });
  });

  describe('isValidPhone', () => {
    it('should accept 10-digit Indian phone', () => {
      expect(helpers.isValidPhone('9876543210')).toBe(true);
    });

    it('should accept +91 format', () => {
      expect(helpers.isValidPhone('+919876543210')).toBe(true);
    });

    it('should reject short numbers', () => {
      expect(helpers.isValidPhone('12345')).toBe(false);
    });

    it('should reject empty', () => {
      expect(helpers.isValidPhone('')).toBe(false);
      expect(helpers.isValidPhone(null)).toBe(false);
    });

    it('should reject too long', () => {
      expect(helpers.isValidPhone('1234567890123456')).toBe(false);
    });
  });

  // ==========================================
  // OTP
  // ==========================================
  describe('generateOTP', () => {
    it('should generate 6-digit OTP by default', () => {
      const otp = helpers.generateOTP();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it('should generate custom length', () => {
      const otp = helpers.generateOTP(4);
      expect(otp).toHaveLength(4);
    });

    it('should generate different values', () => {
      const otps = new Set();
      for (let i = 0; i < 50; i++) otps.add(helpers.generateOTP());
      expect(otps.size).toBeGreaterThan(40);
    });
  });

  // ==========================================
  // Referral Code
  // ==========================================
  describe('generateReferralCode', () => {
    it('should generate code with name prefix', () => {
      const code = helpers.generateReferralCode('John');
      expect(code).toMatch(/^JOH/);
    });

    it('should pad short names', () => {
      const code = helpers.generateReferralCode('AB');
      expect(code).toMatch(/^ABX/);
    });

    it('should uppercase name', () => {
      const code = helpers.generateReferralCode('john');
      expect(code).toMatch(/^JOH/);
    });

    it('should generate unique codes', () => {
      const codes = new Set();
      for (let i = 0; i < 50; i++) {
        codes.add(helpers.generateReferralCode('X'));
      }
      expect(codes.size).toBeGreaterThan(45);
    });
  });

  // ==========================================
  // Pagination
  // ==========================================
  describe('getPagination', () => {
    it('should return defaults', () => {
      const result = helpers.getPagination({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(0);
    });

    it('should parse page and limit', () => {
      const result = helpers.getPagination({ page: '3', limit: '10' });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.skip).toBe(20);
    });

    it('should cap limit at 100', () => {
      const result = helpers.getPagination({ limit: '500' });
      expect(result.limit).toBe(100);
    });

    it('should floor page at 1', () => {
      const result = helpers.getPagination({ page: '0' });
      expect(result.page).toBe(1);
    });
  });

  describe('buildPagination', () => {
    it('should build pagination object', () => {
      const result = helpers.buildPagination(1, 20, 100);
      expect(result).toEqual({
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: false,
      });
    });

    it('should handle last page', () => {
      const result = helpers.buildPagination(5, 20, 100);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(true);
    });
  });

  // ==========================================
  // Date
  // ==========================================
  describe('addDays', () => {
    it('should add days correctly', () => {
      const base = new Date('2026-01-01');
      const result = helpers.addDays(base, 5);
      expect(result.toISOString().split('T')[0]).toBe('2026-01-06');
    });

    it('should handle negative days', () => {
      const base = new Date('2026-01-10');
      const result = helpers.addDays(base, -5);
      expect(result.toISOString().split('T')[0]).toBe('2026-01-05');
    });
  });

  // ==========================================
  // Round
  // ==========================================
  describe('round', () => {
    it('should round to 2 decimals', () => {
      expect(helpers.round(1.234, 2)).toBe(1.23);
      expect(helpers.round(1.235, 2)).toBe(1.24);
    });

    it('should round to 0 decimals', () => {
      expect(helpers.round(1.5, 0)).toBe(2);
    });
  });

  // ==========================================
  // Validation
  // ==========================================
  describe('isValidEmail', () => {
    it('should accept valid emails', () => {
      expect(helpers.isValidEmail('test@example.com')).toBe(true);
      expect(helpers.isValidEmail('a.b@c.co.in')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(helpers.isValidEmail('not-email')).toBe(false);
      expect(helpers.isValidEmail('@test.com')).toBe(false);
      expect(helpers.isValidEmail('')).toBe(false);
    });
  });

  // ==========================================
  // Object
  // ==========================================
  describe('pick', () => {
    it('should pick only allowed keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = helpers.pick(obj, ['a', 'c']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should skip undefined values', () => {
      const obj = { a: 1, b: undefined, c: 3 };
      const result = helpers.pick(obj, ['a', 'b', 'c']);
      expect(result).toEqual({ a: 1, c: 3 });
    });
  });

  describe('omit', () => {
    it('should omit keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = helpers.omit(obj, ['b']);
      expect(result).toEqual({ a: 1, c: 3 });
    });
  });

  // ==========================================
  // Sleep
  // ==========================================
  describe('sleep', () => {
    it('should sleep for given ms', async () => {
      const start = Date.now();
      await helpers.sleep(50);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(45);
    });
  });
});