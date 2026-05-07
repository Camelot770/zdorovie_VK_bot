import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Users,
  Stethoscope,
  Calendar,
  Building2,
  Banknote,
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  UserPlus,
  Phone,
} from "lucide-react";
import { apiPost, apiGetFresh } from "../api/client";
import { useBookingStore } from "../store/booking";
import { useAuth } from "../hooks/useAuth";
import PageTransition from "../components/ui/PageTransition";
import type { LinkedPatient } from "../types";

export default function ConfirmPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { patientId: authPatientId, patientName: authPatientName, maxUserId } = useAuth();

  const {
    isChild,
    clinicId,
    doctorId,
    specializationId,
    appointmentAt,
    clinicName,
    doctorName,
    specializationName,
    price,
    serviceIds,
  } = useBookingStore();

  // Patient selection
  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedPatientName, setSelectedPatientName] = useState("");
  const [showPatientPicker, setShowPatientPicker] = useState(false);

  // Registration form
  const [showRegForm, setShowRegForm] = useState(false);
  const [regLastName, setRegLastName] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regMiddleName, setRegMiddleName] = useState("");
  const [regGender, setRegGender] = useState<"male" | "female">("male");
  const [regBirthDate, setRegBirthDate] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [registering, setRegistering] = useState(false);

  // Load linked patients
  useEffect(() => {
    if (!maxUserId) return;
    setPatientsLoading(true);
    apiGetFresh<LinkedPatient[]>(`/auth/patients/${maxUserId}`, { source: "vk" })
      .then((pts) => {
        const list = pts || [];
        setPatients(list);
        // Auto-select: if only 1 patient and adult mode, use them
        if (list.length === 1 && !isChild) {
          setSelectedPatientId(list[0].patientId);
          setSelectedPatientName(list[0].fullName);
        } else if (list.length === 1 && isChild) {
          // Child mode with 1 patient — check if it's a child
          const age = calcAge(list[0].birthDate || "");
          if (age !== null && age < 18) {
            setSelectedPatientId(list[0].patientId);
            setSelectedPatientName(list[0].fullName);
          }
          // Otherwise don't auto-select — need to add child
        } else if (list.length > 1) {
          // If child mode, try to find a child patient
          if (isChild) {
            const child = list.find((p) => {
              const age = calcAge(p.birthDate || "");
              return age !== null && age < 18;
            });
            if (child) {
              setSelectedPatientId(child.patientId);
              setSelectedPatientName(child.fullName);
            }
          } else {
            // Adult mode — find adult
            const adult = list.find((p) => {
              const age = calcAge(p.birthDate || "");
              return age === null || age >= 18;
            });
            if (adult) {
              setSelectedPatientId(adult.patientId);
              setSelectedPatientName(adult.fullName);
            }
          }
        }
      })
      .catch(() => {
        // Fallback to auth patient
        if (authPatientId) {
          setSelectedPatientId(authPatientId);
          setSelectedPatientName(authPatientName || "");
        }
      })
      .finally(() => setPatientsLoading(false));
  }, [maxUserId, isChild, authPatientId, authPatientName]);

  // Fallback: if no patients loaded, use auth
  useEffect(() => {
    if (!selectedPatientId && authPatientId && !patientsLoading) {
      setSelectedPatientId(authPatientId);
      setSelectedPatientName(authPatientName || "");
    }
  }, [selectedPatientId, authPatientId, authPatientName, patientsLoading]);

  const dateStr = appointmentAt
    ? new Date(appointmentAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const timeStr = appointmentAt ? appointmentAt.slice(11, 16) : "";

  async function handleConfirm() {
    if (!selectedPatientId) {
      setError("Выберите пациента для записи");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await apiPost("/records", {
        appointmentAt,
        clinicId,
        doctorId,
        specializationId,
        patientId: selectedPatientId,
        serviceIds,
      });
      navigate("/success");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ошибка при создании записи"
      );
    } finally {
      setSubmitting(false);
    }
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
          // VK users are stored under prefixed key so MAX/VK never collide
          max_user_id: `vk:${maxUserId}`,
          lastName: regLastName,
          firstName: regFirstName,
          middleName: regMiddleName || undefined,
          noMiddleName: !regMiddleName,
          gender: regGender,
          birthDate: regBirthDate,
          phone: regPhone.replace(/[\s\-()]/g, ""),
        }
      );

      setSelectedPatientId(result.patientId);
      setSelectedPatientName(result.fullName);
      setPatients((prev) => [
        ...prev,
        { patientId: result.patientId, fullName: result.fullName, birthDate: regBirthDate },
      ]);
      setShowRegForm(false);
      setShowPatientPicker(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка регистрации пациента"
      );
    } finally {
      setRegistering(false);
    }
  }

  // Check if selected patient age matches specialization
  const ageWarning = (() => {
    if (!selectedPatientId || !patients.length) return "";
    const patient = patients.find((p) => p.patientId === selectedPatientId);
    if (!patient) return "";
    const age = calcAge(patient.birthDate || "");
    if (age === null) return "";
    const specIsChild = /детск/i.test(specializationName);
    if (specIsChild && age >= 18) {
      return "⚠️ Выбрана детская специализация, но пациент старше 18 лет. Добавьте ребёнка.";
    }
    if (!specIsChild && !isChild && age < 18) {
      return "⚠️ Выбрана взрослая специализация, но пациент младше 18 лет.";
    }
    return "";
  })();

  const details = [
    { icon: User, label: "Врач", value: doctorName },
    { icon: Stethoscope, label: "Специальность", value: specializationName },
    { icon: Calendar, label: "Дата и время", value: dateStr ? `${dateStr}, ${timeStr}` : null },
    { icon: Building2, label: "Филиал", value: clinicName },
    { icon: Banknote, label: "Стоимость", value: price ? `${price.toLocaleString("ru-RU")} ₽` : null },
  ].filter((d) => d.value);

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl p-4 shadow-lg flex items-center gap-3.5 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
          <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div className="relative z-10">
            <h2 className="text-[15px] font-bold text-white">Подтверждение записи</h2>
            <p className="text-[12px] text-white/80 mt-0.5">Проверьте данные перед записью</p>
          </div>
        </div>

        {/* Patient selector */}
        <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-gray-400" />
            <p className="text-xs text-gray-500">Пациент</p>
          </div>

          {patientsLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загрузка...
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowPatientPicker(!showPatientPicker)}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <span className="font-medium text-gray-900 text-sm">
                  {selectedPatientName || "Выберите пациента"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${showPatientPicker ? "rotate-180" : ""}`}
                />
              </button>

              {showPatientPicker && (
                <div className="border-t border-gray-100 pt-2 space-y-1">
                  {patients.map((p) => {
                    const age = calcAge(p.birthDate || "");
                    const ageStr = age !== null ? ` (${age} ${ageLabel(age)})` : "";
                    return (
                      <button
                        key={p.patientId}
                        onClick={() => {
                          setSelectedPatientId(p.patientId);
                          setSelectedPatientName(p.fullName);
                          setShowPatientPicker(false);
                          setError("");
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          p.patientId === selectedPatientId
                            ? "bg-primary-50 text-primary-700 font-medium"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        {p.fullName}{ageStr}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => { setShowRegForm(true); setShowPatientPicker(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-primary-600 hover:bg-primary-50 flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Добавить пациента
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Age warning */}
        {ageWarning && (
          <div className="flex items-start gap-2 bg-amber-50 text-amber-700 text-sm p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{ageWarning}</p>
          </div>
        )}

        {/* Registration form */}
        {showRegForm && (
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900">Новый пациент</h3>
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
            <div className="flex gap-2">
              <button
                onClick={() => setShowRegForm(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600"
              >
                Отмена
              </button>
              <button
                onClick={handleRegister}
                disabled={registering}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary-500 text-white disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}
              </button>
            </div>
          </div>
        )}

        {/* Booking details */}
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

        {error && (
          <div className="flex items-center gap-2 bg-danger-50 text-danger-700 text-sm p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={submitting || !!ageWarning}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3.5 rounded-xl font-semibold shadow-md shadow-primary-600/30 hover:shadow-lg active:scale-[0.97] disabled:opacity-50 transition-all duration-200"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Создаём запись...
            </>
          ) : (
            "Подтвердить запись"
          )}
        </button>
      </div>
    </PageTransition>
  );
}

// ─── Helpers ───

function calcAge(birthDate: string): number | null {
  if (!birthDate) return null;
  try {
    let y: number, m: number, d: number;
    if (birthDate.includes("-")) {
      [y, m, d] = birthDate.split("-").map(Number);
    } else if (birthDate.includes(".")) {
      [d, m, y] = birthDate.split(".").map(Number);
    } else {
      return null;
    }
    const today = new Date();
    let age = today.getFullYear() - y;
    if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) {
      age--;
    }
    return age >= 0 && age < 200 ? age : null;
  } catch {
    return null;
  }
}

function ageLabel(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 19) return "лет";
  const r = n % 10;
  if (r === 1) return "год";
  if (r >= 2 && r <= 4) return "года";
  return "лет";
}
