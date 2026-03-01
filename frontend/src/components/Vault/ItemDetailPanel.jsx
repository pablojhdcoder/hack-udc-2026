import { Loader2, Trash2, Star, ExternalLink, Tag, FolderOpen, Globe, Calendar, Network, ChevronRight, FileText } from "lucide-react";

function getItemDisplayTitle(item) {
  if (item?.aiTitle && String(item.aiTitle).trim()) return item.aiTitle.trim();
  const ai = item?.aiEnrichment;
  if (ai && typeof ai === "object" && ai.title) return String(ai.title).trim();
  if (item?.filename && String(item.filename).trim()) return item.filename;
  return item?.title ?? item?.url?.slice(0, 40) ?? (item?.content?.slice(0, 50) || "Sin título");
}

/**
 * Panel de detalle de un ítem (reutilizado en Baúl y en Temas).
 * Recibe el ítem, traducciones (vt) y callbacks para acciones.
 */
export default function ItemDetailPanel({
  item,
  vt,
  onClose,
  fullNoteContent = null,
  loadingNote = false,
  favoriteCheck = { favorited: false, favoriteId: null },
  togglingFavorite = false,
  isFavoriteItem = false,
  showDeleteConfirm = false,
  deleting = false,
  onOpenUrl,
  onToggleFavorite,
  onRemoveFavorite,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
  panelDragY = 0,
  onPanelDragStart,
  showDragHandle = true,
  relatedItems = [],
  loadingRelated = false,
  relatedOpen = true,
  onRelatedOpenChange,
  onSelectRelatedItem,
  relatedLabel = "Conectado con",
  relatedEmpty = "Nada relacionado por ahora",
  getItemDisplayTitle: getItemDisplayTitleProp,
  iconByKind = {},
}) {
  const getDisplayTitle = getItemDisplayTitleProp ?? getItemDisplayTitle;
  if (!item) return null;

  const isNoteItem = item?.kind === "note" || item?.sourceKind === "note";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      aria-modal="true"
      role="dialog"
      onClick={() => {
        if (deleting || togglingFavorite) return;
        if (showDeleteConfirm && onCancelDelete) onCancelDelete();
        else onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white dark:bg-neutral-900 p-4 pb-safe shadow-xl overflow-y-auto max-h-[85vh] scrollbar-hide transition-transform"
        style={{ transform: `translateY(${panelDragY}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {showDeleteConfirm ? (
          <>
            <p className="text-zinc-700 dark:text-zinc-300 text-sm mb-4">{vt.deleteConfirm}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancelDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium disabled:opacity-50"
              >
                {vt.cancel}
              </button>
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : vt.accept}
              </button>
            </div>
          </>
        ) : (
          <>
            {showDragHandle && onPanelDragStart && (
              <div
                role="button"
                tabIndex={0}
                className="w-12 h-1.5 bg-zinc-300 dark:bg-neutral-600 rounded-full mx-auto mb-4 touch-none cursor-grab active:cursor-grabbing select-none"
                aria-label="Arrastra hacia abajo para cerrar"
                onTouchStart={onPanelDragStart}
                onMouseDown={onPanelDragStart}
              />
            )}

            <h2 className="text-base font-semibold text-zinc-900 dark:text-white leading-snug mb-4">
              {getDisplayTitle(item) || vt.untitled}
            </h2>

            <div className="space-y-3 mb-4">
              <div className="rounded-xl bg-zinc-50 dark:bg-neutral-800/70 border border-zinc-200 dark:border-neutral-700/50 px-4 py-3">
                <p className="text-xs text-zinc-500 dark:text-neutral-400 font-medium uppercase tracking-wider mb-1">{vt.summary}</p>
                <p className="text-sm text-zinc-800 dark:text-neutral-200 leading-relaxed">
                  {item.aiSummary && item.aiSummary.trim() ? item.aiSummary : vt.noSummary}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {item.aiCategory ? (
                  <div className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-500/30 rounded-full px-3 py-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400 shrink-0" />
                    <span className="text-xs text-violet-700 dark:text-violet-300 font-medium">{item.aiCategory}</span>
                  </div>
                ) : null}
                {item.aiLanguage ? (
                  <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-neutral-800 border border-zinc-200 dark:border-neutral-700 rounded-full px-3 py-1.5">
                    <Globe className="w-3.5 h-3.5 text-zinc-500 dark:text-neutral-400 shrink-0" />
                    <span className="text-xs text-zinc-600 dark:text-neutral-300 font-medium uppercase">{item.aiLanguage}</span>
                  </div>
                ) : null}
                {!item.aiCategory && !item.aiLanguage ? (
                  <span className="text-xs text-zinc-400 dark:text-neutral-500">{vt.noSummary}</span>
                ) : null}
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="w-3.5 h-3.5 text-zinc-400 dark:text-neutral-500" />
                  <span className="text-xs text-zinc-500 dark:text-neutral-500 font-medium uppercase tracking-wider">{vt.topics}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(item.aiTopics ?? item.aiTags ?? []).length > 0
                    ? (item.aiTopics ?? item.aiTags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full"
                        >
                          #{String(tag).trim().toLowerCase()}
                        </span>
                      ))
                    : <span className="text-xs text-zinc-400 dark:text-neutral-500">{vt.noSummary}</span>}
                </div>
              </div>

              {(item.kind === "audio" || item.sourceKind === "audio") && item.transcription && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wider mb-1.5">🎙 {vt.transcription ?? "Transcripción"}</p>
                  <p className="text-sm text-zinc-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">{item.transcription}</p>
                </div>
              )}
              {(item.kind === "video" || item.sourceKind === "video") && item.transcription && (
                <div className="rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 px-4 py-3">
                  <p className="text-xs text-violet-600 dark:text-violet-400 font-medium uppercase tracking-wider mb-1.5">🎬 {vt.transcription ?? "Transcripción"}</p>
                  <p className="text-sm text-zinc-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">{item.transcription}</p>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-neutral-500">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
                    : vt.noSummary}
                </span>
              </div>

              {Array.isArray(relatedItems) && (relatedItems.length > 0 || loadingRelated) && onRelatedOpenChange != null && (
                <div className="border-t border-zinc-200 dark:border-neutral-700/50 pt-3 mt-3">
                  <button
                    type="button"
                    onClick={() => onRelatedOpenChange((o) => !o)}
                    className="flex items-center gap-2 w-full text-left text-xs font-medium text-zinc-500 dark:text-neutral-400 hover:text-zinc-700 dark:hover:text-neutral-300"
                  >
                    <Network className="w-4 h-4 shrink-0" />
                    <span>{relatedLabel}</span>
                    <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${relatedOpen ? "rotate-90" : ""}`} />
                  </button>
                  {relatedOpen && (
                    <div className="mt-2 space-y-1 max-h-44 overflow-y-auto scrollbar-hide">
                      {loadingRelated ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                        </div>
                      ) : relatedItems.length === 0 ? (
                        <p className="text-xs text-zinc-400 dark:text-neutral-500 py-2">{relatedEmpty}</p>
                      ) : (
                        relatedItems.map((rel) => {
                          const title = getDisplayTitle(rel);
                          const Icon = iconByKind[rel.kind] ?? FileText;
                          return (
                            <button
                              key={`${rel.kind}-${rel.id}`}
                              type="button"
                              onClick={() => onSelectRelatedItem?.(rel)}
                              className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-zinc-100 dark:bg-neutral-800/80 hover:bg-zinc-200 dark:hover:bg-neutral-700/80 text-left transition-colors"
                            >
                              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-neutral-800 border border-zinc-200 dark:border-neutral-700 flex items-center justify-center">
                                <Icon className="w-4 h-4 text-zinc-500 dark:text-neutral-400" />
                              </div>
                              <span className="text-sm text-zinc-800 dark:text-neutral-200 truncate flex-1">{title}</span>
                              <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isNoteItem && (
              <div className="mb-4">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">{vt.viewNote}</p>
                <div className="rounded-xl border border-zinc-200 dark:border-neutral-700 bg-zinc-50 dark:bg-neutral-800/80 p-3 max-h-48 overflow-y-auto scrollbar-hide">
                  {loadingNote ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                    </div>
                  ) : (
                    <p className="text-zinc-800 dark:text-zinc-200 text-sm whitespace-pre-wrap break-words">
                      {fullNoteContent ?? item.content ?? vt.noSummary}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {(item.url || item.filePath) && onOpenUrl && (
                <button
                  type="button"
                  onClick={onOpenUrl}
                  className="flex-1 min-w-[100px] py-2.5 rounded-xl border border-brand-500/50 bg-brand-500/10 text-brand-600 dark:text-brand-400 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  {item.url ? vt.openLink : (item.kind === "photo" || item.sourceKind === "photo") ? vt.openImage : (item.kind === "video" || item.sourceKind === "video") ? vt.openVideo : vt.openFile}
                </button>
              )}
              {isFavoriteItem && onRemoveFavorite ? (
                <button
                  type="button"
                  onClick={onRemoveFavorite}
                  disabled={togglingFavorite}
                  className="flex-1 min-w-[100px] py-2.5 pl-3 pr-4 rounded-xl bg-amber-400 dark:bg-amber-500 text-white text-sm font-medium flex items-center justify-start gap-2 disabled:opacity-50"
                >
                  {togglingFavorite ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <Star className="w-4 h-4 flex-shrink-0 fill-white" />}
                  {vt.removeFavorite}
                </button>
              ) : onToggleFavorite ? (
                <button
                  type="button"
                  onClick={onToggleFavorite}
                  disabled={togglingFavorite}
                  className={`flex-1 min-w-[100px] py-2.5 pl-3 pr-4 rounded-xl text-sm font-medium flex items-center justify-start gap-2 disabled:opacity-50 ${
                    favoriteCheck.favorited
                      ? "bg-amber-400 dark:bg-amber-500 text-white"
                      : "border border-amber-400 dark:border-amber-500 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {togglingFavorite ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <Star className={`w-4 h-4 flex-shrink-0 ${favoriteCheck.favorited ? "fill-white" : ""}`} />}
                  {favoriteCheck.favorited ? vt.removeFavorite : vt.addFavorite}
                </button>
              ) : null}
              {onDeleteClick && (
                <button
                  type="button"
                  onClick={onDeleteClick}
                  disabled={togglingFavorite}
                  className="flex-1 min-w-[100px] py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {vt.delete}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { getItemDisplayTitle };
