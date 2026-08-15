import './EditorialBackdrop.css'

/** Тёмный сценический фон внутренних страниц (без декоративного шума). */
export default function EditorialBackdrop() {
  return (
    <div className="editorial-backdrop" aria-hidden="true">
      <div className="editorial-backdrop__grain" />
      <div className="editorial-backdrop__glow" />
    </div>
  )
}
