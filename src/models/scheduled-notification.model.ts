import mongoose, { Schema, Document } from 'mongoose';

export interface IScheduledNotification {
    _id?: string;
    appointmentId: mongoose.Types.ObjectId;
    customerId: mongoose.Types.ObjectId;
    type: 'reminder_immediate' | 'reminder_24h' | 'reminder_2h' | 'reminder_2h_after';
    scheduledFor: Date;
    status: 'pending' | 'sent' | 'cancelled' | 'failed';
    // Notification content
    title: string;
    body: string;
    data: Record<string, any>;
    // Tracking
    sentAt?: Date;
    cancelledAt?: Date;
    failureReason?: string;
    retryCount: number;
    createdAt?: Date;
    updatedAt?: Date;
}

const ScheduledNotificationSchema: Schema = new Schema({
    appointmentId: {
        type: Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true,
        index: true
    },
    customerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['reminder_immediate', 'reminder_24h', 'reminder_2h', 'reminder_2h_after'],
        required: true
    },
    scheduledFor: {
        type: Date,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'cancelled', 'failed'],
        default: 'pending',
        index: true
    },
    // Notification content (pre-computed for fast sending)
    title: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },
    data: {
        type: Schema.Types.Mixed,
        default: {}
    },
    // Tracking
    sentAt: {
        type: Date
    },
    cancelledAt: {
        type: Date
    },
    failureReason: {
        type: String
    },
    retryCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
// Find pending notifications due now
ScheduledNotificationSchema.index({ status: 1, scheduledFor: 1 });
// Find all notifications for an appointment (for cancellation)
ScheduledNotificationSchema.index({ appointmentId: 1, status: 1 });
// Daily scheduling query - find pending for a date range
ScheduledNotificationSchema.index({ scheduledFor: 1, status: 1, type: 1 });

export default mongoose.model<IScheduledNotification & Document>('ScheduledNotification', ScheduledNotificationSchema);
