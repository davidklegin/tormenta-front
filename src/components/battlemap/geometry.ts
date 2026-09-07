import type { AreaEffect, FogRegion } from '@/api/types';

/** Um quadrado do tabuleiro vale 1,5 m (Tormenta 20, p. 105). */
export const METROS_POR_QUADRADO = 1.5;

export type Celula = { x: number; y: number };

/**
 * Distância entre dois quadrados, em metros.
 *
 * Tormenta 20 cobra 3 m pela diagonal — o dobro da ortogonal. É a regra
 * "Padrão" do sistema oficial (o Tormenta20 para Foundry traz `diagonals: 3`,
 * com "Equidistante (1,5m)" e "Pathfinder" apenas como alternativas), e por
 * isso a conta é a soma dos dois eixos, e não o maior deles nem Pitágoras.
 *
 * A diferença não é acadêmica: quatro quadrados na diagonal são 12 m pela
 * regra da mesa e 6 m por Chebyshev. Uma régua que discordasse disso poria a
 * peça dentro do alcance de um ataque que, na conta do mestre, não alcança.
 */
export function distanciaEmMetros(de: Celula, para: Celula): number {
  const dx = Math.abs(para.x - de.x);
  const dy = Math.abs(para.y - de.y);

  return (dx + dy) * METROS_POR_QUADRADO;
}

/** Formata a distância como a mesa fala: "9 m", "4,5 m". */
export function formatarDistancia(metros: number): string {
  const texto = Number.isInteger(metros) ? String(metros) : metros.toFixed(1).replace('.', ',');

  return `${texto} m`;
}

/**
 * O ponto está dentro do polígono? (ray casting)
 *
 * É a mesma conta que o servidor faz para decidir o que não mandar ao jogador
 * (BattleMap::isUnderFog). Aqui ela serve só para desenhar: o que chegou nesta
 * tela já veio podado.
 */
export function pontoNoPoligono(x: number, y: number, pontos: Celula[]): boolean {
  if (pontos.length < 3) return false;

  let dentro = false;

  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const atual = pontos[i];
    const anterior = pontos[j];

    if (!atual || !anterior) continue;

    const cruza =
      atual.y > y !== anterior.y > y &&
      x < ((anterior.x - atual.x) * (y - atual.y)) / (anterior.y - atual.y || 1e-9) + atual.x;

    if (cruza) dentro = !dentro;
  }

  return dentro;
}

/**
 * Quais quadrados a névoa cobre.
 *
 * A névoa é guardada como polígono — uma sala retangular são quatro pontos, e
 * não cem células — mas desenhada quadrado a quadrado, que é como o tabuleiro
 * existe. Varre o mapa uma vez por mudança; a tela memoiza o resultado.
 */
export function celulasDaNevoa(regioes: FogRegion[], largura: number, altura: number): Celula[] {
  if (regioes.length === 0) return [];

  const celulas: Celula[] = [];

  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      // O centro do quadrado, e não o canto: um vértice em cima da borda
      // deixaria a fileira inteira oscilando entre coberta e descoberta.
      const dentro = regioes.some((regiao) => pontoNoPoligono(x + 0.5, y + 0.5, regiao.points));

      if (dentro) celulas.push({ x, y });
    }
  }

  return celulas;
}

/**
 * Quais quadrados uma área de efeito pega.
 *
 * Resolver por quadrado (e não desenhar um círculo bonito por cima) é o que a
 * mesa precisa responder: "eu estou dentro da bola de fogo?". A pergunta é
 * sempre sobre o quadrado onde a peça está.
 *
 * A conta de alcance é a mesma da régua — diagonal por 3 m —, então a esfera
 * sai como losango, e não como quadrado. Feio, e certo: se a área usasse uma
 * métrica e a régua usasse outra, o jogador mediria 9 m até a borda de uma
 * bola de fogo de 6 m e continuaria pintado de vermelho.
 */
