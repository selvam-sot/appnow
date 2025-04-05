import mongoose from 'mongoose';

export interface ISubCategory {
    _id: string;
    subCategoryName: string;
    description: string;
    categoryId: mongoose.Schema.Types.ObjectId;
    image?: string;
    isActive: boolean;
    isFavorite: boolean;
    createdAt: Date;
    updatedAt: Date;
    __v?: number;
}