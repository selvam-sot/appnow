import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import User from '../models/user.model';
import { AppError } from '../utils/appError.util';
import { asyncHandler } from '../utils/asyncHandler.util';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendActivationEmail } from '../services/email.service';
import { signToken, verifyToken } from '../utils/jwt.util';

export const signupUser = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Validation Error', 400);
    }

    const { firstName, lastName, userName, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
        throw new AppError('User already exists', 400);
    }

    const activationToken = crypto.randomBytes(20).toString('hex');
    const user = await User.create({
        firstName,
        lastName,
        userName,
        email,
        password,
        role,
        activationToken,
        isActive: false
    });

    // Send activation email
    //await sendActivationEmail(email, activationToken);

    res.status(201).json({
        message: 'User created successfully. Please check your email to activate your account.'
    });
});

export const activateUser = asyncHandler(async (req: Request, res: Response) => {
    const { activationToken } = req.params;

    const user = await User.findOne({ activationToken });
    if (!user) {
        throw new AppError('Invalid activation token', 400);
    }

    user.isActive = true;
    user.activationToken = '';
    await user.save();

    res.json({ message: 'Account activated successfully. You can now log in.' });
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
    const { userName, password } = req.body;
    const user = await User.findOne({ userName }).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
        return new AppError('Incorrect email or password', 401);
    }

    const token = signToken(user._id, user.role, user.tokenVersion);

    res.cookie('jwt', token, {
        expires: new Date(Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRES_IN!) * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
    });

    user.password = '';

    res.status(200).json({
        status: 'success',
        token,
        data: { user }
    });
});

export const logoutUser = asyncHandler(async (req: Request, res: Response) => {
    // First, fetch the complete user from the database using the ID from req.user
    if (!req.user || !req.user.id) {
        throw new AppError('Not authenticated', 401);
    }
    
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Now we can call the method on the actual user document
    await user.incrementTokenVersion();

    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });

    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});

export const getUserProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);
    if (user) {
        res.json({
            _id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role,
        });
    } else {
        throw new AppError('User not found', 404);
    }
});

export const updateUserProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);

    if (user) {
        user.firstName = req.body.firstName || user.firstName;
        user.lastName = req.body.lastName || user.lastName;
        user.email = req.body.email || user.email;
        if (req.body.password) {
        user.password = req.body.password;
        }

        const updatedUser = await user.save();

        res.json({
        _id: updatedUser._id,
        name: `${updatedUser.firstName} ${updatedUser.lastName}`,
        email: updatedUser.email,
        role: updatedUser.role,
        });
    } else {
        throw new AppError('User not found', 404);
    }
});

export const deleteUserAccount = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    //await user.remove();
    res.cookie('jwt', '', {
        httpOnly: true,
        expires: new Date(0)
    });
    res.json({ message: 'User account deleted successfully' });
});