import { create } from "zustand";

interface BookingState {
  isChild: boolean;
  clinicId: string;
  specializationId: string;
  doctorId: string;
  appointmentAt: string;
  patientId: string;
  price: number;
  serviceIds: string;

  clinicName: string;
  doctorName: string;
  specializationName: string;

  setIsChild: (v: boolean) => void;
  setClinicId: (id: string, name?: string) => void;
  setSpecializationId: (id: string, name?: string) => void;
  setDoctorId: (id: string, name?: string) => void;
  setAppointmentAt: (dt: string) => void;
  setPatientId: (id: string) => void;
  setPrice: (p: number) => void;
  setServiceIds: (ids: string) => void;
  reset: () => void;
}

const initial = {
  isChild: false,
  clinicId: "",
  specializationId: "",
  doctorId: "",
  appointmentAt: "",
  patientId: "",
  price: 0,
  serviceIds: "",
  clinicName: "",
  doctorName: "",
  specializationName: "",
};

export const useBookingStore = create<BookingState>((set) => ({
  ...initial,
  setIsChild: (v) => set({ isChild: v, specializationId: "", specializationName: "", doctorId: "", doctorName: "", serviceIds: "", price: 0 }),
  setClinicId: (id, name) => set({ clinicId: id, clinicName: name || "" }),
  setSpecializationId: (id, name) => set({ specializationId: id, specializationName: name || "" }),
  setDoctorId: (id, name) => set({ doctorId: id, doctorName: name || "" }),
  setAppointmentAt: (dt) => set({ appointmentAt: dt }),
  setPatientId: (id) => set({ patientId: id }),
  setPrice: (p) => set({ price: p }),
  setServiceIds: (ids) => set({ serviceIds: ids }),
  reset: () => set(initial),
}));
