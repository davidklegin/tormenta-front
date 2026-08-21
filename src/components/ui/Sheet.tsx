import { useEffect, useRef } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { easing, nativeDriver, radius, spacing, stroke, useMotion, useResponsive, useTheme } from '@/theme';
import { Text } from './Text';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/**
 * Painel modal.
 *
 * No celular sobe de baixo, ocupando a largura toda; em telas maiores vira um
 * diálogo centralizado. A mesma peça serve às duas situações para não existirem
 * dois componentes com o mesmo propósito (briefing §21 e §30).
 *
 * A moldura é dupla — borda externa na cor do traço e, 4px para dentro, um
 * filete de ouro. É o acabamento de uma página emoldurada, e resolve um problema
 * real além do estético: sobre o fundo escurecido, uma borda só some.
 *
 * A entrada é `scale` de 0.97 a 1 com fade. Só transform e opacidade, então roda
 * na GPU; com movimento reduzido o painel simplesmente já está no lugar.
 */
export function Sheet({ visible, onClose, title, subtitle, children, footer }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { isPhone } = useResponsive();
  const { colors, elevation } = useTheme();
  const { reduced, ms } = useMotion();

  const entrada = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      entrada.setValue(0);

      return;
    }

    const animacao = Animated.timing(entrada, {
      toValue: 1,
      duration: reduced ? 0 : ms('base'),
      easing: easing.decelerate,
      useNativeDriver: nativeDriver,
    });
    animacao.start();

    return () => animacao.stop();
  }, [visible, entrada, reduced, ms]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: isPhone ? 'flex-end' : 'center',
            alignItems: isPhone ? 'stretch' : 'center',
            opacity: entrada,
          },
          // Desfoque leve atrás do painel. Só na web: no celular o custo por
          // quadro não se paga para um efeito que fica meio segundo em cena.
          Platform.OS === 'web' ? ({ backdropFilter: 'blur(3px)' } as never) : null,
        ]}
      >
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
          accessibilityLabel="Fechar"
          accessibilityRole="button"
        />

        <Animated.View
          style={[
            {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: stroke.hairline,
              borderColor: colors.border,
              width: isPhone ? '100%' : 560,
              maxWidth: '100%',
              maxHeight: '88%',
              // No celular o painel sobe de baixo e pode chegar perto da barra
              // de status: reservamos o inset do topo. No desktop ele é um
              // diálogo centralizado e não precisa disso.
              marginTop: isPhone ? insets.top + spacing.space4 : 0,
              paddingBottom: isPhone ? insets.bottom : 0,
              transform: [{ scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
            },
            elevation.floating,
          ]}
        >
          {/* Filete interno da moldura dupla, 4px para dentro da borda externa. */}
          <View
            pointerEvents="none"
            aria-hidden
            style={{
              position: 'absolute',
              top: spacing.space1,
              left: spacing.space1,
              right: spacing.space1,
              bottom: spacing.space1,
              borderWidth: stroke.hairline,
              borderColor: colors.accent,
              borderRadius: radius.sm,
              opacity: 0.55,
            }}
          />

          {isPhone ? (
            <View style={{ alignItems: 'center', paddingTop: spacing.space2 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: radius.pill,
                  backgroundColor: colors.borderStrong,
                }}
              />
            </View>
          ) : null}

          {title ? (
            <View
              style={{
                padding: spacing.space4,
                paddingBottom: spacing.space3,
                borderBottomWidth: stroke.hairline,
                borderBottomColor: colors.border,
              }}
            >
              <Text variant="title">{title}</Text>
              {subtitle ? (
                <Text variant="small" tone="secondary" style={{ marginTop: spacing.xxs }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={{ padding: spacing.space4, gap: spacing.space4 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {footer ? (
            <View
              style={{
                padding: spacing.space4,
                borderTopWidth: stroke.hairline,
                borderTopColor: colors.border,
                flexDirection: 'row',
                gap: spacing.space2,
              }}
            >
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
