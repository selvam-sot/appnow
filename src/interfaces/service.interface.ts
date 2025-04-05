import mongoose from 'mongoose';

export interface IService {
    _id: string;
    name: string;
    description?: string;
    image: string;
    categoryId: mongoose.Schema.Types.ObjectId;
    subCategoryId: mongoose.Schema.Types.ObjectId;
    isActive: boolean;
}