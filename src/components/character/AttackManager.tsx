import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { charactersApi } from '@/api';
import type { CharacterAttack, ReferenceItem } from '@/api/types';
import { Button, Card, Chip, Input, Select, Sheet, Text, Icon } from '@/components/ui';
import { useReference } from '@/hooks/useReference';
import { signed } from '@/rules';
import { radius, spacing, stroke, useTheme } from '@/theme';

/**
 * Ataques da ficha (briefing §10).
 *
 * O bônus de ataque não é digitado: ele vem da perícia correspondente — Luta
 * para corpo a corpo, Pontaria para ataques à distância (livro base, p. 142) —
 * calculada pelo servidor. Aqui o jogador informa a arma, o dano e o crítico,
 * e pode somar um modificador extra quando algum poder exigir.
 */
export function AttackManager({
  characterId,
  attacks,
  editable,
}: {
  characterId: number;
  attacks: CharacterAttack[];
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const reference = useReference();

  const { colors } = useTheme();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CharacterAttack | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['character', characterId] });
  };

  const removeAttack = useMutation({
    mutationFn: (id: number) => charactersApi.removeAttack(characterId, id),
    onSuccess: invalidate,
  });

  const weapons = (reference.data?.items ?? []).filter((item) => item.category === 'arma');

  return (
    <Card
      title="Ataques"
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
        {attacks.length === 0 ? (
          <Text variant="small" tone="muted">
            Nenhum ataque cadastrado.
          </Text>
        ) : (
          attacks.map((attack, index) => (
            <Pressable
              key={attack.id}
              disabled={!editable}
              onPress={() => {
                setEditing(attack);
                setFormOpen(true);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.sm,
                borderBottomWidth: index === attacks.length - 1 ? 0 : 1,
                borderBottomColor: colors.border,
                backgroundColor: pressed ? colors.surfaceHover : 'transparent',
              })}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {attack.name}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {attack.attack_type_label} · {attack.damage_type_label}
                  {attack.computed.range_meters ? ` · ${attack.computed.range_meters}m` : ''}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="bodyStrong" tone="primary">
                  {signed(attack.computed.attack_bonus)}
                </Text>
                <Text variant="small" tone="secondary">
                  {attack.computed.damage} ({attack.computed.critical})
                </Text>
              </View>

              {editable ? (
                <Pressable
                  onPress={() => removeAttack.mutate(attack.id)}
                  hitSlop={8}
                  accessibilityLabel={`Remover ${attack.name}`}
                >
                  <Icon name="remover" size={18} color={colors.textSubtle} />
                </Pressable>
              ) : null}
            </Pressable>
          ))
        )}
      </View>

      <AttackForm
        key={editing?.id ?? 'novo'}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        characterId={characterId}
        attack={editing}
        weapons={weapons}
        onSaved={invalidate}
      />
    </Card>
  );
}

