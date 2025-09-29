import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from './../interfaces/user.interface';

const UserSchema: Schema = new Schema({
    firstName: {
        type: String
    },
    lastName: {
        type: String
    },
    userName: {
        type: String,
        required: function(this: IUser): boolean {
            // Only required if not a Clerk user
            return !this.clerkId;
        },
        unique: true,
        sparse: true // Allow null values but ensure uniqueness when present
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: function(this: IUser): boolean {
            // Only required if not a Clerk user (traditional signup)
            return !this.clerkId;
        },
        private: true
    },
    
    // NEW: Clerk Integration Fields
    clerkId: {
        type: String,
        unique: true,
        sparse: true // Allow null values but ensure uniqueness when present
    },
    authProvider: {
        type: String,
        enum: ['local', 'clerk'],
        default: 'local'
    },
    lastSyncedAt: {
        type: Date,
        default: Date.now
    },
    avatar: {
        type: String,
        default: 'avatar.png'
    },
    isActive: {
        type: Boolean,
        default: false
    },
    activationToken: {
        type: String,
    },
    role: {
        type: String,
        enum: ['customer', 'admin', 'vendor'],
        default: 'customer' // Changed from 'user' to 'customer' to match your enum
    },
    tokenVersion: { 
        type: Number,
        default: 0
    },
    passwordChangedAt: Date
}, { 
    // Match the exact field names and structure from the database
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    versionKey: '__v', // This matches the field in your DB output
    toJSON: { virtuals: true }, // Include virtuals when converting to JSON
    toObject: { virtuals: true }
});

// Virtual field for fullName
UserSchema.virtual('fullName').get(function(this: IUser) {
    return `${this.firstName} ${this.lastName}`.trim();
});

// Hash password before saving
UserSchema.pre('save', async function(this: IUser, next) {
    // Only hash the password if it has been modified (or is new) and exists
    if (!this.isModified('password') || !this.password) return next();
    
    // Hash the password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    
    // Set passwordChangedAt to current time
    if (!this.isNew) {
        this.passwordChangedAt = new Date();
    }
    
    next();
});

UserSchema.methods.correctPassword = async function(
    candidatePassword: string,
    userPassword: string
): Promise<boolean> {
    return await bcrypt.compare(candidatePassword, userPassword);
};

UserSchema.methods.changedPasswordAfter = function(JWTTimestamp: number): boolean {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(
            (this.passwordChangedAt.getTime() / 1000).toString(),
            10
        );
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

UserSchema.methods.incrementTokenVersion = async function(): Promise<void> {
    this.tokenVersion += 1;
    await this.save();
};

export default mongoose.model<IUser>('User', UserSchema);