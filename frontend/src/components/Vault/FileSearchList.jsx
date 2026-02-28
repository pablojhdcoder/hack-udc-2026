import { useEffect, useRef, useState } from "react";
import { Search, X, FileImage, Video, FileText, File as FileIcon, Loader2 } from "lucide-react";

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
      <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-zinc-300" />
      </div>
    );
  }

  return (
    <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-700 flex-shrink-0">
      <img
        src={thumbnailUrl}
        alt={alt || ""}
        className="w-12 h-12 object-cover"
        onError={() => setError(true)}
      />
    </div>
  );
}

export default function FileSearchList({ title = "El baúl de las ideas" }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
        const res = await fetch(`/api/archivos?q=${q}`);
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
    <div className="h-full min-h-0 flex flex-col bg-zinc-950 text-zinc-50">
      {/* Header con título / buscador */}
      <header className="shrink-0 flex items-center h-14 px-4 border-b border-zinc-800 bg-zinc-950">
        {isSearchOpen ? (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={handleCloseSearch}
              className="p-2 -ml-2 rounded-full hover:bg-zinc-800 text-zinc-400 shrink-0"
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
              className="p-2 -mr-2 rounded-full hover:bg-zinc-800 text-zinc-400"
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
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-left hover:bg-zinc-900 transition-colors"
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
                            className="text-[10px] bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

