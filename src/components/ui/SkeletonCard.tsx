import clsx from "clsx";

interface Props {
  lines?: number;
  showAvatar?: boolean;
}

export default function SkeletonCard({ lines = 3, showAvatar = false }: Props) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-card border border-gray-100 animate-pulse">
      <div className="flex gap-3">
        {showAvatar && (
          <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
        )}
        <div className="flex-1 space-y-2.5">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          {Array.from({ length: lines - 1 }).map((_, i) => (
            <div
              key={i}
              className={clsx("h-3 bg-gray-200 rounded", i % 2 === 0 ? "w-1/2" : "w-2/3")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
