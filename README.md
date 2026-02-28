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

### Opción 1: Todo desde la raíz (recomendado)

```bash
npm run setup && npm run dev
```

Se levantan backend (`http://localhost:3001`) y frontend (`http://localhost:5173`) a la vez. El frontend hace proxy de `/api` al backend.

### Opción 2: Por separado

**Backend**

```bash
cd backend
cp .env.example .env   # o usa el .env ya creado
npm install
npx prisma generate
npx prisma db push
npm run dev
```

API en `http://localhost:3001`.

**Frontend** (en otra terminal)

```bash
cd frontend
npm install
npm run dev
```

App en `http://localhost:5173` (el proxy reenvía `/api` al backend).

Asegúrate de que en `frontend/.env` tengas `VITE_USE_MOCK=false` para usar el backend real.

## Probar la integración

1. Abre **http://localhost:5173** en el navegador.
2. **Añadir nota o enlace:** escribe en la barra de abajo (texto o URL) y pulsa Enviar. Debe aparecer en la lista.
3. **Añadir archivo:** clic en el clip → "Subir archivo" y elige un PDF, imagen, etc. Debe crearse un ítem en el inbox.
4. **Procesar:** pulsa "Procesar X notas" → elige carpeta de destino (ej. `estudio/SI`) → marca ítems → "Procesar seleccionado(s)". Los ítems pasan a procesados y se generan `.md` en `backend/knowledge/<destino>/`.
5. **Filtros:** usa el icono de filtro para filtrar por tipo (texto, enlaces, voz, archivos) o por fecha.

## Criterios Kelea

- Inbox unificado: un solo punto de entrada para notas, enlaces, etc.
- Identificación de tipo por heurísticas en backend.
- Procesado posterior: acción "Procesar" que genera Markdown en `knowledge/`.
- Almacenamiento abierto: conocimiento en Markdown; BD para estado y metadatos.

## Licencia

Véase [LICENSE](LICENSE).
