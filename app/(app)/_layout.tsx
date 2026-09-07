import { View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { TurnAlertOverlay } from '@/components/combat';
import { ShowcaseOverlay } from '@/components/showcase';
import { VitalsOverlay } from '@/components/vitals';
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

      {/* "É a sua vez": chega pelo canal pessoal e precisa alcançar o jogador
          em qualquer tela — na ficha, no grimório, no perfil. Por isso mora
          aqui, e não na tela do combate, que é justamente a que ele não está
          olhando quando a vez chega. */}
      <TurnAlertOverlay />

      {/* Vida e mana à vista em qualquer tela. Mora aqui pelo mesmo motivo do
          alerta da vez: o jogador precisa do número no grimório e nas
          anotações, não só na aba Combate — e o painel que a pastilha abre não
          pode depender de qual rota está montada. */}
      <VitalsOverlay />
    </View>
  );
}
