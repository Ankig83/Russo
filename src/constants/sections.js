/**
 * Конфигурация разделов шкафа.
 * id в формате drawer_tl / drawer_tr / drawer_bl / drawer_br.
 */
export const sections = [
  { id: 'drawer_tl', type: 'drawer', label: 'Частные пространства', route: '/private-spaces' },
  { id: 'drawer_tr', type: 'drawer', label: 'Авторские коллекции',  route: '/author-collections' },
  { id: 'drawer_bl', type: 'drawer', label: 'Коммерческие проекты', route: '/commercial-projects' },
  { id: 'drawer_br', type: 'drawer', label: 'О нас',                route: '/about' },
]

/** Только ящики из конфига */
export const drawerSections = sections.filter((s) => s.type === 'drawer')
