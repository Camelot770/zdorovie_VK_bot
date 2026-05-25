import type { Doctor } from "../types";

/**
 * Aggregate per-doctor kid/adult flags purely from 1С age ranges (no names).
 *
 * For every (doctor, clinic, spec) and each of its (service) entries we look
 * at ageFrom/ageTo. A range overlaps "kid" mode if its lower bound is ≤ 17;
 * it overlaps "adult" mode if its upper bound is ≥ 18. Undefined bounds
 * default to 0 / 120 (open-ended).
 *
 * A doctor may end up with both flags set (mixed practice — visible in both
 * modes). A doctor with no age data at all defaults to adult so they still
 * appear somewhere.
 */
export function buildDoctorAgeFlags(doctors: Doctor[]): {
  docHasKid: Map<string, boolean>;
  docHasAdult: Map<string, boolean>;
} {
  const docHasKid = new Map<string, boolean>();
  const docHasAdult = new Map<string, boolean>();

  for (const doc of doctors) {
    let hasKid = false;
    let hasAdult = false;

    for (const cl of doc.clinics || []) {
      for (const sp of cl.specializations || []) {
        // Per-(doctor, clinic, spec) range
        const spLo = sp.ageFrom ?? 0;
        const spHi = sp.ageTo ?? 120;
        if (spLo <= 17) hasKid = true;
        if (spHi >= 18) hasAdult = true;

        // Per-(doctor, clinic, spec, service) range
        for (const svc of sp.services || []) {
          const svcLo = svc.ageFrom ?? 0;
          const svcHi = svc.ageTo ?? 120;
          if (svcLo <= 17) hasKid = true;
          if (svcHi >= 18) hasAdult = true;
        }
      }
    }
    if (!hasKid && !hasAdult) hasAdult = true;
    docHasKid.set(doc.id, hasKid);
    docHasAdult.set(doc.id, hasAdult);
  }

  return { docHasKid, docHasAdult };
}

/** Hide pure ultrasound/diagnostic specs from spec list (not age-related). */
export function specNameIsUltrasound(name: string): boolean {
  return /узи|узд|ультразв/i.test(name);
}
