import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatPhoneNumber,
  isValidPhoneNumber,
  displayPhoneNumber,
} from "@/utils/phoneFormat";

interface PhoneInputProps {
  value: string;
  onChange: (e164: string, isValid: boolean) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  showError?: boolean;
}

/**
 * Reusable phone input that formats as user types and emits E.164 (+91XXXXXXXXXX).
 * onChange receives the normalized value and whether it currently validates.
 */
const PhoneInput = ({
  value,
  onChange,
  label = "Phone Number",
  placeholder = "98765 43210",
  required,
  disabled,
  id = "phone-input",
  className,
  showError = true,
}: PhoneInputProps) => {
  const [raw, setRaw] = useState(value || "");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (value !== raw && value !== formatPhoneNumber(raw)) {
      setRaw(value || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const valid = isValidPhoneNumber(raw);
  const showInvalid = touched && raw.length > 0 && !valid;

  const handleChange = (next: string) => {
    // allow only digits, spaces, +, and -
    const cleaned = next.replace(/[^\d+\s-]/g, "");
    setRaw(cleaned);
    const e164 = formatPhoneNumber(cleaned);
    onChange(e164, isValidPhoneNumber(cleaned));
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={id}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <div className="relative">
        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          disabled={disabled}
          required={required}
          value={raw}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setTouched(true)}
          className={cn(
            "pl-9",
            showInvalid && "border-destructive focus-visible:ring-destructive"
          )}
        />
      </div>
      {showError && showInvalid && (
        <p className="text-xs text-destructive">
          Enter a valid 10-digit Indian mobile number.
        </p>
      )}
      {valid && raw.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Will be sent as: <span className="font-mono">{displayPhoneNumber(raw)}</span>
        </p>
      )}
    </div>
  );
};

export default PhoneInput;