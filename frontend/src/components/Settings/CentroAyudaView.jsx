import { useState } from "react";
import { ArrowLeft, ChevronDown, LifeBuoy, Mail } from "lucide-react";

const faqCategories = [
  {
    category: "Conceptos Básicos",
    items: [
      { q: "¿Qué es el Cerebro Digital?", a: "Es tu asistente personal inteligente. Captura notas, audios, imágenes o enlaces, y nuestra IA los procesará, resumirá y organizará por ti automáticamente." },
      { q: "¿Qué significa 'Procesar' una nota?", a: "Al capturar una idea, se guarda en tu bandeja. Al pulsar 'Procesar', la IA lee el contenido, asigna etiquetas (hashtags), genera un resumen y lo archiva en tu Baúl de forma ordenada." },
    ],
  },
  {
    category: "Funciones Inteligentes",
    items: [
      { q: "¿Cómo funciona el Calendario automático?", a: "Si al procesar una nota la IA detecta una fecha o evento (ej. 'Cita médica el jueves'), te propondrá añadirlo directamente a tu calendario interno con un solo clic." },
      { q: "¿Cómo busco mis ideas?", a: "Usa el buscador semántico. No necesitas recordar el nombre del archivo; busca por conceptos (ej. 'ideas para el hackathon' o 'apuntes de mates') y la IA encontrará lo relacionado." },
      { q: "¿Qué tipo de archivos detecta la IA?", a: "Puedes subir texto, audios (los transcribiremos), fotos, documentos y enlaces (incluyendo vídeos de YouTube). Extraeremos el contexto de todos ellos." },
    ],
  },
  {
    category: "Cuenta y Privacidad",
    items: [
      { q: "¿Son privados mis datos?", a: "Absolutamente. Tus archivos están encriptados en tu bóveda. La IA solo accede a ellos de forma segura para generar tus resúmenes locales, sin entrenar modelos públicos." },
      { q: "¿Puedo exportar mi información?", a: "Sí. Tu información es tuya. En la sección de Ajustes, usa 'Exportar mis notas' para descargar todo tu contenido cuando quieras." },
    ],
  },
];

export default function CentroAyudaView({ onBack, onContactEmail }) {
  const [expandedId, setExpandedId] = useState(null);

  const toggle = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
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
        <h1 className="flex-1 text-center text-lg font-semibold text-white">Centro de Ayuda</h1>
        <div className="flex items-center justify-end w-10">
          <LifeBuoy className="w-5 h-5 text-neutral-500" />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 scrollbar-hide">
        {faqCategories.map((cat, catIndex) => (
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
          <p className="text-white font-medium mb-1">¿No encuentras lo que buscas?</p>
          <p className="text-sm text-neutral-400 mb-4">
            Nuestro equipo de soporte está listo para ayudarte.
          </p>
          <button
            type="button"
            onClick={onContactEmail}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-medium transition-colors"
          >
            <Mail className="w-5 h-5" />
            Enviar un correo
          </button>
        </div>

        <div className="text-center text-[10px] font-medium text-neutral-600 mt-8 mb-4 uppercase tracking-widest">
          Cerebro Digital v1.0.0 • Kelea HackUDC
        </div>
      </main>
    </div>
  );
}
