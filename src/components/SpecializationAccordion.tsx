import { Stethoscope, ChevronRight } from "lucide-react";
import type { Specialization, Service } from "../types";

interface Props {
  specializations: Specialization[];
  servicesBySpec: Record<string, Service[]>;
  onSelectSpec: (specId: string, specName: string) => void;
  loading?: boolean;
}

export default function SpecializationAccordion({
  specializations,
  servicesBySpec,
  onSelectSpec,
  loading = false,
}: Props) {
  // Only show specializations that have services
  const visible = specializations.filter((s) => servicesBySpec[s.id]?.length);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="text-center text-gray-500 text-sm py-6">
        Нет доступных специальностей
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Специальность
      </label>
      {visible.map((spec) => {
        const services = servicesBySpec[spec.id] || [];
        const minPrice = services[0]?.price;

        return (
          <button
            key={spec.id}
            type="button"
            onClick={() => onSelectSpec(spec.id, spec.name)}
            className="w-full bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4 h-4 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-900 truncate">
                {spec.name}
              </span>
              {minPrice != null && (
                <span className="block text-xs text-gray-500 mt-0.5">
                  {minPrice.toLocaleString("ru-RU")} ₽
                </span>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
