import { useLocation, useNavigate } from "react-router-dom";
import { Home, Stethoscope, CalendarCheck, User } from "lucide-react";
import clsx from "clsx";

const tabs = [
  { path: "/", label: "Главная", icon: Home },
  { path: "/doctors", label: "Врачи", icon: Stethoscope },
  { path: "/records", label: "Записи", icon: CalendarCheck },
  { path: "/profile", label: "Профиль", icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  function handleNav(path: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = (window as any).vkBridge || null;
      if (b?.send) b.send("VKWebAppTapticSelectionChanged").catch(() => {});
    } catch { /* noop */ }
    navigate(path);
  }

  function isActive(path: string) {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(({ path, label, icon: Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className={clsx(
                "flex-1 flex flex-col items-center pt-2 pb-2.5 gap-0.5 transition-all duration-200 relative",
                active ? "text-primary-600" : "text-gray-400 active:text-gray-500"
              )}
            >
              {/* Active indicator bar */}
              <span
                className={clsx(
                  "absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-300",
                  active ? "w-8 bg-primary-500" : "w-0 bg-transparent"
                )}
              />
              <span
                className={clsx(
                  "flex items-center justify-center w-10 h-7 rounded-xl transition-all duration-200",
                  active ? "bg-primary-50" : ""
                )}
              >
                <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.2 : 1.8} />
              </span>
              <span className={clsx(
                "text-[11px] transition-all duration-200",
                active ? "font-semibold" : "font-medium"
              )}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
