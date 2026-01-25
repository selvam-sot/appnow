import { Request, Response, NextFunction } from 'express';

/**
 * Recursively sanitizes an object by removing dangerous characters
 * Prevents XSS attacks by escaping HTML entities
 */
function sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
        // Escape HTML entities to prevent XSS
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            // Remove null bytes
            .replace(/\0/g, '')
            // Trim whitespace
            .trim();
    }

    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }

    if (value && typeof value === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            // Skip keys that start with $ (MongoDB operators) - handled by mongo-sanitize
            if (!key.startsWith('$')) {
                sanitized[key] = sanitizeValue(val);
            }
        }
        return sanitized;
    }

    return value;
}

/**
 * Light sanitization - only removes dangerous MongoDB operators
 * Use this for fields that should allow HTML (like rich text)
 */
function sanitizeMongoOperators(value: unknown): unknown {
    if (typeof value === 'string') {
        // Only remove null bytes and trim
        return value.replace(/\0/g, '').trim();
    }

    if (Array.isArray(value)) {
        return value.map(sanitizeMongoOperators);
    }

    if (value && typeof value === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            // Remove keys that start with $ (MongoDB operators)
            if (!key.startsWith('$') && !key.includes('.')) {
                sanitized[key] = sanitizeMongoOperators(val);
            }
        }
        return sanitized;
    }

    return value;
}

/**
 * XSS Sanitization middleware
 * Sanitizes request body, query, and params to prevent XSS attacks
 */
export const xssSanitize = (req: Request, res: Response, next: NextFunction) => {
    if (req.body) {
        req.body = sanitizeValue(req.body);
    }

    if (req.query) {
        req.query = sanitizeValue(req.query) as typeof req.query;
    }

    if (req.params) {
        req.params = sanitizeValue(req.params) as typeof req.params;
    }

    next();
};

/**
 * Light sanitization middleware
 * Only removes MongoDB operators, allows HTML content
 * Use for routes that handle rich text content
 */
export const lightSanitize = (req: Request, res: Response, next: NextFunction) => {
    if (req.body) {
        req.body = sanitizeMongoOperators(req.body);
    }

    if (req.query) {
        req.query = sanitizeMongoOperators(req.query) as typeof req.query;
    }

    if (req.params) {
        req.params = sanitizeMongoOperators(req.params) as typeof req.params;
    }

    next();
};

/**
 * Validate and sanitize email format
 */
export const sanitizeEmail = (email: string): string => {
    if (!email || typeof email !== 'string') return '';

    // Basic email sanitization
    return email
        .toLowerCase()
        .trim()
        .replace(/[<>'"]/g, '');
};

/**
 * Validate and sanitize phone number
 */
export const sanitizePhone = (phone: string): string => {
    if (!phone || typeof phone !== 'string') return '';

    // Keep only digits, +, -, (), and spaces
    return phone
        .replace(/[^0-9+\-() ]/g, '')
        .trim();
};

/**
 * Validate and sanitize URL
 */
export const sanitizeUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return '';

    // Basic URL sanitization - remove javascript: and data: schemes
    const trimmed = url.trim();
    if (
        trimmed.toLowerCase().startsWith('javascript:') ||
        trimmed.toLowerCase().startsWith('data:') ||
        trimmed.toLowerCase().startsWith('vbscript:')
    ) {
        return '';
    }

    return trimmed;
};

/**
 * Validate ObjectId format (MongoDB)
 */
export const isValidObjectId = (id: string): boolean => {
    return /^[a-fA-F0-9]{24}$/.test(id);
};

/**
 * Middleware to validate MongoDB ObjectId in params
 */
export const validateObjectId = (paramName: string = 'id') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const id = req.params[paramName];

        if (id && !isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: `Invalid ${paramName} format`
            });
        }

        next();
    };
};
