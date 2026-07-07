const assetBase = import.meta.env.BASE_URL

/** Поднимай после замены PNG в public/textures/patina/ */
export const PATINA_TEXTURE_VERSION = '4'

export const PATINA_DIFFUSE_URL = `${assetBase}textures/patina/copper_diffuse_delit.png?v=${PATINA_TEXTURE_VERSION}`
export const PATINA_METALLIC_URL = `${assetBase}textures/patina/copper_metallic_v2.png?v=${PATINA_TEXTURE_VERSION}`
