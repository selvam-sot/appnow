import mongoose, { Schema } from 'mongoose';
import { INotification } from '../interfaces/notification.interface';

const NotificationSchema: Schema = new Schema({
    userId: {
        type: String,
        required: true,
        index: true, // Index for fast queries by user
    },
    type: {
        type: String,
        enum: ['appointment', 'reminder', 'promotion', 'system'],
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    body: {
        type: String,
        required: true,
    },
    data: {
        type: Schema.Types.Mixed,
        default: {},
    },
    read: {
        type: Boolean,
        default: false,
        index: true, // Index for filtering unread notifications
    },
}, {
    timestamps: true,
});

// Compound indexes for efficient queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });
// Index for notification type filtering
NotificationSchema.index({ type: 1 });
// Compound index for user's unread notifications by type
NotificationSchema.index({ userId: 1, type: 1, read: 1 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
