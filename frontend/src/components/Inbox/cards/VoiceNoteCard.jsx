import { Play, Mic } from "lucide-react";

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return d.toLocaleDateString("es-ES", { weekday: "short" });
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VoiceNoteCard({ item }) {
  return (
    <article className="rounded-xl bg-zinc-50 border border-zinc-200 p-4 dark:bg-neutral-800/80 dark:border-neutral-700/50">
      <div className="flex gap-3 items-center">
        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-amber-400/10 flex items-center justify-center">
          <Mic className="w-7 h-7 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-zinc-600 dark:text-zinc-400 text-xs">Nota de voz</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center hover:bg-brand-600 transition-colors"
              aria-label="Reproducir"
            >
              <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" />
            </button>
            <div className="flex gap-0.5 items-end h-5">
              {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.6, 0.9, 0.5].map((h, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-zinc-400 dark:bg-zinc-500"
                  style={{ height: `${h * 100}%` }}
                />
              ))}
            </div>
            <span className="text-zinc-500 text-xs">{formatDuration(item.durationSeconds)}</span>
          </div>
          {(item.topic || item.aiEnrichment?.tags?.length) && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {item.topic && (
                <span className="text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded-md text-xs">#{item.topic}</span>
              )}
              {item.aiEnrichment?.tags?.map((tag) => (
                <span key={tag} className="text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded-md text-xs">#{tag}</span>
              ))}
            </div>
          )}
          <p className="text-zinc-500 text-xs mt-2">{formatDate(item.createdAt)}</p>
        </div>
      </div>
    </article>
  );
}
