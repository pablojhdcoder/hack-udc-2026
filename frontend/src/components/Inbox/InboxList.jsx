import InboxCard from "./InboxCard";
import EmptyState from "./EmptyState";

export default function InboxList({ items, searchQuery }) {
  if (items.length === 0) {
    return (
      <EmptyState isSearch={Boolean(searchQuery?.trim())} />
    );
  }

  return (
    <div className="px-4 py-3 space-y-3">
      {items.map((item) => (
        <InboxCard key={item.id} item={item} />
      ))}
    </div>
  );
}
