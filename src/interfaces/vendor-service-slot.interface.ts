interface IVendorServiceSlotTime {
    fromTime: string;
    toTime: string;
    reoccurrence: number;
}

interface IVendorServiceSlotDetails {
    date: Date;
    reoccurrence: number;
    timingType: string;
    timings: [IVendorServiceSlotTime]
}

export interface IVendorServiceSlot {
    _id: string;
    vendorServiceId: string;
    month: number;
    year: number;
    reoccurrence: number;
    dates: [IVendorServiceSlotDetails],
    createdAt: Date;
    updatedAt: Date;
    __v?: number;
}