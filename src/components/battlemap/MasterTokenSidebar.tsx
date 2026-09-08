import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { Icon, Text } from '@/components/ui';
import { radius, spacing, stroke, useTheme } from '@/theme';
import type { AreaEffect, BattleMapToken, CombatEntry, ReferenceCondition } from '@/api/types';
import { useConditionCatalog } from '../combat/ConditionBadges';
import { DamagePopover } from '../combat/DamagePopover';
import { acharEntradaDoToken } from '../combat/vinculo';
import { alcanceEmMetros, formatarDistancia, nomeDaForma } from './geometry';

type Props = {
  tokens: BattleMapToken[];
  /** As áreas marcadas no chão — bola de fogo, cone de gelo, muralha. */
  areas: AreaEffect[];
  /** A ordem de iniciativa, quando há combate. Vazia fora dele. */
  entries: CombatEntry[];
  conditions: ReferenceCondition[];
  selecionado: number | null;
  aberta: boolean;
  compacto?: boolean;
  onAlternar: () => void;
  onSelecionar: (tokenId: number | null) => void;
  onEsconder: (token: BattleMapToken) => void;
  onTamanho: (token: BattleMapToken, tamanho: number) => void;
  onRemover: (token: BattleMapToken) => void;
  onRemoverArea: (efeitoId: string) => void;
  onAbrirCondicoes: (entry: CombatEntry) => void;
  onAbrirFicha: (entry: CombatEntry) => void;
  onAplicarDano: (entryId: string, amount: number) => void;
};

/** Os tamanhos do livro, na ordem em que a mesa os nomeia. */
const TAMANHOS = [
  { valor: 1, rotulo: 'M' },
  { valor: 2, rotulo: 'G' },
  { valor: 3, rotulo: 'E' },
  { valor: 4, rotulo: 'C' },
];

/**
 * A mesa de controle das peças — só do mestre.
 *
 * O tabuleiro responde "onde está cada um"; esta lista responde "quem está em
 * cena", que é outra pergunta e não cabia no mapa. Três coisas ficavam fora do
 * alcance do mestre enquanto o único caminho até uma peça era achá-la com o
 * dedo:
 *
 *   · **A peça escondida.** Ela existe só na tela do mestre, translúcida, e
 *     some no meio do cenário. Para revelá-la era preciso lembrar onde tinha
 *     sido posta — a emboscada que o mestre esquece de acionar é a emboscada
 *     que não aconteceu.
 *   · **A peça pequena num mapa grande.** Com o zoom aberto para ver o salão
 *     inteiro, um token de um quadrado tem poucos pixels, e acertá-lo com o
 *     polegar é sorte.
 *   · **A conta de quem sobrou.** Oito goblins no mapa viram oito retratos
 *     iguais; aqui viram oito linhas com PV ao lado.
 *
 * Jogadores e NPCs vão separados porque as decisões sobre eles são diferentes:
 * a ficha do jogador o mestre não esconde nem tira do mapa — ela é da pessoa
 * que está sentada à mesa.
 */
