import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Sparkles, Trash2, CalendarDays, Loader2, FileText, Link2, File, Image, Mic, Video } from "lucide-react";
import { useAppLanguage } from "../../context/LanguageContext";
import { translations } from "../../i18n/translations";
import ItemDetailPanel, { getItemDisplayTitle } from "../Vault/ItemDetailPanel";
import {
  getInboxItem,
  getRelatedItems,
  checkFavorite,
  addToFavorites,
  removeFromFavorites,
  discardItem,
} from "../../api/client";

const ICON_BY_KIND = {
  note: FileText,
  link: Link2,
  file: File,
  photo: Image,
  audio: Mic,
  video: Video,
};

const getReleaseY = (e) => (e.changedTouches ? e.changedTouches[0].clientY : e.clientY);
const getClientY = (e) => (e.touches ? e.touches[0].clientY : e.clientY);

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Devuelve YYYY-MM-DD para comparar fechas. */
function toDateKey(d) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Día de la semana con Lunes = 0. */
function getMondayBasedDay(date) {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

/** Número de días del mes (1-31). */
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** Espacios en blanco al inicio (cuántos días antes del 1º caen en el mes anterior). */
function getLeadingBlanks(year, month) {
  return getMondayBasedDay(new Date(year, month, 1));
}

/** Extrae la fecha (YYYY-MM-DD) de un evento para comparar. */
function getEventDateKey(event) {
  const raw = event.date ?? event.dateTime ?? event.fecha ?? event.start ?? "";
  if (!raw) return "";
  const d = new Date(raw);
  return toDateKey(d);
}

export default function CalendarioView({ onBack }) {
  const { locale } = useAppLanguage();
  const vt = translations[locale]?.vault ?? translations.es?.vault ?? {};
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // Panel de detalle unificado (misma interfaz que procesado/temas)
  const [selectedForDetail, setSelectedForDetail] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [favoriteCheck, setFavoriteCheck] = useState({ favorited: false, favoriteId: null });
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [relatedItems, setRelatedItems] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(true);
  const [panelDragY, setPanelDragY] = useState(0);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const dragStartY = useRef(0);
  const panelDragYRef = useRef(0);

  const fetchEvents = () => {
    setIsLoading(true);
    fetch("/api/eventos")
      .then((res) => (res.ok ? res.json() : Promise.resolve([])))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.events ?? [];
        setEvents(list);
      })
      .catch(() => setEvents([]))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch("/api/eventos")
      .then((res) => (res.ok ? res.json() : Promise.resolve([])))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.events ?? [];
        setEvents(list);
      })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleDeleteEvent = async (id) => {
    setDeletingId(id);
    try {
      await fetch(`/api/eventos/${id}?deleteSource=true`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // silenciar error
    } finally {
      setDeletingId(null);
    }
  };

  // Cargar ítem al abrir detalle desde un evento
  useEffect(() => {
    if (!selectedForDetail?.kind || !selectedForDetail?.id) {
      setDetailItem(null);
      setLoadingDetail(false);
      return;
    }
    setLoadingDetail(true);
    setDetailItem(null);
    let cancelled = false;
    getInboxItem(selectedForDetail.kind, selectedForDetail.id)
      .then((data) => {
        if (!cancelled) setDetailItem({ ...data, kind: selectedForDetail.kind, id: selectedForDetail.id });
      })
      .catch(() => { if (!cancelled) setDetailItem(null); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selectedForDetail]);

  useEffect(() => {
    if (!detailItem) {
      setFavoriteCheck({ favorited: false, favoriteId: null });
      setRelatedItems([]);
      setLoadingRelated(false);
      return;
    }
    const kind = detailItem.kind;
    const id = detailItem.id;
    let cancelled = false;
    checkFavorite(kind, id).then((r) => {
      if (!cancelled) setFavoriteCheck({ favorited: r.favorited, favoriteId: r.favoriteId });
    }).catch(() => {});
    setLoadingRelated(true);
    setRelatedItems([]);
    getRelatedItems(kind, id)
      .then((list) => { if (!cancelled) setRelatedItems(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setRelatedItems([]); })
      .finally(() => { if (!cancelled) setLoadingRelated(false); });
    return () => { cancelled = true; };
  }, [detailItem]);

  const handleCloseDetail = useCallback(() => {
    setShowDeleteConfirm(false);
    setSelectedForDetail(null);
    setDetailItem(null);
  }, []);

  const handlePanelDragStart = useCallback((e) => {
    e.preventDefault();
    dragStartY.current = getClientY(e);
    setPanelDragY(0);
    setIsDraggingPanel(true);
  }, []);

  const handlePanelDragMove = useCallback((e) => {
    const y = getClientY(e);
    const dy = y - dragStartY.current;
    const next = Math.max(0, dy);
    panelDragYRef.current = next;
    setPanelDragY(next);
  }, []);

  const handlePanelDragEnd = useCallback((e) => {
    const releaseY = typeof e !== "undefined" && e !== null ? getReleaseY(e) : null;
    setIsDraggingPanel(false);
    setPanelDragY(0);
    const mid = typeof window !== "undefined" ? window.innerHeight / 2 : 400;
    const inLowerHalf = releaseY != null && releaseY >= mid;
    if (inLowerHalf) handleCloseDetail();
  }, [handleCloseDetail]);

  useEffect(() => {
    if (!isDraggingPanel) return;
    const onMove = (e) => { e.preventDefault(); handlePanelDragMove(e); };
    const onEnd = (ev) => handlePanelDragEnd(ev);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("mousemove", handlePanelDragMove);
    document.addEventListener("mouseup", onEnd);
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("mousemove", handlePanelDragMove);
      document.removeEventListener("mouseup", onEnd);
    };
  }, [isDraggingPanel, handlePanelDragMove, handlePanelDragEnd]);

  const openItemUrl = useCallback(() => {
    if (!detailItem) return;
    if (detailItem.url) {
      window.open(detailItem.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (detailItem.filePath) {
      const basename = detailItem.filePath.split("/").pop() || detailItem.filePath;
      window.open(`/api/uploads/${basename}`, "_blank", "noopener,noreferrer");
    }
  }, [detailItem]);

  const handleToggleFavorite = useCallback(async () => {
    if (!detailItem || detailItem.kind === "favorite" || togglingFavorite) return;
    setTogglingFavorite(true);
    try {
      if (favoriteCheck.favorited) {
        await removeFromFavorites(favoriteCheck.favoriteId);
        setFavoriteCheck({ favorited: false, favoriteId: null });
      } else {
        const created = await addToFavorites(detailItem.kind, detailItem.id);
        setFavoriteCheck({ favorited: true, favoriteId: created.id });
      }
      handleCloseDetail();
    } catch (err) {
      // mantener panel abierto en error
    } finally {
      setTogglingFavorite(false);
    }
  }, [detailItem, favoriteCheck, togglingFavorite, handleCloseDetail]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!detailItem || deleting) return;
    setDeleting(true);
    try {
      await discardItem(detailItem.kind, detailItem.id);
      handleCloseDetail();
    } catch (err) {
      // mantener panel en error
    } finally {
      setDeleting(false);
    }
  }, [detailItem, deleting, handleCloseDetail]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  useEffect(() => {
    if (detailItem) setShowDeleteConfirm(false);
  }, [detailItem]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const leadingBlanks = getLeadingBlanks(year, month);

  const prevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const selectedKey = toDateKey(selectedDate);
  const todayKey = toDateKey(today);

  const hasEventOnDay = (dayNum) => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return events.some((ev) => getEventDateKey(ev) === key);
  };

  const eventsOnSelectedDay = useMemo(() => {
    return events.filter((ev) => getEventDateKey(ev) === selectedKey);
  }, [events, selectedKey]);

  const handleSelectDay = (dayNum) => {
    setSelectedDate(new Date(year, month, dayNum));
  };

  const openDetailFromEvent = (event) => {
    if (event.sourceKind && event.sourceId) {
      setSelectedForDetail({ kind: event.sourceKind, id: event.sourceId });
    }
  };

  return (
    <>
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <header className="shrink-0 flex items-center h-14 px-4 border-b border-zinc-200 dark:border-neutral-800 safe-top">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-600 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-white">Calendario</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 scrollbar-hide">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl bg-zinc-100 dark:bg-neutral-800/60 border border-zinc-200 dark:border-neutral-800 p-4 animate-pulse"
              >
                <div className="h-4 bg-zinc-200 dark:bg-neutral-700 rounded w-1/3 mb-3" />
                <div className="h-5 bg-zinc-200 dark:bg-neutral-700 rounded w-full mb-2" />
                <div className="h-3 bg-zinc-200 dark:bg-neutral-700 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Cabecera del mes */}
            <div className="flex justify-between items-center mb-4">
              <button
                type="button"
                onClick={prevMonth}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-neutral-800 text-blue-500 dark:text-blue-400 transition-colors"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                {MONTH_NAMES[month]} {year}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-neutral-800 text-blue-500 dark:text-blue-400 transition-colors"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Días de la semana */}
            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="text-center text-xs font-medium text-zinc-400 dark:text-neutral-500"
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Cuadrícula de días */}
            <div className="grid grid-cols-7 gap-y-2">
              {Array.from({ length: leadingBlanks }, (_, i) => (
                <div key={`blank-${i}`} className="h-12" aria-hidden />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const dayNum = i + 1;
                const dayKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const isSelected = dayKey === selectedKey;
                const isToday = dayKey === todayKey;
                const hasEvent = hasEventOnDay(dayNum);

                return (
                  <div key={dayNum} className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleSelectDay(dayNum)}
                    className={`
                      flex flex-col items-center justify-center w-9 h-9 cursor-pointer rounded-full transition-colors relative
                      ${isSelected ? "bg-blue-600 text-white" : ""}
                      ${!isSelected && isToday ? "text-blue-500 dark:text-blue-400 font-bold" : ""}
                      ${!isSelected && !isToday ? "text-zinc-800 dark:text-white hover:bg-zinc-100 dark:hover:bg-neutral-800" : ""}
                    `}
                  >
                    <span className="text-sm leading-none">{dayNum}</span>
                    {hasEvent && (
                      <div
                        className={`w-1.5 h-1.5 rounded-full mt-0.5 shrink-0 ${isSelected ? "bg-white" : "bg-blue-400"}`}
                        aria-hidden
                      />
                    )}
                  </button>
                  </div>
                );
              })}
            </div>

            {/* Lista de eventos del día seleccionado */}
            <div className="border-t border-zinc-200 dark:border-neutral-800 mt-6 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <h2 className="text-sm font-medium text-zinc-500 dark:text-neutral-400">
                  {selectedDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                </h2>
              </div>
              {eventsOnSelectedDay.length === 0 ? (
                <p className="text-zinc-400 dark:text-neutral-500 text-sm py-4">No hay eventos para este día.</p>
              ) : (
                <ul className="space-y-3">
                  {eventsOnSelectedDay
                    .sort((a, b) => {
                      if (!a.time && !b.time) return 0;
                      if (!a.time) return 1;
                      if (!b.time) return -1;
                      return a.time.localeCompare(b.time);
                    })
                    .map((event, index) => (
                    <li
                      key={event.id ?? index}
                      onClick={() => openDetailFromEvent(event)}
                      className={`rounded-xl bg-zinc-50 dark:bg-neutral-800/80 border border-zinc-200 dark:border-neutral-700/50 p-4 flex flex-col gap-1.5 group ${
                        event.sourceKind && event.sourceId
                          ? "cursor-pointer hover:bg-zinc-100 dark:hover:bg-neutral-800/90 transition-colors"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {(event.time) && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span className="text-xs text-blue-400 font-medium tabular-nums">{event.time}</span>
                            </div>
                          )}
                          <p className="text-sm text-zinc-900 dark:text-white font-semibold leading-snug">
                            {event.title ?? event.titulo ?? "Sin título"}
                          </p>
                          {(event.description ?? event.note ?? event.originalNote ?? event.sourceContent ?? event.nota) && (
                            <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-1 leading-relaxed line-clamp-3">
                              {event.description ?? event.note ?? event.originalNote ?? event.sourceContent ?? event.nota}
                            </p>
                          )}
                          {event.sourceKind && (
                            <div className="flex items-center gap-1 mt-2">
                              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="text-[10px] text-amber-400 font-medium uppercase tracking-wider">Detectado por IA · {event.sourceKind}</span>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                          disabled={deletingId === event.id}
                          className="p-1.5 rounded-lg text-zinc-300 dark:text-neutral-600 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          aria-label="Eliminar evento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>
    </div>

    {selectedForDetail && loadingDetail && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" aria-busy="true">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )}
    {detailItem && (
      <ItemDetailPanel
        item={detailItem}
        vt={vt}
        onClose={handleCloseDetail}
        fullNoteContent={detailItem.content ?? null}
        loadingNote={false}
        favoriteCheck={favoriteCheck}
        togglingFavorite={togglingFavorite}
        isFavoriteItem={false}
        showDeleteConfirm={showDeleteConfirm}
        deleting={deleting}
        onOpenUrl={openItemUrl}
        onToggleFavorite={handleToggleFavorite}
        onRemoveFavorite={undefined}
        onDeleteClick={() => setShowDeleteConfirm(true)}
        onConfirmDelete={handleDeleteConfirm}
        onCancelDelete={handleCancelDelete}
        panelDragY={panelDragY}
        onPanelDragStart={handlePanelDragStart}
        showDragHandle
        relatedItems={relatedItems}
        loadingRelated={loadingRelated}
        relatedOpen={relatedOpen}
        onRelatedOpenChange={setRelatedOpen}
        onSelectRelatedItem={(rel) => rel && setSelectedForDetail({ kind: rel.kind, id: rel.id })}
        relatedLabel={vt.relatedLabel ?? "Conectado con"}
        relatedEmpty={vt.relatedEmpty ?? "Nada relacionado por ahora"}
        getItemDisplayTitle={getItemDisplayTitle}
        iconByKind={ICON_BY_KIND}
      />
    )}
    </>
  );
}
