import { X } from "lucide-react";
import { useAppLanguage } from "../../context/LanguageContext";
import { translations } from "../../i18n/translations";

const LANGUAGES = [
  { id: "es", labelKey: "es" },
  { id: "en", labelKey: "en" },
  { id: "fr", labelKey: "fr" },
  { id: "pt", labelKey: "pt" },
  { id: "it", labelKey: "it" },
  { id: "de", labelKey: "de" },
];

export default function LanguageBottomSheet({ isOpen, onClose }) {
  const { locale, setLocale, t } = useAppLanguage();

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Cerrar"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-[430px] mx-auto bg-[#1c1c1e] rounded-t-3xl p-6 transition-transform duration-300 animate-slide-in-bottom"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 2rem)" }}
        aria-modal="true"
        aria-label={t("settings.summaryLanguageTitle")}
      >
        <div className="w-12 h-1.5 bg-neutral-600 rounded-full mx-auto mb-4" aria-hidden />
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-white">
            {t("settings.summaryLanguageTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <ul className="mt-2">
          {LANGUAGES.map((lang) => {
            const isSelected = locale === lang.id;
            const label = translations[locale]?.languages?.[lang.labelKey] ?? translations.es.languages[lang.labelKey];
            return (
              <li key={lang.id} className="border-b border-neutral-800/50 last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    setLocale(lang.id);
                    onClose();
                  }}
                  className={`w-full flex justify-between items-center py-4 px-4 -mx-4 rounded-xl active:bg-neutral-800 transition-colors text-left ${
                    isSelected ? "bg-blue-900/20 text-blue-400" : "text-white"
                  }`}
                >
                  <span className="text-sm font-medium">{label}</span>
                  {isSelected && (
                    <span className="text-sm opacity-80">{t("settings.selected")}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
