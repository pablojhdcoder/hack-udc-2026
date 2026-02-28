import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Sparkles, Trash2, CalendarDays } from "lucide-react";

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
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

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
      await fetch(`/api/eventos/${id}`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // silenciar error
    } finally {
      setDeletingId(null);
    }
  };

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

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-neutral-950">
      <header className="shrink-0 flex items-center h-14 px-4 border-b border-neutral-800 safe-top">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-white">Calendario</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 scrollbar-hide">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl bg-neutral-800/60 border border-neutral-800 p-4 animate-pulse"
              >
                <div className="h-4 bg-neutral-700 rounded w-1/3 mb-3" />
                <div className="h-5 bg-neutral-700 rounded w-full mb-2" />
                <div className="h-3 bg-neutral-700 rounded w-2/3" />
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
                className="p-2 rounded-full hover:bg-neutral-800 text-blue-400 transition-colors"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="text-lg font-semibold text-white">
                {MONTH_NAMES[month]} {year}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-2 rounded-full hover:bg-neutral-800 text-blue-400 transition-colors"
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
                  className="text-center text-xs font-medium text-neutral-500"
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
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => handleSelectDay(dayNum)}
                    className={`
                      flex flex-col items-center justify-center p-2 h-12 w-full cursor-pointer rounded-full transition-colors relative
                      ${isSelected ? "bg-blue-600 text-white" : ""}
                      ${!isSelected && isToday ? "text-blue-400 font-bold" : ""}
                      ${!isSelected && !isToday ? "text-white hover:bg-neutral-800" : ""}
                    `}
                  >
                    <span>{dayNum}</span>
                    {hasEvent && (
                      <div
                        className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${isSelected ? "bg-white" : "bg-blue-400"}`}
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Lista de eventos del día seleccionado */}
            <div className="border-t border-neutral-800 mt-6 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-medium text-neutral-400">
                  {selectedDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                </h2>
              </div>
              {eventsOnSelectedDay.length === 0 ? (
                <p className="text-neutral-500 text-sm py-4">No hay eventos para este día.</p>
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
                      className="rounded-xl bg-neutral-800/80 border border-neutral-700/50 p-4 flex flex-col gap-1.5 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {(event.time) && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span className="text-xs text-blue-400 font-medium tabular-nums">{event.time}</span>
                            </div>
                          )}
                          <p className="text-sm text-white font-semibold leading-snug">
                            {event.title ?? event.titulo ?? "Sin título"}
                          </p>
                          {(event.description ?? event.note ?? event.originalNote ?? event.sourceContent ?? event.nota) && (
                            <p className="text-xs text-neutral-400 mt-1 leading-relaxed line-clamp-3">
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
                          onClick={() => handleDeleteEvent(event.id)}
                          disabled={deletingId === event.id}
                          className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-50"
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
  );
}
