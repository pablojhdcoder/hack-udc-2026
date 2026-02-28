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
    <article className="rounded-xl bg-zinc-50 border border-zinc-200 overflow-hidden dark:bg-neutral-800/80 dark:border-neutral-700/50">
      {(item.image || item.imagePlaceholder !== false) && (
        <div className="h-28 bg-zinc-200 flex items-center justify-center border-b border-zinc-200 overflow-hidden dark:bg-neutral-600/50 dark:border-neutral-700/50">
          {item.image ? (
            <img src={item.image} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-brand-500/20 flex items-center justify-center">
              <Link2 className="w-7 h-7 text-brand-500 dark:text-zinc-400" />
            </div>
          )}
        </div>
      )}
      <div className="p-4 flex gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center dark:bg-neutral-700/80">
          <Link2 className="w-4 h-4 text-brand-500 dark:text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-zinc-900 dark:text-zinc-100 font-medium text-sm line-clamp-2">{item.title || item.url}</h3>
          <p className="text-zinc-500 text-xs truncate mt-0.5">{item.url}</p>
          <p className="text-zinc-500 text-xs mt-2">{formatDate(item.createdAt)}</p>
        </div>
      </div>
    </article>
  );
}
