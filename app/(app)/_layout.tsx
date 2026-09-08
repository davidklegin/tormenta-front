import { View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { TurnAlertOverlay } from '@/components/combat';
import { ShowcaseOverlay } from '@/components/showcase';
import { VitalsOverlay } from '@/components/vitals';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

/** Área logada. Sem sessão válida, ninguém passa daqui. */
export default function AppLayout() {
  const { colors } = useTheme();

  const status = useAuthStore((state) => state.status);

  // O tabuleiro é a exceção da pastilha. Lá a barra de ferramentas ocupa o
  // rodapé — e, no celular, ela quebra em três linhas —, e a fila de
  // iniciativa já mostra PV e PM de quem está na cena. A pastilha, que é
  // arrastável e nasce justamente naquele canto, só cobria botões.
  //
  // As telas viradas para a mesa saem pelo outro motivo: ali é o grupo inteiro
  // olhando um mapa ou um cartaz, e o PV de quem por acaso está logado naquele
  // aparelho não é assunto de todo mundo — nem serve para nada projetado na
  // parede, onde ele só cobre um pedaço da cena.
  const rota = usePathname();
  const naTelaDaMesa =
    rota.endsWith('/tabuleiro') || rota.endsWith('/tabuleiro-tv') || rota.endsWith('/palco');

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
      {!naTelaDaMesa && <VitalsOverlay />}
    </View>
  );
}
