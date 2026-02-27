/**
 * Mock data para el prototipo UX/UI. Sin backend.
 */
const nowIso = new Date().toISOString();

export const MOCK_INBOX_ITEMS = [
  {
    id: "0",
    type: "text",
    content: "Nota capturada hoy para probar el filtro por fecha.",
    createdAt: nowIso,
  },
  {
    id: "1",
    type: "text",
    content: "Round-robin con quantum demasiado grande se comporta como FIFO. Anotar para el examen de SI.",
    createdAt: "2025-02-26T10:30:00Z",
  },
  {
    id: "2",
    type: "link",
    title: "Prisma - Next-generation ORM",
    url: "https://www.prisma.io/docs",
    imagePlaceholder: true,
    createdAt: "2025-02-26T09:15:00Z",
  },
  {
    id: "3",
    type: "voice",
    durationSeconds: 42,
    createdAt: "2025-02-25T18:00:00Z",
  },
  {
    id: "4",
    type: "file",
    filename: "Enunciado_SI_P1_2025.pdf",
    fileType: "pdf",
    createdAt: "2025-02-25T16:45:00Z",
  },
  {
    id: "5",
    type: "text",
    content: "Ideas para el proyecto: inbox único, clasificación por heurísticas, export a Markdown.",
    createdAt: "2025-02-25T14:20:00Z",
  },
  {
    id: "6",
    type: "link",
    title: "React useReducer – documentación oficial",
    url: "https://react.dev/reference/react/useReducer",
    imagePlaceholder: true,
    createdAt: "2025-02-24T11:00:00Z",
  },
  {
    id: "7",
    type: "voice",
    durationSeconds: 18,
    createdAt: "2025-02-24T09:30:00Z",
  },
  {
    id: "8",
    type: "file",
    filename: "Apuntes_clase_2.docx",
    fileType: "word",
    createdAt: "2025-02-23T17:10:00Z",
  },
];
