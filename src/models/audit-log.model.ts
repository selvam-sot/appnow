import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog {
    userId?: mongoose.Types.ObjectId;
    userEmail?: string;
    action: string;
    resource: string;
    resourceId?: string;
    method: string;
    path: string;
    statusCode: number;
    ipAddress?: string;
    userAgent?: string;
    requestBody?: Record<string, any>;
    responseTime: number;
    error?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}

const AuditLogSchema: Schema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    userEmail: {
        type: String,
        index: true
    },
    action: {
        type: String,
        required: true,
        enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'OTHER'],
        index: true
    },
    resource: {
        type: String,
        required: true,
        index: true
    },
    resourceId: {
        type: String
    },
    method: {
        type: String,
        required: true,
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    },
    path: {
        type: String,
        required: true
    },
    statusCode: {
        type: Number,
        required: true
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    requestBody: {
        type: Schema.Types.Mixed
    },
    responseTime: {
        type: Number,
        required: true
    },
    error: {
        type: String
    },
    metadata: {
        type: Schema.Types.Mixed
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Compound indexes for common queries
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, action: 1, createdAt: -1 });
AuditLogSchema.index({ statusCode: 1, createdAt: -1 });

// TTL index to auto-delete old logs after 90 days
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model<IAuditLog & Document>('AuditLog', AuditLogSchema);
