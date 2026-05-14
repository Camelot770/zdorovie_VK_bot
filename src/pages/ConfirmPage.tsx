import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Stethoscope,
  Calendar,
  Building2,
  Banknote,
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
} from "lucide-react";
import { apiPost } from "../api/client";
import { useBookingStore } from "../store/booking";
import PageTransition from "../components/ui/PageTransition";
import { calcAge, ageLabel } from "../utils/age";

/**
 * Final confirmation step. By this point the user has already chosen
 * their patient on /select-patient — so this page is intentionally
 * read-only (no inline picker that could be overridden). A single
 * "Подтвердить" button submits the booking.
 */
export default function ConfirmPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const {
    clinicId,
    doctorId,
    specializationId,
    appointmentAt,
    clinicName,
    doctorName,
    specializationName,
    price,
    serviceIds,
    patientId,
    patientName,
    patientBirthDate,
  } = useBookingStore();

  // Guard: if the user landed here without picking a patient (e.g. opened
  // the URL directly), send them back to the picker.
  useEffect(() => {
    if (!patientId) {
      navigate("/select-patient", { replace: true });
    }
  }, [patientId, navigate]);

  const dateStr = appointmentAt
    ? new Date(appointmentAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const timeStr = appointmentAt ? appointmentAt.slice(11, 16) : "";

  async function handleConfirm() {
    if (!patientId) {
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
        patientId,
        serviceIds,
        source: "vk_webapp",
      });
      navigate("/success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при создании записи");
    } finally {
      setSubmitting(false);
    }
  }

  // Age-mismatch warning (informational only — server still validates)
  const ageWarning = (() => {
    const age = calcAge(patientBirthDate || "");
    if (age === null) return "";
    const specIsChild = /детск/i.test(specializationName);
    if (specIsChild && age >= 18) {
      return "Выбрана детская специализация, но пациент старше 18 лет.";
    }
    return "";
  })();

  const patientAge = calcAge(patientBirthDate || "");
  const patientAgeStr = patientAge !== null ? `${patientAge} ${ageLabel(patientAge)}` : "";

  const details = [
    { icon: Stethoscope, label: "Специальность", value: specializationName },
    { icon: User, label: "Врач", value: doctorName },
    { icon: Building2, label: "Филиал", value: clinicName },
    { icon: Calendar, label: "Дата и время", value: dateStr ? `${dateStr}, ${timeStr}` : null },
    { icon: Banknote, label: "Стоимость", value: price ? `${price.toLocaleString("ru-RU")} ₽` : null },
  ].filter((d) => d.value);

  return (
    <PageTransition>
      <div className="space-y-4 pb-28">
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

        {/* Selected patient — read-only with "change" link */}
        <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-gray-400" />
            <p className="text-xs text-gray-500">Пациент</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">
                {patientName || "—"}
              </p>
              {patientAgeStr && (
                <p className="text-xs text-gray-500 mt-0.5">{patientAgeStr}</p>
              )}
            </div>
            <button
              onClick={() => navigate("/select-patient")}
              className="text-primary-600 text-xs font-medium hover:underline whitespace-nowrap flex items-center gap-0.5"
            >
              <ChevronLeft className="w-3 h-3" />
              Изменить
            </button>
          </div>
        </div>

        {ageWarning && (
          <div className="flex items-start gap-2 bg-amber-50 text-amber-700 text-sm p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{ageWarning}</p>
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
          <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Sticky confirm CTA */}
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 bg-gradient-to-t from-gray-50 to-gray-50/0 z-30">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleConfirm}
              disabled={submitting || !patientId}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-semibold py-3.5 rounded-2xl shadow-lg transition-all active:scale-[0.98]"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              {submitting ? "Создаём запись…" : "Подтвердить запись"}
            </button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
