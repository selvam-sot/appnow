import nodemailer from 'nodemailer';
import logger from '../config/logger';

interface EmailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

// Create a test email account if in development mode
const createTestAccount = async () => {
    return await nodemailer.createTestAccount();
};

// Send email using nodemailer
export const sendEmail = async (options: EmailOptions): Promise<void> => {
    try {
        let transporter;
        
        // Check if we're in production
        if (process.env.NODE_ENV === 'production') {
            // Configure production email service (example: Gmail, SendGrid, etc.)
            transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: parseInt(process.env.EMAIL_PORT || '587'),
                secure: process.env.EMAIL_SECURE === 'true',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });
        } else {
            // Use test account for development
            const testAccount = await createTestAccount();
            
            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
        }

        // Send email
        const mailOptions = {
            from: process.env.EMAIL_FROM || 'AppNow <noreply@appnow.com>',
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html
        };

        const info = await transporter.sendMail(mailOptions);
        
        // Log email URL in development mode
        if (process.env.NODE_ENV !== 'production') {
            logger.info(`Email preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        }
    } catch (error) {
        logger.error('Error sending email:', error);
        throw new Error('Email could not be sent');
    }
};

// Function to send activation email
export const sendActivationEmail = async (email: string, activationToken: string): Promise<void> => {
    const activationUrl = `${process.env.CLIENT_URL}/activate/${activationToken}`;
    
    const text = `Welcome to AppNow! Please click on the following link to activate your account: ${activationUrl}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Welcome to AppNow!</h1>
            <p>Thank you for registering with us. Please click the button below to activate your account:</p>
            <a href="${activationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Activate Account</a>
            <p>If you didn't register for an AppNow account, please ignore this email.</p>
            <p>Best regards,<br>The AppNow Team</p>
        </div>
    `;

    await sendEmail({
        to: email,
        subject: 'Activate Your AppNow Account',
        text,
        html
    });
};

// Function to send password reset email
export const sendPasswordResetEmail = async (email: string, resetToken: string): Promise<void> => {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    
    const text = `You requested a password reset. Please click on the following link to reset your password: ${resetUrl}. This link is valid for 10 minutes.`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Reset Your Password</h1>
            <p>You requested a password reset. Please click the button below to reset your password:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a>
            <p>This link is valid for 10 minutes.</p>
            <p>If you didn't request a password reset, please ignore this email.</p>
            <p>Best regards,<br>The AppNow Team</p>
        </div>
    `;

    await sendEmail({
        to: email,
        subject: 'Reset Your AppNow Password',
        text,
        html
    });
};

// Function to send appointment confirmation
export const sendAppointmentConfirmation = async (email: string, appointmentDetails: any): Promise<void> => {
    const text = `Your appointment has been confirmed for ${appointmentDetails.date} at ${appointmentDetails.time}.`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Appointment Confirmation</h1>
            <p>Your appointment has been confirmed:</p>
            <ul>
                <li><strong>Date:</strong> ${appointmentDetails.date}</li>
                <li><strong>Time:</strong> ${appointmentDetails.time}</li>
                <li><strong>Service:</strong> ${appointmentDetails.service}</li>
                <li><strong>Provider:</strong> ${appointmentDetails.provider}</li>
            </ul>
            <p>To view or manage your appointment, please log in to your account.</p>
            <p>Best regards,<br>The AppNow Team</p>
        </div>
    `;

    await sendEmail({
        to: email,
        subject: 'Your AppNow Appointment Confirmation',
        text,
        html
    });
};

// Function to send booking confirmation email
export const sendBookingConfirmationEmail = async (email: string, bookingDetails: any): Promise<void> => {
    const text = `Your booking has been confirmed for ${bookingDetails.serviceName} with ${bookingDetails.vendorServiceName} on ${bookingDetails.date} at ${bookingDetails.time}.`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Booking Confirmation</h1>
            <p>Your booking has been confirmed:</p>
            <ul>
                <li><strong>Service:</strong> ${bookingDetails.serviceName}</li>
                <li><strong>Provider:</strong> ${bookingDetails.vendorServiceName}</li>
                <li><strong>Date:</strong> ${bookingDetails.date}</li>
                <li><strong>Time:</strong> ${bookingDetails.time}</li>
            </ul>
            <p>To view or manage your booking, please log in to your account.</p>
            <p>Best regards,<br>The AppNow Team</p>
        </div>
    `;

    await sendEmail({
        to: email,
        subject: 'Your AppNow Booking Confirmation',
        text,
        html
    });
};