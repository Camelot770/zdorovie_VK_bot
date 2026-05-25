import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useBookingStore } from "../store/booking";
import { HeartPulse } from "lucide-react";
import AgeToggle from "../components/AgeToggle";
import ClinicSelect from "../components/ClinicSelect";
import SpecializationAccordion from "../components/SpecializationAccordion";
import DoctorSearch from "../components/DoctorSearch";
import PageTransition from "../components/ui/PageTransition";
import SkeletonCard from "../components/ui/SkeletonCard";
import { groupServicesBySpecialization, collectServiceIds } from "../utils/prices";
import { buildDoctorAgeFlags, specNameIsPediatric, specNameIsUltrasound } from "../utils/ageFilter";
import type { Clinic, Specialization, Doctor, Service } from "../types";

interface MainPageData {
  clinics: Clinic[];
  specializations: Specialization[];
  doctors: Doctor[];
  services: Service[];
}

/**
 * Try the combined endpoint first; if it fails (404 = backend not deployed yet),
 * fall back to individual parallel calls.
 */
async function fetchMainPageData(): Promise<MainPageData> {
  try {
    return await apiGet<MainPageData>("/main-page-data");
  } catch {
    // Fallback: load individually (parallel where possible)
    const [clinics, specializations, doctors] = await Promise.all([
      apiGet<Clinic[]>("/clinics"),
      apiGet<Specialization[]>("/specializations"),
      apiGet<Doctor[]>("/doctors", { include: "specializations,services" }),
    ]);

    // Collect serviceIds from doctors and load services
    const ids = collectServiceIds(doctors || []);
    let services: Service[] = [];
    if (ids.length > 0) {
      const CHUNK = 40;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        chunks.push(ids.slice(i, i + CHUNK));
      }
      const results = await Promise.all(
        chunks.map((c) => apiGet<Service[]>("/services", { serviceIds: c.join(",") }))
      );
      services = results.flat();
    }

    return {
      clinics: clinics || [],
      specializations: specializations || [],
      doctors: doctors || [],
      services,
    };
  }
}

export default function MainPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    isChild,
    setIsChild,
    clinicId,
    setClinicId,
    setSpecializationId,
    setDoctorId,
    setServiceIds,
  } = useBookingStore();

  // Single call with automatic fallback to individual endpoints
  const { data: mainData, loading } = useApi<MainPageData>(
    fetchMainPageData,
    []
  );

  const clinics = mainData?.clinics || [];
  const allSpecializations = mainData?.specializations || [];
  const doctors = mainData?.doctors || [];
  const services = mainData?.services || [];

  // Spec/clinic visibility uses a per-doctor aggregate (kid/adult flag built
  // from service names, spec names AND per-(doctor,spec,service) age bounds
  // in 1С). See utils/ageFilter.ts.
  const specializations = useMemo(() => {
    const { docHasKid, docHasAdult } = buildDoctorAgeFlags(doctors, services, allSpecializations);

    return allSpecializations.filter((s) => {
      if (specNameIsUltrasound(s.name)) return false;

      // Explicit pediatric spec by NAME → kid-only (no need to scan doctors).
      if (specNameIsPediatric(s.name)) return isChild;

      // Wait for doctor list to load
      if (!doctors || doctors.length === 0) return true;

      // Neutral spec — show if at least one practising doctor (at the
      // optional selected clinic) has the matching aggregate profile.
      for (const doc of doctors) {
        let practises = false;
        for (const cl of doc.clinics || []) {
          if (clinicId && cl.clinicId !== clinicId) continue;
          for (const sp of cl.specializations || []) {
            if (sp.specializationId === s.id) {
              practises = true;
              break;
            }
          }
          if (practises) break;
        }
        if (!practises) continue;
        if (isChild && docHasKid.get(doc.id)) return true;
        if (!isChild && docHasAdult.get(doc.id)) return true;
      }
      return false;
    });
  }, [allSpecializations, isChild, clinicId, doctors, services]);

  // Filter clinics: only those that have at least one doctor practising a
  // specialization matching the patient age (by name only).
  const filteredClinics = useMemo(() => {
    const { docHasKid, docHasAdult } = buildDoctorAgeFlags(doctors, services, allSpecializations);
    const clinicIdsWithDocs = new Set<string>();
    for (const doc of doctors) {
      const matches = isChild ? docHasKid.get(doc.id) : docHasAdult.get(doc.id);
      if (!matches) continue;
      for (const cl of doc.clinics || []) {
        clinicIdsWithDocs.add(cl.clinicId);
      }
    }
    return clinics.filter((c) => clinicIdsWithDocs.has(c.id));
  }, [clinics, allSpecializations, doctors, services, isChild]);

  // Reset clinic selection if current clinic is not in filtered list
  useEffect(() => {
    if (clinicId && filteredClinics.length > 0 && !filteredClinics.some((c) => c.id === clinicId)) {
      setClinicId("", "");
    }
  }, [filteredClinics, clinicId, setClinicId]);

  // Build specialization → services mapping
  const servicesBySpec = useMemo(
    () => groupServicesBySpecialization(doctors, services, clinicId || undefined),
    [doctors, services, clinicId]
  );

  useEffect(() => {
    const preselectedClinic = searchParams.get("clinicId");
    if (preselectedClinic && clinics.length > 0) {
      const clinic = clinics.find((c) => c.id === preselectedClinic);
      if (clinic) {
        setClinicId(clinic.id, clinic.shortAddress || clinic.name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, clinics]);

  function handleDoctorSelect(doctor: Doctor, serviceId?: string, specId?: string, specName?: string) {
    const name =
      doctor.name ||
      [doctor.lastName, doctor.firstName, doctor.middleName]
        .filter(Boolean)
        .join(" ");
    setDoctorId(doctor.id, name);
    // Always set specialization (clear if not provided, e.g. from DoctorSearch)
    setSpecializationId(specId || "", specName || "");
    // Save selected serviceId (from accordion) or clear it
    setServiceIds(serviceId || "");
    navigate(`/slots/${doctor.id}`);
  }

  function handleSpecSelect(specId: string, specName: string) {
    setSpecializationId(specId, specName);
    const params = new URLSearchParams();
    if (clinicId) params.set("clinicId", clinicId);
    params.set("specializationId", specId);
    if (isChild) params.set("isChild", "true");
    navigate(`/doctors?${params.toString()}`);
  }

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl p-4 shadow-lg flex items-center gap-3.5 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -right-2 bottom-0 w-16 h-16 rounded-full bg-white/5" />
          <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <HeartPulse className="w-6 h-6 text-white" />
          </div>
          <div className="relative z-10">
            <h2 className="text-[15px] font-bold text-white">Запись на приём</h2>
            <p className="text-[12px] text-white/80 mt-0.5">Выберите специальность или найдите врача</p>
          </div>
        </div>

        <AgeToggle isChild={isChild} onChange={setIsChild} />

        {loading ? (
          <SkeletonCard lines={2} />
        ) : (
          <ClinicSelect
            clinics={filteredClinics}
            value={clinicId}
            onChange={setClinicId}
            loading={false}
          />
        )}

        <DoctorSearch
          clinicId={clinicId}
          specializationId=""
          onSelect={handleDoctorSelect}
        />

        {loading ? (
          <div className="space-y-2">
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
          </div>
        ) : (
          <SpecializationAccordion
            specializations={specializations}
            servicesBySpec={servicesBySpec}
            onSelectSpec={handleSpecSelect}
          />
        )}
      </div>
    </PageTransition>
  );
}
