// src/utils/validators.ts
import { body, param } from 'express-validator';

export const userValidationRules = {
    create: () => [
        body('firstName').notEmpty().withMessage('First Name is required'),
        body('lastName').notEmpty().withMessage('Last Name is required'),
        body('userName').notEmpty().withMessage('Username is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
        body('role').isIn(['customer', 'vendor']).withMessage('Role must be either customer or vendor'),
    ],
    login: () => [
        body('userName').optional().notEmpty().withMessage('Name cannot be empty'),
        body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    ],
    update: () => [
        body('name').optional().notEmpty().withMessage('Name cannot be empty'),
        body('email').optional().isEmail().withMessage('Valid email is required'),
        body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    ],
};

export const categoryValidationRules = {
    create: () => [
        body('name').notEmpty().withMessage('Category name is required'),
        body('description').notEmpty().withMessage('Category description is required'),
    ],
    update: () => [
        body('name').optional().notEmpty().withMessage('Category name cannot be empty'),
        body('description').optional().notEmpty().withMessage('Category description cannot be empty'),
    ],
};

export const subCategoryValidationRules = {
    create: () => [
        body('name').notEmpty().withMessage('SubCategory name is required'),
        body('description').notEmpty().withMessage('SubCategory description is required'),
        body('categoryId').isMongoId().withMessage('Valid category ID is required'),
    ],
    update: () => [
        body('name').optional().notEmpty().withMessage('SubCategory name cannot be empty'),
        body('description').optional().notEmpty().withMessage('SubCategory description cannot be empty'),
        body('categoryId').optional().isMongoId().withMessage('Valid category ID is required'),
    ],
};

export const serviceValidationRules = {
    create: () => [
        body('name').notEmpty().withMessage('Service name is required'),
        body('description').notEmpty().withMessage('Service description is required'),
        body('categoryId').isMongoId().withMessage('Valid Category ID is required'),
        body('subCategoryId').isMongoId().withMessage('Valid subCategory ID is required'),
    ],
    update: () => [
        body('name').notEmpty().withMessage('Service name is required'),
        body('description').notEmpty().withMessage('Service description is required'),
        body('categoryId').isMongoId().withMessage('Valid Category ID is required'),
        body('subCategoryId').isMongoId().withMessage('Valid subCategory ID is required'),
    ],
};

export const vendorValidationRules = {
    create: () => [
        body('vendorName').notEmpty().withMessage('Vendor Name is required'),
        body('serviceProviderName').notEmpty().withMessage('Service Provide Name is required'),
        body('address1').notEmpty().withMessage('Address1 is required'),
        body('city').notEmpty().withMessage('City is required'),
        body('state').notEmpty().withMessage('State is required'),
        body('zip').notEmpty().withMessage('Zip is required'),
        body('phone').notEmpty().withMessage('Phone number is required'),
        body('email').notEmpty().withMessage('Email is required'),
    ],
    update: () => [
        body('vendorName').notEmpty().withMessage('Vendor Name is required'),
        body('serviceProviderName').notEmpty().withMessage('Service Provide Name is required'),
        body('address1').notEmpty().withMessage('Address1 is required'),
        body('city').notEmpty().withMessage('City is required'),
        body('state').notEmpty().withMessage('State is required'),
        body('zip').notEmpty().withMessage('Zip is required'),
        body('phone').notEmpty().withMessage('Phone number is required'),
        body('email').notEmpty().withMessage('Email is required'),
    ],
};

export const vendorServiceValidationRules = {
    create: () => [
        body('name').notEmpty().withMessage('Name is required'),
    ],
    update: () => [
        body('name').notEmpty().withMessage('Name is required'),
    ],
};

export const appointmentValidationRules = {
    create: () => [
        body('customerId').isMongoId().withMessage('Valid customer ID is required'),
        body('vendorServiceId').isMongoId().withMessage('Valid vendor service ID is required'),
        body('appointmentDate').isISO8601().toDate().withMessage('Valid date is required'),
        body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:MM format'),
        body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:MM format'),
    ],
    update: () => [
        body('status').isIn(['pending', 'confirmed', 'cancelled']).withMessage('Valid status is required'),
    ],
};

export const idValidationRule = () => [
    param('id').isMongoId().withMessage('Valid ID is required'),
];

export const monthlyServiceValidationRules = {
    create: () => [
        body('month').notEmpty().withMessage('Month is required'),
    ],
    update: () => [
        body('month').notEmpty().withMessage('Month is required'),
    ],
};