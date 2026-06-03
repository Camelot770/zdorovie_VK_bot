import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Users,
  UserPlus,
  Loader2,
  AlertCircle,
  Check,
  CheckCircle,
  Phone,
  ChevronRight,
} from "lucide-react";
import { apiGet, apiGetFresh, apiPost } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useBookingStore } from "../store/booking";
import { useAuth } from "../hooks/useAuth";
import PageTransition from "../components/ui/PageTransition";
import { calcAge, ageLabel } from "../utils/age";
import type { Doctor, LinkedPatient, Specialization } from "../types";

/**
 * Dedicated patient-selection step between SlotsPage and ConfirmPage.
 * User explicitly taps the patient they want to book for; ConfirmPage just
 * shows the result without an inline picker.
 */
export default function PatientSelectPage() {
  const navigate = useNavigate();
  const { maxUserId } = useAuth();
  const {
    doctorId,
    doctorName,
    clinicId,
    clinicName,
    specializationId,
    specializationName,
    appointmentAt,
    isChild,
    patientId: storePatientId,
    patientName: storePatientName,
    setPatientId,
  } = useBookingStore();

  // Fetch the doctor + spec list so we can show ALL specs the doctor
  // practises at the current clinic (not just the one auto-picked by the
  // schedule lookup).
  const { data: doctorData } = useApi<Doctor | null>(
    () =>
      doctorId
        ? apiGet<Doctor>(`/doctors/${doctorId}`, { include: "specializations" })
        : Promise.resolve(null),
    [doctorId]
  );
  const { data: specsData } = useApi<Specialization[]>(
    () => apiGet("/specializations"),
    []
  );

  const doctorSpecNames = useMemo(() => {
    if (!doctorData || !Array.isArray(specsData)) {
      return specializationName ? [specializationName] : [];
    }
    const ids = new Set<string>();
    for (const cl of doctorData.clinics || []) {
      if (clinicId && cl.clinicId !== clinicId) continue;
      for (const sp of cl.specializations || []) {
        ids.add(sp.specializationId);
      }
    }
    const names = specsData
      .filter((s) => ids.has(s.id))
      .map((s) => s.name);
    return names.length > 0 ? names : (specializationName ? [specializationName] : []);
  }, [doctorData, specsData, clinicId, specializationName]);

  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(storePatientId || "");
  const [error, setError] = useState("");

  // Add-patient form
  const [showRegForm, setShowRegForm] = useState(false);
  const [regLastName, setRegLastName] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regMiddleName, setRegMiddleName] = useState("");
  const [regGender, setRegGender] = useState<"male" | "female">("male");
  const [regBirthDate, setRegBirthDate] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [registering, setRegistering] = useState(false);

  // Refetch when (user, mode) changes. Keep a per-combination memo so we
  // don't refetch repeatedly for the same maxUserId+isChild — but a toggle
  // from kid↔adult MUST trigger a reload because eligibility rules differ.
  const lastFetchKeyRef = useRef("");
  useEffect(() => {
    if (!maxUserId) return;
    const fetchKey = `${maxUserId}|${isChild ? "1" : "0"}`;
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;
    setLoading(true);
    apiGetFresh<LinkedPatient[]>(`/auth/patients/${maxUserId}`, { source: "vk" })
      .then((pts) => {
        const list = pts || [];
        setPatients(list);
        // Inline copy of isPatientEligible — uses doctor age range first,
        // falls back to toggle. Mirrors isPatientEligible() below.
        let ageFrom: number | undefined;
        let ageTo: number | undefined;
        const dd = doctorData;
        if (dd) {
          for (const cl of dd.clinics || []) {
            if (clinicId && cl.clinicId !== clinicId) continue;
            for (const sp of cl.specializations || []) {
              if (specializationId && sp.specializationId !== specializationId) continue;
              ageFrom = sp.ageFrom;
              ageTo = sp.ageTo;
              break;
            }
            if (ageFrom !== undefined || ageTo !== undefined) break;
          }
        }
        const isStrictKidDoc = typeof ageTo === "number" && ageTo <= 18;
        const isStrictAdultDoc = typeof ageFrom === "number" && ageFrom >= 18;
        const isEligible = (p: LinkedPatient): boolean => {
          const a = calcAge(p.birthDate || "");
          if (a === null) return true;
          if (isStrictKidDoc) return a < 18;
          if (isStrictAdultDoc) return a >= 18;
          if (isChild && a >= 18) return false;
          if (!isChild && a < 18) return false;
          return true;
        };
        setSelectedId((current) => {
          // If a previous selection is no longer eligible, drop it.
          if (current) {
            const prev = list.find((p) => p.patientId === current);
            if (prev && !isEligible(prev)) return "";
            return current;
          }
          const eligibles = list.filter(isEligible);
          if (eligibles.length === 1) return eligibles[0].patientId;
          if (eligibles.length > 1) {
            const match = eligibles.find((p) => {
              const a = calcAge(p.birthDate || "");
              return isChild ? a !== null && a < 18 : a === null || a >= 18;
            });
            return match ? match.patientId : eligibles[0].patientId;
          }
          return "";
        });
      })
      .catch(() => setError("Не удалось загрузить пациентов"))
      .finally(() => setLoading(false));
  }, [maxUserId, isChild]);

  // If wrong route entry (no slot picked yet) — bounce back to booking start
  useEffect(() => {
    if (!appointmentAt) {
      navigate("/", { replace: true });
    }
  }, [appointmentAt, navigate]);

  /** Eligibility uses the doctor's per-(clinic, spec) age range when
   *  available — that's the authoritative source. Falls back to the
   *  booking toggle when the doctor row has no specific age constraint. */
  function isPatientEligible(p: LinkedPatient): boolean {
    const age = calcAge(p.birthDate || "");
    if (age === null) return true;

    let ageFrom: number | undefined;
    let ageTo: number | undefined;
    if (doctorData) {
      for (const cl of doctorData.clinics || []) {
        if (clinicId && cl.clinicId !== clinicId) continue;
        for (const sp of cl.specializations || []) {
          if (specializationId && sp.specializationId !== specializationId) continue;
          ageFrom = sp.ageFrom;
          ageTo = sp.ageTo;
          break;
        }
        if (ageFrom !== undefined || ageTo !== undefined) break;
      }
    }

    const isStrictKidDoc = typeof ageTo === "number" && ageTo <= 18;
    const isStrictAdultDoc = typeof ageFrom === "number" && ageFrom >= 18;
    if (isStrictKidDoc) return age < 18;
    if (isStrictAdultDoc) return age >= 18;

    if (isChild && age >= 18) return false;
    if (!isChild && age < 18) return false;
    return true;
  }

  function handleSelect(p: LinkedPatient) {
    if (!isPatientEligible(p)) return;
    setSelectedId(p.patientId);
    setError("");
  }

  async function handleRegister() {
    if (!regLastName || !regFirstName || !regBirthDate || !regPhone) {
      setError("Заполните все обязательные поля");
      return;
    }
    if (!maxUserId) {
      setError("Ошибка авторизации");
      return;
    }
    setRegistering(true);
    setError("");
    try {
      const result = await apiPost<{ status: string; patientId: string; fullName: string }>(
        "/auth/register",
        {
          max_user_id: `vk:${maxUserId}`,
          lastName: regLastName,
          firstName: regFirstName,
          middleName: regMiddleName || undefined,
          noMiddleName: !regMiddleName,
          gender: regGender,
          birthDate: regBirthDate,
          phone: regPhone.replace(/[\s\-()]/g, ""),
        },
      );
      const newPatient: LinkedPatient = {
        patientId: result.patientId,
        fullName: result.fullName,
        birthDate: regBirthDate,
      };
      setPatients((prev) => [...prev, newPatient]);
      setSelectedId(result.patientId);
      setShowRegForm(false);
      // Clear form
      setRegLastName("");
      setRegFirstName("");
      setRegMiddleName("");
      setRegBirthDate("");
      setRegPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации пациента");
    } finally {
      setRegistering(false);
    }
  }

  function handleContinue() {
    const picked = patients.find((p) => p.patientId === selectedId);
    if (!picked) {
      setError("Выберите пациента для записи");
      return;
    }
    // Persist into booking store — ConfirmPage reads it from here
    setPatientId(picked.patientId, picked.fullName, picked.birthDate || "");
    navigate("/confirm");
  }

  const dateStr = appointmentAt
    ? new Date(appointmentAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        weekday: "short",
      })
    : "";
  const timeStr = appointmentAt ? appointmentAt.slice(11, 16) : "";

  // If selected patient was restored from store and not present in fresh list,
  // surface the name from the store so the button label is still meaningful.
  const selectedDisplayName =
    patients.find((p) => p.patientId === selectedId)?.fullName ||
    (selectedId && selectedId === storePatientId ? storePatientName : "");

  return (
    <PageTransition>
      <div className="space-y-4 pb-44">
        {/* Booking context summary */}
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl p-4 shadow-lg text-white relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
          <div className="relative z-10">
            <p className="text-[11px] text-white/70 uppercase tracking-wider mb-1">Запись</p>
            <h2 className="text-[15px] font-bold leading-tight">{doctorName || "Врач"}</h2>
            {doctorSpecNames.length > 0 && (
              <p className="text-[12px] text-white/80 mt-1">
                {doctorSpecNames.join(", ")}
              </p>
            )}
            <p className="text-[12px] text-white/80 mt-0.5">
              {[dateStr, timeStr].filter(Boolean).join(" · ")}
            </p>
            {clinicName && (
              <p className="text-[11px] text-white/70 mt-0.5">{clinicName}</p>
            )}
          </div>
        </div>

        {/* Heading */}
        <div className="flex items-center gap-2 px-1">
          <Users className="w-4 h-4 text-primary-600" />
          <h3 className="text-base font-bold text-gray-900">Кого записываем?</h3>
        </div>

        {/* Patient list */}
        {loading ? (
          <div className="bg-white rounded-2xl p-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загружаем пациентов…
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-500 space-y-1">
            <p>Нет привязанных пациентов</p>
            <p className="text-xs text-gray-400">
              Добавьте кого-нибудь через форму ниже
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {patients.map((p) => {
              const age = calcAge(p.birthDate || "");
              const ageStr = age !== null ? `${age} ${ageLabel(age)}` : "";
              const isSelected = p.patientId === selectedId;
              const eligible = isPatientEligible(p);

              return (
                <button
                  key={p.patientId}
                  onClick={() => handleSelect(p)}
                  disabled={!eligible}
                  aria-disabled={!eligible}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left ${
                    !eligible
                      ? "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed"
                      : isSelected
                        ? "bg-primary-50 border-primary-500 shadow-card"
                        : "bg-white border-gray-100 hover:border-primary-200 active:bg-gray-50"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      !eligible
                        ? "bg-gray-100 text-gray-300"
                        : isSelected
                          ? "bg-primary-500 text-white"
                          : "bg-gray-50 text-gray-400"
                    }`}
                  >
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${
                        !eligible
                          ? "text-gray-400"
                          : isSelected
                            ? "text-primary-900"
                            : "text-gray-900"
                      }`}
                    >
                      {p.fullName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {ageStr && (
                        <span className={`text-xs ${!eligible ? "text-gray-400" : "text-gray-500"}`}>
                          {ageStr}
                        </span>
                      )}
                      {!eligible && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <AlertCircle className="w-2.5 h-2.5" />
                          возраст не подходит
                        </span>
                      )}
                    </div>
                  </div>
                  {!eligible ? (
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide flex-shrink-0">
                      Недоступно
                    </span>
                  ) : isSelected ? (
                    <Check className="w-5 h-5 text-primary-600 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Add patient — toggle */}
        {!showRegForm && (
          <button
            onClick={() => {
              setShowRegForm(true);
              setError("");
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-primary-200 text-primary-600 text-sm font-medium hover:bg-primary-50 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Добавить пациента
          </button>
        )}

        {/* Add patient — form */}
        {showRegForm && (
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary-600" />
              Новый пациент
            </h3>
            <input
              placeholder="Фамилия *"
              value={regLastName}
              onChange={(e) => setRegLastName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              placeholder="Имя *"
              value={regFirstName}
              onChange={(e) => setRegFirstName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              placeholder="Отчество"
              value={regMiddleName}
              onChange={(e) => setRegMiddleName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRegGender("male")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  regGender === "male"
                    ? "bg-primary-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                Мужской
              </button>
              <button
                onClick={() => setRegGender("female")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  regGender === "female"
                    ? "bg-primary-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                Женский
              </button>
            </div>
            <input
              type="date"
              placeholder="Дата рождения *"
              value={regBirthDate}
              onChange={(e) => setRegBirthDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <input
                type="tel"
                placeholder="Телефон *"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowRegForm(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600"
              >
                Отмена
              </button>
              <button
                onClick={handleRegister}
                disabled={registering}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium bg-primary-500 text-white disabled:opacity-50"
              >
                {registering ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Сохранить"
                )}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Sticky bottom CTA */}
        <div className="fixed left-0 right-0 px-4 pt-3 pb-3 bg-gradient-to-t from-gray-50 to-gray-50/0 z-[60] bottom-[calc(64px+env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleContinue}
              disabled={!selectedId}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-semibold py-3.5 rounded-2xl shadow-lg transition-all active:scale-[0.98]"
            >
              <CheckCircle className="w-5 h-5" />
              {selectedDisplayName
                ? `Продолжить → ${selectedDisplayName.split(" ")[0]}`
                : "Выберите пациента"}
            </button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
