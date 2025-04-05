import { Document } from 'mongoose';

export interface IUser extends Document {
    _id: string;
    firstName: string;
    lastName: string;
    userName: string;
    email: string;
    password: string;
    avatar: string;
    role: string;
    isActive?: boolean;
    activationToken?: string;
    tokenVersion: number;
    passwordChangedAt?: Date;
    correctPassword(candidatePassword: string, userPassword: string): Promise<boolean>;
    changedPasswordAfter(JWTTimestamp: number): boolean;
    incrementTokenVersion(): Promise<void>;
    createdAt: Date;
    updatedAt: Date;
    __v?: number;
}