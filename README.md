<p align="center">
  <img src="icon.svg" alt="Digital Brain logo" width="120" />
</p>

# 🧠 Digital Brain — Kelea HackUDC 2026

Sistema de documentación personal: captura rápida en un **inbox único** y procesado posterior a conocimiento en Markdown.

## 🛠️ Stack

| Capa | Tecnologías |
|---|---|
| 🖥️ Backend | Node.js · Express · Prisma · SQLite |
| 🎨 Frontend | React · Vite · Tailwind CSS |
| 🤖 IA | Azure OpenAI (GPT-4o · Whisper) |
| 📚 Knowledge | Markdown en `backend/knowledge/` (compatible con Obsidian) |

## 📁 Estructura

```
hack-udc-2026/
├── backend/          # API REST + Prisma
│   ├── prisma/       # esquema y migraciones
│   ├── src/
│   │   ├── routes/   # inbox, process, knowledge, search
│   │   └── services/ # aiService, markdownService…
│   └── knowledge/    # Salida Markdown
└── frontend/         # React (Vite)
    └── src/
        ├── components/
        └── api/      # cliente HTTP
```

## 🚀 Cómo ejecutar

### ⭐ Opción 1 — Todo desde la raíz (recomendado)

```bash
npm run setup && npm run dev
```
Instala dependencias, inicializa la BD y arranca backend + frontend con hot reload.

### Opción 2 — Por separado

**🖥️ Backend**

```bash
cd backend
cp .env.example .env
npm install
npm run db:push
npm run dev
```

**🎨 Frontend** (en otra terminal)

```bash
cd frontend
npm install
npm run dev
```

> Asegúrate de que `frontend/.env` tenga `VITE_USE_MOCK=false` para usar el backend real.

## 🧪 Probar la integración

1. Abre **http://localhost:5173** en el navegador.
2. **Añadir nota o enlace:** escribe en la barra de abajo (texto o URL) y pulsa Enviar.
3. **Añadir archivo:** clic en el clip → "Subir archivo" y elige un PDF, imagen, etc.
4. **Procesar:** pulsa "Procesar X notas" → elige carpeta de destino → marca ítems → "Procesar seleccionado(s)". Se generan `.md` en `backend/knowledge/<destino>/`.
5. **Filtros:** usa el icono de filtro para filtrar por tipo (texto, enlaces, voz, archivos) o por fecha.

## ✅ Criterios Kelea

- Inbox unificado: un solo punto de entrada para notas, enlaces, archivos y voz.
- Identificación de tipo por heurísticas en backend.
- Procesado posterior: acción "Procesar" que genera Markdown en `knowledge/`.
- Almacenamiento abierto: conocimiento en Markdown; BD para estado y metadatos.

## ⚙️ Configuración

- **Backend:** copia `backend/.env.example` a `backend/.env` y rellena `DATABASE_URL`, `PORT`, y opcionalmente `AZURE_OPENAI_*` y `GEMINI_API_KEY` (ver [CONTRIBUTING.md](CONTRIBUTING.md#variables-de-entorno)).
- **Frontend:** en `frontend/.env` usa `VITE_USE_MOCK=false` para conectar con el backend real.

## 🔧 Troubleshooting

| Problema | Solución |
|----------|----------|
| El chat no responde / ECONNREFUSED | Asegúrate de tener el **backend** en marcha (`cd backend && npm run dev`). El frontend hace proxy a `localhost:3001`. |
| Error "Cannot find package 'X'" | En la carpeta correspondiente (`backend` o `frontend`): `npm install`. |
| Prisma: "column X does not exist" | En `backend`: `npx prisma db push` para sincronizar el esquema con la BD. |
| IA o chat "no configurado" | Revisa que `backend/.env` tenga las variables correctas. Al arrancar el backend se muestra en consola si Azure y Gemini están activos. |

## 📬 Soporte y comunidad

- **Bugs y mejoras:** [Issues de GitHub](https://github.com/pablojhdcoder/hack-udc-2026/issues) (usa las plantillas de bug o feature request).
- **Contribuir:** [CONTRIBUTING.md](CONTRIBUTING.md) — entorno de desarrollo, convenciones y PRs.
- **Conducta:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- **Seguridad:** [SECURITY.md](SECURITY.md) — cómo reportar vulnerabilidades.

## 📄 Licencia y documentación Open Source

- 📜 **Licencia:** [MIT](LICENSE) — texto completo en [LICENSES/MIT.txt](LICENSES/MIT.txt) (REUSE).
- 📋 **Changelog:** [CHANGELOG.md](CHANGELOG.md).
- 🤝 **Contribuciones:** [CONTRIBUTING.md](CONTRIBUTING.md).
