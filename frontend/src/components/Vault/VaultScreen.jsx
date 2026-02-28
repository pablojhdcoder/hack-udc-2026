import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, FileText, Link2, File, Mic, Video, Loader2, ChevronRight, FolderOpen, RefreshCw } from "lucide-react";
import {
  getVaultFolders,
  getProcessedRecent,
  getInboxByKind,
  getKnowledgeFolder,
  getKnowledgeFile,
  KNOWLEDGE_FOLDERS,
} from "../../api/client";

const ICON_BY_KIND = {
  note: FileText,
  link: Link2,
  file: File,
  audio: Mic,
  video: Video,
};

const KIND_LABEL = {
  note: "Notas",
  link: "Enlaces",
  file: "Archivos",
  audio: "Audio",
  video: "Video",
};

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (d >= today) return "Hoy";
  if (d >= yesterday) return "Ayer";
  if (now - d < 7 * 24 * 60 * 60 * 1000) return "Esta semana";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function basename(path) {
  return path.split("/").pop() || path;
}

function MarkdownViewer({ content }) {
  const lines = content.split("\n");
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mt-4 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-5 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-2 mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(<li key={i} className="ml-4 text-zinc-700 dark:text-zinc-300 text-sm list-disc">{line.slice(2)}</li>);
    } else if (line.startsWith("```")) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 text-xs text-zinc-700 dark:text-zinc-300 overflow-x-auto my-2 font-mono">
          {codeLines.join("\n")}
        </pre>
      );
    } else if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(<p key={i} className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">{line.slice(2, -2)}</p>);
    } else if (line.trim() === "---" || line.trim() === "===") {
      elements.push(<hr key={i} className="border-zinc-200 dark:border-zinc-700 my-3" />);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={j}>{part.slice(2, -2)}</strong>
          : part
      );
      elements.push(<p key={i} className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">{parts}</p>);
    }
    i++;
  }
  return <div className="space-y-0.5">{elements}</div>;
}

