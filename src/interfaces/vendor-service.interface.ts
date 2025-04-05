interface SocialMediaLink {
    mediaName: string;
    mediaLink: string;
}

interface Description {
    title: string;
    type: string;
    content: [string];
}

export interface IVendorService {
    _id: string;
    name: string;
    categoryId: string;
    subCategoryId: string;
    serviceId: string;
    vendorId: string;
    subTitle: string;
    shortDescriptionType: string;
    shortDescription: [string];
    description: [Description];
    images: [string];
    image: string;
    thumbnail: string;
    price: number;
    duration: number;
    servicePlace: string;
    serviceType: string;
    serviceTypeLink: string;
    isCombo: boolean;
    comboServiceIds: string;
    isActive: boolean;
    isFavorite: boolean;
    tags: [string];
    socialMediaLinks: [SocialMediaLink];
    __v?: number;
}