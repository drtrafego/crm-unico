import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getWhatsAppLink(phone: string) {
  // Remove all non-numeric characters
  const clean = phone.replace(/\D/g, '');
  
  // If empty, return empty
  if (!clean) return '';

  // Check if it starts with 55 (Brazil DDI)
  // Assuming most numbers are Brazilian if they are 10 or 11 digits
  if (clean.length >= 10 && clean.length <= 11) {
    return `https://wa.me/55${clean}`;
  }
  
  // If it's longer (e.g. already has 55 or another country code), keep as is
  return `https://wa.me/${clean}`;
}
