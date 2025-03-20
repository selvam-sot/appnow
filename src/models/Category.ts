import mongoose, { Schema } from 'mongoose';
import { ICategory } from '../interfaces/category.interface';

const CategorySchema: Schema = new Schema({
    categoryName: { 
        type: String, 
        required: true,
        unique: true 
    },
    description: { 
        type: String,
        required: true
    },
    image: {
        type: String,
        default: 'category.png'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isFavorite: {
        type: Boolean,
        default: false
    }
}, { 
    // Match the exact field names and structure from the database
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    versionKey: '__v' // This matches the field in your DB output
});

// Create indexes (optimizes queries)
CategorySchema.index({ categoryName: 1 });
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ isFavorite: 1 });

export default mongoose.model<ICategory>('Category', CategorySchema, 'categories');