import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users,
  Stethoscope,
  Building2,
  User,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Clock,
  Shield,
} from "lucide-react";
import { apiGet, apiGetFresh, apiPost } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { useBookingStore } from "../store/booking";
import { collectServiceIds, buildConsultPriceMap, getMinPrice, findBestConsultServiceId } from "../utils/prices";
import Calendar from "../components/Calendar";
import TimeSlots from "../components/TimeSlots";
import Avatar from "../components/ui/Avatar";
import SkeletonCard from "../components/ui/SkeletonCard";
import PageTransition from "../components/ui/PageTransition";
import type {
  Clinic,
  Specialization,
  Doctor,
  Service,
  Schedule,
  AppointmentSlot,
  Patient,
  LinkedPatient,
} from "../types";

// ─── Step definitions ───
const STEPS = [
  { key: "patient", label: "Пациент", icon: Users },
  { key: "specialization", label: "Специальность", icon: Stethoscope },
  { key: "clinic", label: "Филиал", icon: Building2 },
  { key: "doctor", label: "Врач", icon: User },
  { key: "slots", label: "Дата и время", icon: CalendarDays },
  { key: "confirm", label: "Подтверждение", icon: CheckCircle },
] as const;

// ─── Animation variants ───
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

// ─── Helper: doctor display name ───
function docName(d: Doctor): string {
  return (
    d.name ||
    [d.lastName, d.firstName, d.middleName].filter(Boolean).join(" ")
  );
}

