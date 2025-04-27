import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import MonthlyService from '../models/monthly-service.model';
import logger from '../config/logger';
import { AppError } from '../utils/appError.util';

export const createMonthlyService = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, description, image } = req.body;
        const monthlyService = new MonthlyService({ name, description, image });
        await monthlyService.save();
        res.status(201).json(monthlyService);
    } catch (error: any) {
        logger.error(`Error in creating monthlyService: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getMonthlyServices = async (req: Request, res: Response) => {
    try {
        const monthlyServices = await MonthlyService.find().sort();
        res.json(monthlyServices);
    } catch (error: any) {
        logger.error(`Error in fetching monthlyServices: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getMonthlyServiceById = async (req: Request, res: Response) => {
    try {
        const monthlyService = await MonthlyService.findById(req.params.id);
        if (monthlyService) {
            res.json(monthlyService);
        } else {
            //res.status(404).json({ message: 'MonthlyService not found' });
            throw new AppError('MonthlyService not found', 404);
        }
    } catch (error: any) {
        logger.error(`Error in fetching monthlyService: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateMonthlyService = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, description, image } = req.body;
        const monthlyService = await MonthlyService.findByIdAndUpdate(
            req.params.id,
            { name, description, image },
            { new: true }
        );
        if (monthlyService) {
            res.json(monthlyService);
        } else {
            res.status(404).json({ message: 'MonthlyService not found' });
        }
    } catch (error: any) {
        logger.error(`Error in updating monthlyService: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteMonthlyService = async (req: Request, res: Response) => {
    try {
        const monthlyService = await MonthlyService.findByIdAndDelete(req.params.id);
        if (monthlyService) {
            res.json({ message: 'MonthlyService removed' });
        } else {
            res.status(404).json({ message: 'MonthlyService not found' });
        }
    } catch (error: any) {
        logger.error(`Error in deleting monthlyService: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};


// General functions
export const getMonthlyServiceList = async (req: Request, res: Response) => {
    try {
        req.body = {...req.body, ...{ isActive: true }};
        const monthlyServices = await MonthlyService.find(req.body);
        res.json(monthlyServices);
        res.status(200).json({
            success: true,
            data: monthlyServices,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
};