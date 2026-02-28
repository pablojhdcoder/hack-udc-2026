import { X, Inbox, FolderOpen, Calendar, Settings } from "lucide-react";
import { useAppLanguage } from "../../context/LanguageContext";

export default function Sidebar({ isOpen, onClose, onNavigate }) {
  const { t } = useAppLanguage();
  return (
    <>
      {/* Overlay: dentro del marco móvil, clic cierra el menú */}
      <div
        className={`absolute inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={isOpen ? 0 : -1}
        aria-label={t("common.closeMenu")}
        aria-hidden={!isOpen}
      />
      {/* Panel off-canvas: absolute dentro del marco, flota sobre el contenido */}
      <aside
        className={`absolute top-0 left-0 h-full w-64 bg-white border-r border-zinc-200 z-50 flex flex-col transition-transform duration-300 ease-out dark:bg-neutral-900 dark:border-neutral-800 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-modal="true"
        aria-label={t("common.sidebarMenu")}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-200 shrink-0 dark:border-zinc-800">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{t("sidebar.appName")}</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800"
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
          </button>
        </div>
        <nav className="flex flex-col p-2 mt-2">
          <button
            type="button"
            onClick={() => onNavigate?.("inbox")}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-800 dark:text-zinc-200"
          >
            <Inbox className="w-5 h-5 text-brand-500 dark:text-zinc-400" />
            {t("sidebar.factory")}
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.("procesado")}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-800 dark:text-zinc-200"
          >
            <FolderOpen className="w-5 h-5 text-brand-500 dark:text-zinc-400" />
            {t("sidebar.processed")}
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.("calendario")}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-800 dark:text-zinc-200"
          >
            <Calendar className="w-5 h-5 text-brand-500 dark:text-zinc-400" />
            {t("sidebar.calendar")}
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.("ajustes")}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-800 dark:text-zinc-200 mt-4"
          >
            <Settings className="w-5 h-5 text-brand-500 dark:text-zinc-400" />
            {t("sidebar.settings")}
          </button>
        </nav>
      </aside>
    </>
  );
}
