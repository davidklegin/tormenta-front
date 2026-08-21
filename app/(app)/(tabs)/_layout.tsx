import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/ui';
import { fontFamily, fontSize, spacing, stroke, useResponsive, useTheme } from '@/theme';

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

export default function TabsLayout() {
  const { colors } = useTheme();

  const insets = useSafeAreaInsets();
  const { isPhone } = useResponsive();

  const barHeight = (isPhone ? 60 : 56) + insets.bottom;

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
          paddingTop: spacing.space2,
          paddingBottom: insets.bottom + spacing.space1,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.uiStrong,
          fontWeight: '700',
          fontSize: fontSize.xs,
          letterSpacing: 0.4,
        },
        tabBarItemStyle: { paddingVertical: 0 },
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
