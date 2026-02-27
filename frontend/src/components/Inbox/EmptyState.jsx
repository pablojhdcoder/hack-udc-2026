import { Brain } from "lucide-react";

export default function EmptyState({ isSearch }) {
  if (isSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <p className="text-zinc-500 text-sm">No hay resultados para tu búsqueda</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center mb-5">
        <Brain className="w-10 h-10 text-zinc-500" />
      </div>
      <h2 className="text-lg font-medium text-zinc-300 mb-2">Tu cerebro está despejado</h2>
      <p className="text-zinc-500 text-sm max-w-[260px] leading-relaxed">
        Captura tu primera idea abajo.
      </p>
    </div>
  );
}
