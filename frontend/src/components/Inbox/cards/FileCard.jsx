import { FileText, File, Image as ImageIcon } from "lucide-react";

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return d.toLocaleDateString("es-ES", { weekday: "short" });
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const FILE_ICONS = {
  pdf: FileText,
  word: File,
  image: ImageIcon,
  default: File,
};

const FILE_STYLES = {
  pdf: "bg-red-500/20 text-red-400 ring-1 ring-red-500/30",
  word: "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30",
  image: "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30",
  default: "bg-zinc-500/20 text-zinc-400 ring-1 ring-zinc-500/30",
};

export default function FileCard({ item }) {
  const Icon = FILE_ICONS[item.fileType] ?? FILE_ICONS.default;
  const style = FILE_STYLES[item.fileType] ?? FILE_STYLES.default;
  const isImage = item.fileType === "image" && item.previewUrl;

  return (
    <article className="rounded-xl bg-zinc-800/80 border border-zinc-700/50 overflow-hidden">
      {isImage && (
        <div className="aspect-video bg-zinc-800 flex items-center justify-center">
          <img
            src={item.previewUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex gap-4 items-center p-4">
        {!isImage && (
          <div
            className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${style}`}
          >
            <Icon className="w-7 h-7" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-zinc-100 font-medium text-sm truncate">{item.filename}</p>
          <p className="text-zinc-500 text-xs mt-0.5 capitalize">{item.fileType}</p>
          <p className="text-zinc-500 text-xs mt-2">{formatDate(item.createdAt)}</p>
        </div>
      </div>
    </article>
  );
}
