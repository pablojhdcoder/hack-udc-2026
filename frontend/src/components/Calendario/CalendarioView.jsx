import { useState, useEffect } from "react";
import { ArrowLeft, Calendar } from "lucide-react";

export default function CalendarioView({ onBack }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-neutral-500" />
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              No hay eventos programados. La IA detectará tus citas automáticamente.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((event, index) => (
              <li
                key={event.id ?? index}
                className="rounded-xl bg-neutral-800/80 border border-neutral-700/50 p-4 flex flex-col gap-1"
              >
                <p className="text-xs text-neutral-400 font-medium uppercase tracking-wider">
                  {event.date ?? event.dateTime ?? event.fecha ?? "—"}
                </p>
                <p className="text-sm text-white font-medium">
                  {event.title ?? event.titulo ?? "Sin título"}
                </p>
                {(event.note ?? event.originalNote ?? event.sourceContent ?? event.nota) && (
                  <p className="text-xs text-neutral-500 line-clamp-2 mt-1">
                    {event.note ?? event.originalNote ?? event.sourceContent ?? event.nota}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
