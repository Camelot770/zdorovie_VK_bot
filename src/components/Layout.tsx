import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import BottomNav from "./ui/BottomNav";

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";

  // VK has its own back button in the host app; no JS sync needed.
  // We still render our in-app back button (above) for non-VK browsers.
  useEffect(() => {
    // No-op for VK — kept for future expansion if needed.
  }, [isHome, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center px-4 py-2">
          {!isHome && (
            <button
              onClick={() => navigate(-1)}
              className="mr-2 -ml-1 p-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-primary-600"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1 flex justify-center">
            <img
              src="/logo.png"
              alt="Здоровье семьи"
              onClick={() => !isHome && navigate("/")}
              className={`transition-all duration-200 ${
                isHome ? "h-10" : "h-8 cursor-pointer active:scale-95"
              }`}
            />
          </div>
          {!isHome && <div className="w-9" />}
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
