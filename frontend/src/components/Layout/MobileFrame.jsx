/**
 * Contenedor raíz: en móvil ocupa todo el viewport (w-full, h-[100dvh]);
 * en desktop se centra con ancho máximo de teléfono (max-w-md mx-auto).
 * Sin padding/margin en este contenedor para evitar márgenes laterales.
 */
export default function MobileFrame({ children, className = "" }) {
  return (
    <div
      className={`w-full h-[100dvh] max-w-md mx-auto bg-[#0a0a0a] overflow-hidden flex flex-col relative ${className}`}
    >
      {children}
    </div>
  );
}
