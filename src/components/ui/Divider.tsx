import { View, type StyleProp, type ViewStyle } from 'react-native';
import { gradient, spacing, useTheme } from '@/theme';
import { Text } from './Text';

export type DividerProps = {
  /** Rótulo curto no lugar do losango, quando o separador nomeia a seção. */
  label?: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/**
 * Separador ornamental: um losango ao centro com duas linhas que afinam até
 * sumir nas pontas.
 *
 * O losango é um quadrado girado 45°, de lado fixo; as linhas são as que
 * esticam. Por isso o separador acompanha qualquer largura sem que o losango
 * vire um paralelogramo — que é o defeito clássico de fazer isso com um SVG
 * único esticado.
 *
 * O afinamento das linhas vem de um gradiente até transparente, e não de um
 * degradê desenhado: uma pintura só, sem imagem e sem elemento extra.
 */
export function Divider({ label, size = 'md', style }: DividerProps) {
  const { colors } = useTheme();

  const lado = size === 'sm' ? 5 : 7;

  const losango = (
    <View
      style={{
        width: lado,
        height: lado,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.accent,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );

  const linha = (direcao: 'esquerda' | 'direita') => (
    <View
      style={[
        { flex: 1, height: 1 },
        gradient(
          direcao === 'esquerda'
            ? `linear-gradient(90deg, transparent 0%, ${colors.accent} 100%)`
            : `linear-gradient(90deg, ${colors.accent} 0%, transparent 100%)`
        ),
      ]}
    />
  );

  return (
    <View
      aria-hidden={label ? undefined : true}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingVertical: spacing.space2 },
        style,
      ]}
    >
      {linha('esquerda')}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }}>
        {losango}
        {label ? (
          <Text variant="caption" tone="gold">
            {label}
          </Text>
        ) : null}
        {label ? losango : null}
      </View>

      {linha('direita')}
    </View>
  );
}
