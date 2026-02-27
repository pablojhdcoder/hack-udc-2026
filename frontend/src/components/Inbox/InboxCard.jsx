import TextNoteCard from "./cards/TextNoteCard";
import LinkCard from "./cards/LinkCard";
import VoiceNoteCard from "./cards/VoiceNoteCard";
import FileCard from "./cards/FileCard";

const CARD_MAP = {
  text: TextNoteCard,
  link: LinkCard,
  voice: VoiceNoteCard,
  file: FileCard,
};

export default function InboxCard({ item }) {
  const Card = CARD_MAP[item.type] ?? TextNoteCard;
  return <Card item={item} />;
}
