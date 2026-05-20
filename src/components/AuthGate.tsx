import { useEffect, useRef, useState } from "react";
import { Phone, Shield, Loader2, CheckCircle2, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { requestPhoneNumber } from "../services/vkBridge";
import { api } from "../api/client";
import type { Patient } from "../types";

type Step = "intro" | "pick";

/**
 * Global auth gate. Renders a fullscreen, non-dismissable modal whenever
 * we have a VK user id but no linked patient. Disappears automatically
 * once the user gets linked (via VK Bridge phone share).
 *
 * Mounted at Layout level so it covers every page in the app.
 * SMS flow is intentionally NOT here — we only authenticate through
 * VK Bridge phone share.
 */
export default function AuthGate() {
  const { loading, patientId, maxUserId: vkUserId, setPatientId } = useAuth();

  const [step, setStep] = useState<Step>("intro");
  const [foundPatients, setFoundPatients] = useState<Patient[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Auto-fire VK Bridge phone-share dialog automatically the FIRST time the
  // gate becomes visible (i.e. unauthenticated user opens the app).
  // If they decline, they can still retry via the primary button.
  const autoShareFiredRef = useRef(false);
  useEffect(() => {
    if (autoShareFiredRef.current) return;
    if (loading) return;
    if (!vkUserId) return;
    if (patientId) return;
    autoShareFiredRef.current = true;
    // Fire after a short tick so the modal animates in first. Track the
    // timer so we can cancel it on unmount (avoids firing VK Bridge dialog
    // after navigation away).
    const timer = setTimeout(() => {
      handleVkBridgePhone();
    }, 400);
    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, vkUserId, patientId]);

  // Don't render gate while auth is still resolving
  if (loading) return null;
  // No VK user id (running outside VK or launch params missing) — nothing we can do
  if (!vkUserId) return null;
  // Already linked — modal hidden
  if (patientId) return null;

  function friendlyError(err: unknown, fallback: string): string {
    if (!(err instanceof Error)) return fallback;
    const msg = err.message;
    if (msg.includes("Load failed") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return "Нет связи с сервером. Проверьте интернет.";
    }
    if (msg.includes("429")) return "Слишком часто. Подождите минуту.";
    if (msg.includes("502") || msg.includes("503")) return "Сервер временно недоступен. Попробуйте позже.";
    return fallback;
  }

  async function handleVkBridgePhone() {
    if (!vkUserId) return;
    setSubmitting(true);
    setError("");
    try {
      const phoneDigits = await requestPhoneNumber();
      if (!phoneDigits) {
        setError("Вы отклонили доступ к номеру или у вас не подтверждён номер во ВКонтакте.");
        return;
      }
      const result = await api.vkPhoneLink(phoneDigits, vkUserId);
      if (result.status === "linked" && result.patientId) {
        setPatientId(result.patientId, result.fullName || "");
      } else if (result.status === "multiple" && result.patients) {
        setFoundPatients(result.patients);
        setStep("pick");
      } else {
        setError(
          "Пациент с таким номером не найден в клинике. Обратитесь в регистратуру по телефону +7 (843) 204-2-700.",
        );
      }
    } catch (err) {
      setError(friendlyError(err, "Не удалось получить номер через ВКонтакте."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePickPatient(p: Patient) {
    if (!vkUserId) return;
    setSubmitting(true);
    setError("");
    try {
      const fullNameParts = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ");
      const result = await api.linkPatientById(p.id, vkUserId);
      setPatientId(result.patientId, result.fullName || fullNameParts);
    } catch (err) {
      setError(friendlyError(err, "Ошибка привязки. Попробуйте позже."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-8 space-y-4 animate-in slide-in-from-bottom duration-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-base leading-tight">
              Привяжите номер к клинике
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Это нужно один раз — чтобы записываться на приём
            </p>
          </div>
        </div>

        {/* Step: intro (VK Bridge share) */}
        {step === "intro" && (
          <>
            <button
              onClick={handleVkBridgePhone}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 active:scale-[0.97] transition-all"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              {submitting ? "Получение..." : "Поделиться номером через ВКонтакте"}
            </button>
            <p className="text-[11px] text-gray-400 text-center -mt-1">
              Безопасно — номер берётся из вашего профиля ВК
            </p>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
          </>
        )}

        {/* Step: pick (multiple patients matched) */}
        {step === "pick" && (
          <>
            <p className="text-xs text-gray-500">Найдено несколько карточек, выберите свою:</p>
            <div className="space-y-2">
              {foundPatients.map((p) => {
                const name = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ");
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePickPatient(p)}
                    disabled={submitting}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-primary-50 hover:border-primary-200 active:bg-primary-100 transition-colors text-left disabled:opacity-60"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      {p.birthDate && (
                        <p className="text-xs text-gray-500">{p.birthDate}</p>
                      )}
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                setStep("intro");
                setError("");
                setFoundPatients([]);
              }}
              className="w-full py-2 text-gray-500 text-xs hover:text-gray-700 transition-colors flex items-center justify-center gap-1"
            >
              <X className="w-3 h-3" /> Назад
            </button>
            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          </>
        )}

        {/* Contact info */}
        <p className="text-[11px] text-gray-400 text-center pt-2 border-t border-gray-100">
          Если возникли проблемы — позвоните в клинику:{" "}
          <a href="tel:+78432042700" className="text-primary-600 font-medium">
            +7 (843) 204-2-700
          </a>
        </p>
      </div>
    </div>
  );
}
