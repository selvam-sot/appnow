export interface ICardDetails {
    cardNumber: string;
    cardHolderName: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
}

export interface ICustomerAddress {
    address1: string;
    address2: string;
    city: string;
    state: string;
    zip: string;
}

export interface IAppointment {
    _id: string;
    customerId: string;
    vendorServiceId: string;
    servicePlace: string;
    appointmentDate: Date;
    startTime: string;
    endTime: string;
    customerAddress: string | ICustomerAddress;
    customerNotes: string;
    serviceFee: number;
    discountAmount: number;
    walletAmount: number;
    total: number;
    paymentMode: string;
    cardDetails: null | ICardDetails;
    status: 'pending' | 'confirmed' | 'cancelled';
}