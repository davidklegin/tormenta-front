import { View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing, stroke, typography, useTheme } from '@/theme';
import { Text } from './Text';

export type TitlePlateProps = {
  label: string;
  /** Informação curta à direita, dentro da placa — contagem, nível, página. */
  meta?: string;
  /** Ocupa a linha inteira. Por padrão a placa tem a largura do texto. */
  fullWidth?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/** Inclinação do corte nas pontas. */
const CORTE = '-10deg';

/**
 * Placa de título: a faixa rubra com as pontas cortadas na diagonal.
 *
 * O corte vem de `skewX` no contêiner, desfeito por um `skewX` oposto no texto
 * — que continua reto e legível. É a única forma de conseguir isso nas três
 * plataformas: `clip-path` só existe na web, e trazer SVG só por causa de duas
 * diagonais custaria uma dependência inteira.
 *
 * Os filetes de 1px em ouro, acima e abaixo, são bordas da própria faixa. Eles
 * inclinam junto, o que é o desejado: são as bordas da placa, não linhas soltas
 * atrás dela.
 *
 * A meta, quando existe, pede folga à direita: a diagonal rouba largura da
 * ponta, e sem a folga o texto termina em cima do corte.
 */
export function TitlePlate({ label, meta, fullWidth = false, size = 'md', style }: TitlePlateProps) {
  const { colors } = useTheme();

  const compacta = size === 'sm';

  return (
    <View
      style={[
        {
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          backgroundColor: colors.primary,
          borderTopWidth: stroke.hairline,
          borderBottomWidth: stroke.hairline,
          borderTopColor: colors.accent,
          borderBottomColor: colors.accent,
          borderRadius: radius.none,
          paddingVertical: compacta ? spacing.space1 : spacing.space2,
          paddingLeft: compacta ? spacing.space4 : spacing.space5,
          // Folga extra à direita: a ponta cortada come largura, e sem isto a
          // meta encosta na diagonal e sai cortada.
          paddingRight: meta ? spacing.space6 : compacta ? spacing.space4 : spacing.space5,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.space3,
          transform: [{ skewX: CORTE }],
        },
        style,
      ]}
    >
      <View style={{ flex: fullWidth ? 1 : undefined, transform: [{ skewX: `-${CORTE}` }] }}>
        <Text
          variant={compacta ? 'caption' : 'heading'}
          style={{ color: colors.onPrimary, fontSize: compacta ? undefined : typography.subheading.fontSize }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>

      {meta ? (
        <View style={{ transform: [{ skewX: `-${CORTE}` }] }}>
          <Text variant="caption" style={{ color: colors.accent }} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
