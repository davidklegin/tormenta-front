import { useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/character/SheetScreen';
import { BackgroundContent } from '@/components/character/tabs/BackgroundTab';

export default function BackgroundScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <BackgroundContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}
