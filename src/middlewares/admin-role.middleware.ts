import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError.util';

/**
 * Admin role hierarchy gate.
 *
 * - `super_admin` can do everything.
 * - `support_agent` can perform read + safe-support actions; sensitive
 *   destructive/financial actions (permanent deletes, unbounded credits)
 *   require super_admin.
 * - Legacy admin records without `adminRole` are treated as super_admin
 *   for backwards compatibility until migration is done.
 */

export const requireSuperAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user) return next(new AppError('Admin session required', 401));
  if (user.role !== 'admin') return next(new AppError('Admin role required', 403));

  const adminRole = user.adminRole;
  // Legacy admins with no sub-role default to super_admin
  if (!adminRole || adminRole === 'super_admin') return next();

  return next(new AppError('Super Admin permission required for this action', 403));
};

export const requireAdminRole = (
  ..._allowed: Array<'super_admin' | 'support_agent'>
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return next(new AppError('Admin session required', 401));
    if (user.role !== 'admin') return next(new AppError('Admin role required', 403));
    // Legacy admin without adminRole = super_admin
    const effective = user.adminRole || 'super_admin';
    if (_allowed.length === 0 || _allowed.includes(effective)) return next();
    return next(new AppError('Insufficient admin permissions for this action', 403));
  };
};
