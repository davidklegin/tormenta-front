import { createContext, useContext, useMemo, useState } from 'react';
import { duration, useReducedMotion } from './motion';

export type MotionContextValue = {
  /** Movimento decorativo deve ser suprimido? */
  reduced: boolean;
  /** O sistema pediu redução, independente da simulação. */
  systemReduced: boolean;
  /** Liga a redução à força; `null` devolve o controle ao sistema. */
  simulateReduced: (valor: boolean | null) => void;
  /** Duração já resolvida: devolve 0 quando o movimento está reduzido. */
  ms: (chave: keyof typeof duration) => number;
};

const MotionContext = createContext<MotionContextValue | null>(null);

/**
 * Política de movimento do aplicativo.
 *
 * Existe por dois motivos. O primeiro é ter um lugar só que responde "posso
 * animar?", em vez de cada componente consultar a acessibilidade por conta
 * própria. O segundo é o guia de estilo: ele precisa demonstrar como cada
 * ornamento se comporta com movimento reduzido, e ninguém vai mexer na
 * configuração do sistema operacional no meio da demonstração — daí a
 * simulação, que sobrepõe o valor do sistema sem escondê-lo.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const doSistema = useReducedMotion();
  const [simulado, setSimulado] = useState<boolean | null>(null);

  const reduced = simulado ?? doSistema;

  const valor = useMemo<MotionContextValue>(
    () => ({
      reduced,
      systemReduced: doSistema,
      simulateReduced: setSimulado,
      ms: (chave) => (reduced ? 0 : duration[chave]),
    }),
    [reduced, doSistema]
  );

  return <MotionContext.Provider value={valor}>{children}</MotionContext.Provider>;
}

/**
 * Sem provedor acima, devolve o padrão conservador do React Native puro.
 * Isso mantém componentes isolados (um teste, uma tela solta) funcionando.
 */
export function useMotion(): MotionContextValue {
  const contexto = useContext(MotionContext);

  if (contexto) return contexto;

  return {
    reduced: false,
    systemReduced: false,
    simulateReduced: () => undefined,
    ms: (chave) => duration[chave],
  };
}
