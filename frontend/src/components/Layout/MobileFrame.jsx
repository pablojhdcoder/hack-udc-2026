/**
 * Contenedor mobile-first: en desktop centra el contenido con ancho de móvil.
 */
export default function MobileFrame({ children, className = "" }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex justify-center">
      <div
        className={`w-full max-w-[430px] min-h-screen shadow-2xl relative overflow-hidden bg-zinc-900 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
