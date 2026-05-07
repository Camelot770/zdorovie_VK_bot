import { CalendarX2, Clock } from "lucide-react";
import clsx from "clsx";
import EmptyState from "./ui/EmptyState";
import type { AppointmentSlot } from "../types";

interface TimeSlotsProps {
  slots: AppointmentSlot[];
  selectedTime: string;
  onSelect: (slot: AppointmentSlot) => void;
}

export default function TimeSlots({
  slots,
  selectedTime,
  onSelect,
}: TimeSlotsProps) {
  const available = slots.filter((s) => s.isEmpty);

  if (available.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="Нет доступных слотов"
        description="На выбранную дату нет свободного времени"
      />
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {available.map((slot) => {
        const time = slot.startAt.slice(11, 16);
        const isSelected = slot.startAt === selectedTime;

        return (
          <button
            key={slot.startAt}
            onClick={() => onSelect(slot)}
            className={clsx(
              "flex items-center justify-center gap-1 py-3 rounded-lg text-sm font-medium transition-all active:scale-95",
              isSelected
                ? "bg-primary-600 text-white ring-2 ring-primary-300 ring-offset-1 shadow-sm"
                : "bg-white border border-gray-200 text-gray-700 hover:border-primary-400 hover:bg-primary-50"
            )}
          >
            {isSelected && <Clock className="w-3.5 h-3.5" />}
            {time}
          </button>
        );
      })}
    </div>
  );
}
