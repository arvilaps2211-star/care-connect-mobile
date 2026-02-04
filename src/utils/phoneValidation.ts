/**
 * Phone Number Validation & Formatting Utilities
 * Handles E.164 formatting with +91 (India) as default country code
 */

export interface PhoneValidationResult {
  isValid: boolean;
  formatted: string;
  error?: string;
  masked: string;
}

/**
 * Validate and format phone number to E.164 format
 * @param phone - Raw phone number input
 * @param defaultCountryCode - Default country code (e.g., "+91" for India)
 */
export function validateAndFormatPhone(
  phone: string | undefined | null,
  defaultCountryCode: string = "+91"
): PhoneValidationResult {
  const empty: PhoneValidationResult = {
    isValid: false,
    formatted: "",
    error: "Phone number is required",
    masked: "***",
  };

  if (!phone || typeof phone !== "string") {
    return empty;
  }

  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\\d+]/g, "").trim();

  if (!cleaned) {
    return { ...empty, error: "Invalid phone number" };
  }

  // Already has country code
  if (cleaned.startsWith("+")) {
    const isValid = /^\+[1-9]\d{6,14}$/.test(cleaned);
    return {
      isValid,
      formatted: cleaned,
      error: isValid ? undefined : "Invalid international format",
      masked: maskPhoneNumber(cleaned),
    };
  }

  // Remove leading 0 (common in India)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // 10-digit Indian number
  if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
    const formatted = `${defaultCountryCode}${cleaned}`;
    return {
      isValid: true,
      formatted,
      masked: maskPhoneNumber(formatted),
    };
  }

  // 11-12 digit number starting with 91 (India)
  if ((cleaned.length === 12 || cleaned.length === 11) && cleaned.startsWith("91")) {
    const formatted = `+${cleaned}`;
    const isValid = /^\+91\d{10}$/.test(formatted);
    return {
      isValid,
      formatted,
      error: isValid ? undefined : "Invalid format",
      masked: maskPhoneNumber(formatted),
    };
  }

  // Try adding default country code
  const withCountryCode = `${defaultCountryCode}${cleaned}`;
  const isValid = /^\+[1-9]\d{6,14}$/.test(withCountryCode);

  return {
    isValid,
    formatted: withCountryCode,
    error: isValid ? undefined : "Invalid phone number format",
    masked: maskPhoneNumber(withCountryCode),
  };
}

/**
 * Mask phone number for privacy (e.g., +91****1234)
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 6) return "***";

  // Keep country code + first 2 digits + last 4 digits
  if (phone.startsWith("+")) {
    const countryCode = phone.match(/^\+\d{1,3}/)?.[0] || "+";
    const rest = phone.slice(countryCode.length);

    if (rest.length <= 4) {
      return `${countryCode}****`;
    }

    const visible = rest.slice(-4);
    const masked = "*".repeat(Math.max(0, rest.length - 4));
    return `${countryCode}${masked}${visible}`;
  }

  // No country code - mask middle digits
  if (phone.length <= 4) return "****";
  return `${phone.slice(0, 2)}****${phone.slice(-4)}`;
}

/**
 * Check if a phone number appears valid (quick check, not full validation)
 */
export function isPhoneNumberValid(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[^\\d+]/g, "");
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Format phone number for display (adds spaces for readability)
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return "";

  const cleaned = phone.replace(/[^\\d+]/g, "");

  // Indian format: +91 XXXXX XXXXX
  if (cleaned.startsWith("+91") && cleaned.length === 13) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 8)} ${cleaned.slice(8)}`;
  }

  // Other formats: just add a space every 4 digits after country code
  if (cleaned.startsWith("+")) {
    const countryCode = cleaned.match(/^\+\d{1,3}/)?.[0] || "";
    const rest = cleaned.slice(countryCode.length);
    return `${countryCode} ${rest.replace(/(\d{4})/g, "$1 ").trim()}`;
  }

  return cleaned;
}

/**
 * Validate multiple phone numbers and return results
 */
export function validatePhoneNumbers(
  phones: string[],
  defaultCountryCode: string = "+91"
): { valid: PhoneValidationResult[]; invalid: PhoneValidationResult[] } {
  const results = phones.map((p) => validateAndFormatPhone(p, defaultCountryCode));

  return {
    valid: results.filter((r) => r.isValid),
    invalid: results.filter((r) => !r.isValid),
  };
}
