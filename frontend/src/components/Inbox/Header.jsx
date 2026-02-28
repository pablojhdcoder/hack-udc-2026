import { useState, useRef, useEffect } from "react";
import { Menu, Search, Filter, X } from "lucide-react";

export default function Header({
  onMenuClick,
  onFilterClick,
  searchQuery,
  onSearchQueryChange,
  isSearchOpen,
  onSearchOpenChange,
}) {
  const [inputValue, setInputValue] = useState(searchQuery);
  const inputRef = useRef(null);

  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (isSearchOpen) {
      inputRef.current?.focus();
    }
  }, [isSearchOpen]);

  const handleOpenSearch = () => {
    onSearchOpenChange?.(true);
  };

  const handleCloseSearch = () => {
    onSearchOpenChange?.(false);
    setInputValue("");
    onSearchQueryChange?.("");
  };

  const handleBuscar = () => {
    onSearchQueryChange?.(inputValue.trim());
    onSearchOpenChange?.(false);
  };

  if (isSearchOpen) {
    return (
      <header className="shrink-0 z-30 flex items-center gap-2 h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-zinc-900 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleCloseSearch}
          className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Cerrar búsqueda"
        >
          <X className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        </button>
        <input
          ref={inputRef}
          type="search"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
          placeholder="Buscar en la fábrica de las ideas..."
          className="flex-1 bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-2.5 text-zinc-900 placeholder-zinc-500 text-sm outline-none focus:ring-2 focus:ring-brand-500/50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
          aria-label="Buscar"
        />
        <button
          type="button"
          onClick={handleBuscar}
          className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium"
        >
          Buscar
        </button>
      </header>
    );
  }

  return (
    <header className="shrink-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-zinc-900 dark:border-zinc-800">
      <button
        type="button"
        onClick={onMenuClick}
        className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
      </button>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">La fábrica de las ideas</h1>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleOpenSearch}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Buscar"
        >
          <Search className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        </button>
        <button
          type="button"
          onClick={onFilterClick}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Filtros"
        >
          <Filter className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        </button>
      </div>
    </header>
  );
}
