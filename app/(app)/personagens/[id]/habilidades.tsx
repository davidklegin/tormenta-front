import { useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/character/SheetScreen';
import { AbilitiesContent } from '@/components/character/tabs/AbilitiesTab';

export default function ClassAbilitiesScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <AbilitiesContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}
