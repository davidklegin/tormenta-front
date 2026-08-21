import { useState } from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { hitSize, ornamentAttrs, radius, spacing, stroke, useTheme, type Palette } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

type Aparencia = {
  background: string;
  border: string;
  text: string;
  /** Borda inferior mais escura: é ela que dá o relevo de selo cravado. */
  relief: string;
  hoverBackground: string;
  pressBackground: string;
  /** Tinta quando o fundo do hover é a cor cheia da família. */
  hoverText: string;
};

/**
 * O primário é um selo: preenchimento rubi cheio com uma borda inferior de 2px
 * em rubi escuro, que lê como espessura. Ao pressionar, o relevo some e o botão
 * desce um pixel — o mesmo gesto de apertar um carimbo.
 *
 * O secundário é contorno em ouro, o fantasma é só texto. Nenhum dos três
 * repete o mesmo peso visual, para a tela sempre deixar claro qual é a ação
 * principal.
 */
function aparencias(palette: Palette): Record<Variant, Aparencia> {
  return {
    primary: {
      background: palette.primary,
      border: palette.primary,
      text: palette.onPrimary,
      relief: palette.primaryHover,
      hoverBackground: palette.primaryHover,
      pressBackground: palette.primaryHover,
      hoverText: palette.onPrimary,
    },
    secondary: {
      background: 'transparent',
      border: palette.accent,
      text: palette.accentInk,
      relief: palette.accentSoft,
      hoverBackground: palette.accentFill,
      pressBackground: palette.accentFill,
      hoverText: palette.accentInk,
    },
    ghost: {
      background: 'transparent',
      border: 'transparent',
      text: palette.textMuted,
      relief: 'transparent',
      hoverBackground: palette.surfaceHover,
      pressBackground: palette.surfaceHover,
      hoverText: palette.text,
    },
    danger: {
      background: palette.dangerFill,
      border: palette.danger,
      text: palette.dangerInk,
      relief: palette.danger,
      hoverBackground: palette.danger,
      pressBackground: palette.danger,
      hoverText: palette.onPrimary,
    },
    gold: {
      background: palette.accentFill,
      border: palette.accent,
      text: palette.accentInk,
      relief: palette.accent,
      hoverBackground: palette.accent,
      pressBackground: palette.accent,
      hoverText: palette.onAccent,
    },
  };
}

const sizeStyles: Record<
  Size,
  { height: number; paddingHorizontal: number; variant: 'smallStrong' | 'label' }
> = {
  sm: { height: 36, paddingHorizontal: spacing.space3, variant: 'smallStrong' },
  md: { height: hitSize.min, paddingHorizontal: spacing.space4, variant: 'label' },
  lg: { height: 52, paddingHorizontal: spacing.space6, variant: 'label' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { colors } = useTheme();
  const [hover, setHover] = useState(false);

  const palette = aparencias(colors)[variant];
  const dimensions = sizeStyles[size];
  const isInactive = disabled || loading;
  const realce = hover && !isInactive;
  const tinta = realce ? palette.hoverText : palette.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      // O brilho diagonal que cruza o botão uma vez por hover vive no
      // ornaments.css: são dois pseudo-elementos e um keyframe, que na web
      // custam menos que uma camada animada em JavaScript. No celular não há
      // hover, então não há o que substituir.
      {...ornamentAttrs(variant === 'primary' && !isInactive && 'sheen')}
      style={({ pressed }) => [
        {
          height: dimensions.height,
          paddingHorizontal: dimensions.paddingHorizontal,
          backgroundColor: pressed
            ? palette.pressBackground
            : realce
              ? palette.hoverBackground
              : palette.background,
          borderColor: palette.border,
          borderWidth: stroke.hairline,
          // O selo perde o relevo quando afundado, e o conteúdo desce junto.
          borderBottomWidth: pressed ? stroke.hairline : stroke.seal,
          borderBottomColor: pressed ? palette.border : palette.relief,
          borderRadius: radius.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.space2,
          transform: [{ translateY: pressed ? 1 : 0 }],
          opacity: isInactive ? 0.45 : 1,
        },
        fullWidth && { width: '100%' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tinta} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text variant={dimensions.variant} style={{ color: tinta }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
