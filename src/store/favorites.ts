import { create } from "zustand";

interface FavDoctor {
  id: string;
  name: string;
}

interface FavoritesState {
  favorites: FavDoctor[];
  isFavorite: (id: string) => boolean;
  toggle: (doctor: FavDoctor) => void;
}

function loadFavorites(): FavDoctor[] {
  try {
    const raw = localStorage.getItem("fav_doctors");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favs: FavDoctor[]) {
  localStorage.setItem("fav_doctors", JSON.stringify(favs));
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: loadFavorites(),

  isFavorite: (id: string) => get().favorites.some((f) => f.id === id),

  toggle: (doctor: FavDoctor) => {
    const current = get().favorites;
    const exists = current.some((f) => f.id === doctor.id);
    const next = exists
      ? current.filter((f) => f.id !== doctor.id)
      : [...current, doctor];
    saveFavorites(next);
    set({ favorites: next });
  },
}));
