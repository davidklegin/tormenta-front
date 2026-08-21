import { View } from 'react-native';
import { ornament, useTheme } from '@/theme';

export type CornerOrnamentProps = {
  /** Cantos a marcar. Por padrão, o superior esquerdo e o inferior direito. */
  corners?: ('topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight')[];
  color?: string;
  size?: number;
  inset?: number;
};

/**
 * Ornamento de canto: dois traços em L, como o reforço de metal na quina de um
 * grimório.
 *
 * Na web isso seria um pseudo-elemento com duas bordas. O React Native não tem
 * `::before`, então são Views absolutas com uma borda cada — o desenho é o
 * mesmo, e funciona igual nas três plataformas.
 *
 * Fica em dois cantos opostos, não nos quatro: quatro cantos marcados fecham o
 * card como uma moldura e o fazem competir com o conteúdo. Dois apenas sugerem
 * a moldura, que é o que se quer.
 */
export function CornerOrnament({
  corners = ['topLeft', 'bottomRight'],
  color,
  size = ornament.size,
  inset = 0,
}: CornerOrnamentProps) {
  const { colors } = useTheme();
  const tinta = color ?? colors.accent;

  const traco = { position: 'absolute', width: size, height: size, borderColor: tinta } as const;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }} aria-hidden>
      {corners.includes('topLeft') ? (
        <View
          style={[
            traco,
            {
              top: inset,
              left: inset,
              borderTopWidth: ornament.weight,
              borderLeftWidth: ornament.weight,
            },
          ]}
        />
      ) : null}

      {corners.includes('topRight') ? (
        <View
          style={[
            traco,
            {
              top: inset,
              right: inset,
              borderTopWidth: ornament.weight,
              borderRightWidth: ornament.weight,
            },
          ]}
        />
      ) : null}

      {corners.includes('bottomLeft') ? (
        <View
          style={[
            traco,
            {
              bottom: inset,
              left: inset,
              borderBottomWidth: ornament.weight,
              borderLeftWidth: ornament.weight,
            },
          ]}
        />
      ) : null}

      {corners.includes('bottomRight') ? (
        <View
          style={[
            traco,
            {
              bottom: inset,
              right: inset,
              borderBottomWidth: ornament.weight,
              borderRightWidth: ornament.weight,
            },
          ]}
        />
      ) : null}
    </View>
  );
}
