import mongoose, { Schema, Document } from 'mongoose';
import { IService } from '../interfaces/service.interface';

const ServiceSchema: Schema = new Schema({
    name: { 
        type: String, 
        required: true,
        unique: true 
    },
    description: { 
        type: String,
        required: false
    },
    image: {
        type: String,
        default: 'service.png'
    },
    categoryId: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    subCategoryId: {
        type: Schema.Types.ObjectId,
        ref: 'SubCategory',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { 
    // Match the exact field names and structure from the database
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    versionKey: '__v' // This matches the field in your DB output
});

export default mongoose.model<IService & Document>('Service', ServiceSchema);