/**
 * Contenedor mobile-first: en desktop centra con ancho de móvil y alto fijo tipo app.
 * h-screen en móvil; en viewport grande opcionalmente h-[850px] para simular dispositivo.
 */
export default function MobileFrame({ children, className = "" }) {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex justify-center items-center dark:bg-zinc-950 dark:text-zinc-100">
      <div
        className={`w-full max-w-[430px] h-screen max-h-[850px] shadow-2xl relative flex flex-col overflow-hidden bg-white dark:bg-zinc-900 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
