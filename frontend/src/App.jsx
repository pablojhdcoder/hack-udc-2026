import { useState, useMemo, useCallback, useEffect } from "react";
import MobileFrame from "./components/Layout/MobileFrame";
import Header from "./components/Inbox/Header";
import Sidebar from "./components/Inbox/Sidebar";
import FilterBottomSheet from "./components/Inbox/FilterBottomSheet";
import InboxList from "./components/Inbox/InboxList";
import FooterCapture from "./components/Inbox/FooterCapture";
import ProcessScreen from "./components/Process/ProcessScreen";
import { getInbox, addToInbox } from "./api/client";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

function filterByKind(items, typeFilter) {
  if (typeFilter === "all") return items;
  const kindMap = { text: "note", links: "link", voice: "audio", files: "file" };
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

function filterBySearch(items, query) {
  if (!query.trim()) return items;
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (item.content?.toLowerCase().includes(q)) return true;
    if (item.title?.toLowerCase().includes(q)) return true;
    if (item.url?.toLowerCase().includes(q)) return true;
    if (item.filename?.toLowerCase().includes(q)) return true;
    return false;
  });
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState("inbox");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(!USE_MOCK);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all_dates");

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
    if (view === "inbox") loadInbox();
  }, [view, loadInbox]);

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
    const byDate = filterByDate(byKind, dateFilter);
    return filterBySearch(byDate, searchQuery);
  }, [items, typeFilter, dateFilter, searchQuery]);

  if (view === "process") {
    return (
      <MobileFrame>
        <ProcessScreen
          onBack={() => setView("inbox")}
          onProcessDone={loadInbox}
        />
      </MobileFrame>
    );
  }

  return (
    <MobileFrame>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <FilterBottomSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        activeTypeFilter={typeFilter}
        activeDateFilter={dateFilter}
        onTypeFilter={setTypeFilter}
        onDateFilter={setDateFilter}
      />

      <div className="flex flex-col min-h-screen">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onFilterClick={() => setFilterSheetOpen(true)}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          isSearchOpen={searchOpen}
          onSearchOpenChange={setSearchOpen}
        />
        <main className="flex-1 overflow-y-auto pb-2">
          {error && (
            <div className="mx-4 mt-2 p-3 rounded-lg bg-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
              Cargando inbox…
            </div>
          ) : (
            <InboxList items={filteredItems} searchQuery={searchQuery} />
          )}
        </main>
        <FooterCapture
          pendingCount={filteredItems.length}
          onProcessClick={() => setView("process")}
          onAdd={handleAddToInbox}
        />
      </div>
    </MobileFrame>
  );
}
