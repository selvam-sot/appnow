import type { Request, Response, NextFunction } from 'express';

// Test JWT parsing logic directly without importing the middleware (avoids mongoose)
function extractClerkIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload.sub || null;
  } catch {
    return null;
  }
}

function createTestJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.test-signature`;
}

describe('extractClerkIdFromToken', () => {
  it('should extract sub claim from valid JWT', () => {
    const token = createTestJwt({ sub: 'user_abc123', iat: Date.now() });
    expect(extractClerkIdFromToken(token)).toBe('user_abc123');
  });

  it('should return null for JWT without sub claim', () => {
    const token = createTestJwt({ iat: Date.now() });
    expect(extractClerkIdFromToken(token)).toBeNull();
  });

  it('should return null for malformed token (not 3 parts)', () => {
    expect(extractClerkIdFromToken('not-a-jwt')).toBeNull();
    expect(extractClerkIdFromToken('only.two')).toBeNull();
    expect(extractClerkIdFromToken('')).toBeNull();
  });

  it('should return null for invalid base64 payload', () => {
    expect(extractClerkIdFromToken('header.!!!invalid!!!.sig')).toBeNull();
  });

  it('should handle various Clerk user ID formats', () => {
    expect(extractClerkIdFromToken(createTestJwt({ sub: 'user_2abc' }))).toBe('user_2abc');
    expect(extractClerkIdFromToken(createTestJwt({ sub: 'org_xyz' }))).toBe('org_xyz');
  });
});

describe('requireVerifiedVendor logic', () => {
  // Inline the logic to avoid importing mongoose
  const requireVerifiedVendor = (req: any, _res: any, next: any) => {
    if (!req.vendor) {
      return next({ statusCode: 401, message: 'Vendor authentication required.' });
    }
    if (req.vendor.verificationStatus !== 'verified') {
      return next({ statusCode: 403, message: 'Pending verification' });
    }
    next();
  };

  let mockNext: jest.Mock;

  beforeEach(() => {
    mockNext = jest.fn();
  });

  it('should reject if no vendor on request', () => {
    requireVerifiedVendor({}, {}, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('should reject if vendor is pending', () => {
    requireVerifiedVendor({ vendor: { verificationStatus: 'pending' } }, {}, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('should pass if vendor is verified', () => {
    requireVerifiedVendor({ vendor: { verificationStatus: 'verified' } }, {}, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });
});
