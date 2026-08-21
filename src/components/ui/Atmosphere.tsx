import { Platform, View } from 'react-native';
import { Image } from 'expo-image';
import { GRAIN_OPACITY, gradient, grainDataUri, useTheme } from '@/theme';

/**
 * Camada de fundo: atmosfera e grão.
 *
 * Fica atrás de tudo, sem receber toque, e não participa da rolagem — é o papel
 * sobre o qual a interface está impressa, não parte dela.
 *
 * **Atmosfera.** No escuro, um halo rubi no alto da página — 0.18 sobre um rubi
 * a 35% de alfa dá os 6% efetivos do briefing —,
 * que sugere a Tormenta no horizonte sem nunca chamar atenção. No claro, uma
 * vinheta sépia nas bordas, que é o que o papel velho faz sozinho ao redor das
 * margens. Os dois são gradientes, então custam uma pintura e nada mais.
 *
 * **Grão.** Ruído de `feTurbulence` embutido como data URI — sem arquivo, sem
 * requisição. Na web ele já vem do `ornaments.css`, que sabe ladrilhar a
 * imagem e cobre a página inteira mesmo durante a rolagem; aqui a camada só
 * existe no celular, onde não há CSS para fazer isso.
 */
export function Atmosphere() {
  const { colors, isDark } = useTheme();

  const atmosfera = isDark
    ? `radial-gradient(120% 55% at 50% 0%, ${colors.glow} 0%, transparent 62%)`
    : `radial-gradient(120% 100% at 50% 50%, transparent 45%, ${colors.overlay} 100%)`;

  return (
    <View
      pointerEvents="none"
      aria-hidden
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <View
        style={[{ position: 'absolute', inset: 0, opacity: isDark ? 0.18 : 0.18 }, gradient(atmosfera)]}
      />

      {Platform.OS === 'web' ? null : (
        <Image
          source={{ uri: grainDataUri }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: GRAIN_OPACITY }}
          contentFit="cover"
          // Se o renderizador de SVG da plataforma ignorar o filtro, o
          // retângulo é transparente e a camada simplesmente não aparece.
          transition={0}
          cachePolicy="memory"
        />
      )}
    </View>
  );
}
