import { X, Inbox, FolderOpen, Settings } from "lucide-react";

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Overlay: dentro del marco móvil, clic cierra el menú */}
      <div
        className={`absolute inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={isOpen ? 0 : -1}
        aria-label="Cerrar menú"
        aria-hidden={!isOpen}
      />
      {/* Panel off-canvas: absolute dentro del marco, flota sobre el contenido */}
      <aside
        className={`absolute top-0 left-0 h-full w-64 bg-zinc-900 border-r border-zinc-800 z-50 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-modal="true"
        aria-label="Menú lateral"
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-800 shrink-0">
          <span className="font-semibold text-zinc-100">Digital Brain</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex flex-col p-2 mt-2">
          <button
            type="button"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-zinc-800 text-zinc-200"
          >
            <Inbox className="w-5 h-5 text-zinc-400" />
            Tu Inbox
          </button>
          <button
            type="button"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-zinc-800 text-zinc-200"
          >
            <FolderOpen className="w-5 h-5 text-zinc-400" />
            Procesado
          </button>
          <button
            type="button"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-zinc-800 text-zinc-200 mt-4"
          >
            <Settings className="w-5 h-5 text-zinc-400" />
            Ajustes
          </button>
        </nav>
      </aside>
    </>
  );
}
