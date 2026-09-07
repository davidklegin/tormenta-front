import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import type { CombatCondition, CombatEntry, CombatState, ReferenceCondition } from '@/api/types';
import { Icon, Text } from '@/components/ui';
import { radius, spacing, stroke, useTheme } from '@/theme';
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

  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

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

  const ultimoDano = combat.damage_log[0] ?? null;

  if (!combat.active || combat.entries.length === 0) return null;

  const largura = compacto ? 232 : 316;

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
      style={{
        width: largura,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: stroke.seal,
        borderColor: colors.border,
        overflow: 'hidden',
        ...elevation.floating,
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

      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: spacing.xs, gap: 2 }}>
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

          <DamagePopover
            alvo={entradaSelecionada.name}
            onSubmit={(valor) => onApplyDamage?.(entradaSelecionada.id, valor)}
            onClose={() => setSelecionada(null)}
          />
        </View>
      )}
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

  const caido = entry.current_hp <= 0;

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

        {entry.conditions.length > 0 && (
          <ConditionBadges
            conditions={entry.conditions}
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

  const proporcao = entry.max_hp > 0 ? entry.current_hp / entry.max_hp : 1;
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
