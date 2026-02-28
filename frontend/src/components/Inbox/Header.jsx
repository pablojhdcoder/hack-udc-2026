import { Menu, Filter, Brain } from "lucide-react";

export default function Header({ onMenuClick, onFilterClick, onChatClick }) {
  return (
    <header className="shrink-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-neutral-900 dark:border-neutral-800">
      <button
        type="button"
        onClick={onMenuClick}
        className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
      </button>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 ml-6">Fábrica de ideas</h1>
      <div className="flex gap-4 items-center">
        <button
          type="button"
          onClick={onChatClick}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 text-blue-400 hover:text-blue-300 cursor-pointer transition-colors shrink-0"
          aria-label="Abrir chat con el Cerebro Digital"
        >
          <Brain className="w-6 h-6 shrink-0" />
        </button>
        <button
          type="button"
          onClick={onFilterClick}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Filtros"
        >
          <Filter className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        </button>
      </div>
    </header>
  );
}
