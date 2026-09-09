import { useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/character/SheetScreen';
import { SkillsContent } from '@/components/character/tabs/SkillsTab';

export default function SkillsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <SkillsContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}
