import { create } from "zustand";
import { apiGetFresh } from "../api/client";
import { getVkUserId, initVkBridge } from "../services/vkBridge";

interface PatientInfoResponse {
  patientId: string;
  fullName: string;
  phone: string;
}

interface AuthState {
  loading: boolean;
  patientId: string | null;
  patientName: string | null;
  vkUserId: string | null;
  /** Backward-compatible alias used throughout the codebase. Same value as vkUserId. */
  maxUserId: string | null;
  _initialized: boolean;
  _initializing: boolean;
  init: () => Promise<void>;
  setPatientId: (id: string, name?: string) => void;
  resetPatient: () => void;
  /** Full reset for logout: clears all auth state and re-arms init() to run again. */
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  loading: true,
  patientId: null,
  patientName: null,
  vkUserId: null,
  maxUserId: null,
  _initialized: false,
  _initializing: false,

  init: async () => {
    const state = get();
    if (state._initialized || state._initializing) return;
    set({ _initializing: true });

    try {
      // Initialise VK Bridge (no-op when running outside VK app)
      await initVkBridge();

      // VK passes user_id via launch params (?vk_user_id=...). Fall back to localStorage / `userId` URL param.
      const vkUserId = getVkUserId();
      if (!vkUserId) {
        set({
          loading: false,
          patientId: null,
          patientName: null,
          vkUserId: null,
          maxUserId: null,
          _initialized: true,
          _initializing: false,
        });
        return;
      }

      try {
        const result = await apiGetFresh<PatientInfoResponse>(
          `/auth/patient/${vkUserId}`,
          { source: "vk" },
        );
        set({
          loading: false,
          patientId: result.patientId,
          patientName: result.fullName || null,
          vkUserId,
          maxUserId: vkUserId,
          _initialized: true,
          _initializing: false,
        });
      } catch {
        // Not yet linked — user needs to authenticate via SMS
        set({
          loading: false,
          patientId: null,
          patientName: null,
          vkUserId,
          maxUserId: vkUserId,
          _initialized: true,
          _initializing: false,
        });
      }
    } catch {
      set({ loading: false, _initializing: false });
    }
  },

  setPatientId: (id, name) =>
    set((s) => ({ patientId: id, patientName: name || s.patientName })),

  resetPatient: () =>
    set({ patientId: null, patientName: null }),

  reset: () =>
    set({
      loading: true,
      patientId: null,
      patientName: null,
      vkUserId: null,
      maxUserId: null,
      _initialized: false,
      _initializing: false,
    }),
}));
