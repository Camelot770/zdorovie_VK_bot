import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus, Shield, AlertCircle, UserPlus } from "lucide-react";
import { apiGet, apiGetFresh } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import RecordCard from "../components/RecordCard";
import PageTransition from "../components/ui/PageTransition";
import SkeletonList from "../components/ui/SkeletonList";
import EmptyState from "../components/ui/EmptyState";
import PullToRefresh from "../components/ui/PullToRefresh";
import Badge from "../components/ui/Badge";
import type { Appointment, Doctor, Clinic, Specialization } from "../types";

function friendlyRecordsError(raw: string): string {
  if (raw.includes("Load failed") || raw.includes("Failed to fetch") || raw.includes("NetworkError")) {
    return "Нет связи с сервером. Проверьте интернет и попробуйте снова.";
  }
  if (raw.includes("502") || raw.includes("503") || raw.includes("504")) {
    return "Сервер временно недоступен. Попробуйте через минуту.";
  }
  return "Не удалось загрузить список записей. Попробуйте обновить.";
}

function getDoctorName(doc: Doctor | undefined): string {
  if (!doc) return "";
  return doc.name || [doc.lastName, doc.firstName, doc.middleName].filter(Boolean).join(" ");
}

export default function MyRecordsPage() {
  const navigate = useNavigate();
  const { patientId, maxUserId, loading: authLoading } = useAuth();

  // 1C API requires DD.MM.YYYY format
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const today = fmt(new Date());
  const end = fmt(new Date(Date.now() + 180 * 86400000));

  const {
    data: records,
    loading,
    error,
    refetch,
  } = useApi<Appointment[]>(
    () => {
      if (!maxUserId && !patientId) return Promise.resolve([]);
      const params: Record<string, string> = {
        beginDate: today,
        endDate: end,
      };
      if (maxUserId) {
        // VK users are stored under prefixed key in the backend DB
        params.maxUserId = `vk:${maxUserId}`;
      } else if (patientId) {
        params.patientId = patientId;
      }
      return apiGetFresh("/records", params);
    },
    [maxUserId, patientId]
  );

  // Load doctors & clinics for name resolution (cached from MainPage)
  const { data: doctors } = useApi<Doctor[]>(
    () => apiGet<Doctor[]>("/doctors", { limit: "500" }),
    []
  );
  const { data: clinics } = useApi<Clinic[]>(
    () => apiGet<Clinic[]>("/clinics"),
    []
  );
  const { data: specializations } = useApi<Specialization[]>(
    () => apiGet<Specialization[]>("/specializations"),
    []
  );

  const doctorMap = useMemo(() => {
    const map: Record<string, Doctor> = {};
    (doctors || []).forEach((d) => { map[d.id] = d; });
    return map;
  }, [doctors]);

  const clinicMap = useMemo(() => {
    const map: Record<string, Clinic> = {};
    (clinics || []).forEach((c) => { map[c.id] = c; });
    return map;
  }, [clinics]);

  const specMap = useMemo(() => {
    const map: Record<string, string> = {};
    (specializations || []).forEach((s) => { map[s.id] = s.name; });
    return map;
  }, [specializations]);

  // Filter out cancelled, sort by nearest date first
  const list = useMemo(() => {
    const raw = Array.isArray(records) ? records : [];
    return raw
      .filter((r) => !r.canceled)
      .sort((a, b) => {
        const dateA = a.appointmentAt ? new Date(a.appointmentAt).getTime() : 0;
        const dateB = b.appointmentAt ? new Date(b.appointmentAt).getTime() : 0;
        return dateA - dateB;
      });
  }, [records]);

  // Distinguish "not linked" (has maxUserId but no patientId) from "not authenticated"
  const notLinked = !patientId && !!maxUserId;

  return (
    <PageTransition>
      <PullToRefresh onRefresh={refetch}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Мои записи</h2>
            {list.length > 0 && (
              <Badge variant="neutral">Записей: {list.length}</Badge>
            )}
          </div>

          {authLoading || loading ? (
            <SkeletonList count={3} />
          ) : notLinked ? (
            <EmptyState
              icon={UserPlus}
              title="Аккаунт не привязан"
              description="Привяжите аккаунт к медкарте в разделе «Профиль», чтобы видеть свои записи"
              action={{ label: "Перейти в профиль", onClick: () => navigate("/profile") }}
            />
          ) : !patientId ? (
            <EmptyState
              icon={Shield}
              title="Требуется авторизация"
              description="Откройте приложение через бот для авторизации"
              action={{ label: "На главную", onClick: () => navigate("/") }}
            />
          ) : error ? (
            <EmptyState
              icon={AlertCircle}
              title="Ошибка загрузки"
              description={friendlyRecordsError(error)}
              action={{ label: "Повторить", onClick: refetch }}
            />
          ) : list.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="Нет предстоящих записей"
              description="У вас пока нет записей на ближайшее время"
              action={{ label: "Записаться на приём", onClick: () => navigate("/") }}
            />
          ) : (
            list.map((record) => {
              const clinic = record.clinicId ? clinicMap[record.clinicId] : undefined;
              const clinicLabel = clinic?.shortAddress || clinic?.name || "";
              return (
                <RecordCard
                  key={record.id}
                  record={record}
                  doctorName={getDoctorName(doctorMap[record.doctorId || ""])}
                  specializationName={record.specializationId ? specMap[record.specializationId] || "" : ""}
                  clinicName={clinicLabel}
                  patientName={record.patientName}
                  onCancel={() => navigate(`/cancel/${record.id}`)}
                />
              );
            })
          )}
        </div>
      </PullToRefresh>
    </PageTransition>
  );
}
