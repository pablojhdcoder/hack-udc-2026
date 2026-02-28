import {
  ArrowLeft,
  User,
  Moon,
  Bell,
  FileDown,
  RefreshCw,
  Database,
  Bot,
  ChevronRight,
} from "lucide-react";

function ToggleSwitch({ on = true, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900 ${
        on ? "bg-emerald-500" : "bg-gray-600"
      }`}
      role="switch"
      aria-checked={on}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-6 ml-0.5" : "translate-x-1 ml-1"
        }`}
      />
    </button>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <section className="mb-6">
      {title && (
        <h2 className="text-xs font-medium text-zinc-500 dark:text-gray-500 uppercase tracking-wider px-1 mb-2">
          {title}
        </h2>
      )}
      <div className="bg-zinc-100 dark:bg-gray-800 rounded-2xl overflow-hidden border border-zinc-200 dark:border-transparent">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({ icon: Icon, label, children, isLast }) {
  return (
    <div
      className={`flex items-center gap-3 py-3 px-4 ${!isLast ? "border-b border-zinc-200 dark:border-gray-700" : ""}`}
    >
      {Icon && (
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-brand-500/10 dark:bg-gray-700/60 flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand-500 dark:text-gray-300" />
        </div>
      )}
      <span className="flex-1 text-zinc-900 dark:text-white text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

export default function SettingsScreen({ onBack, darkMode = true, onDarkModeChange }) {
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      <header className="shrink-0 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-zinc-900 dark:border-zinc-800">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Volver"
        >
          <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">Ajustes</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 scrollbar-hide">
        <div className="flex items-center gap-4 mb-8 py-4">
          <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-brand-500 dark:text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-900 dark:text-white font-semibold text-base">María Pérez</p>
            <p className="text-zinc-600 dark:text-gray-400 text-sm">Estudiante</p>
            <p className="text-zinc-500 dark:text-gray-500 text-sm truncate">maria@ejemplo.com</p>
          </div>
        </div>

        {/* Grupo 1: General */}
        <SettingsGroup title="General">
          <SettingsRow icon={Moon} label="Modo Oscuro" isLast={false}>
            <ToggleSwitch
              on={darkMode}
              onClick={() => onDarkModeChange?.(!darkMode)}
            />
          </SettingsRow>
          <SettingsRow icon={Bell} label="Sugerencias de revisión" isLast={true}>
            <ToggleSwitch on />
          </SettingsRow>
        </SettingsGroup>

        {/* Grupo 2: Cerebro Digital (Datos) */}
        <SettingsGroup title="Cerebro Digital">
          <button type="button" className="w-full text-left hover:bg-zinc-200/50 dark:hover:bg-gray-700/30 active:bg-zinc-200 dark:active:bg-gray-700/50 transition-colors">
            <SettingsRow icon={FileDown} label="Exportar Cerebro a Markdown" isLast={false}>
              <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-gray-500 flex-shrink-0" />
            </SettingsRow>
          </button>
          <button type="button" className="w-full text-left hover:bg-zinc-200/50 dark:hover:bg-gray-700/30 active:bg-zinc-200 dark:active:bg-gray-700/50 transition-colors">
            <SettingsRow icon={RefreshCw} label="Sincronizar con Obsidian" isLast={false}>
              <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-gray-500 flex-shrink-0" />
            </SettingsRow>
          </button>
          <button type="button" className="w-full text-left hover:bg-zinc-200/50 dark:hover:bg-gray-700/30 active:bg-zinc-200 dark:active:bg-gray-700/50 transition-colors">
            <SettingsRow icon={Database} label="Gestionar almacenamiento local" isLast={true}>
              <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-gray-500 flex-shrink-0" />
            </SettingsRow>
          </button>
        </SettingsGroup>

        <SettingsGroup title="Inteligencia Artificial">
          <button type="button" className="w-full text-left hover:bg-zinc-200/50 dark:hover:bg-gray-700/30 active:bg-zinc-200 dark:active:bg-gray-700/50 transition-colors">
            <SettingsRow icon={Bot} label="Nivel de asistencia de la IA" isLast={true}>
              <span className="text-zinc-600 dark:text-gray-400 text-sm mr-1">Equilibrado</span>
              <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-gray-500 flex-shrink-0" />
            </SettingsRow>
          </button>
        </SettingsGroup>
      </main>
    </div>
  );
}
