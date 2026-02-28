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
import { useAppLanguage } from "../../context/LanguageContext";
import LanguageBottomSheet from "./LanguageBottomSheet";
import { translations } from "../../i18n/translations";
import { getAllItemsForExport } from "../../api/client";

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

const ROW_BASE =
  "flex items-center justify-between w-full py-4 px-4 hover:bg-neutral-800/50 cursor-pointer transition-colors border-b border-zinc-200 dark:border-neutral-800/50 last:border-b-0";

function SettingsRow({ icon: Icon, label, children, danger }) {
  return (
    <>
      <div className="flex items-center gap-3.5">
        {Icon && (
          <div
            className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
              danger ? "bg-red-500/10" : "bg-brand-500/10 dark:bg-neutral-700/60"
            }`}
          >
            <Icon className={`w-4 h-4 ${danger ? "text-red-500" : "text-brand-500 dark:text-neutral-300"}`} />
          </div>
        )}
        <span className={`text-sm font-medium ${danger ? "text-red-500" : "text-zinc-900 dark:text-white"}`}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </>
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
  const { locale, t } = useAppLanguage();
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [suggestionsOn, setSuggestionsOn] = useState(true);

  const [cloudSheetOpen, setCloudSheetOpen] = useState(false);
  const [assistLevelSheetOpen, setAssistLevelSheetOpen] = useState(false);
  const [assistLevel, setAssistLevel] = useState("Equilibrado");

  const [freeSpaceModalOpen, setFreeSpaceModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [editProfileSheetOpen, setEditProfileSheetOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const selectedLanguageLabel = translations[locale]?.languages?.[locale] ?? translations.es.languages.es;

  async function handleExportJSON() {
    setExportLoading(true);
    try {
      const items = await getAllItemsForExport();
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `digital-brain-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToastMessage(`✅ Exportados ${items.length} ítem${items.length !== 1 ? "s" : ""} a JSON`);
      setToastVisible(true);
    } catch (err) {
      setToastMessage(`❌ Error al exportar: ${err.message}`);
      setToastVisible(true);
    } finally {
      setExportLoading(false);
    }
  }

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
        <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("settings.title")}</h1>
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
          <div className={ROW_BASE}>
            <SettingsRow icon={Moon} label={t("settings.darkMode")}>
              <ToggleSwitch on={darkMode} onClick={() => onDarkModeChange?.(!darkMode)} />
            </SettingsRow>
          </div>
          <div className={ROW_BASE}>
            <SettingsRow icon={Bell} label={t("settings.reviewSuggestions")}>
              <ToggleSwitch on={suggestionsOn} onClick={() => setSuggestionsOn((v) => !v)} />
            </SettingsRow>
          </div>
        </SettingsGroup>

        <SettingsGroup title={t("settings.dataPrivacy")}>
          <button type="button" onClick={handleExportJSON} disabled={exportLoading} className={ROW_BASE + " text-left disabled:opacity-50"}>
            <SettingsRow icon={FileDown} label={exportLoading ? "Exportando…" : t("settings.exportNotes")}>
              <ChevronRight className="w-5 h-5 text-neutral-500 shrink-0" />
            </SettingsRow>
          </button>
          <button type="button" onClick={() => setCloudSheetOpen(true)} className={ROW_BASE + " text-left"}>
            <SettingsRow icon={Cloud} label={t("settings.cloudBackup")}>
              <ChevronRight className="w-5 h-5 text-neutral-500 shrink-0" />
            </SettingsRow>
          </button>
          <button type="button" onClick={() => setFreeSpaceModalOpen(true)} className={ROW_BASE + " text-left"}>
            <SettingsRow icon={Trash2} label={t("settings.freeSpace")}>
              <ChevronRight className="w-5 h-5 text-neutral-500 shrink-0" />
            </SettingsRow>
          </button>
        </SettingsGroup>

        <SettingsGroup title={t("settings.ai")}>
          <button type="button" onClick={() => setAssistLevelSheetOpen(true)} className={ROW_BASE + " text-left"}>
            <SettingsRow icon={Bot} label={t("settings.assistLevel")}>
              <span className="text-sm text-neutral-400">{assistLevel}</span>
              <ChevronRight className="w-5 h-5 text-neutral-500 shrink-0" />
            </SettingsRow>
          </button>
          <button type="button" onClick={() => setLanguageSheetOpen(true)} className={ROW_BASE + " text-left"}>
            <SettingsRow icon={Globe} label={t("settings.summaryLanguage")}>
              <span className="text-sm text-neutral-400">{selectedLanguageLabel}</span>
              <ChevronRight className="w-5 h-5 text-neutral-500 shrink-0" />
            </SettingsRow>
          </button>
        </SettingsGroup>

        <SettingsGroup title={t("settings.supportAccount")}>
          <button type="button" onClick={() => setEditProfileSheetOpen(true)} className={ROW_BASE + " text-left"}>
            <SettingsRow icon={UserPen} label={t("settings.editProfile")}>
              <ChevronRight className="w-5 h-5 text-neutral-500 shrink-0" />
            </SettingsRow>
          </button>
          <button type="button" onClick={() => { setToastMessage("Abriendo el centro de soporte en el navegador..."); setToastVisible(true); }} className={ROW_BASE + " text-left"}>
            <SettingsRow icon={HelpCircle} label={t("settings.helpCenter")}>
              <ChevronRight className="w-5 h-5 text-neutral-500 shrink-0" />
            </SettingsRow>
          </button>
          <button type="button" onClick={() => setLogoutModalOpen(true)} className={ROW_BASE + " text-left"}>
            <SettingsRow icon={LogOut} label={t("settings.logout")} danger>
              <ChevronRight className="w-5 h-5 text-neutral-500 shrink-0" />
            </SettingsRow>
          </button>
        </SettingsGroup>
      </main>

      <LanguageBottomSheet isOpen={languageSheetOpen} onClose={() => setLanguageSheetOpen(false)} />

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
        message={toastMessage}
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
