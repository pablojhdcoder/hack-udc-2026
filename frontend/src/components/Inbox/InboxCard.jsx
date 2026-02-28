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

export default function InboxCard({ item }) {
  const Card = CARD_MAP[item.kind] ?? TextNoteCard;
  return <Card item={item} />;
}
