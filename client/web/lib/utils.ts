import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]){
    return twMerge(clsx(inputs));
}

export function eventRegistrationOpen(event: {
  date: string;
  registrationCloseDate: string | null;
}): boolean {
  const closeTs = event.registrationCloseDate
    ? new Date(event.registrationCloseDate).getTime()
    : new Date(event.date).getTime();
  return Date.now() < closeTs;
}

export function isEventPast(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now();
}
