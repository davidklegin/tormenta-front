import { useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/character/SheetScreen';
import { CombatContent } from '@/components/character/tabs/CombatTab';

export default function CharacterOverviewScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <CombatContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}
