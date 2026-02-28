import { useState, useEffect, useMemo } from "react";
import { X, ChevronDown } from "lucide-react";
import { useAppLanguage } from "../../context/LanguageContext";

const TYPE_OPTIONS_KEYS = [
  { value: "all", key: "filters.all" },
  { value: "text", key: "filters.typeText" },
  { value: "links", key: "filters.typeLinks" },
  { value: "voice", key: "filters.typeVoice" },
  { value: "files", key: "filters.typeFiles" },
  { value: "video", key: "filters.typeVideo" },
];

const DATE_OPTIONS_KEYS = [
  { value: "all_dates", key: "filters.anyDate" },
  { value: "today", key: "filters.today" },
  { value: "yesterday", key: "filters.yesterday" },
  { value: "last_7_days", key: "filters.last7Days" },
  { value: "last_30_days", key: "filters.last30Days" },
];

export default function FilterBottomSheet({
  isOpen,
  onClose,
  activeTypeFilter = "all",
  activeDateFilter = "all_dates",
  onTypeFilter,
  onDateFilter,
}) {
  const { t } = useAppLanguage();
  const [localType, setLocalType] = useState(activeTypeFilter);
  const [localDate, setLocalDate] = useState(activeDateFilter);

  const typeOptions = useMemo(
    () => TYPE_OPTIONS_KEYS.map((o) => ({ value: o.value, label: t(o.key) })),
    [t]
  );
  const dateOptions = useMemo(
    () => DATE_OPTIONS_KEYS.map((o) => ({ value: o.value, label: t(o.key) })),
    [t]
  );

  useEffect(() => {
    if (isOpen) {
      setLocalType(activeTypeFilter);
      setLocalDate(activeDateFilter);
    }
  }, [isOpen, activeTypeFilter, activeDateFilter]);

  if (!isOpen) return null;

  const handleClear = () => {
    setLocalType("all");
    setLocalDate("all_dates");
    onTypeFilter?.("all");
    onDateFilter?.("all_dates");
    onClose();
  };

  const handleApply = () => {
    onTypeFilter?.(localType);
    onDateFilter?.(localDate);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label={t("filters.closeAria")}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-950 border-t border-neutral-800 rounded-t-2xl max-w-[430px] mx-auto safe-bottom animate-slide-in-bottom max-h-[85vh] overflow-y-auto"
        aria-modal="true"
        aria-label={t("filters.filterOptionsAria")}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2 sticky top-0 bg-neutral-950 z-10">
          <h2 className="text-lg font-semibold text-white">{t("filters.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            aria-label={t("filters.closeAria")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pb-6">
          <div className="space-y-5">
            <div>
              <label htmlFor="filter-type" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 block">
                {t("filters.fileType")}
              </label>
              <div className="relative">
                <select
                  id="filter-type"
                  value={localType}
                  onChange={(e) => setLocalType(e.target.value)}
                  className="w-full appearance-none bg-neutral-900 border border-neutral-800 text-white font-medium rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                >
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label htmlFor="filter-date" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 block">
                {t("filters.date")}
              </label>
              <div className="relative">
                <select
                  id="filter-date"
                  value={localDate}
                  onChange={(e) => setLocalDate(e.target.value)}
                  className="w-full appearance-none bg-neutral-900 border border-neutral-800 text-white font-medium rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                >
                  {dateOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl py-3 font-medium transition-colors"
            >
              {t("filters.clear")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 font-medium transition-colors shadow-lg shadow-blue-500/20"
            >
              {t("filters.showResults")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
