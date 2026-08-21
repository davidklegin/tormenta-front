import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontFamily, tones, useTheme, type ToneName } from '@/theme';
import { Text } from './Text';

export type SealProps = {
  /** Número ou sigla. Duas ou três letras no máximo — é um selo, não um rótulo. */
  value: string | number;
  tone?: ToneName;
  size?: 'sm' | 'md' | 'lg';
  /** Lido por leitor de tela no lugar do valor, quando a sigla não se explica. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const TAMANHOS = {
  sm: { caixa: 26, corpo: 12 },
  md: { caixa: 34, corpo: 15 },
  lg: { caixa: 46, corpo: 20 },
} as const;

/**
 * Selo de lacre: nível, círculo de magia, tipo de dano.
 *
 * O contorno é irregular de propósito. Cera derretida não sai redonda, então
 * cada canto do raio tem um valor diferente — o resultado é um disco que parece
 * prensado, não desenhado. É o mesmo truque de `border-radius` com quatro
 * valores do CSS, e o React Native aceita os quatro cantos separados.
 *
 * A sombra interna, no topo, sugere a depressão do carimbo. No Android ela cai
 * fora: `inset` em `boxShadow` não existe lá, e o selo continua legível sem —
 * o que ele precisa comunicar é o número, e esse não depende do relevo.
 */
export function Seal({ value, tone = 'primary', size = 'md', accessibilityLabel, style }: SealProps) {
  const { colors } = useTheme();
  const paleta = tones(colors)[tone];
  const { caixa, corpo } = TAMANHOS[size];

  const tinta = paleta.onSolid;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? String(value)}
      style={[
        {
          width: caixa,
          height: caixa,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: paleta.solid,
          // Cera prensada: nenhum canto igual ao outro.
          borderTopLeftRadius: caixa * 0.48,
          borderTopRightRadius: caixa * 0.42,
          borderBottomLeftRadius: caixa * 0.44,
          borderBottomRightRadius: caixa * 0.5,
          borderWidth: 1,
          borderColor: paleta.ink,
          ...Platform.select({
            web: { boxShadow: `inset 0 2px 4px ${colors.shade}` },
            ios: { boxShadow: `inset 0 2px 4px ${colors.shade}` },
            default: {},
          }),
        } as ViewStyle,
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fontFamily.numeric,
          fontWeight: '700',
          fontSize: corpo,
          lineHeight: Math.round(corpo * 1.15),
          color: tinta,
          letterSpacing: 0.4,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
