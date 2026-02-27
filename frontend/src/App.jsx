import { useState, useMemo, useCallback } from "react";
import MobileFrame from "./components/Layout/MobileFrame";
import Header from "./components/Inbox/Header";
import Sidebar from "./components/Inbox/Sidebar";
import FilterBottomSheet from "./components/Inbox/FilterBottomSheet";
import InboxList from "./components/Inbox/InboxList";
import FooterCapture from "./components/Inbox/FooterCapture";
import ProcessScreen from "./components/Process/ProcessScreen";
import { MOCK_INBOX_ITEMS } from "./data/mockInbox";

function filterByType(items, typeFilter) {
  if (typeFilter === "all") return items;
  const typeMap = { text: "text", links: "link", voice: "voice", files: "file" };
  const type = typeMap[typeFilter];
  return type ? items.filter((i) => i.type === type) : items;
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
  const [items, setItems] = useState(MOCK_INBOX_ITEMS);
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all_dates");

  const filteredItems = useMemo(() => {
    const byType = filterByType(items, typeFilter);
    const byDate = filterByDate(byType, dateFilter);
    return filterBySearch(byDate, searchQuery);
  }, [items, typeFilter, dateFilter, searchQuery]);

  const handleAddItem = useCallback((newItem) => {
    setItems((prev) => [newItem, ...prev]);
  }, []);

  if (view === "process") {
    return (
      <MobileFrame>
        <ProcessScreen onBack={() => setView("inbox")} />
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
          <InboxList items={filteredItems} searchQuery={searchQuery} />
        </main>
        <FooterCapture
          pendingCount={filteredItems.length}
          onProcessClick={() => setView("process")}
          onFileAdd={handleAddItem}
          onImageCapture={handleAddItem}
        />
      </div>
    </MobileFrame>
  );
}
