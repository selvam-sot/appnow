import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter for general API requests
 * Allows 500 requests per 15 minutes per IP (increased for development)
 */
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 500, // Higher limit for development
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Stricter rate limiter for authentication endpoints
 * Allows 5 login attempts per 15 minutes per IP
 * Prevents brute-force attacks
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: {
        success: false,
        message: 'Too many login attempts from this IP, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count all requests
});

/**
 * Rate limiter for password reset/forgot password
 * Allows 3 attempts per hour per IP
 */
export const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 requests per hour
    message: {
        success: false,
        message: 'Too many password reset attempts, please try again after an hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for registration
 * Allows 10 registrations per hour per IP
 */
export const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 registrations per hour
    message: {
        success: false,
        message: 'Too many accounts created from this IP, please try again after an hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for payment endpoints
 * Allows 20 requests per minute per IP
 */
export const paymentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // Limit each IP to 20 requests per minute
    message: {
        success: false,
        message: 'Too many payment requests, please try again after a minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for sensitive operations (delete, bulk operations)
 * Allows 30 requests per 15 minutes per IP
 */
export const sensitiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests for this operation, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Dynamic rate limiter factory
 * Creates a custom rate limiter with specified parameters
 */
export const createRateLimiter = (
    windowMinutes: number,
    maxRequests: number,
    message?: string
) => {
    return rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        max: maxRequests,
        message: {
            success: false,
            message: message || `Too many requests, please try again after ${windowMinutes} minutes`
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
};
