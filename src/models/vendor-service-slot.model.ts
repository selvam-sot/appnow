import mongoose, { Schema, Document } from 'mongoose';
import { IVendorServiceSlot } from '../interfaces/vendor-service-slot.interface';

const VendorServiceSlotTimeSchema: Schema = new Schema({
    fromTime: {
        type: String
    },
    toTime: {
        type: String
    },
    reoccurrence: {
        type: Number
    }
});
const VendorServiceSlotDetailsSchema: Schema = new Schema({
    date: {
        type: Date
    },
    reoccurrence: {
        type: Number
    },
    timingType: {
        type: String
    },
    timings: {
        type: [VendorServiceSlotTimeSchema]
    }
});

const VendorServiceSlotSchema: Schema = new Schema({
    vendorServiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VendorService',
        required: true
    },
    month: {
        type: Number,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    reoccurrence: {
        type: Number,
        required: true
    },
    dates: {
        type: [VendorServiceSlotDetailsSchema],
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
VendorServiceSlotSchema.index({ vendorServiceId: 1 });
VendorServiceSlotSchema.index({ 'dates.date': 1 });
// Compound index for efficient by-date queries across months
VendorServiceSlotSchema.index({ vendorServiceId: 1, month: 1, year: 1 });

export default mongoose.model<IVendorServiceSlot & Document>('VendorServiceSlot', VendorServiceSlotSchema);