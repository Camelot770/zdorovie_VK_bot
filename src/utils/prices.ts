import type { Doctor, Service } from "../types";

/**
 * Collect all unique serviceIds from doctors' nested clinics → specializations → services.
 * Optionally filtered by clinicId and/or specializationId.
 */
export function collectServiceIds(
  doctors: Doctor[],
  clinicId?: string,
  specializationId?: string
): string[] {
  const ids = new Set<string>();
  for (const doc of doctors) {
    for (const cl of doc.clinics || []) {
      if (clinicId && cl.clinicId !== clinicId) continue;
      for (const sp of cl.specializations || []) {
        if (specializationId && sp.specializationId !== specializationId) continue;
        for (const svc of sp.services || []) {
          ids.add(svc.serviceId);
        }
      }
    }
  }
  return Array.from(ids);
}

/**
 * From a list of all serviceIds and loaded services,
 * find the best consultation service (primary first, then any consult).
 */
export function findBestConsultServiceId(
  allServiceIds: string[],
  services: Service[]
): string {
  const svcMap = new Map(services.map((s) => [s.id, s]));
  let anyConsult = "";
  for (const sid of allServiceIds) {
    const svc = svcMap.get(sid);
    if (!svc) continue;
    const name = svc.name || "";
    if (CONSULT_RE.test(name)) {
      if (PRIMARY_RE.test(name)) return sid; // best match — return immediately
      if (!anyConsult) anyConsult = sid;
    }
  }
  return anyConsult || allServiceIds[0] || "";
}

/**
 * Build a Map<serviceId, price> from a services array.
 */
export function buildPriceMap(services: Service[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const svc of services) {
    if (svc.price != null && svc.price > 0) {
      map.set(svc.id, svc.price);
    }
  }
  return map;
}

/** Regex matching consultation/appointment service names */
const CONSULT_RE = /при[её]м|консультаци/i;

/** Regex matching primary (первичный) appointment */
const PRIMARY_RE = /первичн/i;

/**
 * Build a price map limited to primary consultation/appointment services.
 * Prefers "первичный" appointments; falls back to any consultation if no primary found.
 */
export function buildConsultPriceMap(services: Service[]): Map<string, number> {
  const primary = new Map<string, number>();
  const any = new Map<string, number>();
  for (const svc of services) {
    if (svc.price != null && svc.price > 0 && CONSULT_RE.test(svc.name || "")) {
      any.set(svc.id, svc.price);
      if (PRIMARY_RE.test(svc.name || "")) {
        primary.set(svc.id, svc.price);
      }
    }
  }
  return primary.size > 0 ? primary : any;
}

/**
 * Find the minimum service price for a doctor, optionally filtered by clinic/specialization.
 */
/**
 * Group consultation services by specializationId.
 * Aggregates from doctor → clinics → specializations → services,
 * then maps to full Service objects filtered by CONSULT_RE.
 */
export function groupServicesBySpecialization(
  doctors: Doctor[],
  services: Service[],
  clinicId?: string
): Record<string, Service[]> {
  // 1. Build serviceId → Service lookup (primary consultations preferred)
  const primaryLookup = new Map<string, Service>();
  const anyLookup = new Map<string, Service>();
  for (const svc of services) {
    if (svc.price != null && svc.price > 0 && CONSULT_RE.test(svc.name || "")) {
      anyLookup.set(svc.id, svc);
      if (PRIMARY_RE.test(svc.name || "")) {
        primaryLookup.set(svc.id, svc);
      }
    }
  }
  // Use both lookups — prefer primary per specialization, fall back to any
  const svcLookup = new Map([...anyLookup, ...primaryLookup]);

  // 2. Collect serviceIds per specializationId from doctor data
  const specSvcIds: Record<string, Set<string>> = {};
  for (const doc of doctors) {
    for (const cl of doc.clinics || []) {
      if (clinicId && cl.clinicId !== clinicId) continue;
      for (const sp of cl.specializations || []) {
        const specId = sp.specializationId;
        if (!specSvcIds[specId]) specSvcIds[specId] = new Set();
        for (const svc of sp.services || []) {
          if (svcLookup.has(svc.serviceId)) {
            specSvcIds[specId].add(svc.serviceId);
          }
        }
      }
    }
  }

  // 3. Map to Service objects, sort by price
  const result: Record<string, Service[]> = {};
  for (const [specId, ids] of Object.entries(specSvcIds)) {
    const svcs = Array.from(ids)
      .map((id) => svcLookup.get(id)!)
      .filter(Boolean)
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    if (svcs.length > 0) result[specId] = svcs;
  }

  return result;
}

/**
 * Find the minimum service price for a doctor, optionally filtered by clinic/specialization.
 */
export function getMinPrice(
  doctor: Doctor,
  priceMap: Map<string, number>,
  clinicId?: string,
  specializationId?: string
): number | undefined {
  let min: number | undefined;
  for (const cl of doctor.clinics || []) {
    if (clinicId && cl.clinicId !== clinicId) continue;
    for (const sp of cl.specializations || []) {
      if (specializationId && sp.specializationId !== specializationId) continue;
      for (const svc of sp.services || []) {
        const price = priceMap.get(svc.serviceId);
        if (price != null && (min == null || price < min)) {
          min = price;
        }
      }
    }
  }
  return min;
}
