import type { ReactNode } from "react";
import clsx from "clsx";

interface Props {
  variant: "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
}

const variantMap = {
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-danger-100 text-danger-700",
  neutral: "bg-gray-100 text-gray-600",
};

export default function Badge({ variant, children }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantMap[variant]
      )}
    >
      {children}
    </span>
  );
}
