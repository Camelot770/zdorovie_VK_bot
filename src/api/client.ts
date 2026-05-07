import type { Clinic, Specialization, Doctor, Schedule, Appointment, Service, Patient, LinkedPatient } from "../types";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

// ---- In-memory GET cache: avoids re-fetching on page navigation ----
const _cache = new Map<string, { data: unknown; ts: number; promise?: Promise<unknown> }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Clear cache entries (all, or by prefix) */
export function clearCache(prefix?: string) {
  if (!prefix) { _cache.clear(); return; }
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

export function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const cacheKey = path + qs;

  // Return cached data if fresh
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    if (cached.promise) return cached.promise as Promise<T>;
    return Promise.resolve(cached.data as T);
  }

  // Deduplicate in-flight requests to the same URL
  const promise = request<T>(cacheKey).then((data) => {
    _cache.set(cacheKey, { data, ts: Date.now() });
    return data;
  }).catch((err) => {
    _cache.delete(cacheKey);
    throw err;
  });

  _cache.set(cacheKey, { data: null, ts: Date.now(), promise });
  return promise;
}

/** GET without caching (for data that must always be fresh) */
export function apiGetFresh<T>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<T>(path + qs);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export const api = {
  // ---- Clinics ----
  getClinics: (params?: Record<string, string>) =>
    apiGet<Clinic[]>("/clinics", params),
  getClinic: (id: string, params?: Record<string, string>) =>
    apiGet<Clinic>(`/clinics/${id}`, params),

  // ---- Specializations ----
  getSpecializations: (params?: Record<string, string>) =>
    apiGet<Specialization[]>("/specializations", params),
  getSpecialization: (id: string) =>
    apiGet<Specialization>(`/specializations/${id}`),

  // ---- Services ----
  getServices: (params?: Record<string, string>) =>
    apiGet<Service[]>("/services", params),
  getService: (id: string, params?: Record<string, string>) =>
    apiGet<Service>(`/services/${id}`, params),

  // ---- Doctors ----
  getDoctors: (params?: Record<string, string>) =>
    apiGet<Doctor[]>("/doctors", params),
  getDoctor: (id: string, params?: Record<string, string>) =>
    apiGet<Doctor>(`/doctors/${id}`, params),

  // ---- Schedules ----
  getSchedules: (params?: Record<string, string>) =>
    apiGet<Schedule[]>("/schedules", params),

  // ---- Patients ----
  getPatients: (params: Record<string, string>) =>
    apiGet<Patient[]>("/patients", params),
  getPatient: (id: string) =>
    apiGet<Patient>(`/patients/${id}`),
  createPatient: (body: {
    lastName: string;
    firstName: string;
    middleName?: string;
    noMiddleName?: boolean;
    gender: string;
    birthDate: string;
    phone: string;
    email?: string;
  }) => apiPost<Patient>("/patients", body),

  // ---- Records (appointments) ----
  getRecords: (params: Record<string, string>) =>
    apiGet<Appointment[]>("/records", params),
  getRecord: (id: string) =>
    apiGet<Appointment>(`/records/${id}`),
  createRecord: (body: {
    appointmentAt: string;
    clinicId: string;
    doctorId: string;
    specializationId: string;
    patientId: string;
    serviceIds?: string;
    comment?: string;
  }) => apiPost<Appointment>("/records", body),
  confirmRecord: (id: string) =>
    apiPost<Appointment>(`/records/${id}/confirm`),
  cancelRecord: (id: string) =>
    apiPost<Appointment>(`/records/${id}/cancel`),
  restoreRecord: (id: string) =>
    apiPost<Appointment>(`/records/${id}/restore`),

  // ---- Auth (VK SMS-based) ----
  smsSend: (phone: string, vkUserId: string) =>
    apiPost<{ status: string }>("/auth/sms/send", { phone, vk_user_id: vkUserId }),
  smsVerify: (phone: string, code: string, vkUserId: string) =>
    apiPost<{
      status: "linked" | "multiple" | "not_found";
      patientId?: string;
      fullName?: string;
      patients?: Patient[];
    }>("/auth/sms/verify", { phone, code, vk_user_id: vkUserId }),
  linkPatientById: (patientId: string, vkUserId: string) =>
    apiPost<{
      status: string;
      patientId: string;
      fullName: string;
    }>(`/auth/link/${patientId}?vk_user_id=${vkUserId}`),
  getPatientByUser: (vkUserId: string) =>
    apiGet<{ patientId: string; fullName?: string; phone?: string }>(
      `/auth/patient/${vkUserId}`,
      { source: "vk" },
    ),
  getLinkedPatients: (vkUserId: string) =>
    apiGetFresh<LinkedPatient[]>(`/auth/patients/${vkUserId}`, { source: "vk" }),

  // ---- Health ----
  health: () => apiGet<{ status: string }>("/health"),
};
