/**
 * Конфигурация разделов шкафа.
 * id совпадает с ключами SHKAF_NODE_MAP.
 */
export const sections = [
  { id: 'door_left',  type: 'door',   label: 'О компании',           route: '/about'              },
  { id: 'door_right', type: 'door',   label: 'Контакты',             route: '/contacts'           },
  { id: 'drawer_tl',  type: 'drawer', label: 'Частные пространства', route: '/private-spaces'   },
  { id: 'drawer_tr',  type: 'drawer', label: 'Коммерческие проекты', route: '/commercial-projects' },
  { id: 'drawer_bl',  type: 'drawer', label: 'Авторские коллекции',  route: '/author-collections' },
  { id: 'drawer_br',  type: 'drawer', label: 'О нас',                route: '/about'              },
]

/** Только ящики из конфига */
export const drawerSections = sections.filter((s) => s.type === 'drawer')

/** Только дверцы из конфига */
export const doorSections = sections.filter((s) => s.type === 'door')
