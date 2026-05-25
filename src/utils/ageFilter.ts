import type { Doctor, Specialization } from "../types";

/** A "strict kid" range: upper bound strictly below 18 (e.g., 0..17). */
export function isStrictKid(ageFrom?: number, ageTo?: number): boolean {
  void ageFrom;
  return typeof ageTo === "number" && ageTo < 18;
}

/** A "strict adult" range: lower bound at 18 or above (e.g., 18..99). */
export function isStrictAdult(ageFrom?: number, ageTo?: number): boolean {
  void ageTo;
  return typeof ageFrom === "number" && ageFrom >= 18;
}

/**
 * Per-spec aggregation across all (doctor, clinic, spec) and
 * (doctor, clinic, spec, service) rows. We collect STRICT signals only
 * (narrow kid / narrow adult). Wide ranges (0..120) contribute nothing —
 * a general "ЭКГ" service on a pediatric doctor mustn't push them into
 * adult mode.
 *
 * Aggregating per-(doctor, clinic, spec) row (NOT per doctor as a whole)
 * keeps each spec independent — a doctor with both "Кардиолог" and
 * "Детский кардиолог" doesn't leak the kid flag into the adult one.
 *
 * Returns three maps so callers can apply the rule:
 *   • strict signal present → trust it (kid mode iff specStrictKid, etc.)
 *   • no strict signal anywhere → permissive (show in both modes).
 */
export function buildSpecAgeFlags(
  doctors: Doctor[],
  clinicId?: string
): {
  specStrictKid: Map<string, boolean>;
  specStrictAdult: Map<string, boolean>;
  specHasAnyEntry: Map<string, boolean>;
} {
  const specStrictKid = new Map<string, boolean>();
  const specStrictAdult = new Map<string, boolean>();
  const specHasAnyEntry = new Map<string, boolean>();

  for (const doc of doctors) {
    for (const cl of doc.clinics || []) {
      if (clinicId && cl.clinicId !== clinicId) continue;
      for (const sp of cl.specializations || []) {
        const sid = sp.specializationId;
        specHasAnyEntry.set(sid, true);
        if (isStrictKid(sp.ageFrom, sp.ageTo)) specStrictKid.set(sid, true);
        if (isStrictAdult(sp.ageFrom, sp.ageTo)) specStrictAdult.set(sid, true);
        for (const svc of sp.services || []) {
          if (isStrictKid(svc.ageFrom, svc.ageTo)) specStrictKid.set(sid, true);
          if (isStrictAdult(svc.ageFrom, svc.ageTo)) specStrictAdult.set(sid, true);
        }
      }
    }
  }
  return { specStrictKid, specStrictAdult, specHasAnyEntry };
}

/** Spec name contains explicit pediatric marker. */
export function specNameIsPediatric(name: string): boolean {
  return /детск|педиатр/i.test(name);
}

/**
 * Whether a Specialization should appear in the current mode.
 *
 * Priority of signals (1С age ranges are unreliable — mostly wide 0..120 —
 * so the spec name is the strongest signal we have):
 *
 *   1. Spec NAME contains "детск" or "педиатр" → kid-only, no exceptions.
 *   2. Strict global age range (ageTo < 18 / ageFrom >= 18) → trust it.
 *   3. Per-spec aggregation across doctor data:
 *        • Kid mode: STRICT — only show if at least one strict kid signal.
 *        • Adult mode: PERMISSIVE — show unless strictly kid (kid + no adult).
 */
export function specShowsInMode(
  spec: Specialization,
  flags: {
    specStrictKid: Map<string, boolean>;
    specStrictAdult: Map<string, boolean>;
    specHasAnyEntry: Map<string, boolean>;
  },
  isChild: boolean
): boolean {
  // 1. Explicit pediatric name wins outright.
  if (specNameIsPediatric(spec.name)) return isChild;

  // 2. Strict global age range.
  if (isStrictKid(spec.ageFrom, spec.ageTo)) return isChild;
  if (isStrictAdult(spec.ageFrom, spec.ageTo)) return !isChild;

  // 3. Per-spec aggregation.
  if (!flags.specHasAnyEntry.get(spec.id)) return false;

  const strictKid = flags.specStrictKid.get(spec.id) === true;
  const strictAdult = flags.specStrictAdult.get(spec.id) === true;

  if (isChild) {
    return strictKid;
  }
  return !(strictKid && !strictAdult);
}

/**
 * Whether a Doctor should appear in the current mode under the optional
 * URL-pinned (clinicId, specializationId). Mirror of specShowsInMode:
 *   • Kid mode strict (require strict kid signal).
 *   • Adult mode permissive but excludes strictly-kid doctors.
 */
export function doctorShowsInMode(
  doctor: Doctor,
  clinicId: string | undefined,
  specializationId: string | undefined,
  isChild: boolean
): boolean {
  let hasAnyEntry = false;
  let hasStrictKid = false;
  let hasStrictAdult = false;

  for (const cl of doctor.clinics || []) {
    if (clinicId && cl.clinicId !== clinicId) continue;
    for (const sp of cl.specializations || []) {
      if (specializationId && sp.specializationId !== specializationId) continue;
      hasAnyEntry = true;
      if (isStrictKid(sp.ageFrom, sp.ageTo)) hasStrictKid = true;
      if (isStrictAdult(sp.ageFrom, sp.ageTo)) hasStrictAdult = true;
      for (const svc of sp.services || []) {
        if (isStrictKid(svc.ageFrom, svc.ageTo)) hasStrictKid = true;
        if (isStrictAdult(svc.ageFrom, svc.ageTo)) hasStrictAdult = true;
      }
    }
  }

  if (!hasAnyEntry) return false;
  if (isChild) {
    return hasStrictKid;
  }
  return !(hasStrictKid && !hasStrictAdult);
}

/** Hide pure ultrasound/diagnostic specs from spec list (not age-related). */
export function specNameIsUltrasound(name: string): boolean {
  return /узи|узд|ультразв/i.test(name);
}