export default function VaultScreen({ onBack }) {
  const [folders, setFolders] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedKind, setSelectedKind] = useState(null);
  const [itemsByKind, setItemsByKind] = useState([]);
  const [loadingKind, setLoadingKind] = useState(false);
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [knowledgeData, setKnowledgeData] = useState(null);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [openFile, setOpenFile] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [foldersRes, recentRes] = await Promise.all([
        getVaultFolders(),
        getProcessedRecent(15),
      ]);
      setFolders(Array.isArray(foldersRes.folders) ? foldersRes.folders : []);
      setRecent(Array.isArray(recentRes) ? recentRes : []);
    } catch (err) {
      setError(err?.message ?? "Error al cargar");
      setFolders([]);
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFolderClick = useCallback(async (kind) => {
    setSelectedKind(kind);
    setLoadingKind(true);
    setError(null);
    try {
      const list = await getInboxByKind(kind);
      setItemsByKind(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message ?? "Error al cargar");
      setItemsByKind([]);
    } finally {
      setLoadingKind(false);
    }
  }, []);

  const handleKnowledgeFolderClick = useCallback(async (path) => {
    setKnowledgePath(path);
    setOpenFile(null);
    setLoadingKnowledge(true);
    setError(null);
    try {
      const data = await getKnowledgeFolder(path);
      setKnowledgeData(data);
    } catch (err) {
      setError(err?.message ?? "Error al cargar");
      setKnowledgeData(null);
    } finally {
      setLoadingKnowledge(false);
    }
  }, []);

  const openMarkdown = useCallback(async (filePath) => {
    setFileLoading(true);
    setError(null);
    try {
      const content = await getKnowledgeFile(filePath);
      setOpenFile({ path: filePath, content });
    } catch (err) {
      setError(err?.message ?? "Error al cargar el archivo");
    } finally {
      setFileLoading(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    if (openFile) {
      setOpenFile(null);
      return;
    }
    onBack();
  }, [openFile, onBack]);

  const selectedLabel = selectedKind ? (KIND_LABEL[selectedKind] || selectedKind) : null;

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      <header className="shrink-0 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-zinc-900 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleBack}
          className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Volver"
        >
          <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate px-2">
          {openFile ? basename(openFile.path).replace(/\.md$/, "") : "Tu Cerebro"}
        </h1>
        {!openFile && (
          <button
            type="button"
            onClick={() => load()}
            className="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Recargar"
          >
            <RefreshCw className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
          </button>
        )}
        {openFile && <div className="w-10" />}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 space-y-6 scrollbar-hide">
        {error && (
          <div className="rounded-xl bg-red-500/15 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {openFile ? (
          <div className="pb-6">
            <MarkdownViewer content={openFile.content} />
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
            <p className="text-zinc-500 text-sm">Cargando carpetas…</p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                Carpetas
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {folders.map((f) => {
                  const Icon = ICON_BY_KIND[f.kind] ?? FileText;
                  const label = f.name || KIND_LABEL[f.kind] || f.kind;
                  return (
                    <button
                      key={f.kind}
                      type="button"
                      onClick={() => handleFolderClick(f.kind)}
                      className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-zinc-800/80 dark:border-zinc-700/50 dark:hover:bg-zinc-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-brand-500/10 dark:bg-zinc-700 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-brand-500 dark:text-zinc-300" />
                        </div>
                        <span className="text-zinc-900 dark:text-zinc-100 font-medium">{label}</span>
                      </div>
                      <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm tabular-nums">
                        {f.count} {f.count === 1 ? "ítem" : "ítems"}
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                Carpetas de conocimiento
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-2">
                Aquí aparecen los ítems que proceses y guardes en cada carpeta. Pulsa en un archivo para leerlo.
              </p>
              <div className="grid grid-cols-1 gap-2">
                {KNOWLEDGE_FOLDERS.map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => handleKnowledgeFolderClick(path)}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-zinc-800/80 dark:border-zinc-700/50 dark:hover:bg-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-500/10 dark:bg-zinc-700 flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-brand-500 dark:text-zinc-300" />
                      </div>
                      <span className="text-zinc-900 dark:text-zinc-100 font-medium text-sm">{path}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                ))}
              </div>
            </section>

            {knowledgePath && knowledgeData && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider">
                    {knowledgePath}
                  </h2>
                  <button
                    type="button"
                    onClick={() => { setKnowledgePath(null); setKnowledgeData(null); }}
                    className="text-brand-500 dark:text-brand-400 text-sm font-medium"
                  >
                    Cerrar
                  </button>
                </div>
                {knowledgeData.files?.length === 0 && !knowledgeData.folders?.length ? (
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm py-4">Aún no hay nada. Procesa ítems y elige esta carpeta como destino.</p>
                ) : (
                  <ul className="space-y-2">
                    {(knowledgeData.files || []).map((filePath) => {
                      const name = basename(filePath).replace(/\.md$/, "") || filePath;
                      return (
                        <li key={filePath}>
                          <button
                            type="button"
                            onClick={() => openMarkdown(filePath)}
                            disabled={fileLoading}
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-zinc-800/60 dark:border-zinc-700/50 dark:hover:bg-zinc-800/80 disabled:opacity-50"
                          >
                            <FileText className="w-5 h-5 text-brand-500 dark:text-zinc-400 flex-shrink-0" />
                            <span className="text-zinc-800 dark:text-zinc-200 text-sm font-medium truncate flex-1">{name}</span>
                            <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {selectedKind && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider">
                    {selectedLabel}
                  </h2>
                  <button
                    type="button"
                    onClick={() => { setSelectedKind(null); setItemsByKind([]); }}
                    className="text-brand-500 dark:text-brand-400 text-sm font-medium"
                  >
                    Cerrar
                  </button>
                </div>
                {loadingKind ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                  </div>
                ) : itemsByKind.length === 0 ? (
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm py-4">No hay ítems en esta carpeta.</p>
                ) : (
                  <ul className="space-y-2">
                    {itemsByKind.map((item) => {
                      const Icon = ICON_BY_KIND[item.kind] ?? FileText;
                      return (
                        <li key={`${item.kind}-${item.id}`}>
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200 dark:bg-zinc-800/60 dark:border-zinc-700/50">
                            <div className="w-9 h-9 rounded-lg bg-brand-500/10 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-brand-500 dark:text-zinc-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-zinc-800 dark:text-zinc-200 text-sm font-medium truncate">
                                {item.title || "Sin título"}
                              </p>
                              <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                                {item.inboxStatus === "processed" ? item.processedPath : "Pendiente"} · {formatDate(item.createdAt)}
                              </p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            <section>
              <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                Procesados recientes
              </h2>
              {recent.length === 0 ? (
                <p className="text-zinc-500 dark:text-zinc-400 text-sm py-4">Aún no hay ítems procesados.</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((item) => {
                    const Icon = ICON_BY_KIND[item.kind] ?? FileText;
                    return (
                      <li key={`${item.kind}-${item.id}`}>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200 dark:bg-zinc-800/60 dark:border-zinc-700/50">
                          <div className="w-9 h-9 rounded-lg bg-brand-500/10 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-brand-500 dark:text-zinc-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-zinc-800 dark:text-zinc-200 text-sm font-medium truncate">
                              {item.title || "Sin título"}
                            </p>
                            <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                              {item.processedPath || formatDate(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
