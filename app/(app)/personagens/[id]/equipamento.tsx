import { useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/character/SheetScreen';
import { EquipmentContent } from '@/components/character/tabs/EquipmentTab';

export default function EquipmentScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <EquipmentContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}
