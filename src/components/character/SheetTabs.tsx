import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Icon, Text } from '@/components/ui';
import { SHEET_TABS } from '@/rules';
import {
  easing,
  hitSize,
  nativeDriver,
  radius,
  spacing,
  stroke,
  useMotion,
  useResponsive,
  useTheme,
} from '@/theme';

/** Inclinação do corte das pontas da placa ativa. */
const CORTE = '-10deg';

/**
 * Abas da ficha (briefing §10 a §15).
 *
 * Cada aba é uma rota, o que dá URL própria na web e faz o botão voltar do
 * sistema levar à aba anterior. Ícone e rótulo aparecem juntos: só o ícone
 * obrigaria a decorar o que cada símbolo quer dizer, e esta é a navegação que
 * um jogador novo usa mais.
 *
 * No celular a barra rola na horizontal, com a aba ativa sempre visível.
 *
 * A aba aberta é a placa do tema — faixa rubra com as pontas cortadas na
 * diagonal e filetes de ouro. A placa desliza entre as abas em vez de saltar,
 * o que deixa claro de onde para onde a seleção foi; é `translateX`, então não
 * há recálculo de layout a cada quadro.
 */
export function SheetTabs({ characterId }: { characterId: number }) {
  const pathname = usePathname();
  const { isPhone } = useResponsive();
  const { colors } = useTheme();
  const { reduced, ms } = useMotion();

  const segmento = pathname.split('/').pop() ?? 'index';
  const ativa = SHEET_TABS.some((tab) => tab.key === segmento) ? segmento : 'index';

  const [medidas, setMedidas] = useState<Record<string, { x: number; width: number }>>({});
  const deslocamento = useRef(new Animated.Value(0)).current;

  const medidaAtiva = medidas[ativa];

  useEffect(() => {
    if (!medidaAtiva) return;

    const animacao = Animated.timing(deslocamento, {
      toValue: medidaAtiva.x,
      duration: reduced ? 0 : ms('base'),
      easing: easing.standard,
      useNativeDriver: nativeDriver,
    });
    animacao.start();

    return () => animacao.stop();
  }, [medidaAtiva, deslocamento, reduced, ms]);

  const barra = (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.space1,
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        borderWidth: stroke.hairline,
        borderColor: colors.border,
        padding: spacing.space1,
      }}
    >
      {medidaAtiva ? (
        <Animated.View
          pointerEvents="none"
          aria-hidden
          style={{
            position: 'absolute',
            top: spacing.space1,
            bottom: spacing.space1,
            left: 0,
            width: medidaAtiva.width,
            backgroundColor: colors.primary,
            borderTopWidth: stroke.hairline,
            borderBottomWidth: stroke.hairline,
            borderTopColor: colors.accent,
            borderBottomColor: colors.accent,
            transform: [{ translateX: deslocamento }, { skewX: CORTE }],
          }}
        />
      ) : null}

      {SHEET_TABS.map((tab) => {
        const selecionada = tab.key === ativa;

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: selecionada }}
            accessibilityLabel={`${tab.label}. ${tab.hint}`}
            onLayout={(evento) => {
              const { x, width } = evento.nativeEvent.layout;
              setMedidas((atual) =>
                atual[tab.key]?.x === x && atual[tab.key]?.width === width
                  ? atual
                  : { ...atual, [tab.key]: { x, width } }
              );
            }}
            onPress={() => {
              const sufixo = tab.key === 'index' ? '' : `/${tab.key}`;
              router.replace(`/(app)/personagens/${characterId}${sufixo}` as never);
            }}
            style={{
              flexGrow: isPhone ? 0 : 1,
              minHeight: hitSize.min,
              minWidth: isPhone ? 76 : undefined,
              paddingVertical: spacing.space2,
              paddingHorizontal: spacing.space2,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
            }}
          >
            <Icon name={tab.icon} size={20} color={selecionada ? colors.onPrimary : colors.textSubtle} />
            <Text
              variant="caption"
              numberOfLines={1}
              style={{ color: selecionada ? colors.onPrimary : colors.textMuted, letterSpacing: 0 }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (!isPhone) return barra;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {barra}
    </ScrollView>
  );
}
