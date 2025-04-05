import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from './../interfaces/user.interface';

const UserSchema: Schema = new Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    userName: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        private: true
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
        default: 'user'
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
    versionKey: '__v' // This matches the field in your DB output
});

UserSchema.methods.correctPassword = async function(
    candidatePassword: string,
    userPassword: string
) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

UserSchema.methods.changedPasswordAfter = function(JWTTimestamp: number) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(
            (this.passwordChangedAt.getTime() / 1000).toString(),
            10
        );
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

UserSchema.methods.incrementTokenVersion = async function() {
    this.tokenVersion += 1;
    await this.save();
};

export default mongoose.model<IUser>('User', UserSchema);