import moment from 'moment';
import { Appointment, Timing, DateDetails, Slot } from './../interfaces/common.interface';

const checkSlotIsAvailable = (
    appointments: Appointment[],
    appointmentDate: string,
    startTs: number,
    endTs: number,
    reoccurrence: number
): number => {
    let availableSlots = reoccurrence;
    for (const appointment of appointments) {
        const appointmentStartTs = new Date(
            `${appointmentDate} ${appointment.start_time}`
        ).getTime();
        const appointmentEndTs = new Date(
            `${appointmentDate} ${appointment.end_time}`
        ).getTime();
        const appointmentCount = appointment.appointments;
    
        if (
            (appointmentStartTs >= startTs && appointmentStartTs <= endTs) ||
            (appointmentEndTs > startTs && appointmentEndTs <= endTs)
        ) {
            availableSlots = availableSlots - appointmentCount;
        }
    }
    return availableSlots;
}

const getSlots = (
    duration: number,
    timing: Timing,
    dateDetails: DateDetails,
    appointments: Record<string, Appointment[]>,
    vendorServiceId: string = ''
): Slot[] => {
    const slots: Slot[] = [];
    let startTime = timing.fromTime;
    const endTime = timing.toTime;    
    const dateStr = moment(dateDetails.date).format().substring(0, 10);
    while (
        new Date(`${dateStr} ${startTime}`).getTime() <=
        new Date(`${dateStr} ${endTime}`).getTime()
    ) {
        const slotStart = startTime;
        const durationAddedTs =
            new Date(`${dateStr} ${startTime}`).getTime() +
            duration * 60 * 1000;
        startTime = new Date(durationAddedTs).toTimeString().slice(0, 5);
        const slotEnd = startTime;
        let slotCount = dateDetails.reoccurrence;
        if (appointments[dateStr]) {
            slotCount = checkSlotIsAvailable(
                appointments[dateStr],
                dateStr,
                new Date(`${dateStr} ${slotStart}`).getTime(),
                new Date(`${dateStr} ${slotEnd}`).getTime(),
                dateDetails.reoccurrence
            );
        }
        if (
            slotCount > 0 &&
            new Date(`${dateStr} ${startTime}`).getTime() <=
            new Date(`${dateStr} ${endTime}`).getTime()
        ) {
            slots.push({
                start_time: slotStart,
                end_time: slotEnd,
                availableSlots: slotCount,
                vendorServiceId,
            });
        }
    }
    return slots;
}

export const getServiceSlots = (
    dateDetails: DateDetails,
    duration: number,
    appointments: Record<string, Appointment[]>,
    vendorServiceId: string = ''
): Slot[] => {
    let resultSlots: Slot[] = [];
    for (const timing of dateDetails.timings) {
        const slots = getSlots(
            duration,
            timing,
            dateDetails,
            appointments,
            vendorServiceId
        );
        resultSlots = resultSlots.concat(slots);
    }
    resultSlots.forEach((resultSlot: Slot, index: number) => resultSlot.index = index);
    return resultSlots;
}