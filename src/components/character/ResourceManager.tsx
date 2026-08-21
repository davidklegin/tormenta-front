import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { charactersApi } from '@/api';
import type { AttributeKey, CharacterResource, EffectScope } from '@/api/types';
import { Button, Card, Chip, HelpNote, Icon, Input, Select, Sheet, Text } from '@/components/ui';
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER, signed } from '@/rules';
import { useReference } from '@/hooks/useReference';
import { radius, spacing, stroke, useTheme } from '@/theme';

/**
 * Buffs, debuffs e recursos temporários da sessão (briefing §19).
 *
 * Serve ao que não é condição do livro nem PV/PM: "Fúria (3 rodadas)",
 * "doses de essência 2/5". Os contadores têm botões de −/+ porque a alteração
 * acontece no meio do turno, e as mudanças chegam ao Painel do Mestre em tempo
 * real.
 *
 * Um efeito pode ainda **mexer nos números da ficha**: marcando "afeta testes
 * de perícia", o bônus entra automaticamente no cálculo e aparece nomeado no
 * detalhamento de cada perícia. É o caso da Inspiração do bardo — "+1 em testes
 * de perícia até o fim da cena" (livro base, p. 43) — que ninguém deveria
 * precisar somar de cabeça a cada rolagem.
 */
