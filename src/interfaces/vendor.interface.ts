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
    createdAt: Date;
    updatedAt: Date;
    __v?: number;
}