import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Building2 } from "lucide-react";
import { apiGet, apiGetFresh } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useBookingStore } from "../store/booking";
import { collectServiceIds, buildConsultPriceMap, getMinPrice } from "../utils/prices";
import Calendar from "../components/Calendar";
import TimeSlots from "../components/TimeSlots";
import PageTransition from "../components/ui/PageTransition";
import Avatar from "../components/ui/Avatar";
import SkeletonCard from "../components/ui/SkeletonCard";
import type { Schedule, AppointmentSlot, Clinic, Specialization, Doctor, Service } from "../types";

export default function SlotsPage() {
  const navigate = useNavigate();
  const { doctorId } = useParams<{ doctorId: string }>();
  const { clinicId, specializationId, setAppointmentAt, setClinicId, setSpecializationId, setDoctorId, setPrice, setServiceIds, doctorName } =
    useBookingStore();

  const [selectedDate, setSelectedDate] = useState("");

  // Fetch clinic/specialization/doctor names for confirm page display
  const { data: clinicsData } = useApi<Clinic[]>(() => apiGet("/clinics"), []);
  const { data: specsData } = useApi<Specialization[]>(() => apiGet("/specializations"), []);
  const { data: doctorData } = useApi<Doctor>(
    () => doctorId ? apiGet(`/doctors/${doctorId}`, { include: "specializations,services" }) : Promise.resolve(null as unknown as Doctor),
    [doctorId]
  );

  // Fetch service prices for this doctor
  const doctorServiceIds = useMemo(() => {
    if (!doctorData) return "";
    return collectServiceIds([doctorData]).join(",");
  }, [doctorData]);

  const { data: doctorServicesData } = useApi<Service[]>(
    () => {
      if (!doctorServiceIds) return Promise.resolve([]);
      return apiGet("/services", { serviceIds: doctorServiceIds });
    },
    [doctorServiceIds]
  );

  const priceMap = useMemo(
    () => buildConsultPriceMap(doctorServicesData || []),
    [doctorServicesData]
  );

  const { data: schedules, loading } = useApi<Schedule[]>(() => {
    const params: Record<string, string> = {
      doctorIds: doctorId || "",
      include: "appointmentSlots",
    };
    if (clinicId) params.clinicIds = clinicId;
    if (specializationId) params.specializationIds = specializationId;
    return apiGetFresh("/schedules", params);
  }, [doctorId, clinicId, specializationId]);

  // Build set of УЗИ specialization IDs to filter out
  const uziSpecIds = useMemo(() => {
    const ids = new Set<string>();
    for (const spec of specsData || []) {
      if (/узи|узд|ультразв/i.test(spec.name)) {
        ids.add(spec.id);
      }
    }
    return ids;
  }, [specsData]);

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    if (!schedules) return dates;
    const list = Array.isArray(schedules) ? schedules : [];
    for (const s of list) {
      if (s.isBusy) continue;
      if (uziSpecIds.has(s.specializationId)) continue;
      for (const slot of s.appointmentSlots || []) {
        if (slot.isEmpty) {
          dates.add(slot.startAt.slice(0, 10));
        }
      }
    }
    return dates;
  }, [schedules, uziSpecIds]);

  const daySlots = useMemo((): AppointmentSlot[] => {
    if (!selectedDate || !schedules) return [];
    const list = Array.isArray(schedules) ? schedules : [];
    const slots: AppointmentSlot[] = [];
    for (const s of list) {
      if (s.isBusy) continue;
      if (uziSpecIds.has(s.specializationId)) continue;
      for (const slot of s.appointmentSlots || []) {
        if (slot.startAt.startsWith(selectedDate) && slot.isEmpty) {
          slots.push(slot);
        }
      }
    }
    slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return slots;
  }, [selectedDate, schedules, uziSpecIds]);

  // Group day slots by clinic to show clinic name before confirmation
  const daySlotsByClinic = useMemo(() => {
    if (!selectedDate || !schedules) return [];
    const list = Array.isArray(schedules) ? schedules : [];
    const groups: Record<string, { clinicId: string; clinicName: string; slots: AppointmentSlot[] }> = {};
    for (const s of list) {
      if (s.isBusy) continue;
      if (uziSpecIds.has(s.specializationId)) continue;
      for (const slot of s.appointmentSlots || []) {
        if (slot.startAt.startsWith(selectedDate) && slot.isEmpty) {
          if (!groups[s.clinicId]) {
            const clinic = (clinicsData || []).find((c) => c.id === s.clinicId);
            groups[s.clinicId] = {
              clinicId: s.clinicId,
              clinicName: clinic?.shortAddress || clinic?.name || "",
              slots: [],
            };
          }
          groups[s.clinicId].slots.push(slot);
        }
      }
    }
    return Object.values(groups).map((g) => ({
      ...g,
      slots: g.slots.sort((a, b) => a.startAt.localeCompare(b.startAt)),
    }));
  }, [selectedDate, schedules, clinicsData, uziSpecIds]);

  function handleSlotSelect(slot: AppointmentSlot) {
    // Find the schedule that contains this slot (single pass)
    const list = Array.isArray(schedules) ? schedules : [];
    let foundClinicId: string | undefined;
    let foundSpecId: string | undefined;

    outer: for (const s of list) {
      if (s.isBusy) continue;
      for (const sl of s.appointmentSlots || []) {
        if (sl.startAt === slot.startAt) {
          foundClinicId = s.clinicId;
          foundSpecId = s.specializationId;
          const clinic = (clinicsData || []).find((c) => c.id === s.clinicId);
          const spec = (specsData || []).find((sp) => sp.id === s.specializationId);
          setClinicId(s.clinicId, clinic?.shortAddress || clinic?.name || "");
          setSpecializationId(s.specializationId, spec?.name || "");
          break outer;
        }
      }
    }

    // Ensure doctorId is in store (needed when navigating from favorites)
    if (doctorId) {
      const docName = doctorData?.name ||
        [doctorData?.lastName, doctorData?.firstName, doctorData?.middleName].filter(Boolean).join(" ") ||
        doctorName || "";
      setDoctorId(doctorId, docName);
    }

    // Set price from this doctor's services (picks min for the matched spec/clinic)
    if (doctorData && priceMap.size > 0) {
      const minP = getMinPrice(doctorData, priceMap, foundClinicId, foundSpecId);
      if (minP) setPrice(minP);
    }

    // Resolve serviceIds for 1C: validate current serviceId belongs to this clinic/spec,
    // otherwise pick the first matching one
    if (doctorData) {
      const validIds = collectServiceIds([doctorData], foundClinicId, foundSpecId);
      const currentServiceIds = useBookingStore.getState().serviceIds;
      if (!currentServiceIds || !validIds.includes(currentServiceIds)) {
        setServiceIds(validIds.length > 0 ? validIds[0] : "");
      }
    }

    setAppointmentAt(slot.startAt);
    navigate("/confirm");
  }

  return (
    <PageTransition>
      <div className="space-y-4">
        {(doctorName || doctorData?.name) && (
          <div className="flex items-center gap-3">
            <Avatar name={doctorName || doctorData?.name || ""} size="md" />
            <h2 className="text-lg font-semibold text-gray-900">
              {doctorName || doctorData?.name || [doctorData?.lastName, doctorData?.firstName, doctorData?.middleName].filter(Boolean).join(" ")}
            </h2>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <SkeletonCard lines={5} />
            <SkeletonCard lines={5} />
          </div>
        ) : (
          <>
            <Calendar
              availableDates={availableDates}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />

            <AnimatePresence>
              {selectedDate && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="font-medium text-gray-800 mb-2">
                    Время на{" "}
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                    })}
                  </h3>
                  {daySlotsByClinic.length <= 1 ? (
                    <>
                      {daySlotsByClinic.length === 1 && daySlotsByClinic[0].clinicName && (
                        <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                          <Building2 className="w-3.5 h-3.5" />
                          {daySlotsByClinic[0].clinicName}
                        </p>
                      )}
                      <TimeSlots
                        slots={daySlots}
                        selectedTime=""
                        onSelect={handleSlotSelect}
                      />
                    </>
                  ) : (
                    <div className="space-y-3">
                      {daySlotsByClinic.map((group) => (
                        <div key={group.clinicId}>
                          <p className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                            <Building2 className="w-3.5 h-3.5" />
                            {group.clinicName}
                          </p>
                          <TimeSlots
                            slots={group.slots}
                            selectedTime=""
                            onSelect={handleSlotSelect}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </PageTransition>
  );
}
