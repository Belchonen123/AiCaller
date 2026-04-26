import { parsePhoneNumberFromString } from "libphonenumber-js/core";
import metadata from "libphonenumber-js/metadata.min.json";

export function normalizePhone(input: string): string | null {
  const phoneNumber = parsePhoneNumberFromString(input, "US", metadata);

  if (!phoneNumber?.isValid()) {
    return null;
  }

  return phoneNumber.number;
}

export function maskPhone(phone: string): string {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return "(***) ***-****";
  }

  return `(***) ***-${normalizedPhone.slice(-4)}`;
}
