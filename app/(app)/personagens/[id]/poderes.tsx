import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { charactersApi } from '@/api';
import type { Character, CharacterPower } from '@/api/types';
import { Button, Card, Chip, Input, SegmentedControl, Select, Sheet, Text } from '@/components/ui';
import { SheetScreen } from '@/components/character/SheetScreen';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Aba Poderes (briefing §11).
 *
 * O livro separa poderes de classe, gerais, concedidos por divindades, da
 * Tormenta, além das habilidades de raça e origem — por isso o filtro por tipo.
 */
const POWER_TYPES = [
  { value: 'classe', label: 'Classe' },
  { value: 'geral', label: 'Geral' },
  { value: 'racial', label: 'Raça' },
  { value: 'origem', label: 'Origem' },
  { value: 'concedido', label: 'Concedido' },
  { value: 'tormenta', label: 'Tormenta' },
  { value: 'outro', label: 'Outro' },
] as const;

export default function PowersScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <PowersContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}

function PowersContent({ characterId, character }: { characterId: number; character: Character }) {
  const { colors } = useTheme();

  const queryClient = useQueryClient();
  const canEdit = character.permissions.can_update;

  const [filter, setFilter] = useState<string>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CharacterPower | null>(null);
  const [detail, setDetail] = useState<CharacterPower | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['character', characterId] });
  };

  const removePower = useMutation({
    mutationFn: (id: number) => charactersApi.removePower(characterId, id),
    onSuccess: invalidate,
  });

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const power of character.powers) {
      map[power.type] = (map[power.type] ?? 0) + 1;
    }

    return map;
  }, [character.powers]);

  const powers = useMemo(
    () => (filter === 'todos' ? character.powers : character.powers.filter((power) => power.type === filter)),
    [character.powers, filter]
  );

  return (
    <View style={{ gap: spacing.md }}>
      <SegmentedControl
        scrollable
        value={filter}
        onChange={setFilter}
        segments={[
          { value: 'todos', label: 'Todos', badge: character.powers.length },
          ...POWER_TYPES.filter((type) => counts[type.value]).map((type) => ({
            value: type.value,
            label: type.label,
            badge: counts[type.value],
          })),
        ]}
      />

      {canEdit ? (
        <Button
          label="Adicionar poder"
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : null}

      {powers.length === 0 ? (
        <Text variant="small" tone="muted">
          Nenhum poder cadastrado.
        </Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {powers.map((power) => (
            <Pressable
              key={power.id}
              onPress={() => setDetail(power)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
                gap: spacing.xs,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {power.name}
                </Text>
                <Chip label={power.type_label} compact tone="arcane" />
                {power.mp_cost ? <Chip label={power.mp_cost} compact tone="primary" /> : null}
              </View>

              {power.source ? (
                <Text variant="caption" tone="muted">
                  {power.source}
                </Text>
              ) : null}

              {power.description ? (
                <Text variant="small" tone="secondary" numberOfLines={2}>
                  {power.description}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      <Sheet visible={detail !== null} onClose={() => setDetail(null)} title={detail?.name ?? ''}>
        {detail ? (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
              <Chip label={detail.type_label} compact tone="arcane" />
              {detail.mp_cost ? <Chip label={detail.mp_cost} compact tone="primary" /> : null}
              {detail.source ? <Chip label={detail.source} compact /> : null}
            </View>

            {detail.requirements ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="caption" tone="secondary" uppercase>
                  Pré-requisitos
                </Text>
                <Text variant="small" tone="secondary">
                  {detail.requirements}
                </Text>
              </View>
            ) : null}

            <Text variant="body" tone="secondary">
              {detail.description || 'Sem descrição.'}
            </Text>

            {canEdit ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  label="Editar"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setEditing(detail);
                    setDetail(null);
                    setFormOpen(true);
                  }}
                />
                <Button
                  label="Remover"
                  variant="danger"
                  style={{ flex: 1 }}
                  onPress={() => {
                    removePower.mutate(detail.id);
                    setDetail(null);
                  }}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <PowerForm
        key={editing?.id ?? 'novo'}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        characterId={characterId}
        power={editing}
        onSaved={invalidate}
      />
    </View>
  );
}

function PowerForm({
  visible,
  onClose,
  characterId,
  power,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  characterId: number;
  power: CharacterPower | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(power?.name ?? '');
  const [type, setType] = useState<string>(power?.type ?? 'geral');
  const [source, setSource] = useState(power?.source ?? '');
  const [mpCost, setMpCost] = useState(power?.mp_cost ?? '');
  const [requirements, setRequirements] = useState(power?.requirements ?? '');
  const [description, setDescription] = useState(power?.description ?? '');

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        type,
        source: source.trim() || undefined,
        mp_cost: mpCost.trim() || undefined,
        requirements: requirements.trim() || undefined,
        description: description.trim() || undefined,
      };

      return power
        ? charactersApi.updatePower(characterId, power.id, payload)
        : charactersApi.createPower(characterId, payload);
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
      title={power ? 'Editar poder' : 'Novo poder'}
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Salvar" onPress={() => save.mutate()} loading={save.isPending} style={{ flex: 1 }} />
        </>
      }
    >
      <Input label="Nome" value={name} onChangeText={setName} placeholder="Golpe Poderoso" />
      <Select
        label="Tipo"
        value={type}
        options={POWER_TYPES.map((entry) => ({ value: entry.value, label: entry.label }))}
        onChange={(value) => setType(value ?? 'geral')}
        searchable={false}
      />
      <Input
        label="Fonte"
        value={source}
        onChangeText={setSource}
        placeholder="Bárbaro 2, Gladiador, Thwor…"
      />
      <Input label="Custo em PM" value={mpCost} onChangeText={setMpCost} placeholder="1 PM" />
      <Input label="Pré-requisitos" value={requirements} onChangeText={setRequirements} multiline />
      <Input label="Descrição" value={description} onChangeText={setDescription} multiline />
    </Sheet>
  );
}
