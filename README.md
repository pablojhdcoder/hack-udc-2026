# Digital Brain — Kelea HackUDC 2026

Sistema de documentación personal (cerebro digital): captura rápida en un inbox único y procesado posterior a conocimiento en Markdown.

## Stack

- **Backend:** Node.js, Express, Prisma (SQLite)
- **Frontend:** React, Vite
- **Conocimiento:** Carpeta `backend/knowledge/` con ficheros Markdown (compatible con Obsidian / MkDocs)

## Estructura

```
hack-udc-2026/
├── backend/          # API REST + Prisma
│   ├── prisma/       # schema y migraciones
│   ├── src/
│   │   ├── routes/   # inbox, process
│   │   └── services/ # markdownService
│   └── knowledge/    # salida Markdown
├── frontend/         # React (Vite)
│   └── src/
│       ├── components/
│       ├── pages/
│       └── api/      # cliente HTTP
└── README.md
```

## Cómo ejecutar

### Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev
```

API en `http://localhost:3001`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App en `http://localhost:5173` (el proxy reenvía `/api` al backend).

## Criterios Kelea

- Inbox unificado: un solo punto de entrada para notas, enlaces, etc.
- Identificación de tipo por heurísticas en backend.
- Procesado posterior: acción "Procesar" que genera Markdown en `knowledge/`.
- Almacenamiento abierto: conocimiento en Markdown; BD para estado y metadatos.

## Licencia

Véase [LICENSE](LICENSE).