export function MasterTokenSidebar({
  tokens,
  areas,
  entries,
  conditions,
  selecionado,
  aberta,
  compacto = false,
  onAlternar,
  onSelecionar,
  onEsconder,
  onTamanho,
  onRemover,
  onRemoverArea,
  onAbrirCondicoes,
  onAbrirFicha,
  onAplicarDano,
}: Props) {
  const { colors } = useTheme();
  const catalogo = useConditionCatalog(conditions);

  const jogadores = useMemo(
    () => tokens.filter((token) => token.entity_type === 'player_character'),
    [tokens]
  );

  const npcs = useMemo(
    () => tokens.filter((token) => token.entity_type !== 'player_character'),
    [tokens]
  );

  const peca = useMemo(
    () => tokens.find((token) => token.id === selecionado) ?? null,
    [tokens, selecionado]
  );

  // A linha da iniciativa da peça selecionada, quando ela tem uma. Um barril
  // ou um marcador de cenário não têm PV para perder.
  const entrada = useMemo(
    () => (peca && entries.length > 0 ? acharEntradaDoToken(peca, entries) : null),
    [peca, entries]
  );

  const escondidas = useMemo(() => tokens.filter((token) => !token.visible).length, [tokens]);

  // Recolhida, continua sendo coluna — estreita, com as contagens na vertical.
  // Some do caminho sem sair da tela: no celular, uma coluna de 224px não
  // deixaria mapa, e uma barra que desaparece por inteiro é uma ferramenta que
  // o mestre precisa lembrar que existe para reencontrar.
  if (!aberta) {
    return (
      <Pressable
        onPress={onAlternar}
        accessibilityRole="button"
        accessibilityLabel={`Abrir a mesa de controle (${tokens.length} peça${tokens.length === 1 ? '' : 's'} no tabuleiro, ${areas.length} área${areas.length === 1 ? '' : 's'} marcada${areas.length === 1 ? '' : 's'})`}
        style={{
          alignSelf: 'stretch',
          width: 44,
          alignItems: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.sm,
          backgroundColor: colors.surfaceAlt,
          borderRightWidth: stroke.hairline,
          borderRightColor: colors.border,
        }}
      >
        <Icon name="expandir" size={16} color={colors.textMuted} />

        <View style={{ height: spacing.xs }} />

        <Icon name="jogadores" size={16} color={colors.textMuted} />
        <Text variant="caption" tone="secondary">
          {tokens.length}
        </Text>

        {escondidas > 0 && (
          <>
            <Icon name="condicao" size={14} color={colors.textMuted} />
            <Text variant="caption" tone="muted">
              {escondidas}
            </Text>
          </>
        )}

        {areas.length > 0 && (
          <>
            <Icon name="magias" size={14} color={colors.textMuted} />
            <Text variant="caption" tone="secondary">
              {areas.length}
            </Text>
          </>
        )}
      </Pressable>
    );
  }

  return (
    <View
      style={{
        alignSelf: 'stretch',
        width: compacto ? 224 : 288,
        backgroundColor: colors.surface,
        borderRightWidth: stroke.hairline,
        borderRightColor: colors.border,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onAlternar}
        accessibilityRole="button"
        accessibilityLabel="Recolher a lista de peças"
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
            Peças
          </Text>
          <Text variant="smallStrong" tone="gold">
            {tokens.length} no tabuleiro
            {areas.length > 0 && ` · ${areas.length} área${areas.length > 1 ? 's' : ''}`}
          </Text>
        </View>

        <Icon name="expandir" size={16} color={colors.textMuted} />
      </Pressable>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xs, gap: 2 }}
      >
        {tokens.length === 0 && (
          <Text variant="caption" tone="muted" center style={{ padding: spacing.sm }}>
            Nenhuma peça no tabuleiro. Traga o grupo ou ponha um NPC pelo painel.
          </Text>
        )}

        {jogadores.length > 0 && <Secao rotulo="Jogadores" />}
        {jogadores.map((token) => (
          <LinhaDaPeca
            key={token.id}
            token={token}
            entrada={entries.length > 0 ? acharEntradaDoToken(token, entries) : null}
            catalogo={catalogo}
            selecionada={selecionado === token.id}
            onPress={() => onSelecionar(selecionado === token.id ? null : token.id)}
          />
        ))}

        {npcs.length > 0 && <Secao rotulo="NPCs e cenário" />}
        {npcs.map((token) => (
          <LinhaDaPeca
            key={token.id}
            token={token}
            entrada={entries.length > 0 ? acharEntradaDoToken(token, entries) : null}
            catalogo={catalogo}
            selecionada={selecionado === token.id}
            onPress={() => onSelecionar(selecionado === token.id ? null : token.id)}
          />
        ))}

        {/*
          As áreas marcadas, uma a uma.

          No mapa, tocar numa área a apaga — o que serve para a que acabou de
          ser marcada, e não para as outras: com uma bola de fogo por cima de um
          cone, o toque tira sempre a de cima, e a de baixo só sai depois da que
          está na frente. Aqui cada uma tem a própria linha, e some a que o
          mestre apontar. É o que permite deixar várias no chão ao mesmo tempo
          sem perder o controle de qual é qual.
        */}
        {areas.length > 0 && <Secao rotulo="Áreas marcadas" />}
        {areas.map((area) => (
          <LinhaDaArea key={area.id} area={area} onRemover={() => onRemoverArea(area.id)} />
        ))}
      </ScrollView>

      {peca && (
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
              {peca.name}
            </Text>

            {/* Esconder e tirar do mapa não valem para a ficha de um jogador:
                a peça é da pessoa que está sentada à mesa, e o mestre que a
                escondesse tiraria da mão dela o único gesto que ela tem aqui. */}
            {peca.entity_type !== 'player_character' && (
              <>
                <BotaoDaPeca
                  rotulo={peca.visible ? `Esconder ${peca.name}` : `Revelar ${peca.name}`}
                  onPress={() => onEsconder(peca)}
                >
                  <Icon
                    name={peca.visible ? 'condicao' : 'info'}
                    size={15}
                    color={peca.visible ? colors.textMuted : colors.accent}
                  />
                </BotaoDaPeca>

                <BotaoDaPeca rotulo={`Tirar ${peca.name} do tabuleiro`} onPress={() => onRemover(peca)}>
                  <Icon name="excluir" size={15} color={colors.danger} />
                </BotaoDaPeca>
              </>
            )}

            {entrada && (
              <BotaoDaPeca rotulo={`Aplicar condição em ${peca.name}`} onPress={() => onAbrirCondicoes(entrada)}>
                <Icon name="condicao" size={15} color={colors.textMuted} />
              </BotaoDaPeca>
            )}

            {entrada?.is_npc && (
              <BotaoDaPeca rotulo={`Ver a ficha de ${peca.name}`} onPress={() => onAbrirFicha(entrada)}>
                <Icon name="mestre" size={15} color={colors.textMuted} />
              </BotaoDaPeca>
            )}
          </View>

          {peca.entity_type !== 'player_character' && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                paddingHorizontal: spacing.sm,
                paddingTop: spacing.xxs,
              }}
            >
              <Text variant="caption" tone="muted">
                Tamanho
              </Text>
              {TAMANHOS.map((tamanho) => (
                <Pressable
                  key={tamanho.valor}
                  onPress={() => onTamanho(peca, tamanho.valor)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: peca.size === tamanho.valor }}
                  accessibilityLabel={`Tamanho ${tamanho.rotulo}`}
                  style={{
                    minWidth: 24,
                    paddingVertical: 2,
                    alignItems: 'center',
                    borderRadius: radius.sm,
                    borderWidth: stroke.hairline,
                    borderColor: peca.size === tamanho.valor ? colors.primary : 'transparent',
                    backgroundColor:
                      peca.size === tamanho.valor ? colors.primaryFill : 'transparent',
                  }}
                >
                  <Text variant="caption" tone={peca.size === tamanho.valor ? 'default' : 'muted'}>
                    {tamanho.rotulo}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {entrada && (
            <DamagePopover
              alvo={entrada.name}
              onSubmit={(valor) => onAplicarDano(entrada.id, valor)}
              onClose={() => onSelecionar(null)}
            />
          )}
        </View>
      )}
    </View>
  );
}

