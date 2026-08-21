import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/ui';
import { fontFamily, fontSize, hitSize, spacing, stroke, useResponsive, useTheme } from '@/theme';

/**
 * Navegação principal.
 *
 * Três destinos apenas — bem abaixo do limite de cinco que uma barra inferior
 * comporta sem virar adivinhação. Cada um tem ícone **e** rótulo: ícone sozinho
 * obriga o usuário a decorar o que cada símbolo significa.
 *
 * A altura da barra soma o inset inferior do aparelho. Sem isso, os botões
 * ficam sob a barra de gestos do Android e viram alvos impossíveis de acertar.
 */
const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'personagens', title: 'Personagens', icon: 'personagens' },
  { name: 'campanhas', title: 'Campanhas', icon: 'campanhas' },
  { name: 'perfil', title: 'Perfil', icon: 'perfil' },
];

/**
 * As três medidas que decidem a altura da barra.
 *
 * O botão não é montado por nós: o React Navigation empilha 5px de folga, um
 * berço fixo de 28px para o ícone, o rótulo e outros 5px de folga. A barra tem
 * altura fixa e **recorta** o que passar dela, então uma conta curta aqui não
 * aparece como aperto — aparece como o pé do rótulo cortado na borda de baixo.
 *
 * `LINHA_ROTULO` também vai no estilo do rótulo, e não só nesta soma: sem
 * `lineHeight` declarado, a altura da linha muda com a fonte do sistema e a
 * conta volta a estourar em quem usa corpo de texto grande.
 */
const FOLGA_BOTAO = 5 * 2;
const BERCO_ICONE = 28;
const LINHA_ROTULO = 16;

export default function TabsLayout() {
  const { colors } = useTheme();

  const insets = useSafeAreaInsets();
  const { width, height } = useResponsive();

  // Mesma regra que o React Navigation usa para decidir onde o rótulo fica: de
  // 768px para cima, e no celular deitado, ele vai ao lado do ícone em vez de
  // embaixo — e aí a linha do rótulo deixa de somar altura.
  const rotuloAoLado = width >= 768 || width > height;

  const alturaBotao = Math.max(
    hitSize.min,
    FOLGA_BOTAO + BERCO_ICONE + (rotuloAoLado ? 0 : LINHA_ROTULO)
  );
  const barHeight = alturaBotao + spacing.space2 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.accent,
          borderTopWidth: stroke.hairline,
          height: barHeight,
          paddingTop: spacing.space1,
          paddingBottom: insets.bottom + spacing.space1,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.uiStrong,
          fontWeight: '700',
          fontSize: fontSize.xs,
          lineHeight: LINHA_ROTULO,
          letterSpacing: 0.4,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color }) => <Icon name={tab.icon} size={24} color={String(color)} />,
            tabBarAccessibilityLabel: tab.title,
          }}
        />
      ))}
    </Tabs>
  );
}
