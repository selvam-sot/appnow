export interface Appointment {
    start_time: string;
    end_time: string;
    appointments: number;
}

export interface Timing {
    fromTime: string;
    toTime: string;
    reoccurrence?: number;
}

export interface DateDetails {
    date: string;
    reoccurrence: number;
    timingType: string;
    timings: Timing[];
}

export interface Slot {
    index?: number;
    start_time: string;
    end_time: string;
    availableSlots: number;
    vendorServiceId?: string;
}

export interface ServiceToMonth {
    serviceId: string;
    month: number;
    year: number;
    reoccurrence: number;
    dates: DateDetails[];
}