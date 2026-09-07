/**
 * Leitura e rolagem de fórmulas de dano escritas à mão.
 *
 * O que chega aqui é o que o mestre digitou na ficha da criatura — "2d6+3",
 * "1d8", "2d4 + 1d6", às vezes com o crítico grudado ("1d12+4/x3"). O texto é
 * livre porque o acervo é livre, então a leitura tolera o que der e desiste
 * silenciosamente do que não der: uma fórmula ilegível vira "sem rolagem", não
 * um erro na tela no meio do combate.
 */

export type ParcelaDeDano = { quantidade: number; faces: number };

export type FormulaDeDano = {
  parcelas: ParcelaDeDano[];
  fixo: number;
};

export type RolagemDeDano = {
  /** Cada dado que caiu, na ordem em que foi lido. */
  dados: number[];
  fixo: number;
  total: number;
};

/** Casa "2d6", "d8", "+3", "- 2" — os pedaços de qualquer fórmula da mesa. */
const PEDACO = /([+-]?)\s*(\d*)\s*d\s*(\d+)|([+-])\s*(\d+)/gi;

/**
 * Isola o trecho que descreve o dano.
 *
 * A ficha de criatura escreve o ataque inteiro numa linha: "Garra +12
 * (1d8+5)". O "+12" ali é o bônus de ACERTO, e somá-lo ao dano — como faria
 * uma leitura ingênua da linha toda — daria 17 de fixo num golpe de 1d8+5.
 * Quando há parênteses com dados dentro, é só aquilo que se rola.
 */
function trechoDoDano(texto: string): string {
  for (const grupo of texto.matchAll(/\(([^)]*)\)/g)) {
    const dentro = grupo[1] ?? '';

    if (/\d*\s*d\s*\d+/i.test(dentro)) return dentro;
  }

  return texto;
}

/**
 * Lê uma fórmula. Null quando não há nenhum dado nela.
 *
 * O corte no "/" tira a notação de crítico ("/x3", "/19"), que descreve o que
 * acontece num acerto crítico e não faz parte do dano rolado.
 */
export function lerFormulaDeDano(texto: string): FormulaDeDano | null {
  const limpo = trechoDoDano(texto).split('/')[0] ?? '';

  const parcelas: ParcelaDeDano[] = [];
  let fixo = 0;

  for (const achado of limpo.matchAll(PEDACO)) {
    const [, sinalDado, quantidade, faces, sinalFixo, valorFixo] = achado;

    if (faces !== undefined) {
      const lados = Number.parseInt(faces, 10);

      if (lados < 2 || lados > 100) continue;

      const vezes = quantidade === undefined || quantidade === '' ? 1 : Number.parseInt(quantidade, 10);

      if (vezes < 1 || vezes > 50) continue;

      parcelas.push({ quantidade: sinalDado === '-' ? -vezes : vezes, faces: lados });

      continue;
    }

    if (valorFixo !== undefined) {
      const valor = Number.parseInt(valorFixo, 10);
      fixo += sinalFixo === '-' ? -valor : valor;
    }
  }

  return parcelas.length === 0 ? null : { parcelas, fixo };
}

/** Rola uma fórmula já lida. O total nunca é negativo — cura por dano não existe. */
export function rolarDano(formula: FormulaDeDano): RolagemDeDano {
  const dados: number[] = [];
  let soma = 0;

  for (const parcela of formula.parcelas) {
    const vezes = Math.abs(parcela.quantidade);
    const sinal = parcela.quantidade < 0 ? -1 : 1;

    for (let i = 0; i < vezes; i++) {
      const caiu = 1 + Math.floor(Math.random() * parcela.faces);

      dados.push(caiu);
      soma += sinal * caiu;
    }
  }

  return { dados, fixo: formula.fixo, total: Math.max(0, soma + formula.fixo) };
}

/** Lê e rola de uma vez. Null quando o texto não tem fórmula nenhuma. */
export function rolarTextoDeDano(texto: string): RolagemDeDano | null {
  const formula = lerFormulaDeDano(texto);

  return formula === null ? null : rolarDano(formula);
}
