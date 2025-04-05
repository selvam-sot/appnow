import { Request, Response, NextFunction } from 'express';
import { getTokenFromRequest, verifyToken } from '../utils/jwt.util';
import { AppError } from '../utils/appError.util';
import User from './../models/user.model';
import { asyncHandler } from '../utils/asyncHandler.util';
import { IUser } from '../interfaces/user.interface';

// Delete the global declaration since it's already declared in jwt.util.ts

// Middleware to protect routes
export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    const decoded: any = verifyToken(token);

    const currentUser = await User.findById(decoded.userId);
    if (!currentUser) {
        return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (currentUser.tokenVersion !== decoded.tokenVersion) {
        return next(new AppError('Invalid token. Please log in again!', 401));
    }

    if (currentUser.changedPasswordAfter(decoded?.iat)) {
        return next(new AppError('User recently changed password! Please log in again.', 401));
    }

    // Assign full user document to req.user
    req.user = currentUser;
    next();
});

// Middleware to authorize based on roles
export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new AppError('Not authorized', 401));
        }
        
        if (!roles.includes(req.user.role)) {
            return next(new AppError('Not authorized to access this route', 403));
        }
        
        next();
    };
};

// General authentication middleware
export const auth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = getTokenFromRequest(req);

        if (token) {
            const decoded = verifyToken(token);
            const user = await User.findById(decoded.userId).select('-password');
            
            if (user) {
                req.user = user;
            }
        }

        next();
    } catch (error: any) {
        // If there's an error decoding the token, we just move on without setting the user
        next();
    }
};