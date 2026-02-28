import { Brain } from "lucide-react";
import { useAppLanguage } from "../../context/LanguageContext";

export default function EmptyState({ isSearch }) {
  const { t } = useAppLanguage();
  if (isSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <p className="text-zinc-600 dark:text-zinc-500 text-sm">{t("home.noSearchResults")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-5 dark:bg-neutral-800/80 dark:border-neutral-700/50">
        <Brain className="w-10 h-10 text-brand-500 dark:text-zinc-500" />
      </div>
      <h2 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-2">{t("home.emptyTitle")}</h2>
      <p className="text-zinc-600 dark:text-zinc-500 text-sm max-w-[260px] leading-relaxed">
        {t("home.emptySubtitle")}
      </p>
    </div>
  );
}
