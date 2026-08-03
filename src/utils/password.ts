/**
 * Validates password strength according to OWASP security guidelines:
 * - Minimum 8 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character (!@#$%^&* etc)
 */
export function validatePasswordComplexity(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Kata sandi minimal 8 karakter.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Kata sandi harus mengandung minimal 1 huruf besar (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Kata sandi harus mengandung minimal 1 huruf kecil (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Kata sandi harus mengandung minimal 1 angka (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'Kata sandi harus mengandung minimal 1 karakter simbol/spesial (!@#$%^&* dll).' };
  }
  return { valid: true };
}
