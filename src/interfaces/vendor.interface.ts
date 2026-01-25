export interface SocialMediaLink {
    mediaName: string;
    mediaLink: string;
}
export interface IVendor {
    _id: string;
    vendorName: string;
    serviceProviderName: string;
    aboutDescription: string;
    country: string;
    state: string;
    city: string;
    zip: string;
    address: string;
    location: string;
    email: string;
    phone: string;
    website: string;
    images: [string];
    image: string;
    specialists: [string];
    amenities: [string];
    tags: string;
    socialMediaLinks: [SocialMediaLink];
    isActive: boolean;
    isFreelancer: boolean;
    // Verification and ratings
    verificationStatus?: 'pending' | 'verified' | 'rejected';
    rating?: number;
    totalReviews?: number;
    // Link to User record (for vendor login via Users table)
    userId?: string;
    // Timestamps
    createdAt: Date;
    updatedAt: Date;
    __v?: number;
}