import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import User from '../models/user.model';
import { logAuditEvent } from '../middlewares/audit.middleware';
import logger from '../config/logger';

/**
 * User impersonation for support agents.
 *
 * Flow:
 *   1. Admin calls POST /admin/users/:targetId/impersonate/start with a
 *      reason. Server verifies admin, mints a short-lived impersonation
 *      JWT (30 min TTL) that names both the admin and the target user,
 *      and logs an IMPERSONATE_START audit event.
 *   2. Admin app forwards the token as `x-impersonation-token` on
 *      subsequent requests. `resolveImpersonation` middleware verifies
 *      the token and exposes `req.impersonation`.
 *   3. Admin calls POST /admin/users/impersonate/end to log an
 *      IMPERSONATE_END audit event. The token still expires on its own
 *      after 30 min if the admin forgets.
 *
 * Every action taken while impersonating remains attributable via the
 * audit-log middleware (the admin's userId, plus the impersonated user
 * in metadata) — nothing looks like it was done by the customer.
 */

const IMPERSONATION_TTL_SECONDS = 30 * 60;

interface ImpersonationPayload {
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetEmail: string;
  reason: string;
  iat?: number;
  exp?: number;
}

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return process.env.JWT_SECRET;
};

/** POST /admin/users/:targetId/impersonate/start */
export const startImpersonation = asyncHandler(async (req: Request, res: Response) => {
  const admin = (req as any).user;
  if (!admin?._id) throw new AppError('Admin session required', 401);

  const { targetId } = req.params;
  const { reason } = req.body as { reason?: string };
  if (!reason || reason.trim().length < 5) {
    throw new AppError('A reason of at least 5 characters is required', 400);
  }

  const target = await User.findById(targetId).select('email name role');
  if (!target) throw new AppError('Target user not found', 404);
  if (target.role === 'admin' || target.role === 'super_admin') {
    throw new AppError('Cannot impersonate another admin', 403);
  }

  const payload: ImpersonationPayload = {
    adminId: String(admin._id),
    adminEmail: admin.email,
    targetUserId: String(target._id),
    targetEmail: target.email,
    reason: reason.trim(),
  };

  const token = jwt.sign(payload, secret(), { expiresIn: IMPERSONATION_TTL_SECONDS });
  const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_SECONDS * 1000);

  await logAuditEvent('IMPERSONATE_START', 'user', {
    userId: String(admin._id),
    userEmail: admin.email,
    resourceId: String(target._id),
    metadata: {
      targetEmail: target.email,
      targetRole: target.role,
      adminRole: admin.adminRole || 'super_admin', // legacy admins default to super_admin
      reason: reason.trim(),
      ttlSeconds: IMPERSONATION_TTL_SECONDS,
    },
  });

  logger.info(
    `[Impersonation] admin ${admin.email} → user ${target.email} (reason: ${reason.trim()})`,
  );

  res.status(200).json({
    success: true,
    data: {
      impersonationToken: token,
      expiresAt,
      target: {
        _id: target._id,
        email: target.email,
        name: (target as any).name,
      },
    },
  });
});

/** POST /admin/users/impersonate/end */
export const endImpersonation = asyncHandler(async (req: Request, res: Response) => {
  const admin = (req as any).user;
  if (!admin?._id) throw new AppError('Admin session required', 401);

  const { targetUserId } = req.body as { targetUserId?: string };

  await logAuditEvent('IMPERSONATE_END', 'user', {
    userId: String(admin._id),
    userEmail: admin.email,
    resourceId: targetUserId,
    metadata: { targetUserId },
  });

  res.status(200).json({ success: true, message: 'Impersonation ended' });
});

/**
 * Middleware — if `x-impersonation-token` header is present, verify it
 * and expose `req.impersonation` so downstream code can either honour it
 * (act as the target user) or refuse it (write endpoints may choose to
 * reject impersonated writes).
 */
export const resolveImpersonation = (req: Request, res: Response, next: () => void) => {
  const token = req.headers['x-impersonation-token'] as string | undefined;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, secret()) as ImpersonationPayload;
    (req as any).impersonation = decoded;
  } catch (err: any) {
    logger.warn(`[Impersonation] invalid token: ${err.message}`);
  }

  next();
};
