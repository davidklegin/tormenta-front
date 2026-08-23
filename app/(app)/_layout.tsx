import { View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { ShowcaseOverlay } from '@/components/showcase';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

/** Área logada. Sem sessão válida, ninguém passa daqui. */
export default function AppLayout() {
  const { colors } = useTheme();

  const status = useAuthStore((state) => state.status);

  if (status !== 'authenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    // O overlay é irmão da pilha, e não filho de uma tela: o "Exibir aos
    // outros" alcança quem está na ficha, no painel do mestre ou no perfil, e
    // o painel que ele abre não pode depender de qual rota está montada.
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />

      <ShowcaseOverlay />
    </View>
  );
}
