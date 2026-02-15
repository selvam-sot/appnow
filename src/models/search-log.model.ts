import mongoose, { Schema, Document } from 'mongoose';

interface ISearchLog {
    serviceId: mongoose.Types.ObjectId;
    serviceName: string;
    searchedAt: Date;
}

const SearchLogSchema: Schema = new Schema({
    serviceId: {
        type: Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    serviceName: {
        type: String,
        required: true
    },
    searchedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for aggregation queries
SearchLogSchema.index({ serviceId: 1 });

// TTL index: auto-delete after 90 days
SearchLogSchema.index({ searchedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model<ISearchLog & Document>('SearchLog', SearchLogSchema);
