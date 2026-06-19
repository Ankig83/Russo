/**
 * Конфигурация разделов шкафа.
 * id совпадает с ключами SHKAF_NODE_MAP.
 */
export const sections = [
  { id: 'door_left',  type: 'door',   label: 'О компании',           route: '/about'     },
  { id: 'door_right', type: 'door',   label: 'Контакты',             route: '/contacts'  },
  { id: 'drawer_1',   type: 'drawer', label: 'Эксклюзив',            route: '/exclusive' },
  { id: 'drawer_3',   type: 'drawer', label: 'О нас',                route: '/about'     },
  { id: 'drawer_4',   type: 'drawer', label: 'Контакты',             route: '/contacts'  },
  { id: 'drawer_5',   type: 'drawer', label: 'Портфолио',            route: '/portfolio' },
  { id: 'drawer_6',   type: 'drawer', label: 'Эскизы',               route: '/sketches'  },
]

/** Только ящики из конфига */
export const drawerSections = sections.filter((s) => s.type === 'drawer')

/** Только дверцы из конфига */
export const doorSections = sections.filter((s) => s.type === 'door')
