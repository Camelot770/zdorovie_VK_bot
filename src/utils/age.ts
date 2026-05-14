/** Calculate age from a birth date string (YYYY-MM-DD or DD.MM.YYYY). */
export function calcAge(birthDate: string): number | null {
  if (!birthDate) return null;
  try {
    let y: number, m: number, d: number;
    if (birthDate.includes("-")) {
      [y, m, d] = birthDate.split("-").map(Number);
    } else if (birthDate.includes(".")) {
      [d, m, y] = birthDate.split(".").map(Number);
    } else {
      return null;
    }
    const today = new Date();
    let age = today.getFullYear() - y;
    if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) {
      age--;
    }
    return age >= 0 && age < 200 ? age : null;
  } catch {
    return null;
  }
}

/** Russian plural form: "1 год", "2 года", "5 лет". */
export function ageLabel(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 19) return "лет";
  const r = n % 10;
  if (r === 1) return "год";
  if (r >= 2 && r <= 4) return "года";
  return "лет";
}

/** Convenience: format as "32 года" or empty string if age unknown. */
export function ageDisplay(birthDate: string): string {
  const a = calcAge(birthDate);
  return a == null ? "" : `${a} ${ageLabel(a)}`;
}
