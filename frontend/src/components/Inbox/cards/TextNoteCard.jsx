import FilePreview from "../../shared/FilePreview";

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return d.toLocaleDateString("es-ES", { weekday: "short" });
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function TextNoteCard({ item, embedded }) {
  const content = (
    <div className="flex gap-3 items-center">
      <FilePreview item={item} />
      <div className="flex-1 min-w-0">
        <p className="text-zinc-800 dark:text-zinc-200 text-sm leading-snug line-clamp-3">{item.content}</p>
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
  );
  if (embedded) return content;
  return (
    <article className="rounded-xl bg-zinc-50 border border-zinc-200 p-4 dark:bg-neutral-800/80 dark:border-neutral-700/50">
      {content}
    </article>
  );
}
