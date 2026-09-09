import { useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/character/SheetScreen';
import { SpellsContent } from '@/components/character/tabs/SpellsTab';

export default function SpellsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <SpellsContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}
