import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

// Simple in-memory cache implementation
interface CacheEntry {
    data: any;
    expiresAt: number;
}

class MemoryCache {
    private cache: Map<string, CacheEntry> = new Map();
    private defaultTTL: number = 300; // 5 minutes default

    constructor() {
        // Clean up expired entries every minute
        setInterval(() => this.cleanup(), 60000);
    }

    set(key: string, value: any, ttlSeconds?: number): void {
        const ttl = ttlSeconds || this.defaultTTL;
        this.cache.set(key, {
            data: value,
            expiresAt: Date.now() + ttl * 1000
        });
    }

    get(key: string): any | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    deleteByPattern(pattern: string): number {
        let deleted = 0;
        const regex = new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                deleted++;
            }
        }
        return deleted;
    }

    clear(): void {
        this.cache.clear();
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    getStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Export singleton instance
export const cache = new MemoryCache();

// Generate cache key from request
const generateCacheKey = (req: Request, prefix?: string): string => {
    const userId = (req as any).auth?.userId || 'anonymous';
    const baseKey = `${prefix || 'api'}:${req.method}:${req.originalUrl}`;

    // For user-specific routes, include userId in key
    if (req.originalUrl.includes('/user/') || req.originalUrl.includes('/appointments')) {
        return `${baseKey}:${userId}`;
    }

    return baseKey;
};

// Cache middleware options
interface CacheOptions {
    ttlSeconds?: number;
    prefix?: string;
    // Function to determine if response should be cached
    shouldCache?: (req: Request, res: Response) => boolean;
    // Whether to include user ID in cache key
    userSpecific?: boolean;
}

/**
 * Cache middleware for GET requests
 * @param options - Cache configuration options
 */
export const cacheMiddleware = (options: CacheOptions = {}) => {
    const {
        ttlSeconds = 300,
        prefix = 'api',
        shouldCache = () => true,
        userSpecific = false
    } = options;

    return (req: Request, res: Response, next: NextFunction) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        const cacheKey = userSpecific
            ? `${prefix}:${req.method}:${req.originalUrl}:${(req as any).auth?.userId || 'anon'}`
            : generateCacheKey(req, prefix);

        // Check if cached response exists
        const cachedResponse = cache.get(cacheKey);
        if (cachedResponse) {
            logger.debug(`Cache HIT: ${cacheKey}`);
            return res.status(200).json(cachedResponse);
        }

        logger.debug(`Cache MISS: ${cacheKey}`);

        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to cache response
        res.json = (body: any) => {
            // Only cache successful responses
            if (res.statusCode === 200 && shouldCache(req, res)) {
                cache.set(cacheKey, body, ttlSeconds);
                logger.debug(`Cached: ${cacheKey} (TTL: ${ttlSeconds}s)`);
            }
            return originalJson(body);
        };

        next();
    };
};

/**
 * Invalidate cache for specific patterns
 * Useful for invalidating cache after mutations
 */
export const invalidateCache = (patterns: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to invalidate cache after successful response
        res.json = (body: any) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                patterns.forEach(pattern => {
                    const deleted = cache.deleteByPattern(pattern);
                    if (deleted > 0) {
                        logger.debug(`Invalidated ${deleted} cache entries matching: ${pattern}`);
                    }
                });
            }
            return originalJson(body);
        };

        next();
    };
};

/**
 * Clear all cache entries
 */
export const clearCache = (req: Request, res: Response) => {
    cache.clear();
    res.status(200).json({
        success: true,
        message: 'Cache cleared successfully'
    });
};

/**
 * Get cache statistics
 */
export const getCacheStats = (req: Request, res: Response) => {
    const stats = cache.getStats();
    res.status(200).json({
        success: true,
        data: stats
    });
};

// Pre-configured cache middlewares for common use cases
export const cacheCategories = cacheMiddleware({ ttlSeconds: 3600, prefix: 'categories' }); // 1 hour
export const cacheServices = cacheMiddleware({ ttlSeconds: 1800, prefix: 'services' }); // 30 min
export const cacheVendors = cacheMiddleware({ ttlSeconds: 900, prefix: 'vendors' }); // 15 min
export const cacheVendorServices = cacheMiddleware({ ttlSeconds: 600, prefix: 'vendor-services' }); // 10 min
export const cacheUserData = cacheMiddleware({ ttlSeconds: 300, prefix: 'user', userSpecific: true }); // 5 min

// Cache invalidation patterns
export const invalidateCategoryCache = invalidateCache(['categories']);
export const invalidateServiceCache = invalidateCache(['services', 'vendor-services']);
export const invalidateVendorCache = invalidateCache(['vendors', 'vendor-services']);
export const invalidateAppointmentCache = invalidateCache(['appointments', 'user']);
