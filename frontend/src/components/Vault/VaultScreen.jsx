import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, FolderOpen, FileText, ChevronRight, RefreshCw, Folder } from "lucide-react";

const API_BASE = "/api";

async function fetchFolder(path = "") {
  const url = path ? `${API_BASE}/knowledge?path=${encodeURIComponent(path)}` : `${API_BASE}/knowledge`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchFile(path) {
  const res = await fetch(`${API_BASE}/knowledge/${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.text();
}

function basename(path) {
  return path.split("/").pop();
}

function MarkdownViewer({ content }) {
  // Render simple markdown: headings, bold, lists, code, paragraphs
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
      const lang = line.slice(3);
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
      // Inline bold
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
  const [currentPath, setCurrentPath] = useState("");
  const [pathStack, setPathStack] = useState([]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openFile, setOpenFile] = useState(null); // { path, content }
  const [fileLoading, setFileLoading] = useState(false);

  const loadFolder = useCallback(async (path) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFolder(path);
      setFolders(data.folders ?? []);
      setFiles(data.files ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolder(currentPath);
  }, [currentPath, loadFolder]);

  function navigateInto(folderPath) {
    setPathStack((s) => [...s, currentPath]);
    setCurrentPath(folderPath);
    setOpenFile(null);
  }

  function navigateBack() {
    if (openFile) { setOpenFile(null); return; }
    if (pathStack.length > 0) {
      const prev = pathStack[pathStack.length - 1];
      setPathStack((s) => s.slice(0, -1));
      setCurrentPath(prev);
    } else {
      onBack();
    }
  }

  async function openMarkdown(filePath) {
    setFileLoading(true);
    setError(null);
    try {
      const content = await fetchFile(filePath);
      setOpenFile({ path: filePath, content });
    } catch (e) {
      setError(e.message);
    } finally {
      setFileLoading(false);
    }
  }

  const isRoot = pathStack.length === 0 && !openFile;
  const isEmpty = !loading && folders.length === 0 && files.length === 0 && !openFile;

  const headerTitle = openFile
    ? basename(openFile.path).replace(/\.md$/, "")
    : currentPath
      ? basename(currentPath)
      : "Tu Cerebro";

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      <header className="shrink-0 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-zinc-900 dark:border-zinc-800">
        <button
          type="button"
          onClick={navigateBack}
          className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Volver"
        >
          <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate px-2">
          {headerTitle}
        </h1>
        <button
          type="button"
          onClick={() => loadFolder(currentPath)}
          className="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Recargar"
        >
          <RefreshCw className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
        </button>
      </header>

      {/* Breadcrumb */}
      {(pathStack.length > 0 || currentPath) && !openFile && (
        <div className="shrink-0 flex items-center gap-1 px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto">
          <button onClick={() => { setPathStack([]); setCurrentPath(""); }} className="hover:text-brand-500">raíz</button>
          {pathStack.filter(Boolean).map((p, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              <button
                onClick={() => {
                  setPathStack((s) => s.slice(0, i + 1));
                  setCurrentPath(p);
                }}
                className="hover:text-brand-500"
              >
                {basename(p)}
              </button>
            </span>
          ))}
          {currentPath && (
            <span className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">{basename(currentPath)}</span>
            </span>
          )}
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {/* File viewer */}
        {openFile && (
          <div className="px-4 py-5">
            <MarkdownViewer content={openFile.content} />
          </div>
        )}

        {/* Folder listing */}
        {!openFile && (
          <div className="px-4 py-5 space-y-6">
            {loading && (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {isEmpty && (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-600">
                <FolderOpen className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm">Esta carpeta está vacía</p>
                <p className="text-xs mt-1">Procesa ítems del inbox para ver archivos aquí</p>
              </div>
            )}

            {!loading && folders.length > 0 && (
              <section>
                <h2 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3">Carpetas</h2>
                <div className="grid grid-cols-1 gap-2">
                  {folders.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => navigateInto(f)}
                      className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-zinc-800/80 dark:border-zinc-700/50 dark:hover:bg-zinc-800 active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand-500/10 dark:bg-zinc-700 flex items-center justify-center">
                          <Folder className="w-5 h-5 text-brand-500 dark:text-zinc-400" />
                        </div>
                        <span className="text-zinc-900 dark:text-zinc-100 font-medium">{basename(f)}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {!loading && files.length > 0 && (
              <section>
                <h2 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3">Archivos</h2>
                <ul className="space-y-2">
                  {files.map((f) => (
                    <li key={f}>
                      <button
                        type="button"
                        onClick={() => openMarkdown(f)}
                        disabled={fileLoading}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-zinc-800/60 dark:border-zinc-700/50 dark:hover:bg-zinc-800/80 active:scale-[0.98] disabled:opacity-50"
                      >
                        <FileText className="w-5 h-5 text-brand-500 dark:text-zinc-500 flex-shrink-0" />
                        <span className="flex-1 min-w-0 text-zinc-800 dark:text-zinc-200 text-sm font-medium truncate">
                          {basename(f).replace(/\.md$/, "")}
                        </span>
                        <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
