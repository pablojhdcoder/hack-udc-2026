import { ArrowLeft, Loader2 } from "lucide-react";

export default function ProcessScreen({ onBack }) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-900">
      <header className="sticky top-0 z-10 flex items-center gap-3 h-14 px-4 bg-zinc-900 border-b border-zinc-800 safe-top">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="Volver al inbox"
        >
          <ArrowLeft className="w-6 h-6 text-zinc-300" />
        </button>
        <h1 className="text-lg font-semibold text-zinc-100">Procesar notas</h1>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">Pantalla de procesado</h2>
        <p className="text-zinc-500 text-sm max-w-[260px]">
          Aquí irá el triaje y la organización de las notas. En construcción.
        </p>
      </main>
    </div>
  );
}
