import clsx from "clsx";

interface Props {
  name: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "w-9 h-9 text-sm",
  md: "w-12 h-12 text-base",
  lg: "w-16 h-16 text-lg",
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function Avatar({ name, size = "md" }: Props) {
  return (
    <div
      className={clsx(
        "rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center flex-shrink-0",
        sizeMap[size]
      )}
    >
      {getInitials(name)}
    </div>
  );
}
