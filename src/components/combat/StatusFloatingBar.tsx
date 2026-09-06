import { useRef } from 'react';
import { Animated, PanResponder, Pressable, View, Dimensions } from 'react-native';
import { Chip, Icon, Text } from '@/components/ui';
import { radius, spacing, stroke, useTheme } from '@/theme';

const SCREEN = Dimensions.get('window');
const BAR_WIDTH = 280;

type StatusData = {
  name: string;
  hp: { current: number; max: number; temp?: number };
  mp: { current: number; max: number };
  defense: number;
  fortitude: number;
  reflex: number;
  will: number;
};

/**
 * Barra flutuante de status do personagem durante combate.
 *
 * Mostra HP, Mana, CA e defesas em tempo real. O jogador pode arrastar
 * para qualquer posição da tela que preferir.
 */
export function StatusFloatingBar({
  data,
  visible,
  onClose,
}: {
  data: StatusData | null;
  visible: boolean;
  onClose?: () => void;
}) {
  const { colors } = useTheme();
  const pan = useRef(new Animated.ValueXY({ x: 20, y: SCREEN.height - 200 })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  if (!visible || !data) {
    return null;
  }

  const hp = data.hp;
  const mp = data.mp;
  const hpPercent = hp.max > 0 ? (hp.current / hp.max) * 100 : 100;
  const mpPercent = mp.max > 0 ? (mp.current / mp.max) * 100 : 100;

  const hpColor =
    hpPercent <= 25
      ? colors.danger
      : hpPercent <= 50
      ? colors.warning
      : colors.success;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        {
          position: 'absolute',
          width: BAR_WIDTH,
          zIndex: 1000,
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: stroke.hairline,
          borderColor: colors.border,
          padding: spacing.md,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        {/* Header com nome e botão fechar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing.sm,
          }}
        >
          <Icon name="personagens" size={16} color={colors.textMuted} />
          <Text
            variant="caption"
            tone="secondary"
            style={{ flex: 1, marginLeft: spacing.xs }}
            numberOfLines={1}
          >
            {data.name}
          </Text>
          {onClose ? (
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="excluir" size={14} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* HP e Mana */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
              <Text variant="heading" style={{ color: hpColor }}>
                {hp.current}
              </Text>
              <Text variant="small" tone="muted">
                / {hp.max} PV
              </Text>
              {hp.temp && hp.temp > 0 ? (
                <Chip label={`+${hp.temp}`} compact tone="gold" />
              ) : null}
            </View>
            <View
              style={{
                height: 6,
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.pill,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.min(100, hpPercent)}%`,
                  height: '100%',
                  backgroundColor: hpColor,
                  borderRadius: radius.pill,
                }}
              />
            </View>
          </View>

          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
              <Text variant="bodyStrong" style={{ color: colors.accent }}>
                {mp.current}
              </Text>
              <Text variant="small" tone="muted">
                / {mp.max} PM
              </Text>
            </View>
            <View
              style={{
                height: 4,
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.pill,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.min(100, mpPercent)}%`,
                  height: '100%',
                  backgroundColor: colors.accent,
                  borderRadius: radius.pill,
                }}
              />
            </View>
          </View>
        </View>

        {/* Defesas */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
            borderTopWidth: stroke.hairline,
            borderTopColor: colors.border,
          }}
        >
          <DefenseStat label="CA" value={data.defense} />
          <DefenseStat label="Fort" value={data.fortitude} />
          <DefenseStat label="Ref" value={data.reflex} />
          <DefenseStat label="Von" value={data.will} />
        </View>
      </View>
    </Animated.View>
  );
}

function DefenseStat({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();

  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="numeric" tone="primary">
        {value >= 0 ? `+${value}` : value}
      </Text>
    </View>
  );
}