function Secao({ rotulo }: { rotulo: string }) {
  return (
    <Text variant="caption" tone="muted" uppercase style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.xs }}>
      {rotulo}
    </Text>
  );
}

/**
 * Uma peça na lista.
 *
 * O PV vem da linha da iniciativa quando ela existe — o tabuleiro não guarda
 * vida, e inventar um número aqui faria a lista discordar da fila de
 * iniciativa sobre quanto o goblin aguenta.
 */
function LinhaDaPeca({
  token,
  entrada,
  catalogo,
  selecionada,
  onPress,
}: {
  token: BattleMapToken;
  entrada: CombatEntry | null;
  catalogo: Map<string, ReferenceCondition>;
  selecionada: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  const marcadores = (token.conditions ?? [])
    .map((chave) => catalogo.get(chave)?.name ?? chave)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: selecionada }}
      accessibilityLabel={`${token.name}${token.visible ? '' : ', escondida'}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.sm,
        borderWidth: stroke.hairline,
        borderColor: selecionada ? colors.accent : 'transparent',
        backgroundColor: selecionada ? colors.accentFill : 'transparent',
        // A peça escondida vai translúcida, como no mapa: é o mesmo estado,
        // e vale a pessoa reconhecê-lo pelo mesmo sinal nos dois lugares.
        opacity: token.visible ? 1 : 0.6,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radius.sm,
          borderWidth: stroke.hairline,
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {token.image_url ? (
          <Image
            source={{ uri: token.image_url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          <Text variant="caption" tone="muted" style={{ fontSize: 10 }}>
            {iniciais(token.name)}
          </Text>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
          <Text variant="small" numberOfLines={1} style={{ flex: 1 }}>
            {token.name}
          </Text>

          {!token.visible && (
            <Text variant="caption" tone="muted">
              oculta
            </Text>
          )}

          {token.size > 1 && (
            <Text variant="caption" tone="muted">
              {token.size}×{token.size}
            </Text>
          )}
        </View>

        {entrada && (
          <Text variant="caption" tone="muted">
            {entrada.current_hp}/{entrada.max_hp} PV
            {entrada.temp_hp > 0 ? ` (+${entrada.temp_hp})` : ''}
          </Text>
        )}

        {marcadores.length > 0 && (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {marcadores}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/**
 * Uma área marcada na lista.
 *
 * O quadradinho de cor à esquerda é a ponte com o mapa: as áreas não têm nome
 * — "Esfera" e "Esfera" são duas linhas iguais —, e a cor com a posição é o que
 * deixa a pessoa apontar no chão qual delas ela está prestes a apagar.
 */
function LinhaDaArea({ area, onRemover }: { area: AreaEffect; onRemover: () => void }) {
  const { colors } = useTheme();

  const alcance = alcanceEmMetros(area);
  const descricao = [
    area.label ?? nomeDaForma(area.shape),
    alcance === null ? null : formatarDistancia(alcance),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
      }}
    >
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: radius.sm,
          borderWidth: stroke.hairline,
          borderColor: colors.border,
          backgroundColor: area.color ?? colors.danger,
          opacity: area.opacity ?? 0.3,
        }}
      />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="small" numberOfLines={1}>
          {descricao}
        </Text>
        <Text variant="caption" tone="muted">
          em {area.x}, {area.y}
        </Text>
      </View>

      <BotaoDaPeca rotulo={`Apagar ${descricao}`} onPress={onRemover}>
        <Icon name="excluir" size={15} color={colors.danger} />
      </BotaoDaPeca>
    </View>
  );
}

function BotaoDaPeca({
  rotulo,
  onPress,
  children,
}: {
  rotulo: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={{
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.sm,
        borderWidth: stroke.hairline,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {children}
    </Pressable>
  );
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0];

  if (!primeira) return '?';
  if (partes.length === 1) return primeira.slice(0, 2).toUpperCase();

  const ultima = partes[partes.length - 1] ?? primeira;

  return ((primeira[0] ?? '') + (ultima[0] ?? '')).toUpperCase();
}
