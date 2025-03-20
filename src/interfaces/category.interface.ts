import { Document } from 'mongoose';

export interface ICategory extends Document {
    categoryName: string;
    description: string;
    image: string;
    isActive: boolean;
    isFavorite: boolean;
    createdAt: Date;
    updatedAt: Date;
    __v?: number;
}