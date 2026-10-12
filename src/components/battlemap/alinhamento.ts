import type { BattleMapGrid, BattleMapImageAlignment } from '@/api/types';

/**
 * A conta do alinhamento entre a imagem de fundo e a grade.
 *
 * Tudo aqui vive em pixels da imagem original, e não da tela: a medida tem de
 * valer igual no celular do mestre, na TV e no notebook do jogador, cada um
 * desenhando o mapa num tamanho diferente.
 */

/** Um retângulo em pixels da imagem. */
export type RetanguloNaImagem = { x: number; y: number; largura: number; altura: number };

export type Alinhamento = {
  /** Pixels da imagem por quadrado, em cada eixo. */
  quadradoX: number;
  quadradoY: number;
  /** Onde, na imagem, fica o canto de cima à esquerda do quadrado A1. */
  origemX: number;
  origemY: number;
  /** Quantos quadrados a grade passa a ter. */
  colunas: number;
  linhas: number;
};

/** O que a API aceita de lado de cada grade. */
export const MENOR_GRADE = 5;
export const MAIOR_GRADE = 100;

/**
 * Quanto de um quadrado cortado na borda precisa estar na imagem para ele
 * entrar na grade.
 *
 * Mapas desenhados raramente terminam numa linha: sobra meio quadrado de
 * parede numa borda, um terço de chão na outra. Com o corte em 60%, o quadrado
 * quase inteiro entra — o mestre pode pôr uma peça ali — e a lasca fina fica
 * de fora, onde não caberia peça nenhuma.
 */
const PEDACO_QUE_CONTA = 0.6;

/** Resto sempre positivo: o `%` do JavaScript devolve negativo para negativo. */
function resto(valor: number, divisor: number): number {
  return ((valor % divisor) + divisor) % divisor;
}

/**
 * O alinhamento que sai do retângulo marcado pelo mestre.
 *
 * O retângulo cobre `quadradosX` × `quadradosY` quadrados do desenho. Daí sai
 * o tamanho do quadrado; e como o canto do retângulo cai numa linha da grade
 * desenhada, a primeira linha da imagem é esse canto voltando de quadrado em
 * quadrado até a borda. Marcar vários quadrados de uma vez dilui o erro do
 * dedo: errar dois pixels numa sala de oito quadrados é um quarto de pixel por
 * quadrado.
 */
export function alinhamentoDoRetangulo(
  retangulo: RetanguloNaImagem,
  quadradosX: number,
  quadradosY: number,
  larguraDaImagem: number,
  alturaDaImagem: number
): Alinhamento | null {
  if (quadradosX < 1 || quadradosY < 1) return null;

  const quadradoX = retangulo.largura / quadradosX;
  const quadradoY = retangulo.altura / quadradosY;
  if (!(quadradoX > 1) || !(quadradoY > 1)) return null;

  let origemX = resto(retangulo.x, quadradoX);
  let origemY = resto(retangulo.y, quadradoY);

  // O pedaço antes da primeira linha inteira também pode valer um quadrado.
  if (origemX >= quadradoX * PEDACO_QUE_CONTA) origemX -= quadradoX;
  if (origemY >= quadradoY * PEDACO_QUE_CONTA) origemY -= quadradoY;

  const colunas = Math.floor((larguraDaImagem - origemX) / quadradoX + (1 - PEDACO_QUE_CONTA));
  const linhas = Math.floor((alturaDaImagem - origemY) / quadradoY + (1 - PEDACO_QUE_CONTA));

  return { quadradoX, quadradoY, origemX, origemY, colunas, linhas };
}

/** Limita ao que a API aceita. */
export function gradePermitida(quadrados: number): number {
  return Math.max(MENOR_GRADE, Math.min(MAIOR_GRADE, quadrados));
}

/**
 * O retângulo de partida da tela de alinhar.
 *
 * Com alinhamento gravado, ele já nasce sobre `quadrados` × `quadrados` da
 * grade atual, perto do centro — reabrir a tela para um ajuste fino não pode
 * começar do zero. Sem alinhamento, parte do que o tabuleiro faz hoje (a
 * imagem esticada sobre a grade), que costuma estar perto do certo.
 */
export function retanguloInicial(
  grade: BattleMapGrid | null,
  larguraDaImagem: number,
  alturaDaImagem: number,
  quadrados: number
): RetanguloNaImagem {
  const atual = grade?.image ?? null;

  const quadradoX = atual?.square_width ?? larguraDaImagem / (grade?.width || 20);
  const quadradoY = atual?.square_height ?? alturaDaImagem / (grade?.height || 15);
  const origemX = atual?.origin_x ?? 0;
  const origemY = atual?.origin_y ?? 0;

  const coluna = Math.max(0, Math.floor((larguraDaImagem / 2 - origemX) / quadradoX - quadrados / 2));
  const linha = Math.max(0, Math.floor((alturaDaImagem / 2 - origemY) / quadradoY - quadrados / 2));

  return {
    x: origemX + coluna * quadradoX,
    y: origemY + linha * quadradoY,
    largura: quadradoX * quadrados,
    altura: quadradoY * quadrados,
  };
}

/**
 * Onde a imagem alinhada fica dentro do tabuleiro, em pixels do tabuleiro.
 *
 * `lado` é o tamanho do quadrado no tabuleiro. A imagem pode começar antes do
 * A1 (origem positiva: há desenho antes da primeira linha) e passar da última
 * coluna; o que sobra fica fora da grade e é cortado.
 */
export function posicaoDaImagem(alinhamento: BattleMapImageAlignment, lado: number) {
  return {
    left: (-alinhamento.origin_x / alinhamento.square_width) * lado,
    top: (-alinhamento.origin_y / alinhamento.square_height) * lado,
    width: (alinhamento.width / alinhamento.square_width) * lado,
    height: (alinhamento.height / alinhamento.square_height) * lado,
  };
}

/** Pixels com até duas casas, na vírgula da mesa. */
export function formatarPixels(valor: number): string {
  return `${(Math.round(valor * 100) / 100).toLocaleString('pt-BR')} px`;
}
