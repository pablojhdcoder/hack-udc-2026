import { useState, useMemo, useCallback, useEffect } from "react";
import { Brain, Send, X, Loader2 } from "lucide-react";
import MobileFrame from "./components/Layout/MobileFrame";
import Header from "./components/Inbox/Header";
import Sidebar from "./components/Inbox/Sidebar";
import FilterBottomSheet from "./components/Inbox/FilterBottomSheet";
import InboxList from "./components/Inbox/InboxList";
import FooterCapture from "./components/Inbox/FooterCapture";
import ProcessScreen from "./components/Process/ProcessScreen";
import VaultScreen from "./components/Vault/VaultScreen";
import CalendarioView from "./components/Calendario/CalendarioView";
import SettingsScreen from "./components/Settings/SettingsScreen";
import CentroAyudaView from "./components/Settings/CentroAyudaView";
import { getInbox, addToInbox } from "./api/client";
import { useAppLanguage } from "./context/LanguageContext";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

function filterByKind(items, typeFilter) {
  if (typeFilter === "all") return items;
  const kindMap = { text: "note", links: "link", voice: "audio", files: "file", video: "video" };
  const kind = kindMap[typeFilter];
  return kind ? items.filter((i) => i.kind === kind) : items;
}

function filterByDate(items, dateFilter) {
  if (dateFilter === "all_dates") return items;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

  return items.filter((item) => {
    const d = new Date(item.createdAt);
    switch (dateFilter) {
      case "today":
        return d >= startOfToday && d < endOfToday;
      case "yesterday":
        return d >= startOfYesterday && d < startOfToday;
      case "last_7_days":
        return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "last_30_days":
        return d >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return true;
    }
  });
}

