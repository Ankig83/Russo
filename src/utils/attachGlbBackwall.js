import {
  SHKAF_ROOT_NAME,
  GLB_BACKWALL_ALIGN,
} from '../constants/shkafNodes'
import { findByName } from './cabinetBounds'

/**
 * Задняя стенка Beck_W из предыдущего GLB (не попала в shkaf_for_D).
 * Вешаем на корень сцены модели — attachCabinetSceneRoots потом attach'ит на shkaf.
 */
export function attachGlbBackwall(model, backwallScene) {
  if (!model || !backwallScene) return false
  if (model.getObjectByName('Beck_W')) return false

  const source = backwallScene.clone(true)
  const beck = source.getObjectByName('Beck_W')
  if (!beck) return false

  // Мировой transform из старого экспорта (сцена-sibling shkaf)
  model.add(beck)
  beck.raycast = () => null
  beck.traverse((child) => {
    if (!child.isMesh) return
    child.raycast = () => null
    child.castShadow = true
    child.receiveShadow = true
  })

  // Если shkaf уже есть — сразу привязать с сохранением мира
  const shkafRoot = findByName(model, SHKAF_ROOT_NAME)
  if (shkafRoot && beck.parent !== shkafRoot) {
    shkafRoot.attach(beck)
  }

  // Выравнивание под новый корпус (старый world-transform давал выступ слева)
  const align = GLB_BACKWALL_ALIGN
  if (align?.position) {
    beck.position.x += align.position[0]
    beck.position.y += align.position[1]
    beck.position.z += align.position[2]
  }
  if (align?.scale != null && align.scale !== 1) {
    beck.scale.multiplyScalar(align.scale)
  }

  return true
}
