import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UserX, AlertCircle, Heart } from "lucide-react";
import { apiGet, apiGetFresh } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useBookingStore } from "../store/booking";
import { useFavoritesStore } from "../store/favorites";
import { buildConsultPriceMap, getMinPrice } from "../utils/prices";
import DoctorCard from "../components/DoctorCard";
import PageTransition from "../components/ui/PageTransition";
import SkeletonList from "../components/ui/SkeletonList";
import EmptyState from "../components/ui/EmptyState";
import PullToRefresh from "../components/ui/PullToRefresh";
import Badge from "../components/ui/Badge";
import type { Doctor, Clinic, Specialization, Service, Schedule } from "../types";

/** Extract first specialization name for a doctor, given a specializations map. */
function getSpecName(
  doctor: Doctor,
  specsMap: Record<string, string>,
  filterSpecId?: string
): string {
  for (const cl of doctor.clinics || []) {
    for (const sp of cl.specializations || []) {
      if (filterSpecId && sp.specializationId === filterSpecId) {
        return specsMap[sp.specializationId] || "";
      }
      if (!filterSpecId && specsMap[sp.specializationId]) {
        return specsMap[sp.specializationId];
      }
    }
  }
  return "";
}

/** Extract clinic name(s) for a doctor, given a clinics map.
 *  Excludes «Стационар» clinics (not used for outpatient appointments).
 *  Returns an array of unique clinic addresses. */
function getClinicNames(
  doctor: Doctor,
  clinicsMap: Record<string, string>,
  filterClinicId?: string,
  stationarIds?: Set<string>
): string[] {
  if (filterClinicId) {
    for (const cl of doctor.clinics || []) {
      if (cl.clinicId === filterClinicId) {
        const name = clinicsMap[cl.clinicId];
        return name ? [name] : [];
      }
    }
    return [];
  }
  // No filter — show all clinics the doctor works at, excluding Стационар
  const names = (doctor.clinics || [])
    .filter((cl) => !stationarIds || !stationarIds.has(cl.clinicId))
    .map((cl) => clinicsMap[cl.clinicId])
    .filter(Boolean);
  return [...new Set(names)];
}

