import { motion } from "framer-motion";
import { User, Baby } from "lucide-react";
import clsx from "clsx";

interface AgeToggleProps {
  isChild: boolean;
  onChange: (isChild: boolean) => void;
}

export default function AgeToggle({ isChild, onChange }: AgeToggleProps) {
  return (
    <div className="relative flex rounded-xl bg-gray-100 p-1">
      <motion.div
        className="absolute top-1 bottom-1 rounded-lg bg-primary-600 shadow-sm pointer-events-none"
        layoutId="age-toggle"
        style={{ width: "calc(50% - 4px)" }}
        animate={{ x: isChild ? "calc(100% + 4px)" : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
      <button
        className={clsx(
          "relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg transition-colors",
          !isChild ? "text-white" : "text-gray-600"
        )}
        onClick={() => onChange(false)}
      >
        <User className="w-4 h-4" />
        Взрослый
      </button>
      <button
        className={clsx(
          "relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg transition-colors",
          isChild ? "text-white" : "text-gray-600"
        )}
        onClick={() => onChange(true)}
      >
        <Baby className="w-4 h-4" />
        Ребёнок
      </button>
    </div>
  );
}
