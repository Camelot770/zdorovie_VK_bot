import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, User, Calendar, Building2, Home } from "lucide-react";
import { useBookingStore } from "../store/booking";
import PageTransition from "../components/ui/PageTransition";

export default function SuccessPage() {
  const navigate = useNavigate();
  const { doctorName, clinicName, appointmentAt, reset } = useBookingStore();

  const dateStr = appointmentAt
    ? new Date(appointmentAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const timeStr = appointmentAt ? appointmentAt.slice(11, 16) : "";

  async function handleClose() {
    reset();
    try {
      const bridge = (await import("@vkontakte/vk-bridge")).default;
      await bridge.send("VKWebAppClose", { status: "success" });
    } catch {
      // Not in VK or close not allowed — just navigate home
    }
    navigate("/");
  }

  const details = [
    { icon: User, label: "Врач", value: doctorName },
    { icon: Calendar, label: "Дата", value: dateStr ? `${dateStr}, ${timeStr}` : null },
    { icon: Building2, label: "Филиал", value: clinicName },
  ].filter((d) => d.value);

  return (
    <PageTransition>
      <div className="text-center py-6 space-y-5">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success-100 mx-auto"
        >
          <CheckCircle2 className="w-10 h-10 text-success-600" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-xl font-bold text-gray-900">Запись создана!</h2>
          <p className="text-sm text-gray-500 mt-1">
            Вам придёт напоминание за 24 часа и за 2 часа до приёма
          </p>
        </motion.div>

        {details.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 text-left max-w-sm mx-auto divide-y divide-gray-50"
          >
            {details.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400">{label}</p>
                  <p className="text-sm font-medium text-gray-900">{value}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <button
            onClick={handleClose}
            className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3.5 rounded-xl font-semibold shadow-md shadow-primary-600/30 hover:shadow-lg active:scale-[0.97] transition-all duration-200"
          >
            <Home className="w-4 h-4" />
            Вернуться в чат
          </button>
        </motion.div>
      </div>
    </PageTransition>
  );
}
