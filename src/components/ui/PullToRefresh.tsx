import { type ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";

interface Props {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: Props) {
  const { containerRef, pullDistance, isRefreshing, isPulling } =
    usePullToRefresh({ onRefresh, threshold: 80 });

  const showIndicator = isPulling || isRefreshing;
  const ready = pullDistance >= 80;

  return (
    <div ref={containerRef} className="relative min-h-[200px]">
      {/* Pull indicator */}
      {showIndicator && (
        <div
          className="flex items-center justify-center transition-all duration-200"
          style={{
            height: Math.max(pullDistance, isRefreshing ? 40 : 0),
            opacity: Math.min(pullDistance / 40, 1),
          }}
        >
          <div
            className={`w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center transition-transform duration-200 ${
              ready ? "scale-110" : "scale-100"
            }`}
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
            ) : (
              <ArrowDown
                className={`w-4 h-4 text-primary-600 transition-transform duration-200 ${
                  ready ? "rotate-180" : ""
                }`}
              />
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
