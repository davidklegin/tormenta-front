import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { fontFamily } from './fonts';
import type { Palette } from './palettes';

/**
 * Escala de espaçamento, base 4.
 *
 * `space1` a `space8` são os nomes do sistema de design. Os apelidos `xs`…`xxxl`
 * continuam existindo porque são o que as telas escrevem hoje, e renomeá-los
 * seria mexer em quase cem chamadas sem ganhar nada — os dois conjuntos apontam
 * para os mesmos números.
 */
export const spacing = {
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space5: 20,
  space6: 24,
  space7: 32,
  space8: 48,

  /** Meio passo. Só para acerto ótico, como o vão entre rótulo e número. */
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Raios.
 *
 * O tema é de placa e selo, não de cápsula: nada passa de 4px. `pill` sobrou
 * para as duas peças que continuam sendo alça e não moldura — a alça de arrastar
 * do painel modal e o ponto do indicador de tempo real.
 */
export const radius = {
  none: 0,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 4,
  pill: 999,
} as const;

/** Espessura dos traços. `hairline` é o filete dourado da placa de título. */
export const stroke = {
  hairline: 1,
  seal: 2,
  plate: 3,
} as const;

/** Escala tipográfica do briefing. */
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  display: 48,
} as const;

const CORPO = 1.5;
const DISPLAY = 1.15;

/** `.06em` convertido para pontos, que é a unidade de `letterSpacing` no RN. */
const versalete = (tamanho: number) => Math.round(tamanho * 0.06 * 100) / 100;

const linha = (tamanho: number, altura: number) => Math.round(tamanho * altura);

/**
 * Variantes de texto.
 *
 * As variantes de display vão em caixa alta com `.06em` de entreletra. Com a
 * fonte única do tema, é essa combinação — caixa alta, entreletra aberta e peso
 * — que continua separando "título de seção" de "linha de texto"; sem ela, uma
 * hierarquia inteira desabaria em diferenças só de corpo.
 *
 * O texto corrido fica em caixa normal: versalete em descrição de magia é
 * bonito por dez segundos e cansativo pelos dez minutos seguintes.
 *
 * Arial é fonte de sistema, então `fontWeight` vale e é de onde vem o negrito.
 */
export const typography = {
  display: {
    fontFamily: fontFamily.display,
    fontWeight: '700',
    fontSize: fontSize.xxxl,
    lineHeight: linha(fontSize.xxxl, DISPLAY),
    letterSpacing: versalete(fontSize.xxxl),
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fontFamily.display,
    fontWeight: '700',
    fontSize: fontSize.xxl,
    lineHeight: linha(fontSize.xxl, DISPLAY),
    letterSpacing: versalete(fontSize.xxl),
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: fontFamily.display,
    fontWeight: '700',
    fontSize: fontSize.xl,
    lineHeight: linha(fontSize.xl, DISPLAY),
    letterSpacing: versalete(fontSize.xl),
    textTransform: 'uppercase',
  },
  subheading: {
    fontFamily: fontFamily.ui,
    fontWeight: '700',
    fontSize: fontSize.lg,
    lineHeight: linha(fontSize.lg, 1.35),
  },
  body: {
    fontFamily: fontFamily.body,
    fontWeight: '400',
    fontSize: fontSize.md,
    lineHeight: linha(fontSize.md, CORPO),
  },
  bodyStrong: {
    fontFamily: fontFamily.body,
    fontWeight: '700',
    fontSize: fontSize.md,
    lineHeight: linha(fontSize.md, CORPO),
  },
  // Rótulo de controle: corpo de texto, mas na sem serifa da interface. Botão
  // com serifa vira citação; o que se quer ali é comando.
  label: {
    fontFamily: fontFamily.ui,
    fontWeight: '700',
    fontSize: fontSize.md,
    lineHeight: linha(fontSize.md, 1.35),
  },
  small: {
    fontFamily: fontFamily.ui,
    fontWeight: '400',
    fontSize: fontSize.sm,
    lineHeight: linha(fontSize.sm, CORPO),
  },
  smallStrong: {
    fontFamily: fontFamily.ui,
    fontWeight: '700',
    fontSize: fontSize.sm,
    lineHeight: linha(fontSize.sm, CORPO),
  },
  caption: {
    fontFamily: fontFamily.ui,
    fontWeight: '700',
    fontSize: fontSize.xs,
    lineHeight: linha(fontSize.xs, 1.35),
    letterSpacing: versalete(fontSize.xs),
    textTransform: 'uppercase',
  },
  // Números de ficha: tabulares para não "dançarem" quando o valor muda em
  // combate — a largura do dígito é a mesma, então a linha não se remexe.
  numeric: {
    fontFamily: fontFamily.numeric,
    fontWeight: '700',
    fontSize: fontSize.xxl,
    lineHeight: linha(fontSize.xxl, DISPLAY),
    fontVariant: ['tabular-nums'] as const,
  },
  numericLarge: {
    fontFamily: fontFamily.numeric,
    fontWeight: '700',
    fontSize: fontSize.xxxl,
    lineHeight: linha(fontSize.xxxl, DISPLAY),
    fontVariant: ['tabular-nums'] as const,
  },
} as const satisfies Record<string, TextStyle>;

