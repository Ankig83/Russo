/**
 * Разделы нового шкафа: два рабочих ящика.
 */
export const sections = [
  { id: 'drawer_1', type: 'drawer', label: 'Мебель', route: '/portfolio' },
  { id: 'drawer_2', type: 'drawer', label: 'О нас', route: '/about' },
]

export const drawerSections = sections.filter((s) => s.type === 'drawer')
