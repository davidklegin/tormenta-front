import { Pressable, View } from 'react-native';
import { radius, spacing, stroke, tones, useTheme, type ToneName } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Tone = ToneName;

export type ChipProps = {
  label: string;
  tone?: Tone;
  onPress?: () => void;
  onRemove?: () => void;
  selected?: boolean;
  compact?: boolean;
};

/**
 * Etiqueta compacta. Usada nas condições do Painel do Mestre, nos filtros de
 * magia e nas categorias de anotação.
 *
 * Cantos retos, como todo o resto do tema: a etiqueta é uma tira de pergaminho
 * presa à ficha, não uma cápsula. Selecionada, ela inverte — o preenchimento
 * vira a cor cheia da família e o texto, a tinta de contraste.
 */
export function Chip({ label, tone = 'neutral', onPress, onRemove, selected, compact }: ChipProps) {
  const { colors } = useTheme();
  const paleta = tones(colors)[tone];

  const fundo = selected ? paleta.solid : paleta.fill;
  const tinta = selected ? paleta.onSolid : paleta.ink;

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.space1,
        backgroundColor: fundo,
        borderColor: paleta.border,
        borderWidth: stroke.hairline,
        borderRadius: radius.sm,
        paddingHorizontal: compact ? spacing.space2 : spacing.space3,
        paddingVertical: compact ? 3 : spacing.space1 + 1,
      }}
    >
      <Text variant={compact ? 'caption' : 'smallStrong'} style={{ color: tinta }}>
        {label}
      </Text>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Remover ${label}`}
          // Ver Toast: na web o `hitSlop` não alcança o DOM, o padding sim.
          style={{ padding: spacing.space1, margin: -spacing.space1 }}
        >
          <Icon name="remover" size={14} color={tinta} />
        </Pressable>
      ) : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {body}
    </Pressable>
  );
}
