/** Конфигурация разделов шкафа — масштабируемый массив */
export const sections = [
  { id: 'door_left', type: 'door', label: 'О компании', route: '/about' },
  { id: 'door_right', type: 'door', label: 'Контакты', route: '/contacts' },
  { id: 'drawer_1', type: 'drawer', label: 'Каталог', route: '/catalog' },
  { id: 'drawer_2', type: 'drawer', label: 'ГАФТ', route: '/gaft' },
  { id: 'drawer_3', type: 'drawer', label: 'ГАФТ', route: '/gaft' },
  { id: 'drawer_4', type: 'drawer', label: 'КЕФА', route: '/kefa' },
  { id: 'drawer_5', type: 'drawer', label: 'КЕФА', route: '/kefa' },
]

/** Только ящики из конфига */
export const drawerSections = sections.filter((s) => s.type === 'drawer')

/** Только дверцы из конфига */
export const doorSections = sections.filter((s) => s.type === 'door')
