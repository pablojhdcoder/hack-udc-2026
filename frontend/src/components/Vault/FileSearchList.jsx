import { useEffect, useRef, useState } from "react";
import { Search, X, FileImage, Video, FileText, File as FileIcon, Loader2, Tag, FolderOpen, Calendar, Globe, ChevronRight } from "lucide-react";

// Vista de lista de archivos conectada a backend real con búsqueda semántica
// Endpoint esperado: GET /api/archivos?q=<query>
// Estructura de cada ítem:
// { id, filename, filepath, type, thumbnailUrl, tags: string[] }

const TYPE_ICON = {
  image: FileImage,
  photo: FileImage,
  video: Video,
  document: FileText,
  text: FileText,
  default: FileIcon,
};

function Thumbnail({ type, thumbnailUrl, alt }) {
  const [error, setError] = useState(false);
  const Icon = TYPE_ICON[type] || TYPE_ICON.default;

  if (!thumbnailUrl || error) {
    return (
      <div className="w-12 h-12 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-zinc-300" />
      </div>
    );
  }

  return (
    <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 border border-neutral-700 flex-shrink-0">
      <img
        src={thumbnailUrl}
        alt={alt || ""}
        className="w-12 h-12 object-cover"
        onError={() => setError(true)}
      />
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function MetadataSheet({ item, onClose }) {
  if (!item) return null;

  const topics = item.aiTopics ?? item.aiTags ?? item.tags ?? [];
  const category = item.aiCategory ?? item.category ?? null;
  const summary = item.aiSummary ?? item.summary ?? null;
  const language = item.aiLanguage ?? item.language ?? null;
  const title = item.aiTitle ?? item.filename ?? item.title ?? "Sin título";
  const date = formatDate(item.createdAt ?? item.enrichedAt);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Cerrar"
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto pointer-events-none">
        <div
          className="w-full bg-neutral-900 border border-neutral-700 rounded-t-2xl p-5 pointer-events-auto safe-bottom"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="w-10 h-1 bg-neutral-700 rounded-full mx-auto mb-4" />

          {/* Título */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-base font-semibold text-white leading-snug flex-1">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Resumen */}
            {summary && (
              <div className="rounded-xl bg-neutral-800/70 border border-neutral-700/50 px-4 py-3">
                <p className="text-xs text-neutral-400 font-medium uppercase tracking-wider mb-1">Resumen</p>
                <p className="text-sm text-neutral-200 leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Categoría + Idioma */}
            {(category || language) && (
              <div className="flex gap-2">
                {category && (
                  <div className="flex items-center gap-1.5 bg-violet-950/50 border border-violet-500/30 rounded-full px-3 py-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span className="text-xs text-violet-300 font-medium">{category}</span>
                  </div>
                )}
                {language && (
                  <div className="flex items-center gap-1.5 bg-neutral-800 border border-neutral-700 rounded-full px-3 py-1.5">
                    <Globe className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="text-xs text-neutral-300 font-medium uppercase">{language}</span>
                  </div>
                )}
              </div>
            )}

            {/* Topics */}
            {topics.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Temas</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {topics.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full"
                    >
                      #{String(tag).trim().toLowerCase()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Fecha */}
            {date && (
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>{date}</span>
              </div>
            )}

            {/* Ruta del fichero */}
            {item.filepath && (
              <div className="rounded-xl bg-neutral-800/50 border border-neutral-700/30 px-3 py-2">
                <p className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider mb-0.5">Ruta</p>
                <p className="text-xs text-neutral-400 break-all">{item.filepath}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function FileSearchList({ title = "El baúl de las ideas" }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const searchInputRef = useRef(null);

  // Debounce de 500ms
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 500);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  // Enfoque automático cuando se abre el buscador
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Fetch al backend cuando cambia el término debounced
  useEffect(() => {
    let cancelled = false;

    async function fetchFiles() {
      setIsLoading(true);
      setError(null);

      try {
        const q = encodeURIComponent(debouncedSearchTerm || "");
        // Sin query: listar todo con metadatos completos
        const url = debouncedSearchTerm
          ? `/api/search?q=${q}`
          : `/api/search/all`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message ?? "Error al buscar archivos");
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    // Llamamos siempre (también con query vacía) para listar contenido inicial
    fetchFiles();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchTerm]);

  const handleOpenSearch = () => {
    setIsSearchOpen(true);
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    setSearchTerm("");
  };

  const hasResults = items.length > 0;

  return (
    <div className="h-full min-h-0 flex flex-col bg-neutral-950 text-zinc-50">
      {/* Header con título / buscador */}
      <header className="shrink-0 flex items-center h-14 px-4 border-b border-neutral-800 bg-neutral-950">
        {isSearchOpen ? (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={handleCloseSearch}
              className="p-2 -ml-2 rounded-full hover:bg-neutral-800 text-zinc-400 shrink-0"
              aria-label="Cerrar búsqueda"
            >
              <X className="w-5 h-5" />
            </button>
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, ruta o etiquetas…"
              className="bg-gray-800 text-white px-4 py-1.5 rounded-full w-full outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-zinc-400"
            />
          </div>
        ) : (
          <>
            <h1 className="flex-1 text-center text-lg font-semibold text-zinc-50 truncate px-2">
              {title}
            </h1>
            <button
              type="button"
              onClick={handleOpenSearch}
              className="p-2 -mr-2 rounded-full hover:bg-neutral-800 text-zinc-400"
              aria-label="Buscar"
            >
              <Search className="w-5 h-5" />
            </button>
          </>
        )}
      </header>

      {/* Contenido principal */}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Buscando en tu cerebro digital...</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {!isLoading && !hasResults && !error && (
          <p className="text-sm text-zinc-500">No se han encontrado archivos.</p>
        )}

        {hasResults && (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-left hover:bg-neutral-900 transition-colors"
                >
                  <Thumbnail
                    type={item.type}
                    thumbnailUrl={item.thumbnailUrl}
                    alt={item.filename}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-50 truncate">
                      {item.filename || "Sin nombre"}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {item.filepath || "Ruta desconocida"}
                    </p>
                    {Array.isArray(item.tags) && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] bg-neutral-800 border border-neutral-700 text-neutral-300 px-2 py-0.5 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-600 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {selectedItem && (
        <MetadataSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

