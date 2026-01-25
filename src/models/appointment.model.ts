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
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    },
    paymentIntentId: {
        type: String
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'refunded', 'partially_refunded', 'failed'],
        default: 'pending'
    },
    // Refund fields
    refundId: {
        type: String
    },
    refundStatus: {
        type: String,
        enum: ['pending', 'processing', 'succeeded', 'failed', 'cancelled'],
    },
    refundAmount: {
        type: Number
    },
    cancelledAt: {
        type: Date
    },
    cancellationReason: {
        type: String
    }
}, {
    // Match the exact field names and structure from the database
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    versionKey: '__v' // This matches the field in your DB output
});

// Indexes for performance optimization
// Index for customer appointments lookup
AppointmentSchema.index({ customerId: 1, appointmentDate: -1 });
// Index for vendor service appointments
AppointmentSchema.index({ vendorServiceId: 1, appointmentDate: -1 });
// Index for status filtering
AppointmentSchema.index({ status: 1 });
// Index for date range queries
AppointmentSchema.index({ appointmentDate: 1 });
// Compound index for slot availability check
AppointmentSchema.index({ vendorServiceId: 1, appointmentDate: 1, startTime: 1, endTime: 1 });
// Index for payment status filtering
AppointmentSchema.index({ paymentStatus: 1 });
// Index for payment intent lookup (Stripe webhooks)
AppointmentSchema.index({ paymentIntentId: 1 });
// Index for created date (dashboard analytics)
AppointmentSchema.index({ createdAt: -1 });

export default mongoose.model<IAppointment & Document>('Appointment', AppointmentSchema);