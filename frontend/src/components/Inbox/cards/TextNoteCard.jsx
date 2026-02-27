import { FileText } from "lucide-react";

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return d.toLocaleDateString("es-ES", { weekday: "short" });
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function TextNoteCard({ item }) {
  return (
    <article className="rounded-xl bg-zinc-800/80 border border-zinc-700/50 p-4">
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-zinc-700/80 flex items-center justify-center">
          <FileText className="w-4 h-4 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-zinc-200 text-sm leading-snug line-clamp-3">{item.content}</p>
          <p className="text-zinc-500 text-xs mt-2">{formatDate(item.createdAt)}</p>
        </div>
      </div>
    </article>
  );
}
