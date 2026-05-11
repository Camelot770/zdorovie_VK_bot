import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Calendar,
  Phone,
  Shield,
  ChevronRight,
  LogOut,
  Stethoscope,
  Loader2,
  Unlink,
  User,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useFavoritesStore } from "../store/favorites";
import { useBookingStore } from "../store/booking";
import { api } from "../api/client";
import { getVkUserInfo, requestPhoneNumber } from "../services/vkBridge";
import { useEffect } from "react";
import PageTransition from "../components/ui/PageTransition";
import Avatar from "../components/ui/Avatar";
import EmptyState from "../components/ui/EmptyState";
import type { Patient } from "../types";

type LinkStep = "phone" | "code" | "pick" | "done";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { patientId, patientName, maxUserId: vkUserId, loading, setPatientId, resetPatient } = useAuth();
  const { favorites } = useFavoritesStore();
  const resetBooking = useBookingStore((s) => s.reset);

  const [linkStep, setLinkStep] = useState<LinkStep>("phone");
  const [phone, setPhone] = useState("+7");
  const [code, setCode] = useState("");
  const [foundPatients, setFoundPatients] = useState<Patient[]>([]);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [vkProfile, setVkProfile] = useState<{ first_name: string; last_name: string } | null>(null);

  // Try to read VK user profile (first/last name) for greeting
  useEffect(() => {
    let mounted = true;
    getVkUserInfo().then((info) => {
      if (mounted && info) {
        setVkProfile({ first_name: info.first_name, last_name: info.last_name });
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const fullName =
    (vkProfile && [vkProfile.first_name, vkProfile.last_name].filter(Boolean).join(" ")) ||
    "Пользователь";

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </PageTransition>
    );
  }

  if (!vkUserId) {
    return (
      <PageTransition>
        <EmptyState
          icon={Shield}
          title="Требуется авторизация"
          description="Откройте приложение через сообщество ВКонтакте"
          action={{ label: "На главную", onClick: () => navigate("/") }}
        />
      </PageTransition>
    );
  }

  function friendlyError(err: unknown, fallback: string): string {
    if (!(err instanceof Error)) return fallback;
    const msg = err.message;
    if (msg.includes("Load failed") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return "Нет связи с сервером. Проверьте интернет и попробуйте снова.";
    }
    if (msg.includes("429")) {
      return "Слишком часто. Подождите минуту.";
    }
    if (msg.includes("401")) {
      return "Неверный код или истёк срок действия.";
    }
    if (msg.includes("502") || msg.includes("503")) {
      return "Сервер временно недоступен. Попробуйте позже.";
    }
    return fallback;
  }

  async function handleSendCode() {
    if (!vkUserId) return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 11) {
      setError("Введите номер целиком (минимум 11 цифр)");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.smsSend(digits, vkUserId);
      setLinkStep("code");
    } catch (err) {
      setError(friendlyError(err, "Не удалось отправить SMS. Попробуйте позже."));
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Get user's phone via VK Bridge (VKWebAppGetPhoneNumber).
   * VK shows a native confirmation dialog. If user grants — phone is returned
   * already verified by VK, no SMS code needed.
   */
  async function handleVkBridgePhone() {
    if (!vkUserId) return;
    setSubmitting(true);
    setError("");
    try {
      const phoneDigits = await requestPhoneNumber();
      if (!phoneDigits) {
        setError("Вы отклонили доступ к номеру или у вас не подтверждён номер во ВКонтакте.");
        setSubmitting(false);
        return;
      }
      const result = await api.vkPhoneLink(phoneDigits, vkUserId);
      if (result.status === "linked" && result.patientId) {
        setPatientId(result.patientId, result.fullName || "");
        setLinkStep("done");
      } else if (result.status === "multiple" && result.patients) {
        setFoundPatients(result.patients);
        setLinkStep("pick");
      } else {
        setError(
          "Пациент с таким номером не найден в клинике. Обратитесь в регистратуру или попробуйте другой способ.",
        );
      }
    } catch (err) {
      setError(friendlyError(err, "Не удалось получить номер через ВКонтакте."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode() {
    if (!vkUserId) return;
    const digits = phone.replace(/\D/g, "");
    if (code.length < 4) {
      setError("Введите код полностью");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await api.smsVerify(digits, code, vkUserId);
      if (result.status === "linked" && result.patientId) {
        setPatientId(result.patientId, result.fullName || "");
        setLinkStep("done");
      } else if (result.status === "multiple" && result.patients) {
        setFoundPatients(result.patients);
        setLinkStep("pick");
      } else {
        setError("Пациент с таким номером не найден. Обратитесь в клинику для регистрации.");
      }
    } catch (err) {
      setError(friendlyError(err, "Неверный код или истёк срок действия."));
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
      setLinkStep("done");
    } catch (err) {
      setError(friendlyError(err, "Ошибка привязки. Попробуйте позже."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlink() {
    if (!vkUserId) return;
    setSubmitting(true);
    setError("");
    try {
      // Use a generic POST helper through `api`. Backend has /auth/unlink with vk_user_id support
      // (or fall back to known endpoint via apiPost)
      await fetch(
        `${(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "")}/auth/unlink`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ max_user_id: `vk:${vkUserId}` }),
        },
      );
      resetPatient();
      setShowUnlinkConfirm(false);
      setLinkStep("phone");
      setPhone("+7");
      setCode("");
    } catch (err) {
      setError(friendlyError(err, "Ошибка отвязки. Попробуйте позже."));
    } finally {
      setSubmitting(false);
    }
  }

  const menuItems = [
    {
      icon: Calendar,
      label: "Мои записи",
      sublabel: "Предстоящие приёмы",
      onClick: () => navigate("/records"),
      color: "text-primary-600",
      bg: "bg-primary-50",
    },
    {
      icon: Heart,
      label: "Избранные врачи",
      sublabel: favorites.length > 0 ? `${favorites.length} врачей` : "Пока нет",
      onClick: () => navigate("/doctors?favorites=true"),
      color: "text-rose-500",
      bg: "bg-rose-50",
    },
    {
      icon: Phone,
      label: "Контакт-центр",
      sublabel: "+7 (843) 204-27-00",
      onClick: () => {
        try {
          window.open("tel:+78432042700");
        } catch {
          /* noop */
        }
      },
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
  ];

  function handleLogout() {
    localStorage.removeItem("vk_user_id");
    localStorage.removeItem("fav_doctors");
    navigate("/");
    window.location.reload();
  }

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* User card */}
        <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
          <div className="flex items-center gap-4">
            <Avatar name={patientName || fullName} size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{fullName}</h2>
              {patientId ? (
                <>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-2 h-2 rounded-full bg-success-500" />
                    <span className="text-xs text-success-600 font-medium">Привязан к клинике</span>
                  </div>
                  {patientName && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <User className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{patientName}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full bg-warning-500" />
                  <span className="text-xs text-warning-600 font-medium">Не привязан</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Unlink trigger */}
        {patientId && !showUnlinkConfirm && (
          <button
            onClick={() => setShowUnlinkConfirm(true)}
            className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 shadow-card border border-gray-100 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Unlink className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Сменить данные пациента</p>
              <p className="text-xs text-gray-500">Отвязать аккаунт от карты</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </button>
        )}

        {/* Unlink confirmation */}
        {patientId && showUnlinkConfirm && (
          <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 space-y-3">
            <p className="text-sm text-orange-800">
              Отвязать аккаунт{patientName ? ` от карты "${patientName}"` : ""}? После этого
              можно привязать другой номер.
            </p>
            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowUnlinkConfirm(false);
                  setError("");
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleUnlink}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 transition-all"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                {submitting ? "Отвязка..." : "Отвязать"}
              </button>
            </div>
          </div>
        )}

        {/* Step 1: enter phone */}
        {!patientId && linkStep === "phone" && (
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Привязка к клинике</h3>
                <p className="text-xs text-gray-500">Выберите способ подтверждения</p>
              </div>
            </div>

            {/* Primary: VK Bridge phone (free, instant) */}
            <div className="space-y-2">
              <button
                onClick={handleVkBridgePhone}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 active:scale-[0.97] transition-all"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                {submitting ? "Получение..." : "Поделиться номером через ВКонтакте"}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Безопасно — номер берётся из вашего профиля ВК
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <div className="flex-1 h-px bg-gray-200" />
              <span>или</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Fallback: SMS verification */}
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                Если номер во ВКонтакте отличается от номера в клинике — введите номер вручную, мы пришлём код в SMS:
              </p>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError("");
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="+7 (999) 123-45-67"
              />
              <button
                onClick={handleSendCode}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-white border border-primary-500 text-primary-600 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-50 disabled:opacity-60 transition-all"
              >
                {submitting ? "Отправка..." : "Получить код в SMS"}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>
        )}

        {/* Step 2: enter code */}
        {!patientId && linkStep === "code" && (
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">Введите код из SMS</h3>
            <p className="text-xs text-gray-500">
              Код отправлен на номер {phone}. Действителен 5 минут.
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base text-center tracking-widest focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="0000"
              autoFocus
            />

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setLinkStep("phone");
                  setError("");
                  setCode("");
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Назад
              </button>
              <button
                onClick={handleVerifyCode}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-all"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {submitting ? "Проверка..." : "Подтвердить"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: pick from multiple */}
        {!patientId && linkStep === "pick" && (
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">Найдено несколько карточек</h3>
            <p className="text-xs text-gray-500">Выберите свою:</p>

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
                    <Avatar name={name} size="sm" />
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

            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button
              onClick={() => {
                setLinkStep("phone");
                setError("");
              }}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Назад
            </button>
          </div>
        )}

        {/* Menu items */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 divide-y divide-gray-50 overflow-hidden">
          {menuItems.map(({ icon: Icon, label, sublabel, onClick, color, bg }) => (
            <button
              key={label}
              onClick={onClick}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 truncate">{sublabel}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Favorite doctors quick list */}
        {favorites.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Избранные врачи</h3>
              <button
                onClick={() => navigate("/doctors?favorites=true")}
                className="text-xs text-primary-600 font-medium"
              >
                Все →
              </button>
            </div>
            <div className="space-y-2">
              {favorites.slice(0, 3).map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    resetBooking();
                    navigate(`/slots/${doc.id}`);
                  }}
                  className="w-full flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                >
                  <Avatar name={doc.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  </div>
                  <Stethoscope className="w-4 h-4 text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-500 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>
    </PageTransition>
  );
}
