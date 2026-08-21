import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { easing, gradient, nativeDriver, radius, stroke, useMotion, useTheme } from '@/theme';

export type ProgressBarProps = {
  value: number;
  max: number;
  /** Parcela temporária, desenhada depois da barra principal (PV/PM temporários). */
  temp?: number;
  color?: string;
  trackColor?: string;
  height?: number;
};

/**
 * Barra de PV/PM.
 *
 * Os pontos temporários aparecem como um segmento distinto porque podem
 * ultrapassar o máximo (livro base, p. 106) — se somássemos ao valor normal, a
 * barra passaria de 100% e mentiria sobre o estado real do personagem.
 *
 * A trilha é uma calha rasa: fundo em `surfaceAlt`, filete de 1px na borda,
 * cantos retos. O preenchimento leva um gradiente de leve para escuro, o que dá
 * ao traço a curvatura de tinta acumulada em vez de chapa lisa.
 *
 * A transição de largura usa `scaleX` sobre uma barra de largura total, e não a
 * propriedade `width`: animar largura recalcula o layout a cada quadro, e esta
 * é uma barra que se mexe no meio do combate, quando o aparelho já está ocupado.
 */
export function ProgressBar({ value, max, temp = 0, color, trackColor, height = 10 }: ProgressBarProps) {
  const { colors } = useTheme();
  const { reduced, ms } = useMotion();

  const preenchimento = color ?? colors.primary;
  const calha = trackColor ?? colors.hpTrack;

  const safeMax = Math.max(1, max);
  const mainRatio = Math.max(0, Math.min(1, value / safeMax));
  const tempRatio = Math.max(0, Math.min(1 - mainRatio, temp / safeMax));

  const principal = useRef(new Animated.Value(mainRatio)).current;

  useEffect(() => {
    const animacao = Animated.timing(principal, {
      toValue: mainRatio,
      duration: reduced ? 0 : ms('base'),
      easing: easing.decelerate,
      useNativeDriver: nativeDriver,
    });
    animacao.start();

    return () => animacao.stop();
  }, [mainRatio, principal, reduced, ms]);

  return (
    <View
      style={{
        height,
        backgroundColor: calha,
        borderWidth: stroke.hairline,
        borderColor: colors.border,
        borderRadius: radius.none,
        overflow: 'hidden',
        flexDirection: 'row',
      }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: safeMax, now: Math.max(0, value) }}
    >
      <Animated.View
        style={[
          { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
          gradient(
            `linear-gradient(180deg, ${preenchimento} 0%, ${preenchimento} 55%, ${colors.shade} 100%)`
          ),
          { backgroundColor: preenchimento },
          // A escala cresce a partir da borda esquerda, como a barra faria se
          // fosse a largura mudando — mas sem tocar no layout.
          { transformOrigin: 'left center', transform: [{ scaleX: principal }] },
        ]}
      />

      {tempRatio > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${mainRatio * 100}%`,
            width: `${tempRatio * 100}%`,
            backgroundColor: preenchimento,
            opacity: 0.45,
          }}
        />
      ) : null}
    </View>
  );
}
