import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerStore {
  myId: string | null;
  myName: string;
  buzzerPosition: number | null;
  setMyId: (id: string) => void;
  setMyName: (name: string) => void;
  setBuzzerPosition: (pos: number | null) => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      myId: null,
      myName: '',
      buzzerPosition: null,
      setMyId: (myId) => set({ myId }),
      setMyName: (myName) => set({ myName }),
      setBuzzerPosition: (buzzerPosition) => set({ buzzerPosition }),
    }),
    {
      name: 'jeopardy-player',
      partialize: (s) => ({ myName: s.myName }),
    },
  ),
);