export default function App() {
  const { t } = useAppLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [currentView, setCurrentView] = useState("inbox");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(!USE_MOCK);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all_dates");
  const [vaultInitial, setVaultInitial] = useState({ folder: null, itemId: null });
  const [loadingProcessData, setLoadingProcessData] = useState(false);
  const [processInboxItems, setProcessInboxItems] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("digitalbrain-theme") !== "light";
    } catch {
      return true;
    }
  });

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "ai", content: "__greeting__" }]);
  const [inputMessage, setInputMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const handleSendMessage = useCallback(async () => {
    const text = inputMessage.trim();
    if (!text || chatLoading) return;
    setInputMessage("");
    const userMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setChatLoading(true);
    const messagesWithUser = [...messages, userMessage];
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesWithUser }),
      });
      const data = await res.json().catch(() => ({}));
      const aiContent = data?.message ?? data?.content ?? "No pude generar una respuesta. Intenta de nuevo.";
      setMessages((prev) => [...prev, { role: "ai", content: aiContent }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Error de conexión. Comprueba la red o intenta más tarde." },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [messages, inputMessage, chatLoading]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    try {
      localStorage.setItem("digitalbrain-theme", darkMode ? "dark" : "light");
    } catch {}
  }, [darkMode]);

  const loadInbox = useCallback(async () => {
    if (USE_MOCK) {
      const { items: mockItems } = await getInbox();
      setItems(mockItems ?? []);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { items: data } = await getInbox();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentView === "inbox") loadInbox();
  }, [currentView, loadInbox]);

  const handleAddToInbox = useCallback(async (payload) => {
    try {
      const newItem = await addToInbox(payload);
      setItems((prev) => [newItem, ...prev]);
      return newItem;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const filteredItems = useMemo(() => {
    const byKind = filterByKind(items, typeFilter);
    return filterByDate(byKind, dateFilter);
  }, [items, typeFilter, dateFilter]);

  const handleNavigate = useCallback((view) => {
    setCurrentView(view);
    setSidebarOpen(false);
  }, []);

  if (currentView === "procesando") {
    return (
      <MobileFrame>
        <ProcessScreen
          initialItems={processInboxItems}
          onBack={() => {
            setProcessInboxItems(null);
            setCurrentView("inbox");
          }}
          onProcessDone={loadInbox}
          onOpenVault={(params) => {
            if (params?.kind) setVaultInitial({ folder: params.kind, itemId: params.id ?? null });
            setProcessInboxItems(null);
            setCurrentView("procesado");
          }}
        />
      </MobileFrame>
    );
  }

  if (currentView === "procesado") {
    return (
      <MobileFrame>
        <VaultScreen
          onBack={() => {
            setVaultInitial({ folder: null, itemId: null });
            setCurrentView("inbox");
          }}
          initialFolder={vaultInitial.folder}
          initialItemId={vaultInitial.itemId}
        />
      </MobileFrame>
    );
  }

  if (currentView === "calendario") {
    return (
      <MobileFrame>
        <CalendarioView onBack={() => setCurrentView("inbox")} />
      </MobileFrame>
    );
  }

  if (currentView === "centro-ayuda") {
    return (
      <MobileFrame>
        <CentroAyudaView
          onBack={() => setCurrentView("ajustes")}
          onContactEmail={() => window.open("mailto:soporte@ejemplo.com", "_blank")}
        />
      </MobileFrame>
    );
  }

  if (currentView === "ajustes") {
    return (
      <MobileFrame>
        <SettingsScreen
          onBack={() => setCurrentView("inbox")}
          onHelpCenterClick={() => setCurrentView("centro-ayuda")}
          darkMode={darkMode}
          onDarkModeChange={setDarkMode}
        />
      </MobileFrame>
    );
  }

  return (
    <MobileFrame>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleNavigate} />
      <FilterBottomSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        activeTypeFilter={typeFilter}
        activeDateFilter={dateFilter}
        onTypeFilter={setTypeFilter}
        onDateFilter={setDateFilter}
      />

      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onFilterClick={() => setFilterSheetOpen(true)}
          onChatClick={() => setIsChatOpen(true)}
        />
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4 scrollbar-hide">
          {error && (
            <div className="mx-4 mt-2 p-3 rounded-lg bg-red-500/20 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
          {loading || loadingProcessData ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-600 dark:text-zinc-500 text-sm">
              <Loader2 className="w-8 h-8 text-brand-500 dark:text-zinc-500 animate-spin" />
              <span>{loadingProcessData ? t("home.preparingProcess") : t("home.loadingInbox")}</span>
            </div>
          ) : (
            <InboxList items={filteredItems} />
          )}
        </main>
        <FooterCapture
          pendingCount={filteredItems.length}
          processLoading={loadingProcessData}
          onProcessClick={async () => {
            if (loadingProcessData) return;
            setLoadingProcessData(true);
            try {
              const { items: data } = await getInbox();
              const list = Array.isArray(data) ? data : [];
              setProcessInboxItems(list);
              setCurrentView("procesando");
            } catch {
              setLoadingProcessData(false);
            } finally {
              setLoadingProcessData(false);
            }
          }}
          onAdd={handleAddToInbox}
        />

        {isChatOpen && (
          <div className="absolute inset-0 z-50 bg-neutral-950 flex flex-col">
            <header className="shrink-0 flex justify-between items-center p-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">{t("chat.title")}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                aria-label={t("chat.closeChat")}
              >
                <X className="w-5 h-5" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={
                    msg.role === "user"
                      ? "self-end bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]"
                      : "self-start bg-neutral-800 text-white rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%]"
                  }
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content === "__greeting__" ? t("chat.greeting") : msg.content}</p>
                </div>
              ))}
              {chatLoading && (
                <div className="self-start bg-neutral-800 text-white rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%]">
                  <p className="text-sm text-neutral-400">{t("chat.typing")}</p>
                </div>
              )}
            </div>
            <footer className="shrink-0 p-3 bg-neutral-950 border-t border-neutral-800 flex items-center gap-2">
              <div className="flex-1 flex items-center bg-neutral-900 border border-neutral-800 rounded-full px-4 py-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  placeholder={t("chat.placeholder")}
                  className="w-full bg-transparent text-white outline-none placeholder-neutral-500 py-1 text-sm"
                  aria-label={t("chat.messageLabel")}
                />
              </div>
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={chatLoading || !inputMessage.trim()}
                className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shrink-0 flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none transition-colors"
                aria-label={t("common.send")}
              >
                <Send className="w-5 h-5" />
              </button>
            </footer>
          </div>
        )}
      </div>
    </MobileFrame>
  );
}
