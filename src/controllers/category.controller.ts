import { Request, Response } from 'express';
import Category from '../models/category.model';

/**
 * Get all categories
 * @route GET /api/categories
 */
export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
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

    const categories = await Category.find(filter).sort({ categoryName: 1 });
    
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Get single category
 * @route GET /api/categories/:id
 */
export const getCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      res.status(404).json({
        success: false,
        error: 'Category not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Create new category
 * @route POST /api/categories
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.create(req.body);

    res.status(201).json({
      success: true,
      data: category,
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

/**
 * Update category
 * @route PUT /api/categories/:id
 */
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true, // Return updated document
        runValidators: true, // Validate the update operation
      }
    );

    if (!category) {
      res.status(404).json({
        success: false,
        error: 'Category not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: category,
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

/**
 * Delete category
 * @route DELETE /api/categories/:id
 */
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      res.status(404).json({
        success: false,
        error: 'Category not found',
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

/**
 * Toggle favorite status
 * @route PATCH /api/categories/:id/toggle-favorite
 */
export const toggleFavorite = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      res.status(404).json({
        success: false,
        error: 'Category not found',
      });
      return;
    }
    
    // Toggle the favorite status
    category.isFavorite = !category.isFavorite;
    await category.save();
    
    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Toggle active status
 * @route PATCH /api/categories/:id/toggle-active
 */
export const toggleActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      res.status(404).json({
        success: false,
        error: 'Category not found',
      });
      return;
    }
    
    // Toggle the active status
    category.isActive = !category.isActive;
    await category.save();
    
    res.status(200).json({
      success: true,
      data: category,
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
export const getCategoryList = async (req: Request, res: Response) => {
  try {    
    // Build filter object
    const filter: Record<string, any> = {
      isActive: true
    };

    const categories = await Category.find(filter).sort({ categoryName: 1 });
    
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};