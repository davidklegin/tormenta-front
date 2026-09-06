import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { CombatEntryInput } from '@/api';
import type { CombatState } from '@/api/types';
import { Button, Card, Chip, EmptyState, Icon, Input, Loading, Text } from '@/components/ui';
import { CombatBuffPanel } from '@/components/combat/CombatBuffPanel';
import { useCampaignCharacters } from '@/hooks/useCampaigns';
import { useCombat, useCombatControls } from '@/hooks/useCombat';
import { radius, spacing, stroke, useTheme } from '@/theme';

/** Uma linha do rascunho da ordem, antes de virar combate. */
type Rascunho = {
  key: string;
  name: string;
  initiative: string;
  characterId: number | null;
};

let sequencia = 0;

const proximaChave = () => `linha-${++sequencia}`;

/**
 * O combate visto do lado do mestre: montar a ordem e andar com ela.
 *
 * Duas telas em uma, conforme o estado. Fora de combate, é a folha onde ele
 * anota as iniciativas que a mesa acabou de rolar. Em combate, some tudo e
 * sobra o que ele toca a cada trinta segundos: "próximo turno".
 *
 * As iniciativas são digitadas, não roladas aqui: quem rola é o jogador, com o
 * dado dele, e o mestre só transcreve. O `d20` existe para os NPCs, que não
 * têm quem role por eles.
 */
export function CombatControl({ campaignId }: { campaignId: number }) {
  const combate = useCombat(campaignId);

  if (combate.isLoading) {
    return <Loading inline label="Lendo o combate…" />;
  }

  const estado = combate.data;

  return estado?.active ? (
    <EmAndamento campaignId={campaignId} combate={estado} />
  ) : (
    <Montagem campaignId={campaignId} />
  );
}

