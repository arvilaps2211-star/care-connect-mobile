/**
 * phoneFormat.ts — thin wrappers exposing the names requested by spec.
 * Wraps existing src/utils/phoneValidation.ts utilities.
 */
import {
  validateAndFormatPhone,
  formatPhoneForDisplay,
} from "@/utils/phoneValidation";

/** Convert any phone input to E.164 (+91XXXXXXXXXX for India). Returns "" if invalid. */
export function formatPhoneNumber(input: string | undefined | null): string {
  const r = validateAndFormatPhone(input ?? "");
  return r.isValid ? r.formatted : "";
}

/** Validate Indian mobile numbers (or any E.164). */
export function isValidPhoneNumber(input: string | undefined | null): boolean {
  return validateAndFormatPhone(input ?? "").isValid;
}

/** Display formatted: "+91 98765 43210" */
export function displayPhoneNumber(input: string | undefined | null): string {
  if (!input) return "";
  const e164 = formatPhoneNumber(input);
  return formatPhoneForDisplay(e164 || input);
}

export { validateAndFormatPhone };