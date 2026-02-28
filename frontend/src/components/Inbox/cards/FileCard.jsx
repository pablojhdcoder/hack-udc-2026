import { FileCode, File } from "lucide-react";

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return d.toLocaleDateString("es-ES", { weekday: "short" });
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function FileCard({ item }) {
  const previewUrl =
    item.fileType === "image" && (item.filePath || item.thumbnailUrl)
      ? item.thumbnailUrl || `/api/uploads/${item.filePath}`
      : null;
  const isImage = item.fileType === "image" && previewUrl;
  const isPdf = (item.fileType || "").toLowerCase() === "pdf";
  const Icon = isPdf ? FileCode : File;

  return (
    <article className="rounded-xl bg-zinc-50 border border-zinc-200 overflow-hidden dark:bg-neutral-800/80 dark:border-neutral-700/50">
      <div className="flex gap-3 items-center p-4">
        {isImage ? (
          <img
            src={previewUrl}
            alt=""
            className="w-14 h-14 rounded-xl object-cover flex-shrink-0 shadow-md border border-neutral-800"
          />
        ) : (
          <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-red-400/10 flex items-center justify-center">
            <Icon className="w-7 h-7 text-red-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-zinc-900 dark:text-zinc-100 font-medium text-sm truncate">{item.filename}</p>
          <p className="text-zinc-500 text-xs mt-0.5 capitalize">{item.fileType}</p>
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
