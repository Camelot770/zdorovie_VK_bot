import type { Doctor } from "../types";

/** A range [ageFrom..ageTo] overlaps the kid band [0..17] iff its lower bound ≤ 17. */
export function rangeOverlapsKid(ageFrom?: number, _ageTo?: number): boolean {
  const lo = ageFrom ?? 0;
  return lo <= 17;
}

/** A range [ageFrom..ageTo] overlaps the adult band [18..120] iff its upper bound ≥ 18. */
export function rangeOverlapsAdult(_ageFrom?: number, ageTo?: number): boolean {
  const hi = ageTo ?? 120;
  return hi >= 18;
}

export function rangeOverlapsMode(
  ageFrom: number | undefined,
  ageTo: number | undefined,
  isChild: boolean
): boolean {
  return isChild ? rangeOverlapsKid(ageFrom, ageTo) : rangeOverlapsAdult(ageFrom, ageTo);
}

/**
 * Per-SPEC aggregation across all (doctor, clinic, spec) and (…, service)
 * rows. A spec is "kid-eligible" if ANY of its rows has a range that overlaps
 * the kid band; mirror for "adult-eligible". Optionally restrict to one clinicId.
 *
 * IMPORTANT: per-doctor aggregation (across the doctor's other specs) would
 * leak — a single doctor practising both "Кардиолог" (adult) and "Детский
 * кардиолог" (kid) would end up tagged as both, polluting both specs.
 * Aggregating per (doctor, clinic, spec) row instead keeps each spec independent.
 */
export function buildSpecAgeFlags(
  doctors: Doctor[],
  clinicId?: string
): {
  specHasKid: Map<string, boolean>;
  specHasAdult: Map<string, boolean>;
} {
  const specHasKid = new Map<string, boolean>();
  const specHasAdult = new Map<string, boolean>();

  for (const doc of doctors) {
    for (const cl of doc.clinics || []) {
      if (clinicId && cl.clinicId !== clinicId) continue;
      for (const sp of cl.specializations || []) {
        const sid = sp.specializationId;
        // Per-(doctor, clinic, spec) range
        if (rangeOverlapsKid(sp.ageFrom, sp.ageTo)) specHasKid.set(sid, true);
        if (rangeOverlapsAdult(sp.ageFrom, sp.ageTo)) specHasAdult.set(sid, true);
        // Per-(doctor, clinic, spec, service) range
        for (const svc of sp.services || []) {
          if (rangeOverlapsKid(svc.ageFrom, svc.ageTo)) specHasKid.set(sid, true);
          if (rangeOverlapsAdult(svc.ageFrom, svc.ageTo)) specHasAdult.set(sid, true);
        }
      }
    }
  }
  return { specHasKid, specHasAdult };
}

/** Hide pure ultrasound/diagnostic specs from spec list (not age-related). */
export function specNameIsUltrasound(name: string): boolean {
  return /узи|узд|ультразв/i.test(name);
}
