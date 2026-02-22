/**
 * Validation helpers for EditableField. Each validator parses the raw input string
 * and returns either a typed value or a failure. Used so that components receive
 * correctly typed values from EditableField.
 */

export type ValidationResult<T> =
  | { success: true; value: T }
  | { success: false };

export function validatePositiveInteger(raw: string): ValidationResult<number> {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return { success: false };
  }
  return { success: true, value: n };
}

export function validateFloatInRange(
  raw: string,
  min: number,
  max: number
): ValidationResult<number> {
  const n = Number(raw.replaceAll(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) {
    return { success: false };
  }
  return { success: true, value: n };
}

export function validateIntegerInRange(
  raw: string,
  min: number,
  max: number
): ValidationResult<number> {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    return { success: false };
  }
  return { success: true, value: n };
}

export function validateNonEmptyString(raw: string): ValidationResult<string> {
  const s = raw.trim();
  if (s.length === 0) {
    return { success: false };
  }
  return { success: true, value: s };
}
