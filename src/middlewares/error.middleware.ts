import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../utils/appError.util';
import logger from './../config/logger';

interface ErrorResponse {
    message: string;
    stack?: string;
    statusCode?: number;
    errors?: any;
}

// Custom error interface to include potential 'code' property
interface CustomError extends Error {
    code?: string | number;
    statusCode?: number;
    status?: string;
    isOperational?: boolean;
}

const handleCastErrorDB = (err: mongoose.Error.CastError): AppError => {
    const message = `Invalid ${err.path}: ${err.value}.`;
    return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err: CustomError): AppError => {
  // Using a type assertion here as we know the structure of this specific error
    const errmsg = (err as any).errmsg;
    const value = errmsg && errmsg.match(/(["'])(\\?.)*?\1/) ? errmsg.match(/(["'])(\\?.)*?\1/)[0] : '';
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new AppError(message, 400);
};

const handleValidationErrorDB = (err: mongoose.Error.ValidationError): AppError => {
    const errors = Object.values(err.errors).map((el: any) => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

const handleJWTError = (): AppError => new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = (): AppError => new AppError('Your token has expired! Please log in again.', 401);

const sendErrorDev = (err: AppError, res: Response): void => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

const sendErrorProd = (err: AppError, res: Response): void => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
        status: err.status,
        message: err.message
        });
    } 
    // Programming or other unknown error: don't leak error details
    else {
        // 1) Log error
        logger.error('ERROR 💥', err);

        // 2) Send generic message
        res.status(500).json({
        status: 'error',
        message: 'Something went very wrong!'
        });
    }
};

export const errorHandler = (err: CustomError, req: Request, res: Response, next: NextFunction): void => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err as AppError, res);
    } else if (process.env.NODE_ENV === 'production') {
        let error = { ...err, message: err.message } as CustomError;

        if (error instanceof mongoose.Error.CastError) error = handleCastErrorDB(error);
        if (error.code === 11000) error = handleDuplicateFieldsDB(error);
        if (error instanceof mongoose.Error.ValidationError) error = handleValidationErrorDB(error);
        if (error.name === 'JsonWebTokenError') error = handleJWTError();
        if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

        sendErrorProd(error as AppError, res);
    }
};

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
    const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
    next(error);
};