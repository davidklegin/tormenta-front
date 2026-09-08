import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import type { CombatCondition, CombatEntry, CombatState, ReferenceCondition } from '@/api/types';
import { Icon, Text } from '@/components/ui';
import { radius, spacing, stroke, useResponsive, useTheme } from '@/theme';
import { ConditionBadges } from './ConditionBadges';
import { DamagePopover } from './DamagePopover';

type Props = {
  combat: CombatState;
  isMaster: boolean;
  conditions: ReferenceCondition[];
  compacto?: boolean;
  /** Fichas desta pessoa: definem de quem ela pode ver e mexer nos vitais. */
  minhasFichas?: number[];
  onNextTurn?: () => void;
  onPreviousTurn?: () => void;
  /** Ausente onde não se aplica dano — o tabuleiro. Sem ela, a caixa some. */
  onApplyDamage?: (entryId: string, amount: number) => void;
  onUndoDamage?: () => void;
  onReorder?: (entryIds: string[]) => void;
  onOpenConditions?: (entry: CombatEntry) => void;
  onRemoveCondition?: (entry: CombatEntry, condition: CombatCondition) => void;
  onOpenSheet?: (entry: CombatEntry) => void;
};

/**
 * Uma linha da fila: ou um combatente, ou um bando de iguais lado a lado.
 *
 * `primeiro` é separado de `membros` porque um bando vazio não existe, e sem
 * isso todo acesso ao representante do grupo viraria um teste de nulo.
 */
type Linha = {
  chave: string;
  primeiro: CombatEntry;
  membros: CombatEntry[];
  primeiroIndice: number;
};

/** Largura do bloco no tamanho de sempre. */
const LARGURA = 316;
const LARGURA_COMPACTA = 232;

/** Altura da fila no tamanho de sempre — dali para baixo ela rola. */
const ALTURA_DA_FILA = 420;

/** Piso da fila quando a ampliação come a altura da tela. */
const ALTURA_MINIMA_DA_FILA = 150;

/** Cabeçalho, rodapé e bordas: o que ocupa altura fora da fila. */
const MOLDURA = 96;

/** O que fica acima e abaixo do bloco na tela do tabuleiro. */
const FOLGA_DA_TELA = 140;

/** Teto da ampliação. Acima disto o bloco vira a tela inteira. */
const ESCALA_MAXIMA = 2.4;

/** Onde o toque simples na alça leva, sem precisar mirar o arrasto. */
const ESCALA_DE_UM_TOQUE = 1.6;

/** Acima disto o bloco conta como ampliado (folga para o arredondamento). */
const AMPLIADO = 1.02;

/**
 * A fila de iniciativa com os vitais, do lado do tabuleiro.
 *
 * Responde de relance as três perguntas que a mesa repete em combate — de quem
 * é a vez, quanto falta para a minha, e quanto de vida sobrou em cada um —, e
 * deixa o mestre agir sobre elas sem sair do mapa: dano, condição e correção
 * de ordem estão todos a um toque da mesma lista.
 *
 * O que cada pessoa vê é diferente. O mestre lê o PV de todo mundo; o jogador
 * lê o das próprias fichas e, dos NPCs, só as condições — que são marcadores
 * que o mestre pendurou justamente para a mesa ver.
 */
