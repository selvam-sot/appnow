import { Document } from 'mongoose';

export interface INotification extends Document {
    _id: string;
    userId: string; // clerkId of the user
    type: 'appointment' | 'reminder' | 'promotion' | 'system';
    title: string;
    body: string;
    data?: Record<string, string>; // Additional data (appointmentId, serviceId, url, etc.)
    read: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateNotificationPayload {
    userId: string;
    type: 'appointment' | 'reminder' | 'promotion' | 'system';
    title: string;
    body: string;
    data?: Record<string, string>;
}

export interface NotificationResponse {
    id: string;
    type: 'appointment' | 'reminder' | 'promotion' | 'system';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    data?: Record<string, string>;
}
