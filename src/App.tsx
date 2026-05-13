import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import bridge from "@vkontakte/vk-bridge";
import Layout from "./components/Layout";
import MainPage from "./pages/MainPage";
import DoctorsPage from "./pages/DoctorsPage";
import SlotsPage from "./pages/SlotsPage";
import ConfirmPage from "./pages/ConfirmPage";
import SuccessPage from "./pages/SuccessPage";
import MyRecordsPage from "./pages/MyRecordsPage";
import CancelPage from "./pages/CancelPage";
import ProfilePage from "./pages/ProfilePage";
import BookingWizardPage from "./pages/BookingWizardPage";

/** Reads VK Mini App `hash` from URL and navigates to matching route once on mount.
 *
 * VK passes deep-link `hash` in TWO different shapes depending on platform:
 *   1. Query param: `?hash=profile&vk_user_id=...`        (web / m.vk.com / some clients)
 *   2. URL fragment: `#profile`                            (open_app action, mobile)
 *
 * We read both and fall back to whichever is present. */
function HashRouter() {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let hash = params.get("hash") || "";
    if (!hash && window.location.hash) {
      hash = window.location.hash.replace(/^#/, "").split("?")[0].split("&")[0];
    }
    if (!hash) return;

    if (hash === "profile") {
      navigate("/profile", { replace: true });
    } else if (hash === "link_phone") {
      // Came from VK bot's "Поделиться номером" button → auto-fire the share dialog
      navigate("/profile?autoShare=1", { replace: true });
    } else if (hash === "records" || hash === "my_records") {
      navigate("/records", { replace: true });
    } else if (hash === "booking") {
      navigate("/booking", { replace: true });
    }
  }, [navigate]);
  return null;
}

export default function App() {
  useEffect(() => {
    // Signal VK that the mini-app is ready
    bridge.send("VKWebAppInit").catch(() => {
      // Running outside VK (browser dev) — ignore
    });

    // Fallback: save userId from URL params (for direct links / dev)
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("userId") || params.get("vk_user_id");
    if (userId) {
      localStorage.setItem("vk_user_id", userId);
    }
  }, []);

  return (
    <BrowserRouter>
      <HashRouter />
      <Layout>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/booking" element={<BookingWizardPage />} />
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/slots/:doctorId" element={<SlotsPage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/records" element={<MyRecordsPage />} />
          <Route path="/cancel/:recordId" element={<CancelPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
