import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

/**
 * Экспорт текущего runtime-шкафа (закрытые дверцы + ножки + медальоны) в GLB.
 */
export function exportShkafToGlb(root, {
  binary = true,
  maxTextureSize = 2048,
  recenter = true,
} = {}) {
  if (!root) {
    return Promise.reject(new Error('exportShkafToGlb: нет root'))
  }

  return new Promise((resolve, reject) => {
    root.updateMatrixWorld(true)

    const wrapper = new THREE.Group()
    wrapper.name = 'shkaf_closed_export'
    const clone = root.clone(true)
    clone.name = root.name || 'shkaf'
    wrapper.add(clone)

    const remove = []
    wrapper.traverse((obj) => {
      if (obj === wrapper) return
      if (obj.isLight || obj.isCamera || obj.isLine || obj.isPoints || obj.isBone) {
        remove.push(obj)
        return
      }
      if (obj.visible === false) remove.push(obj)
    })
    remove.forEach((obj) => obj.parent?.remove(obj))

    if (recenter) {
      wrapper.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(wrapper)
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3())
        wrapper.position.sub(center)
        wrapper.updateMatrixWorld(true)
      }
    }

    const exporter = new GLTFExporter()
    exporter.parse(
      wrapper,
      (result) => resolve(result),
      (err) => reject(err || new Error('GLTFExporter failed')),
      {
        binary,
        onlyVisible: true,
        embedImages: true,
        maxTextureSize,
      },
    )
  })
}

/** ArrayBuffer → base64 (чанками). */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * Регистрирует window.__RUSSO_EXPORT_SHKAF_GLB после готовности шкафа.
 * Сама регистрация дешёвая; тяжёлый export — только по вызову.
 */
export function registerShkafGlbExporter(model) {
  if (typeof window === 'undefined' || !model) return
  window.__RUSSO_SHKAF_EXPORT_ROOT = model
  window.__RUSSO_SHKAF_READY = true
  window.__RUSSO_EXPORT_SHKAF_GLB = async () => {
    const buf = await exportShkafToGlb(model, { binary: true })
    const b64 = arrayBufferToBase64(buf)
    window.__RUSSO_GLB_BASE64 = b64
    window.__RUSSO_GLB_BYTES = buf.byteLength
    if (import.meta.env.DEV) {
      console.info(
        `РУССО:export GLB ready ${(buf.byteLength / 1024 / 1024).toFixed(2)} MB`,
      )
    }
    return { bytes: buf.byteLength, base64: b64 }
  }
  if (import.meta.env.DEV) {
    console.info('РУССО:export exporter ready (window.__RUSSO_EXPORT_SHKAF_GLB)')
  }
}
