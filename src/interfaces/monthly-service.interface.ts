interface IServiceDateTiming {
    fromTime: string;
    toTime: string;
    reoccurrence: number;
}

interface IServiceDate {
    date: string;
    reoccurrence: string;
    timingType: number;
    timings: [IServiceDateTiming];
}

export interface IMonthlyService {
    _id: string;
    serviceId: string;
    month: number;
    year: number;
    reoccurrence: number;
    dates: [IServiceDate];
}