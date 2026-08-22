import { useEffect, useState } from 'react';

/**
 * Segura um valor por `delay` antes de deixá-lo passar.
 *
 * Usado nas buscas dos catálogos: sem isso, digitar "bola de fogo" dispararia
 * doze requisições, uma por letra.
 */
export function useDebounced<T>(value: T, delay: number): T {
  const [atrasado, setAtrasado] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setAtrasado(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return atrasado;
}
