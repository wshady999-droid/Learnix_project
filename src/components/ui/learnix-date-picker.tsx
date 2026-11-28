"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTodayDateString } from "@/lib/date-validation";

interface LearnixDatePickerProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  minDate?: string;
  allowExistingPastValue?: string | null;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * LearnixDatePicker — enforces the global "no past dates" rule on the client
 * while preserving historical dates when editing an existing record unless modified.
 */
export function LearnixDatePicker({
  id,
  label,
  value,
  onChange,
  required = false,
  error,
  minDate,
  allowExistingPastValue,
  disabled,
  placeholder,
}: LearnixDatePickerProps) {
  const effectiveMin = useMemo(
    () => minDate ?? getTodayDateString(),
    [minDate],
  );

  const isHistoricalUnchanged = Boolean(
    value &&
      allowExistingPastValue &&
      allowExistingPastValue.slice(0, 10) === value.slice(0, 10),
  );

  const validationError =
    value && !isHistoricalUnchanged && value < effectiveMin
      ? "This date is in the past. Please select today or a future date."
      : null;

  return (
    <div className="space-y-1">
      {label && <Label htmlFor={id}>{label}</Label>}
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={effectiveMin}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        className={[
          "max-w-sm",
          error || validationError ? "border-destructive" : "",
        ]
          .join(" ")
          .trim()}
      />
      {(error || validationError) && (
        <p className="text-xs text-destructive">{error || validationError}</p>
      )}
    </div>
  );
}
