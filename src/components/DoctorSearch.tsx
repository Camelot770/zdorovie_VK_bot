import { useState, useEffect, useMemo, useRef } from "react";
import { Search, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { apiGet } from "../api/client";
import Avatar from "./ui/Avatar";
import type { Doctor } from "../types";

interface DoctorSearchProps {
  clinicId: string;
  specializationId: string;
  onSelect: (doctor: Doctor) => void;
}

export default function DoctorSearch({
  clinicId,
  specializationId,
  onSelect,
}: DoctorSearchProps) {
  const [query, setQuery] = useState("");
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const loaded = useRef(false);

  // Load all doctors once (with clinic/specialization filter)
  useEffect(() => {
    loaded.current = false;
    setAllDoctors([]);
  }, [clinicId, specializationId]);

  useEffect(() => {
    if (query.length < 2 || loaded.current) return;

    setLoadingAll(true);
    const params: Record<string, string> = { limit: "500" };
    if (clinicId) params.clinicId = clinicId;
    if (specializationId) params.specializationId = specializationId;

    apiGet<Doctor[]>("/doctors", params)
      .then((data) => {
        setAllDoctors(Array.isArray(data) ? data : []);
        loaded.current = true;
      })
      .catch(() => setAllDoctors([]))
      .finally(() => setLoadingAll(false));
  }, [query, clinicId, specializationId]);

  // Client-side filtering by name
  const suggestions = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return allDoctors.filter((doc) => {
      const name = getDoctorName(doc).toLowerCase();
      return name.includes(q);
    });
  }, [query, allDoctors]);

  function getDoctorName(doc: Doctor) {
    return (
      doc.name ||
      [doc.lastName, doc.firstName, doc.middleName].filter(Boolean).join(" ")
    );
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Поиск по ФИО врача
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          className="w-full border border-gray-300 rounded-lg pl-9 pr-9 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          placeholder="Введите фамилию или имя"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />
        {loadingAll && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loadingAll && query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onMouseDown={(e) => {
              e.preventDefault();
              setQuery("");
              setShowDropdown(false);
            }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && query.length >= 2 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-60 overflow-auto"
          >
            {loadingAll ? (
              <li className="px-3 py-3 text-sm text-gray-500 text-center flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                Загрузка...
              </li>
            ) : suggestions.length === 0 ? (
              <li className="px-3 py-3 text-sm text-gray-500 text-center">
                Врачи не найдены
              </li>
            ) : (
              suggestions.slice(0, 20).map((doc) => {
                const name = getDoctorName(doc);
                return (
                  <li
                    key={doc.id}
                    className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-primary-50 cursor-pointer transition-colors"
                    onMouseDown={() => {
                      onSelect(doc);
                      setQuery(name);
                      setShowDropdown(false);
                    }}
                  >
                    <Avatar name={name} size="sm" />
                    <span className="text-sm text-gray-900">{name}</span>
                  </li>
                );
              })
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
