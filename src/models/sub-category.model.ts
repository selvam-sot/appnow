import mongoose, { Schema, Document } from 'mongoose';
import { ISubCategory } from '../interfaces/sub-category.interface';

const SubCategorySchema: Schema = new Schema({
    name: { 
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
        default: 'subcategory.png'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isFavorite: {
        type: Boolean,
        default: false
    },
    categoryId: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
}, { 
    // Match the exact field names and structure from the database
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    versionKey: '__v' // This matches the field in your DB output
});

export default mongoose.model<ISubCategory & Document>('SubCategory', SubCategorySchema);