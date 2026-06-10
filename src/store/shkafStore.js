import { create } from 'zustand'

/** Глобальный стейт интерактивного шкафа */
export const useShkafStore = create((set) => ({
  doorsOpen: false,
  animating: false,
  activeDrawerId: null,

  setDoorsOpen: (open) => set({ doorsOpen: open }),
  setAnimating: (animating) => set({ animating }),
  setActiveDrawerId: (id) => set({ activeDrawerId: id }),

  reset: () => set({ doorsOpen: false, animating: false, activeDrawerId: null }),
}))
