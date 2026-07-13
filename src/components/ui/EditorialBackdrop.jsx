import './EditorialBackdrop.css'

/** Тёмный фактурный фон внутренних страниц — камень, патина и тёплый металл. */
export default function EditorialBackdrop() {
  return (
    <div className="editorial-backdrop" aria-hidden="true">
      <div className="editorial-backdrop__grain" />
      <div className="editorial-backdrop__glow" />
    </div>
  )
}
