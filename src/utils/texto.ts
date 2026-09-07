/**
 * Comparação de texto para busca.
 *
 * Ninguém digita "poção" com til e cedilha no meio da mesa — escreve "pocao"
 * e espera achar. Quem escreve certo também tem de achar, então a comparação
 * dobra os dois lados: o termo digitado e o texto do catálogo passam pela
 * mesma redução antes de se encontrarem.
 */

/** Os acentos que o NFD desprega da letra, para serem descartados. */
const DIACRITICOS = /[\u0300-\u036f]/g;

/** Minúscula e sem acento: "Poção" e "pocao" viram o mesmo "pocao". */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase();
}

/** O termo — já normalizado — aparece no texto, ignorando acento e caixa. */
export function contemTermo(texto: string | null | undefined, termoNormalizado: string): boolean {
  return texto ? normalizar(texto).includes(termoNormalizado) : false;
}
