import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

interface CalendarProps {
  availableDates: Set<string>;
  selectedDate: string;
  onSelect: (date: string) => void;
}

export default function Calendar({
  availableDates,
  selectedDate,
  onSelect,
}: CalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const days = useMemo(() => {
    const result: Date[] = [];
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);

    const startPad = (first.getDay() + 6) % 7;
    for (let i = 0; i < startPad; i++) {
      result.push(new Date(viewYear, viewMonth, 1 - startPad + i));
    }

    for (let day = 1; day <= last.getDate(); day++) {
      result.push(new Date(viewYear, viewMonth, day));
    }

    return result;
  }, [viewYear, viewMonth]);

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const monthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];

  function formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const todayStr = formatDate(today);

  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

  function goPrev() {
    if (isCurrentMonth) return;
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function goNext() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  return (
    <div className="bg-white rounded-xl p-3 shadow-card border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goPrev}
          disabled={isCurrentMonth}
          className={clsx(
            "p-1.5 rounded-lg transition-colors",
            isCurrentMonth
              ? "text-gray-200 cursor-not-allowed"
              : "text-gray-500 hover:bg-gray-100 active:bg-gray-200"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h3 className="font-semibold text-gray-800">
          {monthNames[viewMonth]} {viewYear}
        </h3>

        <button
          onClick={goNext}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekDays.map((wd) => (
          <div key={wd} className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold py-1">
            {wd}
          </div>
        ))}
        {days.map((day, i) => {
          const ds = formatDate(day);
          const inMonth = day.getMonth() === viewMonth;
          const isPast = day < today;
          const isAvailable = availableDates.has(ds) && !isPast;
          const isSelected = ds === selectedDate;
          const isToday = ds === todayStr;

          return (
            <button
              key={i}
              disabled={!isAvailable}
              onClick={() => isAvailable && onSelect(ds)}
              className={clsx(
                "relative min-h-[40px] rounded-lg text-sm transition-all flex flex-col items-center justify-center",
                !inMonth && "text-gray-200",
                inMonth && isSelected && "bg-primary-600 text-white font-bold shadow-sm",
                inMonth && !isSelected && isAvailable && "bg-primary-50 text-primary-700 hover:bg-primary-100 font-medium active:scale-90",
                inMonth && !isSelected && !isAvailable && isPast && "text-gray-300",
                inMonth && !isSelected && !isAvailable && !isPast && "text-gray-400",
                isToday && !isSelected && "ring-1 ring-primary-300"
              )}
            >
              {day.getDate()}
              {isAvailable && !isSelected && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
