import { Platform } from 'react-native';

/**
 * Tipografia do tema.
 *
 * Arial nos quatro papéis, por decisão de projeto. Ela é fonte de sistema em
 * todas as plataformas de destino, o que traz três consequências boas: nenhuma
 * requisição externa, nenhum arquivo embarcado no APK e nenhum instante de
 * texto invisível esperando a fonte baixar no meio de uma sessão.
 *
 * O Android não traz Arial; pedir por ela ali resolve na sans-serif padrão do
 * sistema, que é o comportamento desejado — a pilha declarada aqui deixa isso
 * explícito em vez de deixar a plataforma decidir sozinha.
 *
 * Os quatro papéis continuam existindo como tokens (`display`, `body`, `ui`,
 * `numeric`) mesmo apontando para a mesma família: eles são o contrato que o
 * resto do aplicativo usa, e trocar a fonte de um papel — devolver Cinzel aos
 * títulos, por exemplo — volta a ser mexer em uma linha aqui.
 *
 * Diferente de uma fonte carregada, Arial responde a `fontWeight`: o negrito
 * vem do peso, e não de uma família por peso. Por isso `typography` declara
 * pesos, e não nomes de família com o peso embutido.
 */
const PILHA = Platform.select({
  ios: 'Arial',
  android: 'Arial',
  default: 'Arial, Helvetica, sans-serif',
})!;

export const fontFamily = {
  /** Títulos de seção e cabeçalhos. */
  display: PILHA,
  displayStrong: PILHA,
  displayLight: PILHA,

  /** Texto corrido. */
  body: PILHA,
  bodyMedium: PILHA,
  bodyStrong: PILHA,

  /** Interface: rótulos, botões, tabelas, formulários. */
  ui: PILHA,
  uiMedium: PILHA,
  uiStrong: PILHA,

  /** Números de ficha. Os algarismos da Arial já têm largura uniforme. */
  numeric: PILHA,
} as const;

/**
 * Carrega as fontes do tema.
 *
 * Com Arial não há o que carregar — a fonte já está no aparelho. A função
 * continua existindo, e continua sendo aguardada na raiz do aplicativo, porque
 * é o ponto de extensão para quando alguma família precisar de download de
 * novo; devolvendo `true` de imediato, a raiz simplesmente não espera.
 */
export function useAppFonts(): boolean {
  return true;
}
