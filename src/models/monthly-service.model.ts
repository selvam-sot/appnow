import mongoose, { Schema, Document } from 'mongoose';
import { IMonthlyService } from '../interfaces/monthly-service.interface';

const ServiceDateTiming: Schema = new Schema({
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

const ServiceDate: Schema = new Schema({
    date: {
        type: String
    },
    reoccurrence: {
        type: String
    },
    timingType: {
        type: Number
    },
    timings: {
        type: [ServiceDateTiming]
    }
});

const MonthlyServiceSchema: Schema = new Schema({
    serviceId: {
        type: Schema.Types.ObjectId,
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
        type: [ServiceDate],
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

export default mongoose.model<IMonthlyService & Document>('MonthlyService', MonthlyServiceSchema);