import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-5">
        <Icon className="w-10 h-10 text-gray-400" strokeWidth={1.5} />
      </div>
      <h3 className="text-[15px] font-semibold text-gray-900 mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mb-5 max-w-[280px] leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-primary-600/25 hover:shadow-lg active:scale-[0.97] transition-all duration-200"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
