// Проекты портфолио. Фото лежат в public/assets/portfolio/<slug>/NN.webp
// (генерируются scripts/convert_portfolio_images.mjs из HEIC-архивов заказчика).

const assetBase = import.meta.env.BASE_URL

/** Категории = разделы сайта (совпадают с роутами шкафа) */
export const PORTFOLIO_CATEGORIES = {
  private: {
    key: 'private',
    route: '/private-spaces',
    title: 'Частные пространства',
    subtitle: 'Индивидуальные интерьерные решения для дома',
  },
  commercial: {
    key: 'commercial',
    route: '/commercial-projects',
    title: 'Коммерческие проекты',
    subtitle: 'Мебель и интерьеры для бизнеса и общественных пространств',
  },
  author: {
    key: 'author',
    route: '/author-collections',
    title: 'Авторские коллекции',
    subtitle: 'Коллекционные изделия мебельной компании «Руссо»',
  },
}

/** Путь к фото проекта */
function projectImage(slug, name) {
  return `${assetBase}assets/portfolio/${slug}/${name}`
}

/** Строит массив путей 01.webp … NN.webp */
function buildImages(slug, count) {
  return Array.from({ length: count }, (_, i) =>
    projectImage(slug, `${String(i + 1).padStart(2, '0')}.webp`),
  )
}

const RAW_PROJECTS = [
  {
    id: 'simferopol-mosque',
    slug: 'simferopol-mosque',
    category: 'commercial',
    title: 'Соборная мечеть',
    city: 'Симферополь',
    year: null,
    description:
      'Столярные и мебельные работы для интерьера Соборной мечети в Симферополе.',
    imageCount: 35,
  },
  {
    id: 'simferopol-kitchen',
    slug: 'simferopol-kitchen',
    category: 'private',
    title: 'Кухонный гарнитур и гостиная для молодой семьи',
    city: 'Симферополь',
    year: null,
    description:
      'Кухонный гарнитур и мебель гостиной для молодой семьи в Симферополе.',
    imageCount: 3,
  },
]

/** Полный список проектов с готовыми путями к фото и обложке */
export const PORTFOLIO_PROJECTS = RAW_PROJECTS.map((p) => ({
  ...p,
  cover: projectImage(p.slug, 'cover.webp'),
  images: buildImages(p.slug, p.imageCount),
}))

export function getProjectsByCategory(category) {
  return PORTFOLIO_PROJECTS.filter((p) => p.category === category)
}

export function getProject(category, slug) {
  return PORTFOLIO_PROJECTS.find((p) => p.category === category && p.slug === slug)
}

export function getCategory(category) {
  return PORTFOLIO_CATEGORIES[category]
}
