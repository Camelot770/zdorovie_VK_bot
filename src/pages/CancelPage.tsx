import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { XCircle, ArrowLeft, Trash2, AlertCircle, Home, AlertTriangle } from "lucide-react";
import { apiPost } from "../api/client";
import PageTransition from "../components/ui/PageTransition";

export default function CancelPage() {
  const navigate = useNavigate();
  const { recordId } = useParams<{ recordId: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    if (!recordId) return;
    setSubmitting(true);
    setError("");

    try {
      await apiPost(`/records/${recordId}/cancel`);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка при отмене записи"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <PageTransition>
        <div className="text-center py-6 space-y-5">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-danger-100 mx-auto"
          >
            <XCircle className="w-10 h-10 text-danger-600" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xl font-bold text-gray-900">Запись отменена</h2>
            <p className="text-sm text-gray-500 mt-1">
              Вы можете записаться повторно в любое время
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <button
              onClick={() => navigate("/")}
              className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 active:scale-[0.98] transition-all"
            >
              <Home className="w-4 h-4" />
              На главную
            </button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-4 py-4">
        <div className="bg-white rounded-xl p-5 shadow-card border border-gray-100 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-warning-100 mx-auto">
            <AlertTriangle className="w-7 h-7 text-warning-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Отмена записи</h2>
          <p className="text-sm text-gray-600">
            Вы уверены, что хотите отменить запись? Это действие нельзя будет отменить.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-danger-50 text-danger-700 text-sm p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-3 rounded-lg text-sm font-medium hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Оставить
          </button>
          <button
            onClick={handleCancel}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 bg-danger-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-danger-700 active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            {submitting ? "Отменяем..." : "Отменить"}
          </button>
        </div>
      </div>
    </PageTransition>
  );
}
