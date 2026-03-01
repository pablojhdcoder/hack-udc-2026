# Contribuir a Digital Brain

Este documento muestra cómo contribuir correctamente al proyecto.

## Índice

1. [Requisitos previos](#requisitos-previos)
2. [Puesta en marcha del entorno](#puesta-en-marcha-del-entorno)
3. [Variables de entorno](#variables-de-entorno)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [Flujo de datos](#flujo-de-datos)
6. [Convenciones de código](#convenciones-de-código)
7. [Pull Requests](#pull-requests)
8. [Reportar problemas y añadir características](#reportar-problemas-y-añadir-características)
9. [Recursos](#recursos)
---

## Requisitos previos

- Node.js > 20
- npm > 9
- Git

---

## Puesta en marcha del entorno ([volver arriba](#índice))

### Opción 1 — Todo desde la raíz (recomendado)

```bash
git clone https://github.com/pablojhdcoder/hack-udc-2026.git
cd hack-udc-2026
npm run setup   # instala deps de raíz, backend y frontend + genera la BD
npm run dev     # levanta backend (3001) y frontend (5173) en paralelo
```

### Opción 2 — Por separado

**Backend**

```bash
cd backend
cp .env.example .env   # rellena las variables necesarias
npm install
npx prisma generate
npm run db:push        # crea/actualiza el esquema SQLite
npm run dev            # nodemon (hot-reload)
```

API disponible en `http://localhost:3001`.

**Frontend** (en otra terminal)

```bash
cd frontend
npm install
npm run dev
```

App disponible en `http://localhost:5173`. El proxy de Vite reenvía `/api` al backend automáticamente.

### Scripts disponibles en la raíz

| Script | Descripción |
|---|---|
| `npm run setup` | Instala todas las dependencias y empuja el esquema Prisma |
| `npm run dev` | Backend + frontend en paralelo (concurrently) |
| `npm run start` | Backend en producción + frontend en dev |

### Scripts disponibles en `backend/`

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor con hot-reload (nodemon) |
| `npm start` | Servidor sin hot-reload |
| `npm run db:push` | Sincroniza el esquema Prisma con la BD |
| `npm run db:migrate` | Crea una migración con nombre |
| `npm run db:studio` | Abre Prisma Studio en el navegador |

---

## Variables de entorno ([volver arriba](#índice))

### Backend — `backend/.env`

Copia `backend/.env.example` a `backend/.env` y rellena los valores:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Ruta al fichero SQLite (p. ej. `file:./dev.db`) | 
| `PORT` | Puerto del servidor (por defecto `3001`) | 
| `AZURE_OPENAI_ENDPOINT` | URL del recurso Azure OpenAI | 
| `AZURE_OPENAI_API_KEY` | Clave API de Azure |
| `AZURE_OPENAI_DEPLOYMENT` | Nombre del deployment de chat (p. ej. `gpt-4o`) | 
| `AZURE_OPENAI_WHISPER_DEPLOYMENT` | Nombre del deployment de Whisper | 
| `AZURE_OPENAI_API_VERSION` |

> Si no configuras las variables de Azure, el backend funciona igualmente pero sin enriquecimiento IA.

### Frontend — `frontend/.env`

| Variable | Descripción |
|---|---|
| `VITE_USE_MOCK` | `"true"` usa datos mock locales; `"false"` o vacío usa la API real |

---

## Estructura del proyecto ([volver arriba](#índice))

```
hack-udc-2026/
├── package.json                # Scripts raíz (concurrently)
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # Modelos de la BD (SQLite)
│   ├── src/
│   │   ├── index.js            # Punto de entrada Express
│   │   ├── lib/
│   │   │   └── prisma.js       # Singleton de PrismaClient
│   │   ├── middleware/
│   │   │   └── upload.js       # Multer — subida de ficheros
│   │   ├── routes/
│   │   │   ├── inbox.js        # GET/POST /api/inbox, favoritos, novedades…
│   │   │   ├── process.js      # POST /api/process
│   │   │   ├── search.js       # GET /api/search
│   │   │   ├── chat.js         # POST /api/chat — Riki Brain
│   │   │   ├── eventos.js      # GET/POST/DELETE /api/eventos — calendario
│   │   │   └── topics.js       # GET /api/topics — temas y resúmenes
│   │   └── services/
│   │       ├── aiService.js          # GPT-4o + Whisper (Azure OpenAI), Gemini fallback
│   │       ├── chatService.js         # Chat con contexto (Azure Responses API + Gemini)
│   │       ├── classifyService.js    # Heurísticas y análisis de texto/URLs
│   │       ├── fileExtractService.js  # Extracción de texto de PDF/Word/imágenes
│   │       ├── linkPreviewService.js # Firecrawl + Open Graph
│   │       ├── markdownService.js    # Escritura de .md en knowledge/
│   │       ├── processService.js     # Orquestación del pipeline de procesado
│   │       └── searchService.js      # Búsqueda en el baúl
│   ├── knowledge/              # Salida Markdown (notas/, enlaces/, archivos/, etc.)
│   ├── uploads/                # Ficheros subidos — NO subir a Git
│   ├── .env.example
│   └── .env                    # No subir a Git
└── frontend/
    ├── index.html
    ├── vite.config.js          # Proxy /api → http://localhost:3001
    └── src/
        ├── App.jsx, main.jsx, index.css
        ├── api/
        │   └── client.js       # Cliente HTTP hacia /api
        ├── components/
        │   ├── Inbox/          # Pantalla principal de captura
        │   │   ├── InboxCard.jsx, InboxList.jsx
        │   │   ├── FooterCapture.jsx, FilterBottomSheet.jsx
        │   │   ├── Header.jsx, Sidebar.jsx, EmptyState.jsx
        │   │   └── cards/      # FileCard, LinkCard, TextNoteCard, VoiceNoteCard
        │   ├── Process/        # ProcessScreen — flujo de aprobación y procesado
        │   ├── Vault/          # VaultScreen, ItemDetailPanel, FileSearchList
        │   ├── Calendario/     # CalendarioView
        │   ├── Temas/          # TemasView
        │   ├── Settings/       # SettingsScreen, CentroAyudaView, LanguageBottomSheet
        │   ├── Layout/         # MobileFrame
        │   └── shared/        # FilePreview
        ├── context/            # LanguageContext
        ├── i18n/               # translations.js
        ├── data/               # mockInbox.js
        ├── lib/, utils/
```

---

## Convenciones de código ([volver arriba](#índice))

### Backend

- **ES Modules**: usa `import`/`export`, nunca `require`.
- **Async/await** sobre callbacks o `.then()`.
- Prefijos de log: `[NombreServicio]` para facilitar el filtrado (`[aiService]`, `[processService]`…).
- Elimina todos los `console.log` de debug antes de abrir un PR.

### Frontend

- **React funcional con hooks**. Sin componentes de clase.
- **Tailwind CSS** para estilos. No añadir CSS custom salvo en `index.css`.
- Iconos de **Lucide React** (`lucide-react`).

---

## Pull Requests ([volver arriba](#índice))

1. **Sincroniza y crea una rama** desde `main`:
   ```bash
   git checkout main && git pull origin main
   git checkout -b feat/mi-feature
   ```

2. **Commits atómicos** con prefijo convencional (`feat:`, `fix:`, `refactor:`…).

3. **Abre el PR** contra `main` describiendo qué cambia, por qué y cómo probarlo.

4. **Resuelve el feedback** con commits adicionales. No hagas force-push salvo rebase explícito.

---

## Reportar problemas y añadir características ([volver arriba](#índice))

- 🐛 **[Reportar un bug](https://github.com/pablojhdcoder/hack-udc-2026/issues/new?template=bug_report.md)** — algo no funciona como debería
- ✨ **[Proponer una funcionalidad](https://github.com/pablojhdcoder/hack-udc-2026/issues/new?template=feature_request.md)** — idea o mejora nueva

> Incluye siempre la versión de Node.js (`node -v`), el sistema operativo y los logs relevantes (sin credenciales).

---

## Recursos y referencias ([volver arriba](#índice))

### Stack del proyecto

- Node.js (ESM): https://nodejs.org/api/esm.html
- Express 4: https://expressjs.com/en/4x/api.html
- Prisma ORM: https://www.prisma.io/docs
- SQLite: https://www.sqlite.org/docs.html
- React 18: https://react.dev
- Vite: https://vitejs.dev/guide/
- Tailwind CSS: https://tailwindcss.com/docs
- Lucide Icons: https://lucide.dev/icons/

### Azure OpenAI

- Referencia de la API REST: https://learn.microsoft.com/azure/ai-services/openai/reference
- Azure AI Foundry: https://ai.azure.com
- Modelos GPT-4o: https://learn.microsoft.com/azure/ai-services/openai/concepts/models
- Whisper (transcripción): https://learn.microsoft.com/azure/ai-services/openai/whisper-quickstart
