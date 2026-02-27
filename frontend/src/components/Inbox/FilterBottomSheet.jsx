import { X, Calendar } from "lucide-react";

const TYPE_OPTIONS = [
  { id: "all", label: "Todas" },
  { id: "text", label: "Solo texto" },
  { id: "links", label: "Solo enlaces" },
  { id: "voice", label: "Solo notas de voz" },
  { id: "files", label: "Solo archivos" },
];

const DATE_OPTIONS = [
  { id: "all_dates", label: "Cualquier fecha" },
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "last_7_days", label: "Últimos 7 días" },
  { id: "last_30_days", label: "Último mes" },
];

export default function FilterBottomSheet({
  isOpen,
  onClose,
  activeTypeFilter = "all",
  activeDateFilter = "all_dates",
  onTypeFilter,
  onDateFilter,
}) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Cerrar"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 rounded-t-2xl max-w-[430px] mx-auto safe-bottom animate-slide-in-bottom max-h-[85vh] overflow-y-auto"
        aria-modal="true"
        aria-label="Opciones de filtro"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2 sticky top-0 bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-100">Filtros</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pb-6 space-y-4">
          <section>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
              Por tipo
            </h3>
            <ul className="space-y-1">
              {TYPE_OPTIONS.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onTypeFilter?.(opt.id);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                      activeTypeFilter === opt.id
                        ? "bg-brand-500/20 text-brand-400"
                        : "hover:bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
              <Calendar className="w-3.5 h-3.5" />
              Por fecha
            </h3>
            <ul className="space-y-1">
              {DATE_OPTIONS.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onDateFilter?.(opt.id);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                      activeDateFilter === opt.id
                        ? "bg-brand-500/20 text-brand-400"
                        : "hover:bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
