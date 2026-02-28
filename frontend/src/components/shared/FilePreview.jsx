import { useState } from "react";
import { FileText, Link2, FileCode, File, Image, Mic, Video, Play } from "lucide-react";
import { getYouTubeVideoId } from "../../utils/youtube";

const IMG_CLASS = "w-14 h-14 rounded-xl object-cover flex-shrink-0 shadow-md border border-neutral-800";

const ICON_STYLE_BY_KIND = {
  note: { Icon: FileText, text: "text-emerald-400", bg: "bg-emerald-400/10" },
  link: { Icon: Link2, text: "text-sky-400", bg: "bg-sky-400/10" },
  file: { Icon: FileCode, text: "text-red-400", bg: "bg-red-400/10" },
  photo: { Icon: Image, text: "text-zinc-400", bg: "bg-neutral-700" },
  audio: { Icon: Mic, text: "text-amber-400", bg: "bg-amber-400/10" },
  video: { Icon: Video, text: "text-zinc-400", bg: "bg-neutral-700" },
  novelty: { Icon: FileText, text: "text-emerald-400", bg: "bg-emerald-400/10" },
  favorite: { Icon: FileText, text: "text-zinc-400", bg: "bg-neutral-700" },
};

function buildUploadThumbUrl(filePath) {
  if (!filePath || typeof filePath !== "string") return null;
  const normalized = String(filePath).trim().replace(/\\/g, "/");
  return normalized ? `/api/uploads/${normalized}` : null;
}

function PlayOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none" aria-hidden>
      <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center text-white ring-2 ring-white/30">
        <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
      </div>
    </div>
  );
}

/**
 * Unified file preview: thumbnail when available, otherwise colored icon.
 * Used in Fábrica de ideas (Inbox), Búsqueda, Fotos, Vídeo, Novedades, Favoritos.
 *
 * - Images (type === 'image'): <img> with thumbnailUrl or filePath; onError → fallback icon.
 * - YouTube (link or video with YouTube URL): thumbnail mqdefault.jpg + Play overlay.
 * - Video (type === 'video', not YouTube): thumbnail if thumbnailUrl; same styling + Play overlay.
 * - Fallback: Emerald (note), Amber (audio), Red (PDF/doc), Sky (link).
 */
export default function FilePreview({ item }) {
  const [imgError, setImgError] = useState(false);
  const kind = item?.kind ?? item?.sourceKind ?? "file";
  const type = (item?.type ?? item?.fileType ?? "").toLowerCase();
  const isImageType = type === "image" || type === "photo";
  const isPhoto = kind === "photo" || (kind === "file" && isImageType);
  const isVideo = kind === "video";
  const linkUrl = item?.url ?? null;
  const videoSourceUrl = isVideo ? (item?.url || item?.filePath || "") : linkUrl;
  const youtubeId = getYouTubeVideoId(videoSourceUrl);
  const isYouTube = Boolean(youtubeId);

  const photoThumbUrl =
    item?.thumbnailUrl ||
    (isPhoto && item?.filePath ? buildUploadThumbUrl(item.filePath) : null);
  const videoThumbUrl =
    item?.thumbnailUrl ||
    (isYouTube ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : null) ||
    (isVideo && item?.filePath ? buildUploadThumbUrl(item.filePath) : null);

  const showPhotoImg = isPhoto && photoThumbUrl && !imgError;
  const showVideoThumb = (isVideo || isYouTube) && videoThumbUrl && !imgError;

  const style = ICON_STYLE_BY_KIND[kind] ?? ICON_STYLE_BY_KIND.file;
  const { Icon, text, bg } = style;

  if (showVideoThumb) {
    return (
      <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-md border border-neutral-800">
        <img
          src={videoThumbUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
        <PlayOverlay />
      </div>
    );
  }

  if (showPhotoImg) {
    return (
      <img
        src={photoThumbUrl}
        alt=""
        className={IMG_CLASS}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
      <Icon className={`w-7 h-7 ${text}`} />
    </div>
  );
}