export function ResourceManager({
  characterId,
  resources,
  editable,
}: {
  characterId: number;
  resources: CharacterResource[];
  editable: boolean;
}) {
  const queryClient = useQueryClient();

  const { colors } = useTheme();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CharacterResource | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['character', characterId] });
  };

  const updateResource = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      charactersApi.updateResource(characterId, id, payload),
    onSuccess: invalidate,
  });

  const removeResource = useMutation({
    mutationFn: (id: number) => charactersApi.removeResource(characterId, id),
    onSuccess: invalidate,
  });

  const toneFor = (kind: CharacterResource['kind']) =>
    kind === 'buff' ? colors.success : kind === 'debuff' ? colors.warning : colors.info;

  return (
    <Card
      title="Efeitos ativos"
      right={
        editable ? (
          <Button
            label="Adicionar"
            size="sm"
            variant="secondary"
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          />
        ) : undefined
      }
    >
      <View style={{ gap: spacing.sm }}>
        {resources.length === 0 ? (
          <Text variant="small" tone="muted">
            Nada ativo no momento. Use isto para o que dura só um trecho da sessão — a Inspiração do bardo,
            uma bênção, uma maldição, ou cargas de um item.
          </Text>
        ) : (
          resources.map((resource) => {
            const accent = toneFor(resource.kind);
            const hasCounter = resource.max_value !== null || resource.current_value !== null;

            return (
              <View
                key={resource.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderLeftWidth: 3,
                  borderLeftColor: accent,
                  backgroundColor: colors.surfaceAlt,
                }}
              >
                <Pressable
                  style={{ flex: 1, minWidth: 0, gap: 2 }}
                  disabled={!editable}
                  onPress={() => {
                    setEditing(resource);
                    setFormOpen(true);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                      {resource.name}
                    </Text>
                    {resource.affects_skills ? (
                      <Chip
                        label={`${signed(resource.skill_bonus ?? 0)} perícias`}
                        compact
                        tone={(resource.skill_bonus ?? 0) >= 0 ? 'success' : 'warning'}
                      />
                    ) : null}
                    {resource.is_active === false ? <Chip label="pausado" compact /> : null}
                  </View>

                  {resource.expires_note ? (
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {resource.expires_note}
                    </Text>
                  ) : null}
                </Pressable>

                {hasCounter ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    {editable ? (
                      <CounterButton
                        label="−"
                        onPress={() =>
                          updateResource.mutate({
                            id: resource.id,
                            payload: { current_value: Math.max(0, (resource.current_value ?? 0) - 1) },
                          })
                        }
                      />
                    ) : null}

                    <Text variant="bodyStrong" style={{ color: accent, minWidth: 44, textAlign: 'center' }}>
                      {resource.current_value ?? 0}
                      {resource.max_value !== null ? `/${resource.max_value}` : ''}
                    </Text>

                    {editable ? (
                      <CounterButton
                        label="+"
                        onPress={() =>
                          updateResource.mutate({
                            id: resource.id,
                            payload: {
                              current_value: Math.min(
                                resource.max_value ?? 999,
                                (resource.current_value ?? 0) + 1
                              ),
                            },
                          })
                        }
                      />
                    ) : null}
                  </View>
                ) : null}

                {editable ? (
                  <Pressable
                    onPress={() => removeResource.mutate(resource.id)}
                    hitSlop={8}
                    accessibilityLabel={`Remover ${resource.name}`}
                  >
                    <Icon name="remover" size={18} color={colors.textSubtle} />
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      <ResourceForm
        key={editing?.id ?? 'novo'}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        characterId={characterId}
        resource={editing}
        onSaved={invalidate}
      />
    </Card>
  );
}

function CounterButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 30,
        height: 30,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text variant="smallStrong" tone="secondary">
        {label}
      </Text>
    </Pressable>
  );
}

function ResourceForm({
  visible,
  onClose,
  characterId,
  resource,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  characterId: number;
  resource: CharacterResource | null;
  onSaved: () => void;
}) {
  const reference = useReference();

  const { colors } = useTheme();

  const [name, setName] = useState(resource?.name ?? '');
  const [kind, setKind] = useState<string>(resource?.kind ?? 'buff');
  const [currentValue, setCurrentValue] = useState(
    resource?.current_value !== null && resource?.current_value !== undefined
      ? String(resource.current_value)
      : ''
  );
  const [maxValue, setMaxValue] = useState(
    resource?.max_value !== null && resource?.max_value !== undefined ? String(resource.max_value) : ''
  );
  const [expiresNote, setExpiresNote] = useState(resource?.expires_note ?? '');

  // Efeito mecânico
  const [afetaPericias, setAfetaPericias] = useState(Boolean(resource?.affects_skills));
  const [bonus, setBonus] = useState(String(resource?.skill_bonus ?? 1));
  const [escopo, setEscopo] = useState<EffectScope['scope']>(resource?.applies_to?.scope ?? 'all');
  const [chaves, setChaves] = useState<string[]>(resource?.applies_to?.keys ?? []);
  const [ativo, setAtivo] = useState(resource?.is_active ?? true);

  const alternarChave = (chave: string) =>
    setChaves((atual) => (atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave]));

  /**
   * Preenche o formulário com a Inspiração do bardo.
   *
   * Regra do livro (p. 43): "+1 em testes de perícia até o fim da cena", e o
   * bônus sobe a cada quatro níveis — daí a tabela +1/+2/+3/+4/+5 nos níveis
   * 1, 5, 9, 13 e 17.
   */
  const usarInspiracao = () => {
    setName('Inspiração');
    setKind('buff');
    setAfetaPericias(true);
    setBonus('1');
    setEscopo('all');
    setChaves([]);
    setExpiresNote('até o fim da cena');
    setAtivo(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const paraInteiro = (texto: string) => (texto.trim() === '' ? null : Number.parseInt(texto, 10) || 0);

      const payload: Record<string, unknown> = {
        name: name.trim(),
        kind,
        current_value: paraInteiro(currentValue),
        max_value: paraInteiro(maxValue),
        expires_note: expiresNote.trim() || undefined,
        is_active: ativo,
      };

      if (afetaPericias) {
        payload.skill_bonus = Number.parseInt(bonus, 10) || 0;
        payload.applies_to = escopo === 'all' ? { scope: 'all' } : { scope: escopo, keys: chaves };
      } else {
        // Desmarcar limpa o efeito, em vez de deixá-lo escondido na ficha.
        payload.skill_bonus = null;
        payload.applies_to = null;
      }

      return resource
        ? charactersApi.updateResource(characterId, resource.id, payload)
        : charactersApi.createResource(characterId, payload);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={resource ? 'Editar efeito' : 'Novo efeito'}
      subtitle="Buffs, debuffs e recursos da sessão"
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Salvar" onPress={() => save.mutate()} loading={save.isPending} style={{ flex: 1 }} />
        </>
      }
    >
      {!resource ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" tone="muted" uppercase>
            Atalho
          </Text>
          <Button
            label="Inspiração do bardo"
            variant="secondary"
            size="sm"
            onPress={usarInspiracao}
            icon={<Icon name="poderes" size={16} color={colors.textMuted} />}
          />
        </View>
      ) : null}

      <Input label="Nome" value={name} onChangeText={setName} placeholder="Inspiração, Fúria, Bênção…" />

      <Select
        label="Tipo"
        value={kind}
        options={[
          { value: 'buff', label: 'Buff', description: 'Efeito favorável' },
          { value: 'debuff', label: 'Debuff', description: 'Efeito desfavorável' },
          { value: 'recurso', label: 'Recurso', description: 'Cargas, doses, usos por dia' },
        ]}
        onChange={(valor) => setKind(valor ?? 'buff')}
        searchable={false}
      />

      <Input
        label="Duração"
        value={expiresNote}
        onChangeText={setExpiresNote}
        placeholder="até o fim da cena, 3 rodadas…"
      />

      {/* Efeito mecânico */}
      <Alternador
        rotulo="Afeta testes de perícia"
        descricao="O bônus entra sozinho na conta de cada perícia alcançada."
        ativo={afetaPericias}
        onChange={setAfetaPericias}
      />

      {afetaPericias ? (
        <View style={{ gap: spacing.md }}>
          <Input
            label="Bônus"
            value={bonus}
            onChangeText={setBonus}
            keyboardType="numbers-and-punctuation"
            hint="Use valor negativo para penalidade."
          />

          <Select
            label="Onde se aplica"
            value={escopo}
            options={[
              { value: 'all', label: 'Todas as perícias', description: 'Como a Inspiração do bardo' },
              { value: 'skills', label: 'Algumas perícias', description: 'Escolha quais' },
              { value: 'attribute', label: 'Perícias de um atributo', description: 'Ex.: todas de Carisma' },
            ]}
            onChange={(valor) => {
              setEscopo((valor as EffectScope['scope']) ?? 'all');
              setChaves([]);
            }}
            searchable={false}
          />

          {escopo === 'attribute' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {ATTRIBUTE_ORDER.map((chave) => (
                <Chip
                  key={chave}
                  label={ATTRIBUTE_LABELS[chave].short}
                  selected={chaves.includes(chave)}
                  tone="arcane"
                  onPress={() => alternarChave(chave)}
                />
              ))}
            </View>
          ) : null}

          {escopo === 'skills' ? (
            <View style={{ gap: spacing.xs }}>
              <Text variant="smallStrong" tone="secondary">
                Perícias alcançadas
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {(reference.data?.skills ?? []).map((pericia) => (
                  <Chip
                    key={pericia.key}
                    label={pericia.name}
                    compact
                    selected={chaves.includes(pericia.key)}
                    tone="arcane"
                    onPress={() => alternarChave(pericia.key)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <HelpNote source="Livro base, p. 43">
            A Inspiração do bardo dá +1 em testes de perícia a ele e aos aliados em alcance curto até o fim da
            cena, e sobe a cada quatro níveis: +2 no 5º, +3 no 9º, +4 no 13º e +5 no 17º.
          </HelpNote>
        </View>
      ) : null}

      <Alternador
        rotulo="Ativo"
        descricao="Desligue quando o efeito acabar, sem precisar apagá-lo."
        ativo={ativo}
        onChange={setAtivo}
      />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Input
          label="Contador (atual)"
          value={currentValue}
          onChangeText={setCurrentValue}
          keyboardType="number-pad"
          containerStyle={{ flex: 1 }}
          hint="Opcional"
        />
        <Input
          label="Máximo"
          value={maxValue}
          onChangeText={setMaxValue}
          keyboardType="number-pad"
          containerStyle={{ flex: 1 }}
        />
      </View>
    </Sheet>
  );
}

/** Interruptor com rótulo e explicação, no lugar de uma caixa de seleção nua. */
function Alternador({
  rotulo,
  descricao,
  ativo,
  onChange,
}: {
  rotulo: string;
  descricao?: string;
  ativo: boolean;
  onChange: (valor: boolean) => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => onChange(!ativo)}
      accessibilityRole="switch"
      accessibilityState={{ checked: ativo }}
      accessibilityLabel={rotulo}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.sm,
          borderWidth: 1.5,
          borderColor: ativo ? colors.primary : colors.borderStrong,
          backgroundColor: ativo ? colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {ativo ? <Icon name="confirmar" size={14} color={colors.onPrimary} /> : null}
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{rotulo}</Text>
        {descricao ? (
          <Text variant="caption" tone="muted">
            {descricao}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
