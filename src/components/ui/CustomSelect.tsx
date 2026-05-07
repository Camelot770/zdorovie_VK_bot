import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";

interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string, label: string) => void;
  placeholder: string;
  label: string;
  loading?: boolean;
  icon?: ReactNode;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  label,
  loading = false,
  icon,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => !loading && setOpen(!open)}
        className={clsx(
          "w-full flex items-center gap-2 px-3 py-2.5 bg-white border rounded-lg text-left transition-colors",
          open
            ? "border-primary-500 ring-2 ring-primary-100"
            : "border-gray-300 hover:border-gray-400",
          loading && "opacity-60 cursor-not-allowed"
        )}
      >
        {icon && <span className="text-gray-400 flex-shrink-0">{icon}</span>}
        <span
          className={clsx(
            "flex-1 truncate",
            selected ? "text-gray-900" : "text-gray-400"
          )}
        >
          {loading ? "Загрузка..." : selected?.label || placeholder}
        </span>
        <ChevronDown
          className={clsx(
            "w-4 h-4 text-gray-400 transition-transform flex-shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value, opt.label);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors",
                  opt.value === value
                    ? "bg-primary-50 text-primary-700"
                    : "hover:bg-gray-50 text-gray-900"
                )}
              >
                <span className="flex-1">
                  <span className="block text-sm">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="block text-xs text-gray-500">
                      {opt.sublabel}
                    </span>
                  )}
                </span>
                {opt.value === value && (
                  <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
