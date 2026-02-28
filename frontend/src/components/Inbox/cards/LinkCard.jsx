import { Link2, Play } from "lucide-react";
import { getYouTubeVideoId } from "../../../utils/youtube";

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
  const videoId = getYouTubeVideoId(item.url);
  const isYouTube = Boolean(videoId);
  const thumbUrl = isYouTube ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

  return (
    <article className="rounded-xl bg-zinc-50 border border-zinc-200 overflow-hidden dark:bg-neutral-800/80 dark:border-neutral-700/50">
      <div className="p-4 flex gap-3 items-center">
        {thumbUrl ? (
          <div className="relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden shadow-md border border-neutral-800">
            <img
              src={thumbUrl}
              alt=""
              className="w-14 h-14 object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="w-4 h-4 text-neutral-900 ml-0.5" fill="currentColor" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-sky-400/10 flex items-center justify-center">
            <Link2 className="w-7 h-7 text-sky-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-zinc-900 dark:text-zinc-100 font-medium text-sm line-clamp-2">{item.title || item.url}</h3>
          <p className="text-zinc-500 text-xs truncate mt-0.5">{item.url}</p>
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
