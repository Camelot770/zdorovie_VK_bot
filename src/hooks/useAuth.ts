import { useEffect } from "react";
import { useAuthStore } from "../store/auth";

interface AuthState {
  loading: boolean;
  patientId: string | null;
  patientName: string | null;
  maxUserId: string | null;
  setPatientId: (id: string, name?: string) => void;
  resetPatient: () => void;
}

export function useAuth(): AuthState {
  const { loading, patientId, patientName, maxUserId, init, setPatientId, resetPatient } =
    useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  return { loading, patientId, patientName, maxUserId, setPatientId, resetPatient };
}
