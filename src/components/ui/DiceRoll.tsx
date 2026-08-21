import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing as RNEasing, View } from 'react-native';
import { Image } from 'expo-image';
import { easing, fontFamily, nativeDriver, radius, spacing, stroke, useMotion, useTheme } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

export type DiceRollProps = {
  label?: string;
  /** Modificador somado ao dado, mostrado ao lado do resultado. */
  modifier?: number;
  /**
   * De onde vem o número. Injetável para a tela decidir a regra; o padrão é um
   * d20 comum, e nada de regra de jogo mora aqui.
   */
  roll?: () => number;
  onResult?: (natural: number, total: number) => void;
};

/** Nenhum efeito passa de 600ms — a interface continua respondendo durante. */
const GIRO = 520;
const CONTAGEM = 280;
const CELEBRACAO = 400;

/** Silhueta de icosaedro. Só linhas: o que todo decodificador de SVG cobre. */
function d20DataUri(traco: string, preenchimento: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" ` +
    `stroke-linejoin="round" stroke-linecap="round">` +
    `<path d="M32 3l26 15v28L32 61 6 46V18z" fill="${preenchimento}" stroke="${traco}" stroke-width="2"/>` +
    `<path d="M32 3l16 22-16 9-16-9z" stroke="${traco}" stroke-width="1.5"/>` +
    `<path d="M16 25L6 46l26-12zM48 25l10 21-26-12z" stroke="${traco}" stroke-width="1.5"/>` +
    `<path d="M32 34v27" stroke="${traco}" stroke-width="1.5"/>` +
    `</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Rolagem de d20.
 *
 * O botão dispara três coisas em sequência curta: o dado gira, o número sobe
 * contando, e — só nos extremos — o bloco reage.
 *
 * **Vinte natural** ganha halo dourado pulsante e um tremor de poucos pixels.
 * **Um natural** pisca em vermelho e o bloco perde a cor por um instante. Os
 * dois duram menos de 600ms e nada trava: o botão continua clicável durante a
 * celebração, porque em mesa se rola de novo antes de a animação acabar.
 *
 * Com movimento reduzido não há giro, contagem, tremor nem pulso — o resultado
 * aparece direto, e o realce de acerto ou falha vira estático. O que a animação
 * comunica (foi 20, foi 1) continua legível sem ela.
 */
export function DiceRoll({ label = 'Rolar d20', modifier = 0, roll, onResult }: DiceRollProps) {
  const { colors } = useTheme();
  const { reduced, ms } = useMotion();

  const [natural, setNatural] = useState<number | null>(null);
  const [mostrado, setMostrado] = useState<number | null>(null);
  const [celebrando, setCelebrando] = useState<'critico' | 'falha' | null>(null);

  const giro = useRef(new Animated.Value(0)).current;
  const contador = useRef(new Animated.Value(0)).current;
  const pulso = useRef(new Animated.Value(0)).current;
  const tremor = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const inscricao = contador.addListener(({ value }) => setMostrado(Math.max(1, Math.round(value))));

    return () => contador.removeListener(inscricao);
  }, [contador]);

  const rolar = useCallback(() => {
    const valor = roll ? roll() : 1 + Math.floor(Math.random() * 20);

    setNatural(valor);
    onResult?.(valor, valor + modifier);

    const extremo = valor === 20 ? 'critico' : valor === 1 ? 'falha' : null;

    if (reduced) {
      setMostrado(valor);
      setCelebrando(extremo);

      return;
    }

    setCelebrando(null);
    giro.setValue(0);
    contador.setValue(1);

    Animated.parallel([
      Animated.timing(giro, {
        toValue: 1,
        duration: GIRO,
        easing: RNEasing.out(RNEasing.cubic),
        useNativeDriver: nativeDriver,
      }),
      Animated.sequence([
        Animated.delay(GIRO - CONTAGEM),
        // Sem driver nativo de propósito: este valor não vira estilo, é lido em
        // JS para escrever o número. Não há layout envolvido.
        Animated.timing(contador, {
          toValue: valor,
          duration: CONTAGEM,
          easing: easing.decelerate,
          useNativeDriver: false,
        }),
      ]),
    ]).start(() => {
      if (!extremo) return;

      setCelebrando(extremo);

      if (extremo === 'critico') {
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulso, { toValue: 1, duration: CELEBRACAO / 2, useNativeDriver: nativeDriver }),
            Animated.timing(pulso, { toValue: 0, duration: CELEBRACAO / 2, useNativeDriver: nativeDriver }),
          ]),
          Animated.sequence([
            Animated.timing(tremor, { toValue: 1, duration: 60, useNativeDriver: nativeDriver }),
            Animated.timing(tremor, { toValue: -1, duration: 60, useNativeDriver: nativeDriver }),
            Animated.timing(tremor, { toValue: 1, duration: 60, useNativeDriver: nativeDriver }),
            Animated.timing(tremor, { toValue: 0, duration: 60, useNativeDriver: nativeDriver }),
          ]),
        ]).start();
      }

      setTimeout(() => setCelebrando(null), CELEBRACAO + 120);
    });
  }, [roll, modifier, onResult, reduced, giro, contador, pulso, tremor]);

  const critico = celebrando === 'critico';
  const falha = celebrando === 'falha';

  const total = natural === null ? null : natural + modifier;

  return (
    <Animated.View
      style={[
        {
          gap: spacing.space3,
          alignItems: 'center',
          padding: spacing.space4,
          backgroundColor: colors.surface,
          borderWidth: stroke.hairline,
          borderColor: critico ? colors.accent : falha ? colors.danger : colors.border,
          borderRadius: radius.lg,
          transform: [{ translateX: tremor.interpolate({ inputRange: [-1, 1], outputRange: [-3, 3] }) }],
        },
        // Perda de cor momentânea no 1 natural. `filter` não mexe em layout.
        falha ? ({ filter: 'saturate(0.35)' } as never) : null,
      ]}
    >
      <View style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }}>
        {critico ? (
          <Animated.View
            aria-hidden
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: 76,
              height: 76,
              borderRadius: 38,
              backgroundColor: colors.accent,
              opacity: pulso.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.4] }),
              transform: [{ scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) }],
            }}
          />
        ) : null}

        <Animated.View
          style={{
            transform: [
              { perspective: 600 },
              {
                rotateY: giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] }),
              },
              {
                rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '18deg'] }),
              },
            ],
          }}
        >
          <Image
            source={{
              uri: d20DataUri(
                critico ? colors.accent : falha ? colors.danger : colors.borderStrong,
                colors.surfaceAlt
              ),
            }}
            style={{ width: 60, height: 60 }}
            contentFit="contain"
            aria-hidden
            transition={0}
          />
        </Animated.View>
      </View>

      <View style={{ alignItems: 'center', gap: spacing.xxs }}>
        <Text
          accessibilityLiveRegion="polite"
          style={{
            fontFamily: fontFamily.numeric,
            fontWeight: '700',
            fontSize: 40,
            lineHeight: 46,
            color: critico ? colors.accentInk : falha ? colors.dangerInk : colors.text,
          }}
        >
          {mostrado === null ? '—' : mostrado}
        </Text>

        <Text variant="caption" tone={critico ? 'gold' : falha ? 'danger' : 'muted'}>
          {natural === null
            ? 'nenhuma rolagem'
            : critico
              ? 'vinte natural'
              : falha
                ? 'um natural'
                : modifier === 0
                  ? 'resultado'
                  : `${natural} ${modifier >= 0 ? '+' : '−'} ${Math.abs(modifier)} = ${total}`}
        </Text>
      </View>

      <Button label={label} onPress={rolar} variant="secondary" size="sm" />
    </Animated.View>
  );
}
