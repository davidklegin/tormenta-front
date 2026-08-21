/**
 * Ilustrações de estado vazio.
 *
 * Desenhos autorais, monocromáticos, feitos com um punhado de linhas: um baú
 * fechado, um mapa dobrado, um dado parado. Traço na cor da borda, com um único
 * detalhe em ouro — a fechadura, a rosa dos ventos, o pip do vinte.
 *
 * São SVG embutidos como data URI porque assim atravessam as três plataformas
 * sem virar arquivo e sem pedir biblioteca: o `expo-image` decodifica SVG no
 * Android (AndroidSVG), no iOS e na web. Só formas simples — nada de filtro,
 * que é justamente o que os decodificadores nativos não cobrem por inteiro.
 *
 * As cores entram por parâmetro para o desenho acompanhar o tema, em vez de
 * existirem duas versões da mesma ilustração.
 */
export type IllustrationName = 'bau' | 'mapa' | 'dado';

type Tintas = { stroke: string; accent: string };

const envelope = (conteudo: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 96" fill="none" ` +
      `stroke-linecap="round" stroke-linejoin="round">${conteudo}</svg>`
  )}`;

const DESENHOS: Record<IllustrationName, (tintas: Tintas) => string> = {
  /** Baú fechado: nada guardado aqui ainda. */
  bau: ({ stroke, accent }) =>
    `<g stroke="${stroke}" stroke-width="2">` +
    `<path d="M22 44h76v34a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4z"/>` +
    `<path d="M22 44a38 38 0 0 1 76 0"/>` +
    `<path d="M22 58h76"/>` +
    `<path d="M36 30v14M84 30v14"/>` +
    `</g>` +
    `<g stroke="${accent}" stroke-width="2">` +
    `<rect x="53" y="52" width="14" height="14" rx="2"/>` +
    `<path d="M60 58v4"/>` +
    `</g>`,

  /** Mapa dobrado: o território existe, só não foi percorrido. */
  mapa: ({ stroke, accent }) =>
    `<g stroke="${stroke}" stroke-width="2">` +
    `<path d="M18 26l26-8 32 10 26-8v54l-26 8-32-10-26 8z"/>` +
    `<path d="M44 18v54M76 28v54"/>` +
    `</g>` +
    `<g stroke="${accent}" stroke-width="2">` +
    `<circle cx="60" cy="48" r="7"/>` +
    `<path d="M60 37v-5M60 64v-5M49 48h-5M76 48h-5"/>` +
    `</g>`,

  /** Dado parado: a rolagem ainda não aconteceu. */
  dado: ({ stroke, accent }) =>
    `<g stroke="${stroke}" stroke-width="2">` +
    `<path d="M60 16l34 20v40L60 96 26 76V36z"/>` +
    `<path d="M26 36l34 20 34-20M60 56v40"/>` +
    `</g>` +
    `<g stroke="${accent}" stroke-width="2" fill="${accent}">` +
    `<circle cx="60" cy="34" r="3"/>` +
    `</g>`,
};

export function illustration(name: IllustrationName, tintas: Tintas): string {
  return envelope(DESENHOS[name](tintas));
}