export default function DoctorsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const clinicId = searchParams.get("clinicId") || "";
  const specializationId = searchParams.get("specializationId") || "";
  const showFavorites = searchParams.get("favorites") === "true";
  const isChild = searchParams.get("isChild") === "true";

  const { setDoctorId, setClinicId, setSpecializationId, setPrice, setServiceIds } = useBookingStore();
  const { favorites } = useFavoritesStore();

  // Fetch doctors
  const { data: doctors, loading, error, refetch } = useApi<Doctor[]>(() => {
    if (showFavorites) {
      if (favorites.length === 0) return Promise.resolve([]);
      return apiGet("/doctors", { include: "description,specializations,services" });
    }
    const params: Record<string, string> = {
      include: "description,specializations,services",
    };
    if (clinicId) params.clinicId = clinicId;
    if (specializationId) params.specializationId = specializationId;
    return apiGet("/doctors", params);
  }, [clinicId, specializationId, showFavorites]);

  // Fetch clinics + specializations for labels
  const { data: clinicsData } = useApi<Clinic[]>(
    () => apiGet("/clinics"),
    []
  );
  const { data: specsData } = useApi<Specialization[]>(
    () => apiGet("/specializations"),
    []
  );

  const clinicsMap: Record<string, string> = {};
  const stationarIds = new Set<string>();
  (clinicsData || []).forEach((c) => {
    clinicsMap[c.id] = c.shortAddress || c.name;
    // Mark inpatient (Стационар) clinics — not used for outpatient appointments
    if (c.name && /стационар/i.test(c.name)) {
      stationarIds.add(c.id);
    }
  });

  const specsMap: Record<string, string> = {};
  (specsData || []).forEach((s) => {
    specsMap[s.id] = s.name;
  });

  // Fetch all services once (cached 15min on backend) for price lookup
  const { data: servicesData } = useApi<Service[]>(
    () => apiGet("/services"),
    []
  );

  const priceMap = useMemo(
    () => buildConsultPriceMap(servicesData || []),
    [servicesData]
  );

  // Fetch schedules for nearest available date (limit to first 20 doctors)
  const scheduleDocIds = useMemo(() => {
    const docs = Array.isArray(doctors) ? doctors : [];
    return docs.slice(0, 20).map((d) => d.id);
  }, [doctors]);

  const scheduleKey = scheduleDocIds.join(",");
  const { data: schedules } = useApi<Schedule[]>(
    () => {
      if (scheduleDocIds.length === 0) return Promise.resolve([]);
      const params: Record<string, string> = {
        doctorIds: scheduleDocIds.join(","),
        include: "appointmentSlots",
      };
      if (clinicId) params.clinicIds = clinicId;
      if (specializationId) params.specializationIds = specializationId;
      return apiGetFresh("/schedules", params);
    },
    [scheduleKey, clinicId, specializationId]
  );

  /** Map doctorId → formatted nearest date string */
  const nearestDateMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!schedules) return map;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const earliest: Record<string, Date> = {};
    for (const sch of Array.isArray(schedules) ? schedules : []) {
      if (sch.isBusy) continue;
      for (const slot of sch.appointmentSlots || []) {
        if (!slot.isEmpty) continue;
        const slotDate = new Date(slot.startAt);
        if (slotDate < now) continue;
        if (!earliest[sch.doctorId] || slotDate < earliest[sch.doctorId]) {
          earliest[sch.doctorId] = slotDate;
        }
      }
    }

    for (const [docId, dt] of Object.entries(earliest)) {
      const dayStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
      if (dayStart.getTime() === todayStart.getTime()) {
        map[docId] = "сегодня";
      } else if (dayStart.getTime() === tomorrowStart.getTime()) {
        map[docId] = "завтра";
      } else {
        map[docId] = dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
      }
    }
    return map;
  }, [schedules]);

  function handleBook(doctor: Doctor) {
    const name =
      doctor.name ||
      [doctor.lastName, doctor.firstName, doctor.middleName]
        .filter(Boolean)
        .join(" ");

    setDoctorId(doctor.id, name);
    // Always set (or clear) to avoid stale values from prior flows
    setClinicId(clinicId || "", clinicId ? (clinicsMap[clinicId] || "") : "");
    setSpecializationId(specializationId || "", specializationId ? (specsMap[specializationId] || "") : "");
    setServiceIds("");

    const minP = getMinPrice(doctor, priceMap, clinicId || undefined, specializationId || undefined);
    if (minP) setPrice(minP);

    navigate(`/slots/${doctor.id}`);
  }

  let list = Array.isArray(doctors) ? doctors : [];

  // Filter doctors by patient age when isChild flag is set
  // Also filter out child-only doctors when NOT isChild (adult mode)
  {
    const patientAge = isChild ? 10 : 30;
    // Detect child specializations by name when ageFrom/ageTo missing
    const childSpecNames = new Set<string>();
    for (const spec of specsData || []) {
      if (spec.ageFrom == null && spec.ageTo == null && /детск/i.test(spec.name)) {
        childSpecNames.add(spec.id);
      }
    }
    if (specializationId) {
      list = list.filter((d) =>
        (d.clinics || []).some((cl) =>
          (cl.specializations || []).some((s) => {
            if (s.specializationId !== specializationId) return false;
            let from = s.ageFrom ?? 0;
            let to = s.ageTo ?? 999;
            if (from === 0 && to === 999 && childSpecNames.has(s.specializationId)) {
              from = 0;
              to = 17;
            }
            return patientAge >= from && patientAge <= to;
          })
        )
      );
    }
  }

  // Filter to favorites if requested
  if (showFavorites) {
    const favIds = new Set(favorites.map((f) => f.id));
    list = list.filter((d) => favIds.has(d.id));
  }

  const title = showFavorites ? "Избранные врачи" : "Врачи";

  return (
    <PageTransition>
      <PullToRefresh onRefresh={refetch}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {list.length > 0 && (
              <Badge variant="neutral">Найдено: {list.length}</Badge>
            )}
          </div>

          {loading ? (
            <SkeletonList count={4} showAvatar />
          ) : error ? (
            <EmptyState
              icon={AlertCircle}
              title="Ошибка загрузки"
              description="Не удалось загрузить список врачей"
              action={{ label: "Назад", onClick: () => navigate(-1) }}
            />
          ) : list.length === 0 ? (
            showFavorites ? (
              <EmptyState
                icon={Heart}
                title="Нет избранных врачей"
                description="Нажмите ♥ на карточке врача, чтобы добавить в избранное"
                action={{ label: "Найти врачей", onClick: () => navigate("/") }}
              />
            ) : (
              <EmptyState
                icon={UserX}
                title="Врачи не найдены"
                description="Попробуйте изменить параметры поиска"
                action={{ label: "Изменить фильтры", onClick: () => navigate(-1) }}
              />
            )
          ) : (
            list.map((doctor) => (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                specializationName={getSpecName(doctor, specsMap, specializationId || undefined)}
                clinicNames={getClinicNames(doctor, clinicsMap, clinicId || undefined, stationarIds)}
                price={getMinPrice(doctor, priceMap, clinicId || undefined, specializationId || undefined)}
                nearestDate={nearestDateMap[doctor.id]}
                onBook={() => handleBook(doctor)}
              />
            ))
          )}
        </div>
      </PullToRefresh>
    </PageTransition>
  );
}
