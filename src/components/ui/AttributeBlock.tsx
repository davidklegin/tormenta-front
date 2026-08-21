import { useState } from 'react';
import { Platform, View } from 'react-native';
import { fontFamily, spacing, stroke, useTheme } from '@/theme';
import { Text } from './Text';

export type AttributeBlockProps = {
  /** Sigla do atributo: FOR, DES, CON, INT, SAB, CAR. */
  abbreviation: string;
  /** Valor total, já com sinal — em Tormenta20 o atributo é o modificador. */
  value: string;
  /** Camadas que compõem o valor (raça, bônus, temporário). */
  detail?: string;
  /** Destaca o bloco: usado quando há modificador temporário em vigor. */
  highlighted?: boolean;
  size?: number;
};

/**
 * Um atributo, em losango.
 *
 * O losango é um quadrado girado 45° com o conteúdo girado de volta — a única
 * forma de conseguir a figura nas três plataformas sem SVG nem `clip-path`. O
 * hexágono do briefing exigiria um dos dois; o losango, que o briefing dá como
 * alternativa, sai de dois `rotate`.
 *
 * O valor vem grande e em algarismos de largura uniforme, porque é o número
 * que o jogador
 * procura de relance no meio de uma rolagem. A borda é dourada e ganha um halo
 * rubi sob o ponteiro — discreto, só o suficiente para dizer que o bloco
 * responde ao toque.
 */
export function AttributeBlock({
  abbreviation,
  value,
  detail,
  highlighted = false,
  size = 92,
}: AttributeBlockProps) {
  const { colors } = useTheme();
  const [hover, setHover] = useState(false);

  // O losango inscrito em um quadrado de lado L tem diagonal L·√2; para o
  // conteúdo caber, o quadrado girado precisa ser menor que a caixa.
  const lado = size / Math.SQRT2;

  return (
    <View
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      accessibilityLabel={`${abbreviation}: ${value}${detail ? `. ${detail}` : ''}`}
      style={{ width: size, alignItems: 'center', gap: spacing.space1 }}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={[
            {
              position: 'absolute',
              width: lado,
              height: lado,
              backgroundColor: colors.surface,
              borderWidth: highlighted ? stroke.seal : stroke.hairline,
              borderColor: highlighted ? colors.info : hover ? colors.primary : colors.accent,
              transform: [{ rotate: '45deg' }],
            },
            hover && Platform.OS !== 'android' ? ({ boxShadow: `0 0 12px ${colors.glow}` } as never) : null,
          ]}
        />

        <View style={{ alignItems: 'center' }}>
          <Text variant="caption" tone="secondary">
            {abbreviation}
          </Text>
          <Text
            style={{
              fontFamily: fontFamily.numeric,
              fontWeight: '700',
              fontSize: Math.round(size * 0.3),
              lineHeight: Math.round(size * 0.34),
              color: colors.text,
            }}
          >
            {value}
          </Text>
        </View>
      </View>

      {detail ? (
        <Text variant="caption" tone="muted" numberOfLines={1} center>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}
