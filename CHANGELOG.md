# Changelog

Todos los cambios notables de este proyecto se documentan en este fichero.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), y el proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/) cuando aplica.

## [Unreleased]

### Añadido
- Chat Ricky Brain (Cerebrito) con contexto RAG desde la bóveda (Gemini).
- Enriquecimiento con Azure OpenAI y fallback a Gemini.
- Soporte multimodal (imágenes, audio) en el procesado.

### Cambiado
- Arquitectura híbrida: Azure para procesado, Gemini para chat.

---

## [0.1.0] - 2026-03-01

### Añadido
- Inbox unificado: notas, enlaces, archivos, voz.
- Procesado a Markdown en `backend/knowledge/`.
- Búsqueda en la bóveda.
- Favoritos, novedades, filtros por tipo y fecha.
- Integración con Azure OpenAI (GPT-4o, Whisper) para enriquecimiento.
- Frontend React + Vite + Tailwind; diseño responsive.

[Unreleased]: https://github.com/pablojhdcoder/hack-udc-2026/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pablojhdcoder/hack-udc-2026/releases/tag/v0.1.0