function EmAndamento({ campaignId, combate }: { campaignId: number; combate: CombatState }) {
  const { colors } = useTheme();
  const { proximo, anterior, encerrar } = useCombatControls(campaignId);

  return (
    <View style={{ gap: spacing.md }}>
      <Card
        title={`Rodada ${combate.round}`}
        subtitle={combate.current ? `Agora: ${combate.current.name}` : 'Ordem vazia'}
      >
        <View style={{ gap: spacing.md }}>
          {/* O botão que o mestre toca a noite inteira: grande, sozinho na
              linha, impossível de errar no escuro da sala. */}
          <Button
            label="Próximo turno"
            size="lg"
            loading={proximo.isPending}
            onPress={() => proximo.mutate()}
            fullWidth
          />

          {combate.next ? (
            <Text variant="small" tone="secondary">
              Em seguida: {combate.next.name}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label="Voltar um turno"
              variant="secondary"
              size="sm"
              loading={anterior.isPending}
              onPress={() => anterior.mutate()}
              style={{ flex: 1 }}
            />
            <Button
              label="Encerrar combate"
              variant="ghost"
              size="sm"
              loading={encerrar.isPending}
              onPress={() => encerrar.mutate()}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </Card>

      <View style={{ gap: spacing.xs }}>
        {combate.entries.map((entrada, indice) => {
          const agora = indice === combate.turn_index;

          return (
            <View
              key={entrada.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: agora ? colors.accentFill : colors.surface,
                borderRadius: radius.md,
                borderWidth: stroke.hairline,
                borderColor: agora ? colors.accent : colors.border,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
              }}
            >
              <Text variant="numeric" tone={agora ? 'gold' : 'muted'} style={{ width: 32 }}>
                {entrada.initiative}
              </Text>
              <Text variant={agora ? 'bodyStrong' : 'body'} style={{ flex: 1 }} numberOfLines={1}>
                {entrada.name}
              </Text>
              {entrada.is_npc ? <Chip label="NPC" compact /> : null}
              {agora ? <Chip label="agora" compact tone="gold" /> : null}
            </View>
          );
        })}
      </View>

      {/* Painel para aplicar buffs/condições em grupo */}
      <CombatBuffPanel campaignId={campaignId} />
    </View>
  );
}

function Montagem({ campaignId }: { campaignId: number }) {
  const { colors } = useTheme();

  const personagens = useCampaignCharacters(campaignId);
  const { definir } = useCombatControls(campaignId);

  const [npcs, setNpcs] = useState<Rascunho[]>([]);
  const [fichas, setFichas] = useState<Record<number, string>>({});

  const lista = personagens.data ?? [];

  const entries: CombatEntryInput[] = useMemo(() => {
    const dosJogadores = lista
      .filter((personagem) => (fichas[personagem.id] ?? '').trim() !== '')
      .map((personagem) => ({
        character_id: personagem.id,
        initiative: Number(fichas[personagem.id]),
      }));

    const dosNpcs = npcs
      .filter((npc) => npc.name.trim() !== '' && npc.initiative.trim() !== '')
      .map((npc) => ({ name: npc.name.trim(), initiative: Number(npc.initiative) }));

    return [...dosJogadores, ...dosNpcs].filter((linha) => Number.isFinite(linha.initiative));
  }, [lista, fichas, npcs]);

  if (personagens.isLoading) {
    return <Loading inline label="Carregando personagens…" />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Card title="Nova ordem de iniciativa" subtitle="Anote o que a mesa rolou">
        <View style={{ gap: spacing.md }}>
          {lista.length === 0 ? (
            <EmptyState
              icon="jogadores"
              title="Nenhum personagem na mesa"
              description="Você ainda pode montar o combate só com NPCs."
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text variant="caption" tone="secondary" uppercase>
                Personagens
              </Text>

              {lista.map((personagem) => (
                <View
                  key={personagem.id}
                  style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}
                >
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {personagem.name}
                  </Text>
                  <View style={{ width: 96 }}>
                    <Input
                      placeholder="—"
                      keyboardType="number-pad"
                      value={fichas[personagem.id] ?? ''}
                      onChangeText={(valor) =>
                        setFichas((atual) => ({ ...atual, [personagem.id]: valor.replace(/[^0-9-]/g, '') }))
                      }
                    />
                  </View>
                </View>
              ))}

              <Text variant="caption" tone="muted">
                Quem ficar em branco não entra nesta ordem.
              </Text>
            </View>
          )}

          <View style={{ gap: spacing.sm }}>
            <Text variant="caption" tone="secondary" uppercase>
              NPCs e criaturas
            </Text>

            {npcs.map((npc) => (
              <View key={npc.key} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Input
                    placeholder="Goblin 1"
                    value={npc.name}
                    onChangeText={(valor) =>
                      setNpcs((atual) =>
                        atual.map((linha) => (linha.key === npc.key ? { ...linha, name: valor } : linha))
                      )
                    }
                  />
                </View>
                <View style={{ width: 76 }}>
                  <Input
                    placeholder="—"
                    keyboardType="number-pad"
                    value={npc.initiative}
                    onChangeText={(valor) =>
                      setNpcs((atual) =>
                        atual.map((linha) =>
                          linha.key === npc.key
                            ? { ...linha, initiative: valor.replace(/[^0-9-]/g, '') }
                            : linha
                        )
                      )
                    }
                  />
                </View>

                {/* O NPC não tem quem role por ele. */}
                <Pressable
                  onPress={() =>
                    setNpcs((atual) =>
                      atual.map((linha) =>
                        linha.key === npc.key
                          ? { ...linha, initiative: String(1 + Math.floor(Math.random() * 20)) }
                          : linha
                      )
                    )
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Rolar iniciativa de ${npc.name || 'NPC'}`}
                  style={{ padding: spacing.sm }}
                >
                  <Icon name="pericias" size={20} color={colors.primaryInk} />
                </Pressable>

                <Pressable
                  onPress={() => setNpcs((atual) => atual.filter((linha) => linha.key !== npc.key))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${npc.name || 'NPC'}`}
                  style={{ padding: spacing.sm }}
                >
                  <Icon name="excluir" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}

            <Button
              label="Adicionar NPC"
              variant="ghost"
              size="sm"
              icon={<Icon name="adicionar" size={14} color={colors.primaryInk} />}
              onPress={() =>
                setNpcs((atual) => [
                  ...atual,
                  { key: proximaChave(), name: '', initiative: '', characterId: null },
                ])
              }
            />
          </View>

          <Button
            label={`Começar combate${entries.length > 0 ? ` (${entries.length})` : ''}`}
            disabled={entries.length === 0}
            loading={definir.isPending}
            onPress={() => definir.mutate({ entries })}
            fullWidth
          />
        </View>
      </Card>
    </View>
  );
}
