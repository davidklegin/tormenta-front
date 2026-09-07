import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { charactersApi } from '@/api';
import type { Character, CharacterSpell } from '@/api/types';
import {
  Button,
  Card,
  Chip,
  DetailRow,
  HelpNote,
  Input,
  SegmentedControl,
  Select,
  Sheet,
  Text,
  Toast,
} from '@/components/ui';
import { SheetScreen } from '@/components/character/SheetScreen';
import { SpellCatalogSheet } from '@/components/character/SpellCatalogSheet';
import { ShowcaseButton } from '@/components/showcase';
import { useReference } from '@/hooks/useReference';
import { SPELL_CIRCLE_COST } from '@/rules';
import { radius, spacing, useTheme } from '@/theme';
import { contemTermo, normalizar } from '@/utils/texto';

/**
 * Aba Magias (briefing §12).
 *
 * Organizada por círculo, com busca e filtros. Cada magia traz a ficha
 * completa do livro (p. 178): execução, alcance, alvo/área/efeito, duração,
 * resistência, custo em PM e aprimoramentos.
 */
export default function SpellsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <SpellsContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}

function SpellsContent({ characterId, character }: { characterId: number; character: Character }) {
  const { colors } = useTheme();

  const queryClient = useQueryClient();
  const canEdit = character.permissions.can_update;

  const [query, setQuery] = useState('');
  const [circle, setCircle] = useState<string>('todos');
  const [detail, setDetail] = useState<CharacterSpell | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CharacterSpell | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['character', characterId] });
  };

  const removeSpell = useMutation({
    mutationFn: (id: number) => charactersApi.removeSpell(characterId, id),
    onSuccess: invalidate,
  });

  const filtered = useMemo(() => {
    const term = normalizar(query.trim());

    return character.spells.filter((spell) => {
      if (term && !contemTermo(spell.name, term)) return false;
      if (circle !== 'todos' && spell.circle !== Number(circle)) return false;

      return true;
    });
  }, [character.spells, query, circle]);

  const byCircle = useMemo(() => {
    const groups = new Map<number, CharacterSpell[]>();

    for (const spell of filtered) {
      const list = groups.get(spell.circle) ?? [];
      list.push(spell);
      groups.set(spell.circle, list);
    }

    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  /** Magias vindas da biblioteca: o grimório as mostra marcadas. */
  const knownSpellIds = useMemo(
    () => character.spells.map((spell) => spell.spell_id).filter((id): id is number => id !== null),
    [character.spells]
  );

  const circleCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const spell of character.spells) {
      counts[spell.circle] = (counts[spell.circle] ?? 0) + 1;
    }

    return counts;
  }, [character.spells]);

  return (
    <View style={{ gap: spacing.md }}>
      {/* CD dos testes de resistência contra as magias deste personagem */}
      {character.spellcasting.total !== null ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text variant="caption" tone="secondary" uppercase>
                CD dos testes de resistência
              </Text>
              <Text variant="caption" tone="muted">
                {character.spellcasting.breakdown.map((part) => `${part.label} ${part.value}`).join(' + ')}
              </Text>
            </View>
            <Text variant="numeric" tone="arcane">
              {character.spellcasting.total}
            </Text>
          </View>
        </Card>
      ) : null}

      <HelpNote collapsible source="Livro base, p. 170">
        Magias são agrupadas por círculo, do 1º ao 5º — quanto mais alto, mais poderosa e mais cara em pontos
        de mana. Toque em uma magia para ver alcance, duração e aprimoramentos.
      </HelpNote>

      <Input placeholder="Buscar magia…" value={query} onChangeText={setQuery} autoCorrect={false} />

      <SegmentedControl
        scrollable
        value={circle}
        onChange={setCircle}
        segments={[
          { value: 'todos', label: 'Todos', badge: character.spells.length },
          ...[1, 2, 3, 4, 5]
            .filter((value) => circleCounts[value])
            .map((value) => ({
              value: String(value),
              label: `${value}º`,
              badge: circleCounts[value],
            })),
        ]}
      />

      {canEdit ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label="Buscar no grimório"
            onPress={() => setCatalogOpen(true)}
            style={{ flex: 1 }}
          />
          <Button
            label="Criar do zero"
            variant="secondary"
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      {byCircle.length === 0 ? (
        <Text variant="small" tone="muted">
          Nenhuma magia encontrada.
        </Text>
      ) : (
        byCircle.map(([circleNumber, spells]) => (
          <Card
            key={circleNumber}
            title={`${circleNumber}º círculo`}
            subtitle={`${SPELL_CIRCLE_COST[circleNumber] ?? '?'} PM por lançamento`}
            padded={false}
          >
            {spells.map((spell, index) => (
              <Pressable
                key={spell.id}
                onPress={() => setDetail(spell)}
                style={({ pressed }) => ({
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderBottomWidth: index === spells.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                  gap: 2,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {spell.name}
                  </Text>
                  <Chip label={`${spell.mp_cost} PM`} compact tone="arcane" />
                </View>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {spell.header}
                  {spell.execution ? ` · ${spell.execution}` : ''}
                  {spell.range_text ? ` · ${spell.range_text}` : ''}
                </Text>
              </Pressable>
            ))}
          </Card>
        ))
      )}

      {/* Detalhe completo da magia */}
      <Sheet
        visible={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ''}
        subtitle={detail?.header}
      >
        {detail ? (
          <>
            <View style={{ gap: spacing.xs }}>
              <DetailRow label="Execução" value={detail.execution} />
              <DetailRow label="Alcance" value={detail.range_text} />
              <DetailRow label="Alvo" value={detail.target} />
              <DetailRow label="Área" value={detail.area} />
              <DetailRow label="Efeito" value={detail.effect} />
              <DetailRow label="Duração" value={detail.duration} />
              <DetailRow label="Resistência" value={detail.resistance} />
              <DetailRow label="Custo" value={`${detail.mp_cost} PM`} />
            </View>

            {detail.description ? (
              <Text variant="body" tone="secondary">
                {detail.description}
              </Text>
            ) : null}

            {detail.enhancements.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="caption" tone="secondary" uppercase>
                  Aprimoramentos
                </Text>
                {detail.enhancements.map((enhancement, index) => (
                  <View
                    key={index}
                    style={{
                      backgroundColor: colors.surfaceAlt,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      gap: 2,
                    }}
                  >
                    <Text variant="smallStrong" tone="arcane">
                      {enhancement.cost}
                    </Text>
                    <Text variant="small" tone="secondary">
                      {enhancement.text}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <ShowcaseButton kind="spell" characterId={characterId} resourceId={detail.id} />

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
                    removeSpell.mutate(detail.id);
                    setDetail(null);
                  }}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <SpellForm
        key={editing?.id ?? 'nova'}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        characterId={characterId}
        spell={editing}
        onSaved={invalidate}
      />

      <SpellCatalogSheet
        visible={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        characterId={characterId}
        knownSpellIds={knownSpellIds}
        onImported={(added) =>
          setAviso(added === 1 ? 'Magia adicionada à ficha.' : `${added} magias adicionadas à ficha.`)
        }
      />

      {aviso ? <Toast message={aviso} tone="success" onDismiss={() => setAviso(null)} /> : null}
    </View>
  );
}

function SpellForm({
  visible,
  onClose,
  characterId,
  spell,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  characterId: number;
  spell: CharacterSpell | null;
  onSaved: () => void;
}) {
  const reference = useReference();

  const [name, setName] = useState(spell?.name ?? '');
  const [tradition, setTradition] = useState<string>(spell?.tradition ?? 'arcana');
  const [circle, setCircle] = useState<number>(spell?.circle ?? 1);
  const [school, setSchool] = useState<string | null>(spell?.school ?? null);
  const [execution, setExecution] = useState(spell?.execution ?? '');
  const [rangeText, setRangeText] = useState(spell?.range_text ?? '');
  const [target, setTarget] = useState(spell?.target ?? '');
  const [duration, setDuration] = useState(spell?.duration ?? '');
  const [resistance, setResistance] = useState(spell?.resistance ?? '');
  const [description, setDescription] = useState(spell?.description ?? '');

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        tradition,
        circle,
        school: school ?? undefined,
        execution: execution.trim() || undefined,
        range_text: rangeText.trim() || undefined,
        target: target.trim() || undefined,
        duration: duration.trim() || undefined,
        resistance: resistance.trim() || undefined,
        description: description.trim() || undefined,
        // Sem custo informado, o backend aplica o da Tabela 4-1 (p. 170).
        mp_cost: SPELL_CIRCLE_COST[circle],
      };

      return spell
        ? charactersApi.updateSpell(characterId, spell.id, payload)
        : charactersApi.createSpell(characterId, payload);
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
      title={spell ? 'Editar magia' : 'Nova magia'}
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Salvar" onPress={() => save.mutate()} loading={save.isPending} style={{ flex: 1 }} />
        </>
      }
    >
      <Input label="Nome" value={name} onChangeText={setName} placeholder="Bola de Fogo" />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Select
            label="Tipo"
            value={tradition}
            options={[
              { value: 'arcana', label: 'Arcana' },
              { value: 'divina', label: 'Divina' },
            ]}
            onChange={(value) => setTradition(value ?? 'arcana')}
            searchable={false}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Select
            label="Círculo"
            value={circle}
            options={[1, 2, 3, 4, 5].map((value) => ({
              value,
              label: `${value}º`,
              description: `${SPELL_CIRCLE_COST[value]} PM`,
            }))}
            onChange={(value) => setCircle(value ?? 1)}
            searchable={false}
          />
        </View>
      </View>

      <Select
        label="Escola"
        value={school}
        options={(reference.data?.spell_schools ?? []).map((entry) => ({
          value: entry.value,
          label: entry.label,
        }))}
        onChange={setSchool}
        clearable
        searchable={false}
      />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Input
          label="Execução"
          value={execution}
          onChangeText={setExecution}
          placeholder="padrão"
          containerStyle={{ flex: 1 }}
        />
        <Input
          label="Alcance"
          value={rangeText}
          onChangeText={setRangeText}
          placeholder="curto"
          containerStyle={{ flex: 1 }}
        />
      </View>

      <Input label="Alvo / Área / Efeito" value={target} onChangeText={setTarget} placeholder="1 criatura" />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Input
          label="Duração"
          value={duration}
          onChangeText={setDuration}
          placeholder="cena"
          containerStyle={{ flex: 1 }}
        />
        <Input
          label="Resistência"
          value={resistance}
          onChangeText={setResistance}
          placeholder="Reflexos reduz"
          containerStyle={{ flex: 1 }}
        />
      </View>

      <Input label="Descrição" value={description} onChangeText={setDescription} multiline />
    </Sheet>
  );
}
