import { Briefcase, MapPin, Calendar, ArrowRight, Heart, Shield, Banknote } from "lucide-react";
import Avatar from "./ui/Avatar";
import Badge from "./ui/Badge";
import { useFavoritesStore } from "../store/favorites";
import type { Doctor } from "../types";

interface DoctorCardProps {
  doctor: Doctor;
  specializationName?: string;
  clinicNames?: string[];
  nearestDate?: string;
  price?: number;
  onBook: () => void;
}

export default function DoctorCard({
  doctor,
  specializationName,
  clinicNames,
  nearestDate,
  price,
  onBook,
}: DoctorCardProps) {
  const name =
    doctor.name ||
    [doctor.lastName, doctor.firstName, doctor.middleName]
      .filter(Boolean)
      .join(" ");

  const { isFavorite, toggle } = useFavoritesStore();
  const fav = isFavorite(doctor.id);

  function handleFav(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      // VK Bridge haptic feedback (graceful no-op outside VK)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = (window as any).vkBridge || null;
      if (b?.send) b.send("VKWebAppTapticImpactOccurred", { style: "light" }).catch(() => {});
    } catch { /* noop */ }
    toggle({ id: doctor.id, name });
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 hover:shadow-card-hover transition-all duration-200">
      <div className="flex gap-3.5">
        <Avatar name={name} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <h3 className="font-bold text-[15px] text-gray-900 truncate flex-1">{name}</h3>
            <button
              onClick={handleFav}
              className="ml-2 p-1.5 -mr-1 -mt-1 rounded-lg hover:bg-gray-50 active:scale-90 transition-all"
            >
              <Heart
                className={`w-[18px] h-[18px] transition-colors duration-200 ${
                  fav ? "fill-rose-500 text-rose-500" : "text-gray-300"
                }`}
              />
            </button>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {specializationName && (
              <Badge variant="neutral">{specializationName}</Badge>
            )}
            {doctor.dms && (
              <Badge variant="success">
                <Shield className="w-3 h-3 mr-0.5" />
                ДМС
              </Badge>
            )}
          </div>
          <div className="mt-2.5 space-y-1">
            {doctor.experience != null && (
              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <Briefcase className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                Стаж: {doctor.experience} лет
              </p>
            )}
            {clinicNames && clinicNames.length > 0 && clinicNames.map((cn) => (
              <p key={cn} className="flex items-center gap-1.5 text-xs text-gray-500">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                <span className="truncate">{cn}</span>
              </p>
            ))}
            {price != null && price > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-primary-700 font-medium">
                <Banknote className="w-3.5 h-3.5 flex-shrink-0" />
                Приём {price} ₽
              </p>
            )}
            {nearestDate && (
              <p className="flex items-center gap-1.5 text-xs text-success-600 font-medium">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                Ближайшая: {nearestDate}
              </p>
            )}
          </div>
        </div>
      </div>
      <button
        className="mt-3.5 w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm shadow-primary-600/20 hover:shadow-md active:scale-[0.97] transition-all duration-200"
        onClick={onBook}
      >
        Записаться
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