export function CombatSidebar({
  combat,
  isMaster,
  conditions,
  compacto = false,
  minhasFichas = [],
  onNextTurn,
  onPreviousTurn,
  onApplyDamage,
  onUndoDamage,
  onReorder,
  onOpenConditions,
  onRemoveCondition,
  onOpenSheet,
}: Props) {
  const { colors, elevation } = useTheme();

  const { width: janelaLargura, height: janelaAltura } = useResponsive();

  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  /*
    A ampliação é um fator de escala sobre o bloco inteiro, e não uma largura
    maior: o que a mesa reclama é do tamanho da letra e do retrato — esticar só
    a caixa daria os mesmos 11px de nome no meio de espaço vazio.
  */
  const [escala, setEscala] = useState(1);

  const largura = compacto ? LARGURA_COMPACTA : LARGURA;

  /* Teto: ampliado, o bloco ainda tem que caber na largura da janela. */
  const escalaMaxima = Math.max(
    1,
    Math.min(ESCALA_MAXIMA, (janelaLargura - spacing.xl) / largura)
  );

  /*
    A fila encolhe em pontos o quanto a ampliação a estica em pixels. Sem isto,
    dobrar o bloco jogaria metade da ordem para fora da borda de baixo — e a
    fila é justamente o que se foi ampliar para ler.
  */
  const alturaDaFila = Math.max(
    ALTURA_MINIMA_DA_FILA,
    Math.min(ALTURA_DA_FILA, (janelaAltura - FOLGA_DA_TELA) / escala - MOLDURA)
  );

  /*
    Janela menor — o mestre girou o tablet, ou encolheu a janela do navegador —
    traz o bloco de volta para dentro dela. Sem isto a ampliação escolhida no
    desktop deixa a alça fora da tela no celular, e não há como desfazê-la.
  */
  useEffect(() => {
    setEscala((atual) => Math.min(atual, escalaMaxima));
  }, [escalaMaxima]);

  /*
    O gesto é montado uma vez e lê tudo por referência: remontá-lo a cada
    render mataria o arrasto em andamento, e a fila re-renderiza sozinha a cada
    turno e a cada dano que chega pelo tempo real.
  */
  const medidas = useRef({ largura, altura: 0, escala, maxima: escalaMaxima });
  medidas.current.largura = largura;
  medidas.current.escala = escala;
  medidas.current.maxima = escalaMaxima;

  const escalaAoPegar = useRef(1);

  /* Distingue o arrasto do toque: os dois começam igual, no mesmo dedo. */
  const arrastou = useRef(false);

  /*
    Quando a mão soltou o ponteiro. O navegador ainda emite um clique depois do
    arrasto, e sem esta marca terminar de puxar desfaria a ampliação que se
    acabou de escolher — o toque do teclado e o do leitor de tela chegam por
    esse mesmo clique, e continuam passando porque não vêm depois de um gesto.
  */
  const fimDoGesto = useRef(0);

  const puxador = useRef(
    PanResponder.create({
      /*
        A alça toma o gesto no primeiro contato e pela descida (`Capture`) — as
        duas coisas contra o costume, e as duas necessárias.

        No costume, quem quer arrastar espera alguns pixels de movimento para
        não roubar o toque de ninguém. Aqui isso não funcionava: o botão de
        dentro vira o responder no contato (ele é consultado antes, por estar
        mais fundo), e a partir daí a negociação por movimento só ouve quem
        está debaixo do ponteiro. A alça tem 28×22, e um puxão de verdade já
        sai dela no primeiro passo — o gesto nunca chegava a começar, sem erro
        nenhum: a escala apenas não saía do lugar.

        O preço é que o botão de dentro não vê mais o toque do dedo nem o do
        mouse; quem decide entre puxar e tocar é o `onPanResponderRelease` aqui
        embaixo, e o botão fica sendo o caminho do teclado e do leitor de tela.
      */
      onStartShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: () => {
        escalaAoPegar.current = medidas.current.escala;
        arrastou.current = false;
      },

      onPanResponderMove: (_evento, gesto) => {
        if (Math.abs(gesto.dx) > 3 || Math.abs(gesto.dy) > 3) arrastou.current = true;

        if (!arrastou.current) return;

        const { largura: l, altura: a } = medidas.current;
        const diagonal = l * l + a * a;

        if (diagonal === 0) return;

        /*
          O bloco cresce a partir do canto de cima à direita, então a alça mora
          em `escala × (−largura, altura)`. Projetar o dedo nesse vetor é o que
          faz o canto acompanhar a mão em vez de correr na frente dela.
        */
        const avanco = (gesto.dx * -l + gesto.dy * a) / diagonal;
        const alvo = escalaAoPegar.current + avanco;

        setEscala(Math.round(Math.min(Math.max(alvo, 1), medidas.current.maxima) * 100) / 100);
      },

      onPanResponderRelease: () => {
        fimDoGesto.current = Date.now();

        if (!arrastou.current) alternar.current();
      },

      onPanResponderTerminate: () => {
        fimDoGesto.current = Date.now();
      },
    })
  ).current;

  /*
    Alternar entre o tamanho de sempre e o ampliado, lido por referência: o
    gesto é montado uma vez, e esta função muda a cada render junto com o teto
    que ela consulta.
  */
  const alternar = useRef<() => void>(() => {});

  alternar.current = () => {
    setEscala((atual) => (atual > AMPLIADO ? 1 : Math.min(ESCALA_DE_UM_TOQUE, escalaMaxima)));
  };

  /* O caminho do teclado e do leitor de tela, que chegam por clique e não por
     gesto — e só por ali, porque o gesto já resolveu o toque do ponteiro. */
  const tocarPeloBotao = () => {
    if (Date.now() - fimDoGesto.current < 300) return;

    alternar.current();
  };

  const ampliado = escala > AMPLIADO;

  const catalogo = useMemo(() => {
    const mapa = new Map<string, ReferenceCondition>();
    for (const c of conditions) mapa.set(c.key, c);
    return mapa;
  }, [conditions]);

  const linhas = useMemo(() => agruparIguais(combat.entries), [combat.entries]);

  const entradaSelecionada = useMemo(
    () => combat.entries.find((e) => e.id === selecionada) ?? null,
    [combat.entries, selecionada]
  );

  const ultimoDano = combat.damage_log?.[0] ?? null;

  if (!combat.active || combat.entries.length === 0) return null;

  const podeVerVitais = (entry: CombatEntry) =>
    isMaster || (entry.character_id !== null && minhasFichas.includes(entry.character_id));

  const alternarGrupo = (chave: string) =>
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      proximo.has(chave) ? proximo.delete(chave) : proximo.add(chave);

      return proximo;
    });

  const mover = (entry: CombatEntry, direcao: -1 | 1) => {
    if (!onReorder) return;

    const ids = combat.entries.map((e) => e.id);
    const de = ids.indexOf(entry.id);
    const para = de + direcao;

    const daqui = ids[de];
    const dali = ids[para];

    if (daqui === undefined || dali === undefined) return;

    ids[de] = dali;
    ids[para] = daqui;
    onReorder(ids);
  };

  return (
    <View
      onLayout={(evento) => {
        medidas.current.altura = evento.nativeEvent.layout.height;
      }}
      style={{
        width: largura,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: stroke.seal,
        borderColor: ampliado ? colors.accent : colors.border,
        overflow: 'hidden',
        ...elevation.floating,
        transform: [{ scale: escala }],
        /* O bloco está encostado no canto de cima à direita do mapa: crescer
           por ali é crescer para dentro da tela, e não para fora dela. */
        transformOrigin: 'right top',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: stroke.hairline,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceAlt,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="secondary" uppercase>
            Iniciativa
          </Text>
          <Text variant="smallStrong" tone="gold">
            Rodada {combat.round}
          </Text>
        </View>

        {isMaster && (
          <>
            {/*
              Desfazer fica separado das setas de turno por um filete: os três
              botões juntos viravam três setas parecidas, e errar aqui desfaz um
              golpe que já aconteceu na mesa.
            */}
            {onUndoDamage && ultimoDano && (
              <>
                <BotaoDeBarra
                  rotulo={`Desfazer o dano em ${ultimoDano.entry_name}`}
                  onPress={onUndoDamage}
                >
                  <Glifo texto="⟲" cor={colors.dangerInk} />
                </BotaoDeBarra>

                <View style={{ width: stroke.hairline, height: 16, backgroundColor: colors.border }} />
              </>
            )}

            {onPreviousTurn && (
              <BotaoDeBarra rotulo="Turno anterior" onPress={onPreviousTurn}>
                <Glifo texto="‹" cor={colors.textMuted} />
              </BotaoDeBarra>
            )}

            {onNextTurn && (
              <BotaoDeBarra rotulo="Próximo turno" onPress={onNextTurn} destaque>
                <Glifo texto="›" cor={colors.accent} />
              </BotaoDeBarra>
            )}
          </>
        )}
      </View>

      <ScrollView style={{ maxHeight: alturaDaFila }} contentContainerStyle={{ padding: spacing.xs, gap: 2 }}>
        {linhas.map((linha) => {
          const bando = linha.membros.length > 1;
          const aberto = expandidos.has(linha.chave);

          if (bando && !aberto) {
            return (
              <LinhaDeBando
                key={linha.chave}
                linha={linha}
                turnIndex={combat.turn_index}
                mostrarVitais={linha.membros.some(podeVerVitais)}
                onExpandir={() => alternarGrupo(linha.chave)}
              />
            );
          }

          return (
            <View key={linha.chave} style={bando ? { gap: 2 } : undefined}>
              {bando && (
                <Pressable
                  onPress={() => alternarGrupo(linha.chave)}
                  accessibilityRole="button"
                  style={{ paddingHorizontal: spacing.sm, paddingTop: 2 }}
                >
                  <Text variant="caption" tone="muted">
                    {nomeDoBando(linha)} · recolher
                  </Text>
                </Pressable>
              )}

              {linha.membros.map((entry) => {
                const indice = combat.entries.indexOf(entry);

                return (
                  <LinhaDeCombatente
                    key={entry.id}
                    entry={entry}
                    ativa={indice === combat.turn_index}
                    proxima={indice === (combat.turn_index + 1) % combat.entries.length}
                    selecionada={selecionada === entry.id}
                    mostrarVitais={podeVerVitais(entry)}
                    catalogo={catalogo}
                    compacto={compacto}
                    onPress={() => {
                      if (!isMaster) {
                        onOpenSheet?.(entry);

                        return;
                      }

                      setSelecionada((atual) => (atual === entry.id ? null : entry.id));
                    }}
                    onRemoveCondition={
                      isMaster && onRemoveCondition
                        ? (condition) => onRemoveCondition(entry, condition)
                        : undefined
                    }
                  />
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {isMaster && entradaSelecionada && (
        <View
          style={{
            borderTopWidth: stroke.hairline,
            borderTopColor: colors.border,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.sm,
              paddingTop: spacing.xs,
            }}
          >
            <Text variant="caption" tone="gold" numberOfLines={1} style={{ flex: 1 }}>
              {entradaSelecionada.name}
            </Text>

            <BotaoDeBarra rotulo="Subir na ordem" onPress={() => mover(entradaSelecionada, -1)}>
              <Glifo texto="↑" cor={colors.textMuted} />
            </BotaoDeBarra>

            <BotaoDeBarra rotulo="Descer na ordem" onPress={() => mover(entradaSelecionada, 1)}>
              <Glifo texto="↓" cor={colors.textMuted} />
            </BotaoDeBarra>

            <BotaoDeBarra
              rotulo="Aplicar condição"
              onPress={() => onOpenConditions?.(entradaSelecionada)}
            >
              <Icon name="condicao" size={15} color={colors.textMuted} />
            </BotaoDeBarra>

            {entradaSelecionada.is_npc && (
              <BotaoDeBarra rotulo="Ver ficha" onPress={() => onOpenSheet?.(entradaSelecionada)}>
                <Icon name="mestre" size={15} color={colors.textMuted} />
              </BotaoDeBarra>
            )}
          </View>

          {/*
            A caixa de dano só aparece onde há para onde mandá-la.

            No tabuleiro ela não existe: lá o combate é posicional, e o dano é
            resolvido em voz alta na mesa. Desenhá-la assim mesmo daria ao
            mestre um campo que aceita o número e não faz nada — pior do que
            não ter campo nenhum.
          */}
          {onApplyDamage && (
            <DamagePopover
              alvo={entradaSelecionada.name}
              onSubmit={(valor) => onApplyDamage(entradaSelecionada.id, valor)}
              onClose={() => setSelecionada(null)}
            />
          )}
        </View>
      )}

      {/*
        A alça de ampliar, embaixo à esquerda.

        Fica nesse canto porque é o único do bloco que não encosta em nada: o
        de cima à direita está preso na borda do mapa, e é dele que a ampliação
        cresce. Puxar daqui para a esquerda e para baixo é o gesto que a mão já
        espera de um canto solto.

        Ela mora numa faixa própria em vez de flutuar sobre a fila: por cima,
        cobriria o último nome da ordem — que é justamente quem acabou de
        entrar em cena quando a lista está cheia.
      */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderTopWidth: stroke.hairline,
          borderTopColor: colors.border,
          backgroundColor: colors.surfaceAlt,
          paddingRight: spacing.sm,
        }}
      >
        <View {...puxador.panHandlers}>
          <Pressable
            onPress={tocarPeloBotao}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={
              ampliado ? 'Voltar a iniciativa ao tamanho normal' : 'Ampliar a iniciativa'
            }
            accessibilityHint="Arraste este canto para escolher o tamanho"
            style={{
              width: 28,
              height: 22,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name={ampliado ? 'sairDaTelaCheia' : 'telaCheia'}
              size={14}
              color={ampliado ? colors.accent : colors.textMuted}
            />
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />

        {/* O tamanho escolhido, dito em voz baixa: sem ele, quem puxou até o
            teto fica tentando puxar mais e achando que travou. */}
        <Text variant="caption" tone={ampliado ? 'gold' : 'muted'}>
          {ampliado ? `${Math.round(escala * 100)}%` : 'puxe para ampliar'}
        </Text>
      </View>
    </View>
  );
}

/**
 * Junta em uma linha só os iguais que estão lado a lado na fila.
 *
 * Só adjacentes: três goblins com iniciativas 18, 11 e 4 estão espalhados pela
 * ordem de propósito, e encostá-los na tela para economizar espaço mentiria
 * sobre quando cada um age — que é a única pergunta que esta lista existe para
 * responder.
 */
function agruparIguais(entries: CombatEntry[]): Linha[] {
  const linhas: Linha[] = [];

  entries.forEach((entry, indice) => {
    const anterior = linhas[linhas.length - 1];
    const especie = especieDe(entry);

    if (anterior && especie !== null && especieDe(anterior.primeiro) === especie) {
      anterior.membros.push(entry);

      return;
    }

    linhas.push({ chave: entry.id, primeiro: entry, membros: [entry], primeiroIndice: indice });
  });

  return linhas;
}

/**
 * O que faz dois NPCs serem "o mesmo bicho".
 *
 * A peça do acervo quando existe; senão o nome sem o número de série, que é
 * como o mestre batiza o bando ao montar a ordem ("Goblin 1", "Goblin 2").
 * Ficha de jogador nunca agrupa: cada uma é uma pessoa na mesa.
 */
/** "Goblin 3" e "Goblin 7" viram só "Goblin" quando o bando está recolhido. */
function nomeDoBando(linha: Linha): string {
  return linha.primeiro.name.replace(/\s*\d+$/, '');
}

function especieDe(entry: CombatEntry): string | null {
  if (!entry.is_npc) return null;

  if (entry.stage_item_id !== null) return `peca:${entry.stage_item_id}`;

  const base = entry.name.replace(/\s*\d+$/, '').trim().toLowerCase();

  return base === '' ? null : `nome:${base}`;
}

function LinhaDeBando({
  linha,
  turnIndex,
  mostrarVitais,
  onExpandir,
}: {
  linha: Linha;
  turnIndex: number;
  mostrarVitais: boolean;
  onExpandir: () => void;
}) {
  const { colors } = useTheme();

  const ativa = turnIndex >= linha.primeiroIndice && turnIndex < linha.primeiroIndice + linha.membros.length;
  const nome = nomeDoBando(linha);
  const vivos = linha.membros.filter((m) => m.current_hp > 0).length;
  const ultimo = linha.membros[linha.membros.length - 1] ?? linha.primeiro;

  // Recolhido, o bando some com a resposta que a lista existe para dar: "de
  // quem é a vez?" não pode ser respondido com "de um destes três". Quando o
  // turno cai aqui dentro, a sublinha diz qual deles é.
  const agindo = ativa ? linha.membros[turnIndex - linha.primeiroIndice] : null;

  return (
    <Pressable
      onPress={onExpandir}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${nome}, ${linha.membros.length} criaturas`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: ativa ? colors.accentFill : pressed ? colors.surfaceHover : 'transparent',
        borderLeftWidth: ativa ? stroke.plate : 0,
        borderLeftColor: colors.accent,
      })}
    >
      <Retrato entry={linha.primeiro} tamanho={ativa ? 30 : 22} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant={ativa ? 'smallStrong' : 'small'} tone={ativa ? 'gold' : 'muted'} numberOfLines={1}>
          {nome} ×{linha.membros.length}
        </Text>

        {agindo ? (
          <Text variant="caption" tone="gold" numberOfLines={1}>
            Agora: {agindo.name}
          </Text>
        ) : (
          mostrarVitais && (
            <Text variant="caption" tone="muted">
              {vivos} de pé
            </Text>
          )
        )}
      </View>

      <Text variant="caption" tone="muted">
        {linha.primeiro.initiative}–{ultimo.initiative}
      </Text>
    </Pressable>
  );
}

function LinhaDeCombatente({
  entry,
  ativa,
  proxima,
  selecionada,
  mostrarVitais,
  catalogo,
  compacto,
  onPress,
  onRemoveCondition,
}: {
  entry: CombatEntry;
  ativa: boolean;
  proxima: boolean;
  selecionada: boolean;
  mostrarVitais: boolean;
  catalogo: Map<string, ReferenceCondition>;
  compacto: boolean;
  onPress: () => void;
  onRemoveCondition?: (condition: CombatCondition) => void;
}) {
  const { colors } = useTheme();

  // Sem PV registrado não é o mesmo que sem PV. Um combate salvo antes de a
  // ordem guardar vitais chega com 0/0, e riscar esses nomes anunciaria à mesa
  // que oito personagens caíram — quando o que houve é que ninguém anotou a
  // vida deles.
  const caido = entry.max_hp > 0 && entry.current_hp <= 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={entry.name}
      accessibilityState={{ selected: selecionada }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        opacity: caido ? 0.55 : 1,
        backgroundColor: ativa
          ? colors.accentFill
          : selecionada
            ? colors.surfaceHover
            : pressed
              ? colors.surfaceHover
              : 'transparent',
        borderLeftWidth: ativa ? stroke.plate : proxima ? stroke.hairline : 0,
        borderLeftColor: ativa ? colors.accent : colors.border,
      })}
    >
      <Retrato entry={entry} tamanho={ativa ? 30 : 22} caido={caido} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          variant={ativa ? 'smallStrong' : 'small'}
          tone={ativa ? 'gold' : entry.is_npc ? 'muted' : 'default'}
          numberOfLines={1}
          style={caido ? { textDecorationLine: 'line-through' } : undefined}
        >
          {entry.name}
        </Text>

        {(entry.conditions?.length ?? 0) > 0 && (
          <ConditionBadges
            conditions={entry.conditions ?? []}
            catalog={catalogo}
            compact
            onRemove={onRemoveCondition}
          />
        )}
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="caption" tone={ativa ? 'gold' : 'muted'}>
          {entry.initiative}
        </Text>

        {mostrarVitais && <Vitais entry={entry} compacto={compacto} />}
      </View>
    </Pressable>
  );
}

function Retrato({ entry, tamanho, caido = false }: { entry: CombatEntry; tamanho: number; caido?: boolean }) {
  const { colors } = useTheme();

  const moldura = {
    width: tamanho,
    height: tamanho,
    borderRadius: radius.sm,
  } as const;

  return (
    <View>
      {entry.avatar_url ? (
        <Image
          source={{ uri: entry.avatar_url }}
          style={moldura}
          contentFit="cover"
          accessibilityLabel={entry.name}
        />
      ) : (
        <View
          style={{
            ...moldura,
            backgroundColor: colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="caption" tone="muted">
            {entry.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      {caido && (
        <View
          style={{
            ...moldura,
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.overlay,
          }}
        >
          <Text variant="caption" tone="danger">
            ✕
          </Text>
        </View>
      )}
    </View>
  );
}

function Vitais({ entry, compacto }: { entry: CombatEntry; compacto: boolean }) {
  const { colors } = useTheme();

  // Nada a mostrar quando a entrada não tem vitais: "0/0" é pior que o silêncio,
  // porque parece um número e não é.
  if (entry.max_hp <= 0) return null;

  const proporcao = entry.current_hp / entry.max_hp;
  const corDoPv =
    entry.current_hp <= 0
      ? colors.dangerInk
      : proporcao > 0.5
        ? colors.successInk
        : proporcao > 0.25
          ? colors.warningInk
          : colors.dangerInk;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 1 }}>
        <Text variant="caption" style={{ color: corDoPv }}>
          {entry.current_hp}
        </Text>

        {!compacto && (
          <Text variant="caption" tone="muted">
            /{entry.max_hp}
          </Text>
        )}

        {entry.temp_hp > 0 && (
          <Text variant="caption" tone="arcane">
            +{entry.temp_hp}
          </Text>
        )}
      </View>

      {entry.current_mp !== null && entry.max_mp !== null && entry.max_mp > 0 && (
        <Text variant="caption" tone="arcane">
          {entry.current_mp}
          {!compacto && `/${entry.max_mp}`}
        </Text>
      )}
    </View>
  );
}

/**
 * Seta desenhada como texto.
 *
 * O conjunto de ícones da casa não tem "para cima" nem "próximo", e uma seta é
 * a coisa mais legível que existe para isso — não vale inventar um glifo novo
 * no arquivo de ícones por causa de dois botões.
 */
function Glifo({ texto, cor }: { texto: string; cor: string }) {
  return (
    <Text variant="smallStrong" style={{ color: cor, width: 15, textAlign: 'center' }}>
      {texto}
    </Text>
  );
}

function BotaoDeBarra({
  rotulo,
  onPress,
  destaque = false,
  children,
}: {
  rotulo: string;
  onPress: () => void;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }) => ({
        padding: spacing.xxs,
        borderRadius: radius.sm,
        backgroundColor: destaque ? colors.accentFill : pressed ? colors.surfaceHover : 'transparent',
      })}
    >
      {children}
    </Pressable>
  );
}
