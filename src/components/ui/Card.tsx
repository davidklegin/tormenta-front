import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  easing,
  gradient,
  nativeDriver,
  ornament,
  radius,
  spacing,
  stroke,
  useMotion,
  useTheme,
  type Palette,
} from '@/theme';
import { CornerOrnament } from './CornerOrnament';
import { Text } from './Text';

export type CardProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  accentColor?: string;
  /** Card em foco: ganha o fio de rubi no topo. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Fio de rubi: 2px no topo, transparente nas pontas e cheio no meio.
 *
 * Entra deslizando da esquerda quando o card vira ativo. É `translateX` puro,
 * então roda na GPU e não força recálculo de layout. Com movimento reduzido a
 * linha simplesmente já está lá — o que ela comunica é "este é o card em foco",
 * e essa informação não pode depender de ter visto a animação.
 */
function FioDeRubi({ palette }: { palette: Palette }) {
  const { reduced, ms } = useMotion();
  const [largura, setLargura] = useState(0);
  const progresso = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progresso.setValue(1);

      return;
    }

    progresso.setValue(0);
    const animacao = Animated.timing(progresso, {
      toValue: 1,
      duration: ms('base'),
      easing: easing.decelerate,
      useNativeDriver: nativeDriver,
    });
    animacao.start();

    return () => animacao.stop();
  }, [progresso, reduced, ms]);

  return (
    <View
      pointerEvents="none"
      aria-hidden
      onLayout={(evento) => setLargura(evento.nativeEvent.layout.width)}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: stroke.seal, overflow: 'hidden' }}
    >
      <Animated.View
        style={[
          { width: '100%', height: '100%' },
          gradient(`linear-gradient(90deg, transparent 0%, ${palette.primary} 50%, transparent 100%)`),
          // Deslocamento em pontos, medido pelo onLayout acima: o driver nativo
          // só interpola números, e uma string de porcentagem o derrubaria em
          // tempo de execução — erro que nenhum verificador de tipos pega.
          {
            transform: [
              { translateX: progresso.interpolate({ inputRange: [0, 1], outputRange: [-largura, 0] }) },
            ],
          },
        ]}
      />
    </View>
  );
}

/**
 * Superfície padrão do app.
 *
 * `accentColor` desenha uma faixa na borda esquerda — é assim que o Painel do
 * Mestre sinaliza PV baixo sem precisar colorir o card inteiro, o que
 * prejudicaria a leitura (briefing §7 e §20).
 *
 * As cantoneiras nos quatro cantos são o que dá ao card cara de página de
 * grimório em vez de caixa de formulário. Em repouso elas são discretas, na cor
 * da borda; sob o ponteiro crescem de 12 para 16px e viram ouro. São Views
 * absolutas com uma borda cada, o equivalente nativo dos pseudo-elementos que
 * fariam isso no CSS.
 */
export function Card({
  children,
  title,
  subtitle,
  right,
  onPress,
  padded = true,
  elevated = false,
  accentColor,
  active = false,
  style,
}: CardProps) {
  const { colors, elevation } = useTheme();
  const [hover, setHover] = useState(false);

  // Em repouso a cantoneira usa o traço forte, e não `border`: fosse a mesma
  // cor da borda do card, ela desapareceria dentro dela e só existiria no hover.
  const corDaCantoneira = hover ? colors.accent : colors.borderStrong;
  const tamanhoDaCantoneira = hover ? 16 : ornament.size;

  const content = (
    <>
      {(title || right) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: subtitle ? spacing.xxs : spacing.space2,
            gap: spacing.space2,
          }}
        >
          <View style={{ flex: 1 }}>
            {title ? <Text variant="heading">{title}</Text> : null}
            {subtitle ? (
              <Text variant="small" tone="secondary" style={{ marginTop: spacing.xxs }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
      )}
      {children}
    </>
  );

  const ornamentos = (
    <>
      {active ? <FioDeRubi palette={colors} /> : null}
      <CornerOrnament
        corners={['topLeft', 'topRight', 'bottomLeft', 'bottomRight']}
        color={corDaCantoneira}
        size={tamanhoDaCantoneira}
      />
    </>
  );

  const cardStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: elevated ? colors.surfaceAlt : colors.surface,
      borderRadius: radius.lg,
      borderWidth: stroke.hairline,
      borderColor: active ? colors.primary : colors.border,
      padding: padded ? spacing.space4 : 0,
      overflow: 'hidden',
    },
    accentColor ? { borderLeftWidth: stroke.plate, borderLeftColor: accentColor } : null,
    elevated ? elevation.card : null,
    style,
  ];

  if (!onPress) {
    return (
      <View style={cardStyle} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
        {content}
        {ornamentos}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ pressed }) => [cardStyle, pressed && { backgroundColor: colors.surfaceHover }]}
      accessibilityRole="button"
    >
      {content}
      {ornamentos}
    </Pressable>
  );
}