function AttackForm({
  visible,
  onClose,
  characterId,
  attack,
  weapons,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  characterId: number;
  attack: CharacterAttack | null;
  weapons: ReferenceItem[];
  onSaved: () => void;
}) {
  const [name, setName] = useState(attack?.name ?? '');
  const [weaponId, setWeaponId] = useState<number | null>(attack?.item_id ?? null);
  const [attackType, setAttackType] = useState<string>(attack?.attack_type ?? 'corpo_a_corpo');
  const [damageDice, setDamageDice] = useState(attack?.computed.damage_breakdown[0]?.value ?? '');
  const [criticalRange, setCriticalRange] = useState(String(attack?.critical_range ?? 20));
  const [criticalMultiplier, setCriticalMultiplier] = useState(String(attack?.critical_multiplier ?? 2));
  const [damageType, setDamageType] = useState<string>(attack?.damage_type ?? 'corte');
  const [rangeCategory, setRangeCategory] = useState<string>(attack?.range_category ?? 'nenhum');
  const [attackOther, setAttackOther] = useState(String(attack?.attack_bonus_other ?? 0));
  const [damageOther, setDamageOther] = useState(String(attack?.damage_bonus_other ?? 0));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        item_id: weaponId ?? undefined,
        attack_type: attackType,
        damage_dice: damageDice.trim() || undefined,
        critical_range: Number.parseInt(criticalRange, 10) || 20,
        critical_multiplier: Number.parseInt(criticalMultiplier, 10) || 2,
        damage_type: damageType,
        range_category: rangeCategory,
        attack_bonus_other: Number.parseInt(attackOther, 10) || 0,
        damage_bonus_other: Number.parseInt(damageOther, 10) || 0,
      };

      return attack
        ? charactersApi.updateAttack(characterId, attack.id, payload)
        : charactersApi.createAttack(characterId, payload);
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
      title={attack ? 'Editar ataque' : 'Novo ataque'}
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Salvar" onPress={() => save.mutate()} loading={save.isPending} style={{ flex: 1 }} />
        </>
      }
    >
      <Select
        label="Arma do livro (opcional)"
        value={weaponId}
        options={weapons.map((weapon) => ({
          value: weapon.id,
          label: weapon.name,
          description: [weapon.damage, weapon.damage_type, weapon.proficiency].filter(Boolean).join(' · '),
        }))}
        onChange={(value) => {
          setWeaponId(value);

          // Preenche a partir da Tabela 3-3 (p. 144), poupando digitação.
          const weapon = weapons.find((entry) => entry.id === value);
          if (weapon) {
            setName(weapon.name);
            setDamageDice(weapon.damage ?? '');
            setCriticalRange(String(weapon.critical_range ?? 20));
            setCriticalMultiplier(String(weapon.critical_multiplier ?? 2));
            setDamageType(weapon.damage_type ?? 'corte');
            setRangeCategory(weapon.range_category ?? 'nenhum');
            setAttackType(weapon.attack_type ?? 'corpo_a_corpo');
          }
        }}
        clearable
        placeholder="Escolher arma do catálogo"
      />

      <Input label="Nome" value={name} onChangeText={setName} placeholder="Machado táurico" />

      <Select
        label="Tipo de ataque"
        value={attackType}
        options={[
          {
            value: 'corpo_a_corpo',
            label: 'Corpo a corpo',
            description: 'Teste de Luta, soma Força ao dano',
          },
          { value: 'arremesso', label: 'Arremesso', description: 'Teste de Pontaria, soma Força ao dano' },
          { value: 'disparo', label: 'Disparo', description: 'Teste de Pontaria, sem atributo no dano' },
        ]}
        onChange={(value) => setAttackType(value ?? 'corpo_a_corpo')}
        searchable={false}
      />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Input
          label="Dano"
          value={damageDice}
          onChangeText={setDamageDice}
          placeholder="2d8"
          containerStyle={{ flex: 2 }}
        />
        <Input
          label="Margem"
          value={criticalRange}
          onChangeText={setCriticalRange}
          keyboardType="number-pad"
          containerStyle={{ flex: 1 }}
          hint="20, 19, 18"
        />
        <Input
          label="Multipl."
          value={criticalMultiplier}
          onChangeText={setCriticalMultiplier}
          keyboardType="number-pad"
          containerStyle={{ flex: 1 }}
          hint="2, 3, 4"
        />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Select
            label="Tipo de dano"
            value={damageType}
            options={[
              { value: 'corte', label: 'Corte' },
              { value: 'impacto', label: 'Impacto' },
              { value: 'perfuracao', label: 'Perfuração' },
              { value: 'corte_perfuracao', label: 'Corte/perfuração' },
              { value: 'outro', label: 'Outro' },
            ]}
            onChange={(value) => setDamageType(value ?? 'corte')}
            searchable={false}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Select
            label="Alcance"
            value={rangeCategory}
            options={[
              { value: 'nenhum', label: '—' },
              { value: 'curto', label: 'Curto (9m)' },
              { value: 'medio', label: 'Médio (30m)' },
              { value: 'longo', label: 'Longo (90m)' },
            ]}
            onChange={(value) => setRangeCategory(value ?? 'nenhum')}
            searchable={false}
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Input
          label="Outros no ataque"
          value={attackOther}
          onChangeText={setAttackOther}
          keyboardType="numbers-and-punctuation"
          containerStyle={{ flex: 1 }}
        />
        <Input
          label="Outros no dano"
          value={damageOther}
          onChangeText={setDamageOther}
          keyboardType="numbers-and-punctuation"
          containerStyle={{ flex: 1 }}
        />
      </View>

      <Text variant="small" tone="muted">
        O bônus de ataque vem da perícia correspondente (Luta ou Pontaria) e é calculado pelo servidor.
      </Text>
    </Sheet>
  );
}
