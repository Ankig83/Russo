import { create } from 'zustand'

/** Глобальный стейт приложения (не шкафа) */
export const useAppStore = create((set) => ({
  /** true после того, как лого улетело и сцена полностью открыта */
  loadingDone: false,
  setLoadingDone: () => set({ loadingDone: true }),
}))
