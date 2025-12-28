import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import SubCategory from '../models/sub-category.model';

export const getSubCategories = async (req: Request, res: Response) => {
    try {
        // Optional query parameters
        const { isActive, isFavorite } = req.query;
        
        // Build filter object
        const filter: Record<string, any> = {};
        
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }
    
        if (isFavorite !== undefined) {
            filter.isFavorite = isFavorite === 'true';
        }

        const subCategories = await SubCategory.find(filter).populate('categoryId').sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: subCategories.length,
            data: subCategories,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
};

export const getSubCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const subCategory = await SubCategory.findById(req.params.id);

        if (!subCategory) {
            res.status(404).json({
                success: false,
                error: 'SubCategory not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: subCategory,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
};

export const createSubCategory = async (req: Request, res: Response) => {
    try {
        const subCategory = await SubCategory.create(req.body);
    
        res.status(201).json({
            success: true,
            data: subCategory,
        });
    } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
        const messages = Object.values((error as any).errors).map(val => (val as any).message);
        res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: messages.join(', '),
        });
    } else if (error instanceof Error && error.message.includes('duplicate key error')) {
        res.status(400).json({
            success: false,
            error: 'Duplicate Entry',
            message: 'A category with this name already exists',
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
    }
};

export const updateSubCategory = async (req: Request, res: Response) => {    try {
        const subCategory = await SubCategory.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true, // Return updated document
                runValidators: true, // Validate the update operation
            }
        );
    
        if (!subCategory) {
            res.status(404).json({
                success: false,
                error: 'Sub Category not found',
            });
            return;
        }
    
        res.status(200).json({
            success: true,
            data: subCategory,
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate key error')) {
            res.status(400).json({
                success: false,
                error: 'Duplicate Entry',
                message: 'A category with this name already exists',
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Server Error',
                message: error instanceof Error ? error.message : 'Unknown error occurred',
            });
        }
    }
};

export const deleteSubCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const subCategory = await SubCategory.findByIdAndDelete(req.params.id);
    
        if (!subCategory) {
            res.status(404).json({
                success: false,
                error: 'SubCategory not found',
            });
            return;
        }
    
        res.status(200).json({
            success: true,
            data: {},
        });
        } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
        }
};

// General functions
export const getSubCategoryList = async (req: Request, res: Response) => {
    try {
        // Build filter object
        const filter: Record<string, any> = {...req.body, isActive: true};

        const subCategories:any = await SubCategory.find(filter).sort({ name: 1 }).populate('categoryId');
        
        res.status(200).json({
            success: true,
            count: subCategories.length,
            data: subCategories,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
};