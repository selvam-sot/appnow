import mongoose, { Schema, Document } from 'mongoose';
import { IAppointment } from './../interfaces/appointment.interface';

const CardDetailsSchema: Schema = new Schema({
    cardNumber: {
        type: String
    },
    cardHolderName: {
        type: String
    },
    expiryMonth: {
        type: String
    },
    expiryYear: {
        type: String
    },
    cvv: {
        type: String
    }
});

const CustomerAddressSchema: Schema = new Schema({
    address1: {
        type: String
    },
    address2: {
        type: String
    },
    city: {
        type: String
    },
    state: {
        type: String
    },
    zip: {
        type: String
    }
});
const AppointmentSchema: Schema = new Schema({
    customerId: { 
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    vendorServiceId: { 
        type: Schema.Types.ObjectId,
        ref: 'VendorService',
        required: true
    },
    servicePlace: {
        type: String,
        required: true
    },
    appointmentDate: { 
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    customerAddress: {
        type: CustomerAddressSchema
    },
    customerNotes: {
        type: String
    },
    serviceFee: {
        type: Number,
        required: true
    },
    discountAmount: {
        type: Number
    },
    walletAmount: {
        type: Number
    },
    total: {
        type: Number
    },
    paymentMode: {
        type: String
    },
    cardDetails: {
        type: CardDetailsSchema
    },
    status: { 
        type: String, 
        enum: ['pending', 'confirmed', 'cancelled'], 
        default: 'pending'
    }
}, { 
    // Match the exact field names and structure from the database
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    versionKey: '__v' // This matches the field in your DB output
});

export default mongoose.model<IAppointment & Document>('Appointment', AppointmentSchema);