import { useState, useEffect } from "react";
import {
  ArrowLeft,
  User,
  UserPen,
  Moon,
  Bell,
  FileDown,
  Cloud,
  Trash2,
  Bot,
  Globe,
  HelpCircle,
  LogOut,
  ChevronRight,
  X,
} from "lucide-react";

const LANGUAGES = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
  { id: "pt", label: "Português" },
  { id: "it", label: "Italiano" },
  { id: "de", label: "Deutsch" },
];

const ASSIST_LEVELS = ["Manual", "Equilibrado", "Automático"];

function ToggleSwitch({ on = true, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900 ${
        on ? "bg-emerald-500" : "bg-neutral-600"
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
        <h2 className="text-xs font-medium text-zinc-500 dark:text-neutral-500 uppercase tracking-wider px-1 mb-2">
          {title}
        </h2>
      )}
      <div className="bg-zinc-100 dark:bg-neutral-800 rounded-2xl overflow-hidden border border-zinc-200 dark:border-transparent">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({ icon: Icon, label, children, isLast, danger }) {
  return (
    <div
      className={`flex items-center gap-3 py-3 px-4 ${!isLast ? "border-b border-zinc-200 dark:border-neutral-700" : ""}`}
    >
      {Icon && (
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
          danger ? "bg-red-500/10" : "bg-brand-500/10 dark:bg-neutral-700/60"
        }`}>
          <Icon className={`w-4 h-4 ${danger ? "text-red-500" : "text-brand-500 dark:text-neutral-300"}`} />
        </div>
      )}
      <span className={`flex-1 text-sm font-medium ${danger ? "text-red-500" : "text-zinc-900 dark:text-white"}`}>
        {label}
      </span>
      {children}
    </div>
  );
}

function BottomSheet({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Cerrar"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-center pointer-events-none max-w-[430px] mx-auto"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="w-full bg-neutral-800 rounded-t-2xl p-6 border-t border-neutral-700 pointer-events-auto safe-bottom animate-slide-in-bottom"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel, cancelLabel = "Cancelar", danger }) {
  if (!isOpen) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Cerrar"
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="w-11/12 max-w-sm bg-neutral-800 rounded-2xl p-6 border border-neutral-700 pointer-events-auto animate-slide-in-bottom"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
          <p className="text-gray-400 text-sm mb-6">{message}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-neutral-600 text-neutral-300 hover:bg-neutral-700 transition-colors text-sm font-medium"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => { onConfirm?.(); onClose(); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                danger
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-brand-500 hover:bg-brand-600 text-white"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Toast({ message, visible, onDismiss }) {
  useEffect(() => {
    if (!visible || !onDismiss) return;
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  if (!visible) return null;
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-3 bg-gray-800 border border-neutral-700 rounded-xl shadow-xl text-white text-sm animate-slide-in-bottom safe-bottom">
      {message}
    </div>
  );
}

export default function SettingsScreen({ onBack, darkMode = true, onDarkModeChange }) {
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [summaryLanguageId, setSummaryLanguageId] = useState("es");
  const [suggestionsOn, setSuggestionsOn] = useState(true);

  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [cloudSheetOpen, setCloudSheetOpen] = useState(false);
  const [assistLevelSheetOpen, setAssistLevelSheetOpen] = useState(false);
  const [assistLevel, setAssistLevel] = useState("Equilibrado");

  const [freeSpaceModalOpen, setFreeSpaceModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [editProfileSheetOpen, setEditProfileSheetOpen] = useState(false);

  const selectedLanguage = LANGUAGES.find((l) => l.id === summaryLanguageId) ?? LANGUAGES[0];

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
      <header className="shrink-0 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-neutral-900 dark:border-neutral-800">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800"
          aria-label="Volver"
        >
          <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">Ajustes</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 scrollbar-hide">
        <div className="flex items-center gap-4 mb-8 py-4">
          <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-brand-500 dark:text-neutral-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-900 dark:text-white font-semibold text-base">María Pérez</p>
            <p className="text-zinc-600 dark:text-neutral-400 text-sm">Estudiante</p>
            <p className="text-zinc-500 dark:text-neutral-500 text-sm truncate">maria@ejemplo.com</p>
          </div>
        </div>

        <SettingsGroup title="General">
          <SettingsRow icon={Moon} label="Modo Oscuro" isLast={false}>
            <ToggleSwitch on={darkMode} onClick={() => onDarkModeChange?.(!darkMode)} />
          </SettingsRow>
          <SettingsRow icon={Bell} label="Sugerencias de revisión" isLast={true}>
            <ToggleSwitch on={suggestionsOn} onClick={() => setSuggestionsOn((v) => !v)} />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Datos y privacidad">
          <button
            type="button"
            onClick={() => setExportSheetOpen(true)}
            className="w-full text-left hover:bg-zinc-200/50 dark:hover:bg-neutral-700/30 active:bg-zinc-200 dark:active:bg-neutral-700/50 transition-colors"
          >
            <SettingsRow icon={FileDown} label="Exportar mis notas" isLast={false}>
              <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-neutral-500 flex-shrink-0" />
            </SettingsRow>
          </button>
          <button
            type="button"
            onClick={() => setCloudSheetOpen(true)}
            className="w-full text-left hover:bg-zinc-200/50 dark:hover:bg-neutral-700/30 active:bg-zinc-200 dark:active:bg-neutral-700/50 transition-colors"
          >
            <SettingsRow icon={Cloud} label="Copia de seguridad en la nube" isLast={false}>
              <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-neutral-500 flex-shrink-0" />
            </SettingsRow>
          </button>
          <button
            type="button"
            onClick={() => setFreeSpaceModalOpen(true)}
            className="w-full text-left hover:bg-zinc-200/50 dark:hover:bg-neutral-700/30 active:bg-zinc-200 dark:active:bg-neutral-700/50 transition-colors"
          >
            <SettingsRow icon={Trash2} label="Liberar espacio" isLast={true}>
              <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-neutral-500 flex-shrink-0" />
            </SettingsRow>
          </button>
        </SettingsGroup>

        <SettingsGroup title="Inteligencia Artificial">
          <button
            type="button"
            onClick={() => setAssistLevelSheetOpen(true)}
            className="w-full text-left hover:bg-zinc-200/50 dark:hover:bg-neutral-700/30 active:bg-zinc-200 dark:active:bg-neutral-700/50 transition-colors"
          >
            <SettingsRow icon={Bot} label="Nivel de asistencia de la IA" isLast={false}>
              <span className="text-zinc-600 dark:text-neutral-400 text-sm mr-1">{assistLevel}</span>
              <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-neutral-500 flex-shrink-0" />
            </SettingsRow>
          </button>
          <button
            type="button"
            onClick={() => setLanguageSheetOpen(true)}
            className="w-full text-left hover:bg-zinc-200/50 dark:hover:bg-neutral-700/30 active:bg-zinc-200 dark:active:bg-neutral-700/50 transition-colors"
          >
            <SettingsRow icon={Globe} label="Idioma de los resúmenes" isLast={true}>
              <span className="text-zinc-600 dark:text-neutral-400 text-sm mr-1">{selectedLanguage.label}</span>
              <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-neutral-500 flex-shrink-0" />
            </SettingsRow>
          </button>
        </SettingsGroup>

        <SettingsGroup title="Soporte y cuenta">
          <button
            type="button"
            onClick={() => setEditProfileSheetOpen(true)}
            className="w-full text-left hover:bg-zinc-200/50 dark:hover:bg-neutral-700/30 active:bg-zinc-200 dark:active:bg-neutral-700/50 transition-colors"
          >
            <SettingsRow icon={UserPen} label="Editar perfil" isLast={false}>
              <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-neutral-500 flex-shrink-0" />
            </SettingsRow>
          </button>
          <button
            type="button"
            onClick={() => setToastVisible(true)}
            className="w-full text-left hover:bg-zinc-200/50 dark:hover:bg-neutral-700/30 active:bg-zinc-200 dark:active:bg-neutral-700/50 transition-colors"
          >
            <SettingsRow icon={HelpCircle} label="Centro de ayuda" isLast={false}>
              <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-neutral-500 flex-shrink-0" />
            </SettingsRow>
          </button>
          <button
            type="button"
            onClick={() => setLogoutModalOpen(true)}
            className="w-full text-left hover:bg-zinc-200/50 dark:hover:bg-neutral-700/30 active:bg-zinc-200 dark:active:bg-neutral-700/50 transition-colors"
          >
            <SettingsRow icon={LogOut} label="Cerrar sesión" isLast={true} danger>
              <ChevronRight className="w-5 h-5 text-red-500 flex-shrink-0" />
            </SettingsRow>
          </button>
        </SettingsGroup>
      </main>

      {/* Bottom sheet: idioma de los resúmenes */}
      {languageSheetOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setLanguageSheetOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setLanguageSheetOpen(false)}
            role="button"
            tabIndex={0}
            aria-label="Cerrar"
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-800 rounded-t-2xl max-w-[430px] mx-auto safe-bottom animate-slide-in-bottom border-t border-neutral-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Idioma de los resúmenes</h2>
              <button type="button" onClick={() => setLanguageSheetOpen(false)} className="p-2 rounded-lg hover:bg-neutral-700 text-neutral-400" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="space-y-1">
              {LANGUAGES.map((lang) => (
                <li key={lang.id}>
                  <button
                    type="button"
                    onClick={() => { setSummaryLanguageId(lang.id); setLanguageSheetOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors ${
                      summaryLanguageId === lang.id ? "bg-brand-500/20 text-brand-400" : "hover:bg-neutral-700 text-neutral-200"
                    }`}
                  >
                    <span className="text-sm font-medium">{lang.label}</span>
                    {summaryLanguageId === lang.id && <span className="text-brand-400 text-xs">Seleccionado</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Bottom Sheet: Formato de exportación */}
      <BottomSheet isOpen={exportSheetOpen} onClose={() => setExportSheetOpen(false)} title="Formato de exportación">
        <div className="flex flex-col gap-2">
          {["Texto Plano", "Markdown", "PDF"].map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => setExportSheetOpen(false)}
              className="w-full px-4 py-3 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium transition-colors text-left"
            >
              {format}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Bottom Sheet: Conectar cuenta */}
      <BottomSheet isOpen={cloudSheetOpen} onClose={() => setCloudSheetOpen(false)} title="Conectar cuenta">
        <div className="flex flex-col gap-2">
          {["Google Drive", "iCloud", "OneDrive"].map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => setCloudSheetOpen(false)}
              className="w-full px-4 py-3 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium transition-colors text-left"
            >
              {provider}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Bottom Sheet: Nivel de asistencia de la IA */}
      <BottomSheet isOpen={assistLevelSheetOpen} onClose={() => setAssistLevelSheetOpen(false)} title="Nivel de asistencia">
        <div className="flex flex-col gap-2">
          {ASSIST_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => { setAssistLevel(level); setAssistLevelSheetOpen(false); }}
              className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${
                assistLevel === level ? "bg-brand-500/20 text-brand-400" : "bg-neutral-700 hover:bg-neutral-600 text-neutral-200"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Modal: Liberar caché */}
      <ConfirmModal
        isOpen={freeSpaceModalOpen}
        onClose={() => setFreeSpaceModalOpen(false)}
        onConfirm={() => {}}
        title="¿Liberar caché?"
        message="Se liberarán unos 45 MB de archivos temporales."
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        danger={false}
      />

      {/* Modal: Cerrar sesión */}
      <ConfirmModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={() => {}}
        title="¿Cerrar sesión?"
        message="¿Seguro que quieres salir de tu Cerebro Digital?"
        confirmLabel="Salir"
        cancelLabel="Cancelar"
        danger
      />

      <Toast
        message="Abriendo el centro de soporte en el navegador..."
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

      {/* Bottom Sheet: Editar perfil */}
      <BottomSheet isOpen={editProfileSheetOpen} onClose={() => setEditProfileSheetOpen(false)} title="Editar perfil">
        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-xs font-medium mb-1.5">Nombre</label>
            <input
              type="text"
              defaultValue="María Pérez"
              className="w-full rounded-xl bg-neutral-700 border border-neutral-600 px-4 py-3 text-white text-sm placeholder-gray-500 outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs font-medium mb-1.5">Email</label>
            <input
              type="email"
              defaultValue="maria@ejemplo.com"
              className="w-full rounded-xl bg-neutral-700 border border-neutral-600 px-4 py-3 text-white text-sm placeholder-gray-500 outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="tu@email.com"
            />
          </div>
          <button
            type="button"
            onClick={() => setEditProfileSheetOpen(false)}
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
          >
            Guardar
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
