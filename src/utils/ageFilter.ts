import type { Doctor, Service, Specialization } from "../types";

/**
 * Aggregate per-doctor "kid/adult" flags. A doctor is "kid-friendly" if ANY
 * of these are true across all their (clinic, spec, service) rows:
 *   • service NAME contains "детск/педиатр"
 *   • spec NAME contains "детск/педиатр"
 *   • per-spec or per-service ageTo < 18 (kid age bound)
 * Mirror for "adult-friendly":
 *   • service NAME exists and DOESN'T match kid markers
 *   • per-spec or per-service ageFrom >= 18 (adult lower bound)
 *
 * A doctor may end up with BOTH flags (mixed practice — visible in both
 * modes). A doctor with no signal at all defaults to adult so they still
 * show up somewhere.
 *
 * This is intentionally permissive: better to over-show than to hide a
 * legitimate pediatric doctor whose 1С record is sparse.
 */
export function buildDoctorAgeFlags(
  doctors: Doctor[],
  services: Service[],
  specializations: Specialization[]
): {
  docHasKid: Map<string, boolean>;
  docHasAdult: Map<string, boolean>;
} {
  const serviceIsKid = new Map<string, boolean>();
  for (const svc of services) {
    if (!svc.name) continue;
    serviceIsKid.set(svc.id, /детск|педиатр/i.test(svc.name));
  }
  const specIsKidByName = new Map<string, boolean>();
  for (const sp of specializations) {
    specIsKidByName.set(sp.id, /детск|педиатр/i.test(sp.name));
  }

  const docHasKid = new Map<string, boolean>();
  const docHasAdult = new Map<string, boolean>();

  for (const doc of doctors) {
    let hasKid = false;
    let hasAdult = false;

    for (const cl of doc.clinics || []) {
      for (const sp of cl.specializations || []) {
        // Spec name signal
        if (specIsKidByName.get(sp.specializationId)) hasKid = true;
        // Per-spec age range (only narrow, unambiguous bounds count)
        if (typeof sp.ageTo === "number" && sp.ageTo < 18) hasKid = true;
        if (typeof sp.ageFrom === "number" && sp.ageFrom >= 18) hasAdult = true;

        for (const svc of sp.services || []) {
          // Service name signal
          const kid = serviceIsKid.get(svc.serviceId);
          if (kid === true) hasKid = true;
          else if (kid === false) hasAdult = true;
          // Per-service age range
          if (typeof svc.ageTo === "number" && svc.ageTo < 18) hasKid = true;
          if (typeof svc.ageFrom === "number" && svc.ageFrom >= 18) hasAdult = true;
        }
      }
    }
    // No signals at all → default to adult.
    if (!hasKid && !hasAdult) hasAdult = true;

    docHasKid.set(doc.id, hasKid);
    docHasAdult.set(doc.id, hasAdult);
  }

  return { docHasKid, docHasAdult };
}

/** Quick check: is a spec name an explicit pediatric label like "Детский ..."? */
export function specNameIsPediatric(name: string): boolean {
  return /детск|педиатр/i.test(name);
}

/** Quick check: hide pure ultrasound/diagnostic specs (kept for parity). */
export function specNameIsUltrasound(name: string): boolean {
  return /узи|узд|ультразв/i.test(name);
}
