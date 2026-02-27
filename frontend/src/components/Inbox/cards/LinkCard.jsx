import { Link2 } from "lucide-react";

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return d.toLocaleDateString("es-ES", { weekday: "short" });
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function LinkCard({ item }) {
  return (
    <article className="rounded-xl bg-zinc-800/80 border border-zinc-700/50 overflow-hidden">
      {/* Miniatura tipo link preview: bloque rectangular gris claro */}
      {(item.imagePlaceholder !== false) && (
        <div className="h-28 bg-zinc-600/50 flex items-center justify-center border-b border-zinc-700/50">
          <div className="w-14 h-14 rounded-xl bg-zinc-500/40 flex items-center justify-center">
            <Link2 className="w-7 h-7 text-zinc-400" />
          </div>
        </div>
      )}
      <div className="p-4 flex gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-zinc-700/80 flex items-center justify-center">
          <Link2 className="w-4 h-4 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-zinc-100 font-medium text-sm line-clamp-2">{item.title}</h3>
          <p className="text-zinc-500 text-xs truncate mt-0.5">{item.url}</p>
          <p className="text-zinc-500 text-xs mt-2">{formatDate(item.createdAt)}</p>
        </div>
      </div>
    </article>
  );
}
