import { Clock, User, Users, Building2, Stethoscope, X } from "lucide-react";
import Badge from "./ui/Badge";
import type { Appointment } from "../types";

interface RecordCardProps {
  record: Appointment;
  clinicName?: string;
  doctorName?: string;
  specializationName?: string;
  patientName?: string;
  onCancel?: () => void;
}

export default function RecordCard({
  record,
  clinicName,
  doctorName,
  specializationName,
  patientName,
  onCancel,
}: RecordCardProps) {
  const appt = record.appointmentAt || "";
  const dateStr = appt
    ? new Date(appt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const timeStr = appt ? appt.slice(11, 16) : "";

  const statusVariant = record.confirmed
    ? "success"
    : record.canceled
      ? "danger"
      : "warning";
  const statusText = record.confirmed
    ? "Подтверждена"
    : record.canceled
      ? "Отменена"
      : record.status || "Запланирована";

  return (
    <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
      <div className="flex justify-between items-start mb-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="font-bold text-[15px] text-gray-900">{timeStr}</p>
              <p className="text-xs text-gray-500">{dateStr}</p>
            </div>
          </div>
          {doctorName && (
            <p className="flex items-center gap-1.5 text-sm text-gray-700 ml-10">
              <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{doctorName}</span>
            </p>
          )}
          {specializationName && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500 ml-10">
              <Stethoscope className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{specializationName}</span>
            </p>
          )}
          {clinicName && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500 ml-10">
              <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{clinicName}</span>
            </p>
          )}
          {patientName && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500 ml-10">
              <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{patientName}</span>
            </p>
          )}
        </div>
        <Badge variant={statusVariant}>{statusText}</Badge>
      </div>
      {onCancel && !record.canceled && (
        <button
          onClick={onCancel}
          className="w-full flex items-center justify-center gap-1.5 border border-danger-200 text-danger-600 py-2.5 rounded-xl text-sm font-medium hover:bg-danger-50 active:scale-[0.97] transition-all duration-200"
        >
          <X className="w-4 h-4" />
          Отменить запись
        </button>
      )}
    </div>
  );
}