/**
 * Alvos de toque. 44pt é o mínimo confortável; os botões de PV/PM da ficha
 * usam 48 porque são apertados às pressas durante o combate.
 */
export const hitSize = {
  min: 44,
  combat: 48,
} as const;

/** Ornamento de canto dos cards: dois traços em L, de 12px. */
export const ornament = {
  size: 12,
  weight: 1,
} as const;

export type Elevation = { card: ViewStyle; floating: ViewStyle };

/**
 * Sombras, calculadas a partir do tema.
 *
 * No claro a sombra faz o trabalho de sempre: separa o card do papel. No escuro
 * ela quase não aparece, de propósito — ali a elevação vem da cor (`surfaceAlt`
 * sobe em relação a `surface`), porque sombra preta sobre fundo quase preto não
 * comunica altura nenhuma e só suja a borda.
 */
export function elevation(palette: Palette): Elevation {
  const escuro = palette.scheme === 'dark';
  const cor = escuro ? '#000000' : '#2B2119';

  const montar = (opacidade: number, raio: number, deslocamento: number, android: number): ViewStyle =>
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: cor,
        shadowOpacity: opacidade,
        shadowRadius: raio,
        shadowOffset: { width: 0, height: deslocamento },
      },
      android: { elevation: android },
      default: { boxShadow: `0 ${deslocamento}px ${raio}px rgba(0, 0, 0, ${opacidade})` } as ViewStyle,
    })!;

  return escuro
    ? { card: montar(0.55, 12, 2, 2), floating: montar(0.65, 28, 10, 6) }
    : { card: montar(0.12, 8, 2, 2), floating: montar(0.2, 24, 10, 8) };
}

/**
 * Gradiente como estilo, sem dependência.
 *
 * O React Native passou a aceitar gradiente em `experimental_backgroundImage`;
 * o React Native Web usa o nome definitivo, `backgroundImage`. A diferença é só
 * de chave, então ela morre aqui e nenhum componente precisa saber. Vale para
 * `linear-gradient` nas três plataformas.
 *
 * Isto é o que dispensa `expo-linear-gradient`: o fio de rubi, o brilho do
 * botão e o preenchimento das barras de PV e PM saem todos daqui.
 */
export function gradient(valor: string): ViewStyle {
  return Platform.OS === 'web'
    ? ({ backgroundImage: valor } as unknown as ViewStyle)
    : ({ experimental_backgroundImage: valor } as unknown as ViewStyle);
}

/**
 * Grão de papel.
 *
 * Ruído gerado por `feTurbulence` em SVG embutido como data URI — sem arquivo de
 * imagem, sem requisição, e do tamanho de uma linha de código. Fica em 0.04 de
 * opacidade: o suficiente para o fundo deixar de ser uma chapa lisa, longe o
 * bastante para não competir com o texto.
 *
 * O retângulo é `fill="transparent"`: se o renderizador de SVG da plataforma
 * ignorar o filtro, o resultado é nada visível em vez de um bloco opaco.
 */
export const GRAIN_OPACITY = 0.04;

export const grainSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">` +
  `<filter id="g" x="0" y="0" width="100%" height="100%">` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>` +
  `<feColorMatrix type="saturate" values="0"/>` +
  `</filter>` +
  `<rect width="160" height="160" fill="transparent" filter="url(#g)"/>` +
  `</svg>`;

export const grainDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(grainSvg)}`;
