import type { ReactNode } from 'react';

export type NoticeHostProps = {
  /** Distância do topo da tela, já contando a área segura. */
  top: number;
  /** No celular os avisos ocupam a largura toda; em telas maiores, o canto. */
  aoLado: boolean;
  children: ReactNode;
};
