import { useState } from "react";
import { ArrowLeft, ChevronDown, LifeBuoy, Mail } from "lucide-react";
import { useAppLanguage } from "../../context/LanguageContext";
import { translations } from "../../i18n/translations";

export default function CentroAyudaView({ onBack, onContactEmail }) {
  const { t, locale } = useAppLanguage();
  const [expandedId, setExpandedId] = useState(null);

  const hc = translations[locale]?.helpCenter ?? translations.es.helpCenter;
  const faqCategories = hc.categories;

  const toggle = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <header className="shrink-0 flex items-center h-14 px-4 border-b border-neutral-800 safe-top">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          aria-label={hc.backAria}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-white">{hc.title}</h1>
        <div className="flex items-center justify-end w-10">
          <LifeBuoy className="w-5 h-5 text-neutral-500" />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 scrollbar-hide">
        {Array.isArray(faqCategories) && faqCategories.map((cat, catIndex) => (
          <section key={catIndex}>
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 mt-6 ml-1 first:mt-0">
              {cat.category}
            </h2>
            {cat.items.map((item, itemIndex) => {
              const id = `${catIndex}-${itemIndex}`;
              const isExpanded = expandedId === id;
              return (
                <div
                  key={itemIndex}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl mb-3 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="w-full flex justify-between items-center p-4 font-medium text-white text-left"
                  >
                    <span className="pr-3">{item.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 shrink-0 text-neutral-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="p-4 pt-0 text-sm text-neutral-400 bg-neutral-900">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}

        <div className="bg-blue-900/10 border border-blue-900/30 rounded-2xl p-5 mt-8 text-center">
          <p className="text-white font-medium mb-1">{hc.notFoundTitle}</p>
          <p className="text-sm text-neutral-400 mb-4">
            {hc.notFoundBody}
          </p>
          <button
            type="button"
            onClick={onContactEmail}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-medium transition-colors"
          >
            <Mail className="w-5 h-5" />
            {hc.contactButton}
          </button>
        </div>

        <div className="text-center text-[10px] font-medium text-neutral-600 mt-8 mb-4 uppercase tracking-widest">
          Riki Brain v1.0.0 • Kelea HackUDC
        </div>
      </main>
    </div>
  );
}
