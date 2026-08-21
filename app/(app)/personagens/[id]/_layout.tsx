import { Slot } from 'expo-router';
import { useTheme } from '@/theme';
import { View } from 'react-native';

/**
 * Casca das abas da ficha.
 *
 * Cada aba renderiza a própria tela completa (com cabeçalho e barra de abas),
 * de modo que a rolagem de cada uma é independente — importante no celular,
 * onde a lista de perícias é longa e não deve arrastar o cabeçalho junto.
 */
export default function CharacterSheetLayout() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Slot />
    </View>
  );
}
