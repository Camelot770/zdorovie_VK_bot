import { create } from "zustand";

interface BookingState {
  isChild: boolean;
  clinicId: string;
  specializationId: string;
  doctorId: string;
  appointmentAt: string;
  patientId: string;
  patientName: string;
  patientBirthDate: string;
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
  setPatientId: (id: string, name?: string, birthDate?: string) => void;
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
  patientName: "",
  patientBirthDate: "",
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
  setPatientId: (id, name, birthDate) =>
    set({ patientId: id, patientName: name || "", patientBirthDate: birthDate || "" }),
  setPrice: (p) => set({ price: p }),
  setServiceIds: (ids) => set({ serviceIds: ids }),
  reset: () => set(initial),
}));
