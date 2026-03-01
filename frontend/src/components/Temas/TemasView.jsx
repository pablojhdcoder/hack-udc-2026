import { useState, useEffect, useRef } from "react";
import { ArrowLeft, BookOpen, Loader2, Search, X, ChevronRight, FileText, Link2, File, Image, Mic, Video, RefreshCw } from "lucide-react";
import { useAppLanguage } from "../../context/LanguageContext";
import { translations } from "../../i18n/translations";

const ICON_BY_KIND = {
  note: FileText,
  link: Link2,
  file: File,
  photo: Image,
  audio: Mic,
  video: Video,
};

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function normalizeText(t) {
  return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function TopicDetail({ topic, data, onBack, vt, onOpenItem }) {
  const sourceItems = data?.sourceItems ?? [];
  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-950">
      <header className="shrink-0 flex items-center h-14 px-4 border-b border-zinc-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0" aria-label={vt?.back ?? "Volver"}>
          <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold text-zinc-900 dark:text-white truncate px-2 capitalize">{topic}</h1>
        <div className="w-9 shrink-0" />
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {data?.summary ? (
          <div className="rounded-2xl bg-zinc-50 dark:bg-neutral-800/70 border border-zinc-200 dark:border-neutral-700/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-brand-500 shrink-0" />
              <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider">{vt?.topicSummaryLabel ?? "Resumen del tema"}</p>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{data.summary}</p>
            {data.updatedAt && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-3 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                {vt?.lastUpdated ?? "Actualizado"} {formatDate(data.updatedAt)}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-zinc-50 dark:bg-neutral-800/70 border border-zinc-200 dark:border-neutral-700/50 p-4">
            <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">{vt?.noSummaryYet ?? "Aun no hay resumen para este tema."}</p>
          </div>
        )}
        {sourceItems.length > 0 && (
          <div>
            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">{vt?.topicSources ?? "Fuentes"} ({sourceItems.length})</p>
            <ul className="space-y-2">
              {sourceItems.map((item, idx) => {
                const Icon = ICON_BY_KIND[item.kind] ?? FileText;
                const clickable = onOpenItem && item.kind && item.id;
                return (
                  <li key={`${item.kind}-${item.id ?? idx}`}>
                    {clickable ? (
                      <button
                        type="button"
                        onClick={() => onOpenItem(item.kind, item.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-neutral-800/60 border border-zinc-200 dark:border-neutral-700/50 hover:bg-zinc-100 dark:hover:bg-neutral-800 transition-colors active:scale-[0.98] text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-brand-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{item.title ?? "(sin título)"}</p>
                          {item.createdAt && <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(item.createdAt)}</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-neutral-800/60 border border-zinc-200 dark:border-neutral-700/50">
                        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-brand-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{item.title ?? "(sin título)"}</p>
                          {item.createdAt && <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(item.createdAt)}</p>}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

function TopicCard({ topic, summary, itemCount, updatedAt, onClick }) {
  const previewText = summary ? summary.slice(0, 120) + (summary.length > 120 ? "\u2026" : "") : null;
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded-2xl bg-white dark:bg-neutral-800/70 border border-zinc-200 dark:border-neutral-700/50 p-4 hover:bg-zinc-50 dark:hover:bg-neutral-800 transition-colors active:scale-[0.98]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-brand-500" />
          </div>
          <span className="text-sm font-semibold text-zinc-900 dark:text-white capitalize truncate">{topic}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{itemCount}</span>
          <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </div>
      </div>
      {previewText
        ? <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-3">{previewText}</p>
        : <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">Sin resumen aun...</p>
      }
      {updatedAt && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">{formatDate(updatedAt)}</p>}
    </button>
  );
}

export default function TemasView({ onBack, onOpenItem }) {
  const { locale } = useAppLanguage();
  const vt = translations[locale]?.vault ?? translations.es?.vault ?? {};
  const tt = translations[locale]?.temas ?? translations.es?.temas ?? {};
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/topics");
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        if (!cancelled) setTopics(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  const filtered = topics.filter((t) =>
    !searchQuery.trim() || normalizeText(t.topic).includes(normalizeText(searchQuery))
  );

  if (selectedTopic) {
    return (
      <TopicDetail
        topic={selectedTopic.topic}
        data={selectedTopic.data}
        onBack={() => setSelectedTopic(null)}
        vt={{ ...vt, ...tt }}
        onOpenItem={onOpenItem}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-950">
      <header className="shrink-0 flex items-center h-14 px-4 border-b border-zinc-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        {searchOpen ? (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0"
            >
              <X className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </button>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tt.searchPlaceholder ?? "Buscar tema..."}
              className="flex-1 min-w-0 bg-zinc-100 dark:bg-neutral-800 border border-zinc-200 dark:border-neutral-700 rounded-xl px-4 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0"
              aria-label={vt.back ?? "Volver"}
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </button>
            <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-white truncate px-2">
              {tt.title ?? "Temas"}
            </h1>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0"
            >
              <Search className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            </button>
          </>
        )}
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4 scrollbar-hide">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        )}
        {error && !loading && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{error}</div>
        )}
        {!loading && !error && topics.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-600" />
            <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xs">
              {tt.empty ?? "Procesa items del inbox para generar resumenes por tema."}
            </p>
          </div>
        )}
        {!loading && !error && topics.length > 0 && filtered.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-8">
            {tt.noResults ?? "Sin resultados"} &quot;{searchQuery}&quot;
          </p>
        )}
        {!loading && !error && filtered.length > 0 && (
          <ul className="space-y-3">
            {filtered.map((t) => (
              <li key={t.topic}>
                <TopicCard
                  topic={t.topic}
                  summary={t.summary}
                  itemCount={t.itemCount}
                  updatedAt={t.updatedAt}
                  onClick={() => setSelectedTopic({ topic: t.topic, data: t })}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