export function celulasDaArea(efeito: AreaEffect, largura: number, altura: number): Celula[] {
  const celulas: Celula[] = [];
  const origem = { x: efeito.x, y: efeito.y };

  const cabe = (x: number, y: number) => x >= 0 && y >= 0 && x < largura && y < altura;

  if (efeito.shape === 'circle') {
    const raio = efeito.radius ?? 0;

    for (let y = Math.floor(origem.y - raio); y <= Math.ceil(origem.y + raio); y++) {
      for (let x = Math.floor(origem.x - raio); x <= Math.ceil(origem.x + raio); x++) {
        if (cabe(x, y) && Math.abs(x - origem.x) + Math.abs(y - origem.y) <= raio) {
          celulas.push({ x, y });
        }
      }
    }

    return celulas;
  }

  if (efeito.shape === 'cube') {
    const lado = Math.round(efeito.length ?? 0);

    for (let y = origem.y; y < origem.y + lado; y++) {
      for (let x = origem.x; x < origem.x + lado; x++) {
        if (cabe(x, y)) celulas.push({ x, y });
      }
    }

    return celulas;
  }

  if (efeito.shape === 'line') {
    const comprimento = Math.round(efeito.length ?? 0);
    const espessura = Math.max(1, Math.round(efeito.width ?? 1));
    const radianos = ((efeito.direction ?? 0) * Math.PI) / 180;
    const dx = Math.cos(radianos);
    const dy = Math.sin(radianos);

    for (let passo = 0; passo < comprimento; passo++) {
      for (let lado = 0; lado < espessura; lado++) {
        const x = Math.round(origem.x + dx * passo - dy * lado);
        const y = Math.round(origem.y + dy * passo + dx * lado);

        if (cabe(x, y) && !celulas.some((c) => c.x === x && c.y === y)) {
          celulas.push({ x, y });
        }
      }
    }

    return celulas;
  }

  // Cone: tudo dentro do alcance cuja direção não se afasta mais que 30° do
  // eixo — o cone de 90° do livro, medido a partir do quadrado de origem.
  const alcance = efeito.length ?? efeito.radius ?? 0;
  const eixo = ((efeito.direction ?? 0) * Math.PI) / 180;
  const abertura = Math.PI / 4;

  for (let y = Math.floor(origem.y - alcance); y <= Math.ceil(origem.y + alcance); y++) {
    for (let x = Math.floor(origem.x - alcance); x <= Math.ceil(origem.x + alcance); x++) {
      if (!cabe(x, y)) continue;

      const vx = x - origem.x;
      const vy = y - origem.y;

      if (vx === 0 && vy === 0) continue;
      if (Math.abs(vx) + Math.abs(vy) > alcance) continue;

      // Diferença angular normalizada para o intervalo [-π, π].
      let desvio = Math.atan2(vy, vx) - eixo;
      while (desvio > Math.PI) desvio -= 2 * Math.PI;
      while (desvio < -Math.PI) desvio += 2 * Math.PI;

      if (Math.abs(desvio) <= abertura) celulas.push({ x, y });
    }
  }

  return celulas;
}

/** O nome da forma como a mesa a chama — o rótulo da barra e o da lista. */
export function nomeDaForma(forma: AreaEffect['shape']): string {
  if (forma === 'circle') return 'Esfera';
  if (forma === 'cone') return 'Cone';
  if (forma === 'line') return 'Linha';

  return 'Cubo';
}

/**
 * O alcance de uma área, em metros, como a magia se descreve.
 *
 * A esfera se mede do centro (`radius`); cone, linha e cubo se estendem a
 * partir da origem (`length`). Sem essa distinção, uma bola de fogo de 6 m
 * apareceria na lista sem alcance nenhum, porque o campo que ela usa não é o
 * mesmo que o cone usa.
 */
export function alcanceEmMetros(efeito: AreaEffect): number | null {
  const quadrados = efeito.shape === 'circle' ? efeito.radius : efeito.length;

  if (quadrados === undefined || quadrados <= 0) return null;

  return quadrados * METROS_POR_QUADRADO;
}

/** Converte um par de cantos em polígono de quatro pontos, para a névoa. */
export function retanguloComoPoligono(a: Celula, b: Celula): FogRegion {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x, b.x) + 1;
  const y2 = Math.max(a.y, b.y) + 1;

  return {
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
  };
}
