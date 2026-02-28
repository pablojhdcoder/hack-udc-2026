import { Trash2 } from "lucide-react";
import TextNoteCard from "./cards/TextNoteCard";
import LinkCard from "./cards/LinkCard";
import VoiceNoteCard from "./cards/VoiceNoteCard";
import FileCard from "./cards/FileCard";

const CARD_MAP = {
  note: TextNoteCard,
  link: LinkCard,
  audio: VoiceNoteCard,
  file: FileCard,
  photo: FileCard,
};

export default function InboxCard({ item, onDiscardItem }) {
  const Card = CARD_MAP[item.kind] ?? TextNoteCard;
  if (!onDiscardItem) {
    return <Card item={item} />;
  }
  return (
    <article
      className="rounded-2xl bg-zinc-50 border border-zinc-200 dark:bg-neutral-800/80 dark:border-neutral-700/50 overflow-hidden flex items-stretch gap-0 min-h-[88px]"
      aria-label={`Elemento: ${item.kind}`}
    >
      <div className="flex-1 min-w-0 py-4 pl-4 pr-3">
        <Card item={item} embedded />
      </div>
      {onDiscardItem && (
        <div className="flex items-center pr-3 py-3 flex-shrink-0 border-l border-zinc-200/80 dark:border-neutral-700/80 pl-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDiscardItem(item.kind, item.id);
            }}
            className="p-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-zinc-50 dark:focus:ring-offset-neutral-800 transition-colors"
            aria-label="Eliminar de la bandeja"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </article>
  );
}
