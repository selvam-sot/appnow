import { Document } from 'mongoose';

export interface IUser extends Document {
    _id: string;
    firstName: string;
    lastName: string;
    userName?: string; // Made optional since Clerk users might not have this
    email: string;
    password?: string; // Made optional since Clerk users might not have this
    avatar: string;
    role: string;
    isActive?: boolean;
    activationToken?: string;
    tokenVersion: number;
    passwordChangedAt?: Date;
    
    // Clerk Integration Fields
    clerkId?: string;
    authProvider: 'local' | 'clerk';
    lastSyncedAt?: Date;
    fullName?: string; // Virtual field or computed property
    
    // Methods
    correctPassword(candidatePassword: string, userPassword: string): Promise<boolean>;
    changedPasswordAfter(JWTTimestamp: number): boolean;
    incrementTokenVersion(): Promise<void>;
    
    // Timestamps
    createdAt: Date;
    updatedAt: Date;
    __v?: number;
}