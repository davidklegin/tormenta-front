import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { typography, useTheme, type Palette } from '@/theme';

type Variant = keyof typeof typography;
type Tone =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'primary'
  | 'arcane'
  | 'gold'
  | 'success'
  | 'warning'
  | 'danger'
  | 'inverse';

/**
 * Cada tom aponta para a tinta da família, e não para a cor pura.
 *
 * A diferença aparece no tema claro: o ouro da identidade (#B8860B) é lindo
 * como ornamento e ilegível como texto sobre pergaminho — 3.0 de contraste. O
 * tom `gold` usa então o ouro queimado, que dá 6.0 e continua sendo ouro.
 */
function toneColors(palette: Palette): Record<Tone, string> {
  return {
    default: palette.text,
    secondary: palette.textMuted,
    muted: palette.textSubtle,
    primary: palette.primaryInk,
    arcane: palette.infoInk,
    gold: palette.accentInk,
    success: palette.successInk,
    warning: palette.warningInk,
    danger: palette.dangerInk,
    inverse: palette.onPrimary,
  };
}

export type TextProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
  center?: boolean;
  uppercase?: boolean;
};

/**
 * Texto do app.
 *
 * Centraliza tipografia e cor para que nenhuma tela precise repetir tokens —
 * e para que ajustar a legibilidade signifique mexer em um lugar só.
 *
 * As variantes de display (`display`, `title`, `heading`, `caption`) já vêm em
 * caixa alta pela própria escala tipográfica; a prop `uppercase` continua
 * existindo para forçar o mesmo nas variantes de corpo.
 */
export function Text({ variant = 'body', tone = 'default', center, uppercase, style, ...props }: TextProps) {
  const { colors } = useTheme();
  const base = typography[variant] as TextStyle;

  return (
    <RNText
      {...props}
      style={[
        base,
        { color: toneColors(colors)[tone] },
        center && { textAlign: 'center' },
        uppercase && { textTransform: 'uppercase' },
        style,
      ]}
    />
  );
}
