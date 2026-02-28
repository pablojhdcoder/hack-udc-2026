import { ArrowLeft, FolderOpen, FileText } from "lucide-react";

const MOCK_FOLDERS = [
  { name: "Proyectos", count: 12 },
  { name: "Recursos", count: 8 },
  { name: "Áreas", count: 5 },
];

const MOCK_NOTES = [
  { title: "Round-robin y planificación", folder: "estudio/SI", date: "Hoy" },
  { title: "Prisma - ORM", folder: "referencias/React", date: "Ayer" },
];

export default function VaultScreen({ onBack }) {
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      <header className="shrink-0 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-zinc-900 dark:border-zinc-800">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Volver"
        >
          <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">Tu Cerebro</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 space-y-6 scrollbar-hide">
        <section>
          <h2 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3">
            Carpetas
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {MOCK_FOLDERS.map((f) => (
              <button
                key={f.name}
                type="button"
                className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-zinc-800/80 dark:border-zinc-700/50 dark:hover:bg-zinc-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-500/10 dark:bg-zinc-700 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-brand-500 dark:text-zinc-400" />
                  </div>
                  <span className="text-zinc-900 dark:text-zinc-100 font-medium">{f.name}</span>
                </div>
                <span className="text-zinc-500 text-sm">{f.count} notas</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3">
            Notas recientes
          </h2>
          <ul className="space-y-2">
            {MOCK_NOTES.map((note, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-zinc-800/60 dark:border-zinc-700/50 dark:hover:bg-zinc-800/80"
                >
                  <FileText className="w-5 h-5 text-brand-500 dark:text-zinc-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-800 dark:text-zinc-200 text-sm font-medium truncate">{note.title}</p>
                    <p className="text-zinc-500 text-xs">{note.folder} · {note.date}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
