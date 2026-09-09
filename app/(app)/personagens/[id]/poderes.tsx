import { useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/character/SheetScreen';
import { PowersContent } from '@/components/character/tabs/PowersTab';

export default function PowersScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <PowersContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}
