import dados from './palettes.data.json';

/**
 * As duas paletas do aplicativo, tipadas.
 *
 * As cores em si moram em `palettes.data.json` porque o mesmo arquivo alimenta
 * dois consumidores: este módulo, no aplicativo, e `tools/gen-theme-css.mjs`,
 * que escreve as custom properties de `public/theme.css` para a web. Uma fonte
 * só, sem cópia para esquecer de atualizar.
 *
 * **Pergaminho** (claro) é papel envelhecido com tinta rubi e ouro velho.
 * **Tempestade Rubra** (escuro) não é a inversão do claro: o fundo é um preto
 * quente, as superfícies sobem por cor — e não por sombra —, e o rubi e o ouro
 * ganham luminosidade para não afundarem no escuro.
 *
 * ## Por que existem cores além das do briefing
 *
 * O briefing fixa a identidade; alguns papéis de interface não cabem nela sem
 * quebrar o contraste mínimo AA, que o próprio briefing exige. Onde isso
 * aconteceu, a cor original continua no lugar dela e ganhou uma companheira:
 *
 * - `accent` (#B8860B) é o ouro do briefing e vale para ornamento. Como texto
 *   no claro ele dá 3.0 sobre o card — abaixo de AA. Então texto e ícone
 *   dourados usam `accentInk`, um ouro queimado que dá 6.0.
 * - `primaryContrast` é o valor do briefing. O rótulo sobre preenchimento rubi
 *   usa `onPrimary`, quase idêntico, porque no escuro o valor do briefing dá
 *   4.48 contra os 4.5 exigidos.
 * - `*Ink` e `*Fill` formam os pares de etiqueta (Badge, Chip, avisos): o fundo
 *   é uma superfície tingida, não uma cor translúcida, para que o contraste
 *   seja o mesmo esteja a etiqueta sobre o card ou sobre a faixa zebrada.
 * - `warning` não existe no briefing e o aplicativo precisa dele (penalidade de
 *   armadura, PV em faixa crítica). É derivado da família do ouro.
 *
 * `tools/check-contrast.mjs` confere todos esses pares e falha se algum cair.
 */
export type Palette = {
  /** Nome do tema, como aparece no seletor. */
  name: string;
  /** Esquema do sistema correspondente, para barra de status e `color-scheme`. */
  scheme: 'light' | 'dark';

  // Superfícies
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceHover: string;

  // Traços
  border: string;
  /** Contorno de controle (campo, botão outline): cumpre 3:1 contra a superfície. */
  borderStrong: string;

  // Texto, do mais forte ao mais discreto
  text: string;
  textMuted: string;
  textSubtle: string;

  // Rubi
  primary: string;
  primaryHover: string;
  /** Valor do briefing para texto sobre rubi. Componentes usam `onPrimary`. */
  primaryContrast: string;
  onPrimary: string;
  /** Texto sobre preenchimento dourado cheio. */
  onAccent: string;

  // Ouro
  accent: string;
  accentSoft: string;

  // Semânticas
  danger: string;
  success: string;
  warning: string;
  info: string;

  // Tintas de texto — versões das semânticas que cumprem AA como texto
  primaryInk: string;
  accentInk: string;
  successInk: string;
  warningInk: string;
  dangerInk: string;
  infoInk: string;
  neutralInk: string;

  // Preenchimentos de etiqueta
  primaryFill: string;
  accentFill: string;
  successFill: string;
  warningFill: string;
  dangerFill: string;
  infoFill: string;
  neutralFill: string;

  // Vitalidade
  hpTrack: string;
  mpTrack: string;

  // Diversos
  shadow: string;
  overlay: string;
  /** Sombreamento de profundidade: relevo do selo, curva das barras de PV/PM. */
  shade: string;
  /** Halo dos elementos ativos. Discreto no escuro, quase ausente no claro. */
  glow: string;
};

type PaletteData = Omit<Palette, 'name' | 'scheme'> & { $name: string; $scheme: 'light' | 'dark' };

function montar(bruta: PaletteData): Palette {
  const { $name, $scheme, ...cores } = bruta;

  return { name: $name, scheme: $scheme, ...cores };
}

export type ThemeName = 'light' | 'dark';

export const palettes: Record<ThemeName, Palette> = {
  light: montar(dados.light as PaletteData),
  dark: montar(dados.dark as PaletteData),
};

/** Ordem em que o seletor alterna os temas. */
export const themeNames: ThemeName[] = ['light', 'dark'];
