import { Platform } from 'react-native';

/**
 * Ponte com o `public/ornaments.css`.
 *
 * Alguns ornamentos só existem no navegador — capitular com texto contornando a
 * letra, brilho por pseudo-elemento, barra de rolagem. Eles moram no CSS, e o
 * componente precisa de um jeito de marcar o elemento para o CSS achar.
 *
 * O React Native Web não repassa `className`, mas repassa `dataSet` como
 * `data-*`. Por isso o CSS responde tanto a `.t20-corners` quanto a
 * `[data-t20~='corners']`: a primeira forma para markup escrito à mão, a
 * segunda para o que sai daqui.
 *
 * No Android e no iOS devolve um objeto vazio, e o componente cai na
 * implementação nativa equivalente.
 */
export type OrnamentName =
  | 'dropcap'
  | 'corners'
  | 'ruby-thread'
  | 'sheen'
  | 'skeleton'
  | 'tooltip'
  | 'modal-overlay'
  | 'modal-panel'
  | 'toast'
  | 'crit'
  | 'fumble'
  | 'still';

/** Este ornamento é feito pelo CSS nesta plataforma? */
export const cssOrnaments = Platform.OS === 'web';

export function ornamentAttrs(...names: (OrnamentName | false | null | undefined)[]) {
  if (!cssOrnaments) return {};

  const ativos = names.filter(Boolean).join(' ');

  return ativos ? { dataSet: { t20: ativos } } : {};
}
