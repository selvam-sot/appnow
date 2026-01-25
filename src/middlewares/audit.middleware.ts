import { Request, Response, NextFunction } from 'express';
import AuditLog from '../models/audit-log.model';
import logger from '../config/logger';

// Fields to exclude from request body logging (sensitive data)
const SENSITIVE_FIELDS = [
    'password',
    'confirmPassword',
    'currentPassword',
    'newPassword',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'cardNumber',
    'cvv',
    'cvc',
    'card_number',
    'exp_month',
    'exp_year'
];

// Paths to exclude from audit logging
const EXCLUDED_PATHS = [
    '/health',
    '/api-docs',
    '/swagger',
    '/favicon.ico'
];

/**
 * Sanitize request body by removing sensitive fields
 */
const sanitizeBody = (body: Record<string, any>): Record<string, any> => {
    if (!body || typeof body !== 'object') return {};

    const sanitized = { ...body };

    const recursiveSanitize = (obj: Record<string, any>) => {
        for (const key of Object.keys(obj)) {
            if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
                obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                recursiveSanitize(obj[key]);
            }
        }
    };

    recursiveSanitize(sanitized);
    return sanitized;
};

/**
 * Determine action type based on HTTP method
 */
const getActionType = (method: string, path: string): string => {
    // Check for specific paths first
    if (path.includes('/login') || path.includes('/signin')) return 'LOGIN';
    if (path.includes('/logout') || path.includes('/signout')) return 'LOGOUT';
    if (path.includes('/export')) return 'EXPORT';
    if (path.includes('/import')) return 'IMPORT';

    // Map HTTP methods to actions
    switch (method) {
        case 'POST':
            return 'CREATE';
        case 'GET':
            return 'READ';
        case 'PUT':
        case 'PATCH':
            return 'UPDATE';
        case 'DELETE':
            return 'DELETE';
        default:
            return 'OTHER';
    }
};

/**
 * Extract resource name from path
 */
const getResourceFromPath = (path: string): string => {
    // Remove query string
    const cleanPath = path.split('?')[0];

    // Remove /api/v1 or /api prefix
    const pathParts = cleanPath
        .replace(/^\/api\/v\d+\//, '')
        .replace(/^\/api\//, '')
        .split('/');

    // Get the resource name (first meaningful segment)
    const resource = pathParts.find(part =>
        part &&
        !part.match(/^[a-f0-9]{24}$/i) && // Exclude MongoDB ObjectIds
        !part.match(/^[\d]+$/)             // Exclude numeric IDs
    );

    return resource || 'unknown';
};

/**
 * Extract resource ID from path
 */
const getResourceIdFromPath = (path: string): string | undefined => {
    const cleanPath = path.split('?')[0];
    const parts = cleanPath.split('/');

    // Look for MongoDB ObjectId or numeric ID
    return parts.find(part =>
        part.match(/^[a-f0-9]{24}$/i) || // MongoDB ObjectId
        part.match(/^[\d]+$/)             // Numeric ID
    );
};

/**
 * Get client IP address
 */
const getClientIp = (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
};

interface AuditOptions {
    // Only log specific HTTP methods
    methods?: string[];
    // Only log specific resources
    resources?: string[];
    // Skip logging for successful requests
    errorsOnly?: boolean;
    // Log request body
    logBody?: boolean;
}

/**
 * Audit logging middleware
 */
export const auditMiddleware = (options: AuditOptions = {}) => {
    const {
        methods = ['POST', 'PUT', 'PATCH', 'DELETE'],
        resources = [],
        errorsOnly = false,
        logBody = true
    } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
        // Skip excluded paths
        if (EXCLUDED_PATHS.some(path => req.path.startsWith(path))) {
            return next();
        }

        // Skip if method not in filter
        if (methods.length > 0 && !methods.includes(req.method)) {
            return next();
        }

        const startTime = Date.now();
        const resource = getResourceFromPath(req.path);

        // Skip if resource not in filter
        if (resources.length > 0 && !resources.includes(resource)) {
            return next();
        }

        // Store original end method
        const originalEnd = res.end;

        // Override end method to capture response
        res.end = function (this: Response, chunk?: any, encoding?: any, callback?: any): Response {
            const responseTime = Date.now() - startTime;

            // Skip if errorsOnly and status is successful
            if (errorsOnly && res.statusCode < 400) {
                return originalEnd.call(this, chunk, encoding, callback);
            }

            // Create audit log entry asynchronously
            const auditEntry = {
                userId: (req as any).user?._id || (req as any).auth?.userId,
                userEmail: (req as any).user?.email,
                action: getActionType(req.method, req.path),
                resource,
                resourceId: getResourceIdFromPath(req.path),
                method: req.method,
                path: req.originalUrl || req.path,
                statusCode: res.statusCode,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'],
                requestBody: logBody ? sanitizeBody(req.body) : undefined,
                responseTime,
                error: res.statusCode >= 400 ? (res as any).errorMessage : undefined,
                metadata: {
                    contentType: req.headers['content-type'],
                    contentLength: req.headers['content-length']
                }
            };

            // Save asynchronously without blocking response
            AuditLog.create(auditEntry).catch(err => {
                logger.error(`Failed to create audit log: ${err.message}`);
            });

            return originalEnd.call(this, chunk, encoding, callback);
        };

        next();
    };
};

/**
 * Log a custom audit event
 */
export const logAuditEvent = async (
    action: string,
    resource: string,
    details: {
        userId?: string;
        userEmail?: string;
        resourceId?: string;
        metadata?: Record<string, any>;
        error?: string;
    }
): Promise<void> => {
    try {
        await AuditLog.create({
            userId: details.userId,
            userEmail: details.userEmail,
            action,
            resource,
            resourceId: details.resourceId,
            method: 'OTHER' as any,
            path: `/${resource}`,
            statusCode: details.error ? 500 : 200,
            responseTime: 0,
            error: details.error,
            metadata: details.metadata
        });
    } catch (err: any) {
        logger.error(`Failed to log audit event: ${err.message}`);
    }
};

// Pre-configured audit middlewares
export const auditAllMutations = auditMiddleware({
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    logBody: true
});

export const auditErrors = auditMiddleware({
    errorsOnly: true,
    logBody: true
});

export const auditAdmin = auditMiddleware({
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    logBody: true
});
