import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './appError.util';
import { IUser } from '../interfaces/user.interface';

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: IUser | null;
    }
  }
}

// Interface for the payload of our JWT
interface JwtPayload {
    userId: string;
    tokenVersion: number;
    role: string;
    iat?: number;
}

// Create a custom sign function to work around type issues
const customSign = (
  payload: object, 
  secret: string, 
  options?: { expiresIn?: string | number }
): string => {
  // This is a manual wrapper around jwt.sign to bypass TypeScript errors
  return jwt.sign(payload, secret, options as any);
};

// Function to generate a JWT
export const generateToken = (userId: string, role: string): string => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET environment variable is not set");
    }
    
    return customSign(
        { userId, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );
};

// Function to verify a JWT
export const verifyToken = (token: string): JwtPayload => {
    try {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET environment variable is not set");
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET as any) as JwtPayload;
        return decoded;
    } catch (error: any) {
        throw new AppError('Invalid token', 401);
    }
};

// Function to set JWT in cookie
export const setTokenCookie = (res: Response, token: string): void => {
    const cookieOptions = {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const
    };

    res.cookie('jwt', token, cookieOptions);
};

// Function to clear JWT cookie
export const clearTokenCookie = (res: Response): void => {
    res.cookie('jwt', 'none', {
        expires: new Date(Date.now() + 5 * 1000), // 5 seconds
        httpOnly: true
    });
};

// Function to get JWT from request
export const getTokenFromRequest = (req: Request): string | null => {
    let token: string | null = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        // Get token from Bearer token in header
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        // Get token from cookie
        token = req.cookies.jwt;
    }

    return token;
};

// Function to extract user data from token
export const extractUserFromToken = (token: string): { userId: string; role: string } => {
    const decoded = verifyToken(token);
    return { userId: decoded.userId, role: decoded.role };
};

// Middleware to attach user to request if JWT is valid
export const attachUserToRequest = (req: Request, res: Response, next: NextFunction): void => {
    const token = getTokenFromRequest(req);

    if (token) {
        try {
            const decoded = verifyToken(token);
            // Only attach the userId and role - not a full user object
            (req as any).userData = { id: decoded.userId, role: decoded.role };
        } catch (error: any) {
            // If token is invalid, we don't throw an error, we just don't attach the user
        }
    }

    next();
};

// Function to refresh JWT
export const refreshToken = (oldToken: string): string => {
    const decoded = verifyToken(oldToken);
    return generateToken(decoded.userId, decoded.role);
};

// Function to sign JWT with token version
export const signToken = (userId: string, role: string, tokenVersion: number): string => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET environment variable is not set");
    }
    
    return customSign(
        { userId, role, tokenVersion },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
};