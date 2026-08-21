import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import {
  easing,
  nativeDriver,
  radius,
  spacing,
  stroke,
  tones,
  type ToneName,
  useMotion,
  useTheme,
} from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ToastProps = {
  message: string;
  tone?: Extract<ToneName, 'success' | 'warning' | 'danger' | 'arcane' | 'neutral'>;
  /** Some sozinho depois deste tempo. `0` mantém até o usuário fechar. */
  duration?: number;
  onDismiss?: () => void;
};

const ICONES: Record<NonNullable<ToastProps['tone']>, IconName> = {
  success: 'confirmar',
  warning: 'alerta',
  danger: 'alerta',
  arcane: 'info',
  neutral: 'info',
};

/**
 * Aviso passageiro.
 *
 * Entra como um pergaminho desenrolando: `scaleY` de 0.8 para 1 com a origem no
 * topo, mais fade. A origem no topo é o que faz a diferença — com origem no
 * centro o aviso "cresce", com origem no topo ele "desce", que é o gesto de
 * desenrolar.
 *
 * O ícone à esquerda é um selo redondo na cor do tipo, para o aviso se
 * identificar sem depender só da cor de fundo — quem não distingue vermelho de
 * verde ainda tem o símbolo e o texto.
 */
export function Toast({ message, tone = 'neutral', duration = 4000, onDismiss }: ToastProps) {
  const { colors, elevation } = useTheme();
  const { reduced, ms } = useMotion();
  const paleta = tones(colors)[tone];

  const entrada = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animacao = Animated.timing(entrada, {
      toValue: 1,
      duration: reduced ? 0 : ms('base'),
      easing: easing.decelerate,
      useNativeDriver: nativeDriver,
    });
    animacao.start();

    return () => animacao.stop();
  }, [entrada, reduced, ms]);

  useEffect(() => {
    if (!duration || !onDismiss) return;

    const relogio = setTimeout(onDismiss, duration);

    return () => clearTimeout(relogio);
  }, [duration, onDismiss]);

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.space3,
          backgroundColor: colors.surface,
          borderWidth: stroke.hairline,
          borderColor: paleta.border,
          borderLeftWidth: stroke.plate,
          borderLeftColor: paleta.solid,
          borderRadius: radius.md,
          paddingVertical: spacing.space3,
          paddingHorizontal: spacing.space4,
          opacity: entrada,
          transformOrigin: 'top center',
          transform: [{ scaleY: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
        },
        elevation.card,
      ]}
    >
      <View
        aria-hidden
        style={{
          width: 26,
          height: 26,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: paleta.solid,
          // Contorno de selo: cera nunca sai redonda.
          borderTopLeftRadius: 13,
          borderTopRightRadius: 11,
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 13,
        }}
      >
        <Icon name={ICONES[tone]} size={15} color={paleta.onSolid} />
      </View>

      <Text variant="small" style={{ flex: 1 }}>
        {message}
      </Text>

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Fechar aviso"
          // O padding é o que garante o alvo na web: ali o `hitSlop` não vira
          // área clicável, e um ícone de 16px seria um alvo de 16px.
          style={{ padding: spacing.space2, margin: -spacing.space2 }}
        >
          <Icon name="remover" size={16} color={colors.textSubtle} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
