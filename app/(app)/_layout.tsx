import { View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { TurnAlertOverlay } from '@/components/combat';
import { ShowcaseOverlay } from '@/components/showcase';
import { VitalsOverlay } from '@/components/vitals';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

/**
 * Altura que a barra de ferramentas do tabuleiro toma do rodapé, com folga para
 * a segunda linha em que ela quebra nas telas estreitas e para a faixa da peça
 * selecionada, que abre abaixo dela.
 */
const ESPACO_DA_BARRA_DO_TABULEIRO = 168;

/** Área logada. Sem sessão válida, ninguém passa daqui. */
export default function AppLayout() {
  const { colors } = useTheme();

  const status = useAuthStore((state) => state.status);

  // As telas viradas para a mesa não têm pastilha: ali é o grupo inteiro
  // olhando um mapa ou um cartaz, e o PV de quem por acaso está logado naquele
  // aparelho não é assunto de todo mundo — nem serve para nada projetado na
  // parede, onde ele só cobre um pedaço da cena.
  //
  // O tabuleiro é diferente, e por isso saiu desta lista: quem está nele é o
  // jogador movendo a própria peça, e é lá que ele leva o dano. Sem a pastilha,
  // conferir o PV — ou abrir a ficha — custava sair do mapa e voltar.
  //
  // Ele entra com uma condição: o rodapé é ocupado pela barra de ferramentas,
  // que no celular quebra em mais de uma linha, e a pastilha nasce justamente
  // naquele canto. A folga abaixo a mantém acima dos botões; dali o jogador
  // arrasta para onde quiser, e o lugar fica guardado.
  const rota = usePathname();
  const naTelaDaMesa = rota.endsWith('/tabuleiro-tv') || rota.endsWith('/palco');
  const noTabuleiro = rota.endsWith('/tabuleiro');

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
      {!naTelaDaMesa && <VitalsOverlay folgaDoRodape={noTabuleiro ? ESPACO_DA_BARRA_DO_TABULEIRO : undefined} />}
    </View>
  );
}
