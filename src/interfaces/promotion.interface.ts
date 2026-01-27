import { Document } from 'mongoose';

export interface IPromotion extends Document {
    title: string;
    subtitle: string;
    description: string;
    code: string;
    discount: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    minBookingValue?: number;
    maxDiscountAmount?: number;
    validFrom: Date;
    validUntil: Date;
    terms: string[];
    gradient: string[];
    icon: string;
    isActive: boolean;
    isNew: boolean;
    isFeatured: boolean;
    showInBanner: boolean;
    displayOrder: number;
    usageLimit?: number;
    usageCount: number;
    applicableServices?: string[];
    applicableCategories?: string[];
    createdAt: Date;
    updatedAt: Date;
}
