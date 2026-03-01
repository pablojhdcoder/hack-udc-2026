import { useState, useRef, useEffect } from "react";
import { Play, Pause, Mic } from "lucide-react";

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
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildAudioUrl(filePath) {
  if (!filePath || typeof filePath !== "string") return null;
  const normalized = String(filePath).trim().replace(/\\/g, "/");
  const basename = normalized.split("/").pop();
  return basename ? `/api/uploads/${basename}` : null;
}

export default function VoiceNoteCard({ item, embedded }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(item.durationSeconds || 0);
  const audioRef = useRef(null);

  const audioUrl = buildAudioUrl(item.filePath);
  const displayName = item.filename || item.aiTitle || "Nota de voz";
  const durationLabel = formatDuration(audioDuration);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handlePlayPause = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!audioRef.current || !audioUrl) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = Math.round(audioRef.current.duration);
      if (dur && dur > 0) setAudioDuration(dur);
    }
  };

  const handleEnded = () => {
    setPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  const content = (
    <div className="flex gap-3 items-center">
      <div className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center bg-amber-400/10">
        <Mic className="w-7 h-7 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-zinc-700 dark:text-zinc-200 text-sm font-medium truncate" title={displayName}>
            {displayName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePlayPause}
            disabled={!audioUrl}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={playing ? "Pausar" : "Reproducir"}
          >
            {playing
              ? <Pause className="w-3.5 h-3.5 text-white" fill="currentColor" />
              : <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" />
            }
          </button>
          <div className="flex-1 min-w-0">
            <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-600 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          {durationLabel && (
            <span className="text-zinc-500 text-xs flex-shrink-0">{durationLabel}</span>
          )}
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
        {item.transcription && (
          <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-2 leading-relaxed line-clamp-3" title={item.transcription}>
            {item.transcription}
          </p>
        )}
        <p className="text-zinc-500 text-xs mt-1">{formatDate(item.createdAt)}</p>
      </div>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onPause={() => setPlaying(false)}
          preload="metadata"
        />
      )}
    </div>
  );

  if (embedded) return content;
  return (
    <article className="rounded-xl bg-zinc-50 border border-zinc-200 p-4 dark:bg-neutral-800/80 dark:border-neutral-700/50">
      {content}
    </article>
  );
}
