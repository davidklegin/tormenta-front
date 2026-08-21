import type { Palette } from './palettes';

/**
 * Cores de domínio, derivadas da paleta em vigor.
 *
 * A paleta diz o que é rubi e o que é ouro; este arquivo diz o que é PV, o que
 * é PM e o que é "esse personagem está prestes a cair". A separação importa: um
 * dia o vermelho da identidade pode mudar de tom, e nada aqui precisa mudar
 * junto — continua sendo "PV usa o rubi", seja qual for o rubi.
 */

/** Vida e mana. O rubi marca PV; o azul arcano, PM (briefing e livro, p. 106). */
export function vitalColors(palette: Palette) {
  return {
    hp: palette.primary,
    hpTrack: palette.hpTrack,
    mp: palette.info,
    mpTrack: palette.mpTrack,
  } as const;
}

export type Severity = 'ok' | 'warning' | 'critical' | 'down';

/**
 * Cor por faixa de gravidade do Painel do Mestre (briefing §7).
 *
 * A faixa vem calculada do backend para que todos os clientes concordem — o
 * cliente só escolhe como pintar. Usa as tintas de texto, e não as cores puras,
 * porque essa cor também vai em rótulo ao lado do nome do personagem.
 */
export function severityColors(palette: Palette): Record<Severity, string> {
  return {
    ok: palette.successInk,
    warning: palette.warningInk,
    critical: palette.dangerInk,
    down: palette.dangerInk,
  };
}

/**
 * Tons de etiqueta: tinta legível sobre um fundo tingido da mesma família.
 *
 * Fundo sólido, e não translúcido, de propósito. Uma etiqueta translúcida muda
 * de contraste conforme cai sobre o card ou sobre a faixa zebrada da tabela —
 * e uma delas acaba abaixo do mínimo sem ninguém perceber.
 */
export type ToneName = 'neutral' | 'primary' | 'arcane' | 'gold' | 'success' | 'warning' | 'danger';

export type Tone = {
  /** Fundo tingido, para a etiqueta em repouso. */
  fill: string;
  /** Tinta que lê sobre `fill`. */
  ink: string;
  /** Contorno da etiqueta. */
  border: string;
  /** Cor cheia da família: etiqueta selecionada, selo de lacre. */
  solid: string;
  /** Tinta que lê sobre `solid`. */
  onSolid: string;
};

export function tones(palette: Palette): Record<ToneName, Tone> {
  // Sobre preenchimento cheio, a tinta é sempre o extremo oposto do tema — o
  // creme no claro, o quase-preto no escuro. A exceção é o dourado: no claro
  // ele já é uma cor clara, então pede tinta escura nos dois temas.
  const sobreCheio = palette.onPrimary;

  return {
    neutral: {
      fill: palette.neutralFill,
      ink: palette.neutralInk,
      border: palette.border,
      solid: palette.textMuted,
      onSolid: palette.surface,
    },
    primary: {
      fill: palette.primaryFill,
      ink: palette.primaryInk,
      border: palette.primary,
      solid: palette.primary,
      onSolid: sobreCheio,
    },
    arcane: {
      fill: palette.infoFill,
      ink: palette.infoInk,
      border: palette.info,
      solid: palette.info,
      onSolid: sobreCheio,
    },
    gold: {
      fill: palette.accentFill,
      ink: palette.accentInk,
      border: palette.accent,
      solid: palette.accent,
      onSolid: palette.onAccent,
    },
    success: {
      fill: palette.successFill,
      ink: palette.successInk,
      border: palette.success,
      solid: palette.success,
      onSolid: sobreCheio,
    },
    warning: {
      fill: palette.warningFill,
      ink: palette.warningInk,
      border: palette.warning,
      solid: palette.warning,
      onSolid: sobreCheio,
    },
    danger: {
      fill: palette.dangerFill,
      ink: palette.dangerInk,
      border: palette.danger,
      solid: palette.danger,
      onSolid: sobreCheio,
    },
  };
}