// ─── Main component ───
export default function BookingWizardPage() {
  const navigate = useNavigate();
  const { patientId, patientName, maxUserId, loading: authLoading } = useAuth();

  const bookingStore = useBookingStore();

  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const currentStep = STEPS[stepIdx].key;

  // ─── Local state ───
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState("");
  const [selectedSpecId, setSelectedSpecId] = useState("");
  const [selectedSpecName, setSelectedSpecName] = useState("");
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [selectedClinicName, setSelectedClinicName] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedDoctorName, setSelectedDoctorName] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState("");
  const [selectedPrice, setSelectedPrice] = useState(0);

  // Linked patients list
  const [linkedPatients, setLinkedPatients] = useState<LinkedPatient[]>([]);
  const [linkedPatientsLoading, setLinkedPatientsLoading] = useState(false);
  const [linkedPatientsFetched, setLinkedPatientsFetched] = useState(false);

  // Phone linking state
  const [foundPatients, setFoundPatients] = useState<Patient[]>([]);
  const [showPhoneForm, setShowPhoneForm] = useState(false);

  // New patient registration form
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [regLastName, setRegLastName] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regMiddleName, setRegMiddleName] = useState("");
  const [regGender, setRegGender] = useState("");
  const [regBirthDate, setRegBirthDate] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Load linked patients list
  useEffect(() => {
    if (!maxUserId || linkedPatientsFetched || linkedPatientsLoading) return;
    setLinkedPatientsLoading(true);
    apiGetFresh<LinkedPatient[]>(`/auth/patients/${maxUserId}`, { source: "vk" })
      .then((pts) => {
        setLinkedPatients(pts || []);
        // Auto-select if only one patient
        if (pts && pts.length === 1 && !selectedPatientId) {
          setSelectedPatientId(pts[0].patientId);
          setSelectedPatientName(pts[0].fullName);
        }
      })
      .catch(() => {
        // Fallback to single patient from auth
        if (patientId && patientName && !selectedPatientId) {
          setSelectedPatientId(patientId);
          setSelectedPatientName(patientName);
        }
      })
      .finally(() => {
        setLinkedPatientsLoading(false);
        setLinkedPatientsFetched(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxUserId]);

  // ─── Data loading ───
  const { data: specializations, loading: specsLoading } = useApi<Specialization[]>(
    () => apiGet("/specializations"),
    []
  );
  const { data: clinics, loading: clinicsLoading } = useApi<Clinic[]>(
    () => apiGet("/clinics"),
    []
  );

  // Doctors filtered by specialization + clinic
  const doctorParams = useMemo(() => {
    const p: Record<string, string> = { include: "specializations,services" };
    if (selectedSpecId) p.specializationId = selectedSpecId;
    if (selectedClinicId) p.clinicId = selectedClinicId;
    return p;
  }, [selectedSpecId, selectedClinicId]);

  const { data: doctors, loading: doctorsLoading } = useApi<Doctor[]>(
    () =>
      selectedSpecId
        ? apiGet("/doctors", doctorParams)
        : Promise.resolve([]),
    [selectedSpecId, selectedClinicId]
  );

  // Services for price display
  const serviceIds = useMemo(() => {
    if (!doctors || doctors.length === 0) return "";
    return collectServiceIds(doctors).join(",");
  }, [doctors]);

  const { data: servicesData } = useApi<Service[]>(
    () => (serviceIds ? apiGet("/services", { serviceIds }) : Promise.resolve([])),
    [serviceIds]
  );

  const priceMap = useMemo(
    () => buildConsultPriceMap(servicesData || []),
    [servicesData]
  );

  // Schedules for selected doctor
  const { data: schedules, loading: schedulesLoading } = useApi<Schedule[]>(
    () => {
      if (!selectedDoctorId) return Promise.resolve([]);
      const params: Record<string, string> = {
        doctorIds: selectedDoctorId,
        include: "appointmentSlots",
      };
      if (selectedClinicId) params.clinicIds = selectedClinicId;
      if (selectedSpecId) params.specializationIds = selectedSpecId;
      return apiGetFresh("/schedules", params);
    },
    [selectedDoctorId, selectedClinicId, selectedSpecId]
  );

  // Available dates from schedules
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    if (!schedules) return dates;
    for (const s of Array.isArray(schedules) ? schedules : []) {
      if (s.isBusy) continue;
      for (const slot of s.appointmentSlots || []) {
        if (slot.isEmpty) dates.add(slot.startAt.slice(0, 10));
      }
    }
    return dates;
  }, [schedules]);

  // Day slots
  const daySlots = useMemo((): AppointmentSlot[] => {
    if (!selectedDate || !schedules) return [];
    const slots: AppointmentSlot[] = [];
    for (const s of Array.isArray(schedules) ? schedules : []) {
      if (s.isBusy) continue;
      for (const slot of s.appointmentSlots || []) {
        if (slot.startAt.startsWith(selectedDate) && slot.isEmpty)
          slots.push(slot);
      }
    }
    return slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [selectedDate, schedules]);

  // Filter out inpatient clinics
  const filteredClinics = useMemo(() => {
    if (!clinics) return [];
    return clinics.filter((c) => !/стационар/i.test(c.name || ""));
  }, [clinics]);

  // Filter clinics to those where the selected specialization is available
  const clinicsForSpec = useMemo(() => {
    if (!selectedSpecId || !doctors || doctors.length === 0) return filteredClinics;
    const clinicIds = new Set<string>();
    for (const doc of doctors) {
      for (const cl of doc.clinics || []) {
        for (const sp of cl.specializations || []) {
          if (sp.specializationId === selectedSpecId) {
            clinicIds.add(cl.clinicId);
          }
        }
      }
    }
    if (clinicIds.size === 0) return filteredClinics;
    return filteredClinics.filter((c) => clinicIds.has(c.id));
  }, [selectedSpecId, doctors, filteredClinics]);

  // ─── Navigation ───
  function goNext() {
    if (stepIdx < STEPS.length - 1) {
      setDirection(1);
      setStepIdx(stepIdx + 1);
    }
  }

  function goBack() {
    if (stepIdx > 0) {
      setDirection(-1);
      setStepIdx(stepIdx - 1);
    }
  }


  // ─── Submit booking ───
  async function handleConfirmBooking() {
    if (!selectedPatientId || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError("");

    // Resolve serviceIds and schedule context
    const schedList = Array.isArray(schedules) ? schedules : [];
    let resolvedClinicId = selectedClinicId;
    let resolvedSpecId = selectedSpecId;

    for (const s of schedList) {
      if (s.isBusy) continue;
      for (const sl of s.appointmentSlots || []) {
        if (sl.startAt === selectedSlot.startAt) {
          resolvedClinicId = s.clinicId || resolvedClinicId;
          resolvedSpecId = s.specializationId || resolvedSpecId;
          break;
        }
      }
    }

    try {
      await apiPost("/records", {
        appointmentAt: selectedSlot.startAt,
        clinicId: resolvedClinicId,
        doctorId: selectedDoctorId,
        specializationId: resolvedSpecId,
        patientId: selectedPatientId,
        serviceIds: selectedServiceIds,
      });
      // Sync to booking store for SuccessPage
      bookingStore.setDoctorId(selectedDoctorId, selectedDoctorName);
      bookingStore.setClinicId(resolvedClinicId, selectedClinicName);
      bookingStore.setSpecializationId(resolvedSpecId, selectedSpecName);
      bookingStore.setAppointmentAt(selectedSlot.startAt);
      bookingStore.setPatientId(selectedPatientId);
      navigate("/success");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Ошибка при создании записи"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Slot select handler ───
  function handleSlotClick(slot: AppointmentSlot) {
    setSelectedSlot(slot);

    // Resolve serviceIds
    if (doctors && selectedDoctorId) {
      const doc = doctors.find((d) => d.id === selectedDoctorId);
      if (doc) {
        const validIds = collectServiceIds(
          [doc],
          selectedClinicId || undefined,
          selectedSpecId || undefined
        );
        // Pick the best consultation service, not just the first one
        const bestId = findBestConsultServiceId(validIds, servicesData || []);
        setSelectedServiceIds(bestId);
        const minP = getMinPrice(
          doc,
          priceMap,
          selectedClinicId || undefined,
          selectedSpecId || undefined
        );
        if (minP) setSelectedPrice(minP);
      }
    }

    goNext();
  }

  // ─── Step progress indicator ───
  function StepProgress() {
    return (
      <div className="flex items-center justify-between mb-4 px-1">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === stepIdx;
          const isDone = i < stepIdx;
          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? "bg-primary-600 text-white shadow-md shadow-primary-600/30"
                      : isDone
                      ? "bg-primary-100 text-primary-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-[9px] mt-1 font-medium leading-tight text-center max-w-[50px] ${
                    isActive ? "text-primary-600" : isDone ? "text-primary-500" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-3 h-0.5 mx-0.5 mt-[-12px] rounded-full transition-colors ${
                    i < stepIdx ? "bg-primary-400" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Register new patient ───
  async function handleRegisterPatient() {
    if (!maxUserId || !regLastName || !regFirstName || !regGender || !regBirthDate) return;
    setRegistering(true);
    setRegError("");
    try {
      const result = await apiPost<{ status: string; patientId: string; fullName: string }>(
        "/auth/register",
        {
          // VK users are stored under prefixed key so MAX/VK never collide
          max_user_id: `vk:${maxUserId}`,
          lastName: regLastName,
          firstName: regFirstName,
          middleName: regMiddleName || undefined,
          noMiddleName: !regMiddleName,
          gender: regGender,
          birthDate: regBirthDate,
          phone: regPhone.replace(/\D/g, ""),
        }
      );
      setSelectedPatientId(result.patientId);
      setSelectedPatientName(result.fullName);
      // Add to linked list
      setLinkedPatients((prev) => [
        ...prev,
        { patientId: result.patientId, fullName: result.fullName, birthDate: regBirthDate },
      ]);
      setShowRegisterForm(false);
    } catch {
      setRegError("Ошибка создания пациента. Попробуйте позже.");
    } finally {
      setRegistering(false);
    }
  }

  // ─── Step: Patient ───
  function PatientStep() {
    if (authLoading || linkedPatientsLoading) {
      return <SkeletonCard lines={3} />;
    }

    // Registration form
    if (showRegisterForm) {
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Новый пациент</p>
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 space-y-3">
            <input
              value={regLastName}
              onChange={(e) => setRegLastName(e.target.value)}
              placeholder="Фамилия *"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
            />
            <input
              value={regFirstName}
              onChange={(e) => setRegFirstName(e.target.value)}
              placeholder="Имя *"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
            />
            <input
              value={regMiddleName}
              onChange={(e) => setRegMiddleName(e.target.value)}
              placeholder="Отчество"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRegGender("male")}
                className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all ${
                  regGender === "male"
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                Мужской
              </button>
              <button
                onClick={() => setRegGender("female")}
                className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all ${
                  regGender === "female"
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                Женский
              </button>
            </div>
            <input
              type="date"
              value={regBirthDate}
              onChange={(e) => setRegBirthDate(e.target.value)}
              placeholder="Дата рождения *"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
            />
            <input
              type="tel"
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
              placeholder="Телефон (необязательно)"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
            />
            {regError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {regError}
              </p>
            )}
          </div>
          <button
            onClick={handleRegisterPatient}
            disabled={registering || !regLastName || !regFirstName || !regGender || !regBirthDate}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 rounded-xl font-semibold shadow-md shadow-primary-600/30 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {registering ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Сохранение...</>
            ) : (
              "Создать пациента"
            )}
          </button>
          <button
            onClick={() => setShowRegisterForm(false)}
            className="w-full text-sm text-gray-500 py-2"
          >
            Назад
          </button>
        </div>
      );
    }

    // Already selected — show selected + option to change
    if (selectedPatientId && selectedPatientName && !showPhoneForm) {
      return (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
            <div className="flex items-center gap-3">
              <Avatar name={selectedPatientName} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{selectedPatientName}</p>
                <p className="text-xs text-primary-600 flex items-center gap-1 mt-0.5">
                  <CheckCircle className="w-3 h-3" /> Пациент выбран
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={goNext}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 rounded-xl font-semibold shadow-md shadow-primary-600/30 active:scale-[0.97] transition-all"
          >
            Далее
            <ChevronRight className="w-4 h-4" />
          </button>
          {linkedPatients.length > 1 && (
            <button
              onClick={() => {
                setSelectedPatientId(null);
                setSelectedPatientName("");
              }}
              className="w-full text-sm text-gray-500 py-2"
            >
              Выбрать другого пациента
            </button>
          )}
          {linkedPatients.length <= 1 && (
            <button
              onClick={() => setShowPhoneForm(true)}
              className="w-full text-sm text-gray-500 py-2"
            >
              Выбрать другого пациента
            </button>
          )}
        </div>
      );
    }

    // Multiple linked patients — show list to pick from
    if (linkedPatients.length > 1 && !showPhoneForm) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 font-medium">Выберите пациента:</p>
          {linkedPatients.map((p) => (
            <button
              key={p.patientId}
              onClick={() => {
                setSelectedPatientId(p.patientId);
                setSelectedPatientName(p.fullName);
              }}
              className="w-full bg-white rounded-xl p-3.5 shadow-card border border-gray-100 text-left flex items-center gap-3 active:scale-[0.98] transition-all hover:border-primary-300"
            >
              <Avatar name={p.fullName} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{p.fullName}</p>
                {p.birthDate && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.birthDate.includes("-")
                      ? p.birthDate.split("-").reverse().join(".")
                      : p.birthDate}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}
          <button
            onClick={() => setShowRegisterForm(true)}
            className="w-full bg-white rounded-xl p-3.5 shadow-card border border-dashed border-primary-300 text-left flex items-center gap-3 active:scale-[0.98] transition-all hover:border-primary-500"
          >
            <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <p className="font-medium text-primary-600 text-sm">Добавить нового пациента</p>
          </button>
        </div>
      );
    }

    // Show found patients list (from phone search)
    if (foundPatients.length > 0) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 font-medium">Найдено несколько пациентов:</p>
          {foundPatients.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedPatientId(p.id);
                setSelectedPatientName([p.lastName, p.firstName].filter(Boolean).join(" "));
                setFoundPatients([]);
                setShowPhoneForm(false);
              }}
              disabled={false}
              className="w-full bg-white rounded-xl p-3.5 shadow-card border border-gray-100 text-left flex items-center gap-3 active:scale-[0.98] transition-all hover:border-primary-300"
            >
              <Avatar
                name={[p.lastName, p.firstName].filter(Boolean).join(" ")}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">
                  {[p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ")}
                </p>
                {p.birthDate && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.birthDate}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}
          <button
            onClick={() => {
              setFoundPatients([]);
            }}
            className="w-full text-sm text-gray-500 py-2"
          >
            Назад
          </button>
        </div>
      );
    }

    // Auth via SMS — direct user to the Profile page where SMS flow lives
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Требуется привязка номера</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Чтобы записаться, сначала привяжите свой номер телефона. Мы отправим код подтверждения в SMS.
          </p>
          <button
            onClick={() => navigate("/profile")}
            className="w-full bg-primary-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-700 active:scale-[0.97] transition-all"
          >
            Привязать номер
          </button>
        </div>
        {selectedPatientId && (
          <button
            onClick={() => setShowPhoneForm(false)}
            className="w-full text-sm text-gray-500 py-2"
          >
            Отмена
          </button>
        )}
      </div>
    );
  }

  // ─── Step: Specialization ───
  function SpecializationStep() {
    if (specsLoading) {
      return (
        <div className="space-y-2">
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
        </div>
      );
    }

    // Filter specializations by patient age and exclude УЗИ
    const patientAge = bookingStore.isChild ? 10 : 30;
    const specs = (specializations || []).filter((s) => {
      // Exclude УЗИ specializations
      if (/узи|узд|ультразв/i.test(s.name)) return false;
      let from = s.ageFrom ?? 0;
      let to = s.ageTo ?? 999;
      // Name-based fallback: "Детский" in name → child-only (0-17)
      if (from === 0 && to === 999 && /детск/i.test(s.name)) {
        from = 0;
        to = 17;
      }
      return patientAge >= from && patientAge <= to;
    });

    return (
      <div className="space-y-2">
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Поиск специальности..."
            id="spec-search"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
            onChange={(e) => {
              const val = e.target.value.toLowerCase();
              const items = document.querySelectorAll("[data-spec-item]");
              items.forEach((el) => {
                const name = el.getAttribute("data-spec-name") || "";
                (el as HTMLElement).style.display = name.includes(val) ? "" : "none";
              });
            }}
          />
        </div>
        {specs.map((spec) => (
          <button
            key={spec.id}
            data-spec-item
            data-spec-name={spec.name.toLowerCase()}
            onClick={() => {
              setSelectedSpecId(spec.id);
              setSelectedSpecName(spec.name);
              // Reset downstream selections
              setSelectedClinicId("");
              setSelectedClinicName("");
              setSelectedDoctorId("");
              setSelectedDoctorName("");
              setSelectedSlot(null);
              setSelectedDate("");
              goNext();
            }}
            className={`w-full text-left bg-white rounded-xl p-3.5 shadow-card border transition-all active:scale-[0.98] flex items-center gap-3 ${
              selectedSpecId === spec.id
                ? "border-primary-500 bg-primary-50"
                : "border-gray-100 hover:border-primary-300"
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4.5 h-4.5 text-primary-600" />
            </div>
            <span className="font-medium text-gray-900 text-sm">{spec.name}</span>
            <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
          </button>
        ))}
      </div>
    );
  }

  // ─── Step: Clinic ───
  function ClinicStep() {
    if (clinicsLoading) {
      return (
        <div className="space-y-2">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      );
    }

    const list = clinicsForSpec;

    return (
      <div className="space-y-2">
        {/* Option: all clinics */}
        <button
          onClick={() => {
            setSelectedClinicId("");
            setSelectedClinicName("Любой филиал");
            setSelectedDoctorId("");
            setSelectedDoctorName("");
            setSelectedSlot(null);
            setSelectedDate("");
            goNext();
          }}
          className={`w-full text-left bg-white rounded-xl p-3.5 shadow-card border transition-all active:scale-[0.98] flex items-center gap-3 ${
            selectedClinicId === ""
              ? "border-primary-500 bg-primary-50"
              : "border-gray-100 hover:border-primary-300"
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4.5 h-4.5 text-gray-500" />
          </div>
          <div>
            <span className="font-medium text-gray-900 text-sm">Любой филиал</span>
            <p className="text-xs text-gray-500">Показать всех врачей</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
        </button>

        {list.map((clinic) => (
          <button
            key={clinic.id}
            onClick={() => {
              setSelectedClinicId(clinic.id);
              setSelectedClinicName(clinic.shortAddress || clinic.name);
              setSelectedDoctorId("");
              setSelectedDoctorName("");
              setSelectedSlot(null);
              setSelectedDate("");
              goNext();
            }}
            className={`w-full text-left bg-white rounded-xl p-3.5 shadow-card border transition-all active:scale-[0.98] flex items-center gap-3 ${
              selectedClinicId === clinic.id
                ? "border-primary-500 bg-primary-50"
                : "border-gray-100 hover:border-primary-300"
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4.5 h-4.5 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-900 text-sm block truncate">
                {clinic.shortAddress || clinic.name}
              </span>
              {clinic.address?.street && (
                <p className="text-xs text-gray-500 truncate">
                  {[clinic.address.street, clinic.address.house].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" />
          </button>
        ))}
      </div>
    );
  }

  // ─── Step: Doctor ───
  function DoctorStep() {
    if (doctorsLoading) {
      return (
        <div className="space-y-2">
          <SkeletonCard lines={2} showAvatar />
          <SkeletonCard lines={2} showAvatar />
          <SkeletonCard lines={2} showAvatar />
        </div>
      );
    }

    const list = Array.isArray(doctors) ? doctors : [];

    if (list.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">Врачи не найдены</p>
          <p className="text-gray-400 text-xs mt-1">Попробуйте выбрать другой филиал</p>
          <button
            onClick={goBack}
            className="mt-4 text-primary-600 text-sm font-medium"
          >
            Изменить филиал
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {list.map((doctor) => {
          const name = docName(doctor);
          const price = getMinPrice(
            doctor,
            priceMap,
            selectedClinicId || undefined,
            selectedSpecId || undefined
          );
          return (
            <button
              key={doctor.id}
              onClick={() => {
                setSelectedDoctorId(doctor.id);
                setSelectedDoctorName(name);
                setSelectedSlot(null);
                setSelectedDate("");
                goNext();
              }}
              className={`w-full text-left bg-white rounded-xl p-3.5 shadow-card border transition-all active:scale-[0.98] flex items-center gap-3 ${
                selectedDoctorId === doctor.id
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-100 hover:border-primary-300"
              }`}
            >
              <Avatar name={name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {doctor.experience != null && doctor.experience > 0 && (
                    <span className="text-xs text-gray-500">
                      Стаж: {doctor.experience} лет
                    </span>
                  )}
                  {price != null && price > 0 && (
                    <span className="text-xs text-primary-600 font-medium">
                      {price.toLocaleString("ru-RU")} ₽
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    );
  }

  // ─── Step: Slots ───
  function SlotsStep() {
    if (schedulesLoading) {
      return (
        <div className="space-y-3">
          <SkeletonCard lines={5} />
          <SkeletonCard lines={3} />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {selectedDoctorName && (
          <div className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-card border border-gray-100">
            <Avatar name={selectedDoctorName} size="sm" />
            <div>
              <p className="font-medium text-gray-900 text-sm">{selectedDoctorName}</p>
              {selectedSpecName && (
                <p className="text-xs text-gray-500">{selectedSpecName}</p>
              )}
            </div>
          </div>
        )}

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
              <TimeSlots
                slots={daySlots}
                selectedTime=""
                onSelect={handleSlotClick}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Step: Confirm ───
  function ConfirmStep() {
    const dateStr = selectedSlot
      ? new Date(selectedSlot.startAt).toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";
    const timeStr = selectedSlot ? selectedSlot.startAt.slice(11, 16) : "";

    const details = [
      { icon: Users, label: "Пациент", value: selectedPatientName },
      { icon: Stethoscope, label: "Специальность", value: selectedSpecName },
      { icon: Building2, label: "Филиал", value: selectedClinicName !== "Любой филиал" ? selectedClinicName : undefined },
      { icon: User, label: "Врач", value: selectedDoctorName },
      {
        icon: CalendarDays,
        label: "Дата и время",
        value: dateStr ? `${dateStr}, ${timeStr}` : undefined,
      },
      {
        icon: Clock,
        label: "Стоимость",
        value: selectedPrice ? `${selectedPrice.toLocaleString("ru-RU")} ₽` : undefined,
      },
    ].filter((d) => d.value);

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 divide-y divide-gray-50">
          {details.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-gray-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-medium text-gray-900 text-sm">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {submitError && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{submitError}</p>
          </div>
        )}

        <button
          onClick={handleConfirmBooking}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3.5 rounded-xl font-semibold shadow-md shadow-primary-600/30 hover:shadow-lg active:scale-[0.97] disabled:opacity-50 transition-all duration-200"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Создаём запись...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Подтвердить запись
            </>
          )}
        </button>
      </div>
    );
  }

  // ─── Step renderer ───
  function renderStep() {
    switch (currentStep) {
      case "patient":
        return <PatientStep />;
      case "specialization":
        return <SpecializationStep />;
      case "clinic":
        return <ClinicStep />;
      case "doctor":
        return <DoctorStep />;
      case "slots":
        return <SlotsStep />;
      case "confirm":
        return <ConfirmStep />;
    }
  }

  return (
    <PageTransition>
      <div className="space-y-3">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl p-4 shadow-lg flex items-center gap-3.5 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -right-2 bottom-0 w-16 h-16 rounded-full bg-white/5" />
          <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-6 h-6 text-white" />
          </div>
          <div className="relative z-10">
            <h2 className="text-[15px] font-bold text-white">Запись на приём</h2>
            <p className="text-[12px] text-white/80 mt-0.5">
              Шаг {stepIdx + 1} из {STEPS.length}: {STEPS[stepIdx].label}
            </p>
          </div>
        </div>

        {/* Progress */}
        <StepProgress />

        {/* Back button (except on first step) */}
        {stepIdx > 0 && currentStep !== "confirm" && (
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Назад
          </button>
        )}

        {/* Step content with animation */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Back button on confirm step */}
        {currentStep === "confirm" && (
          <button
            onClick={goBack}
            className="w-full text-sm text-gray-500 py-2"
          >
            Изменить данные
          </button>
        )}
      </div>
    </PageTransition>
  );
}
