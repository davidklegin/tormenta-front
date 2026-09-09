import { useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/character/SheetScreen';
import { NotesContent } from '@/components/character/tabs/NotesTab';

export default function CharacterNotesScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <NotesContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}
