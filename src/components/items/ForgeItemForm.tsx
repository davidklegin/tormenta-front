import { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, forgeApi } from '@/api';
import type { CharacterItem, ForgeItem } from '@/api/types';
import { Button, HelpNote, Input, Select, Sheet, Text } from '@/components/ui';
import { useReference } from '@/hooks/useReference';
import { spacing } from '@/theme';
import { ItemEffectsEditor, draftsToEffects, effectsToDrafts, type EffectDraft } from './ItemEffectsEditor';

const ATTACK_TYPES = [
  { value: 'corpo_a_corpo', label: 'Corpo a corpo' },
  { value: 'arremesso', label: 'Arremesso' },
  { value: 'disparo', label: 'Disparo' },
];

const RANGES = [
  { value: 'nenhum', label: 'Sem alcance (corpo a corpo)' },
  { value: 'curto', label: 'Curto (9 m)' },
  { value: 'medio', label: 'Médio (30 m)' },
  { value: 'longo', label: 'Longo (90 m)' },
];

function inteiro(raw: string): number | null {
  const parsed = Number.parseInt(raw.replace('−', '-'), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function decimal(raw: string): number | null {
  const parsed = Number.parseFloat(raw.replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Formulário da Forja: o item e o que ele dá.
 *
 * A parte de cima é o item como o livro o descreveria (categoria, espaços,
 * preço; dano se for arma, Defesa se for armadura). A de baixo são os bônus
 * — e é ela que faz o item somar sozinho na ficha de quem o equipar.
 */
export function ForgeItemForm({
  visible,
  onClose,
  item,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  item: ForgeItem | null;
  onSaved?: (item: ForgeItem) => void;
}) {
  const queryClient = useQueryClient();
  const reference = useReference();

  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<CharacterItem['category']>(item?.category ?? 'geral');
  const [slots, setSlots] = useState(String(item?.slots ?? 1).replace('.', ','));
  const [price, setPrice] = useState(item?.price != null ? String(item.price).replace('.', ',') : '');
  const [description, setDescription] = useState(item?.description ?? '');

  const [damage, setDamage] = useState(item?.damage ?? '');
  const [damageType, setDamageType] = useState<string | null>(item?.damage_type ?? null);
  const [criticalRange, setCriticalRange] = useState(String(item?.critical_range ?? ''));
  const [criticalMultiplier, setCriticalMultiplier] = useState(String(item?.critical_multiplier ?? ''));
  const [attackType, setAttackType] = useState<string | null>(item?.attack_type ?? 'corpo_a_corpo');
  const [range, setRange] = useState<string | null>(item?.range_category ?? 'nenhum');

  const [defenseBonus, setDefenseBonus] = useState(item?.defense_bonus != null ? String(item.defense_bonus) : '');
  const [armorPenalty, setArmorPenalty] = useState(item?.armor_penalty != null ? String(item.armor_penalty) : '');
  const [armorWeight, setArmorWeight] = useState<string | null>(item?.armor_weight ?? null);

  const [drafts, setDrafts] = useState<EffectDraft[]>(effectsToDrafts(item?.effects));

  const isWeapon = category === 'arma';
  const isArmor = category === 'armadura' || category === 'escudo';

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        category,
        slots: decimal(slots) ?? 1,
        price: decimal(price),
        description: description.trim() || null,
        effects: draftsToEffects(drafts),
        // Campos da categoria errada vão nulos: uma arma que já foi armadura
        // não deve guardar a Defesa de antes.
        damage: isWeapon ? damage.trim() || null : null,
        damage_type: isWeapon ? damageType : null,
        critical_range: isWeapon ? inteiro(criticalRange) : null,
        critical_multiplier: isWeapon ? inteiro(criticalMultiplier) : null,
        attack_type: isWeapon ? attackType : null,
        range_category: isWeapon ? range : null,
        defense_bonus: isArmor ? inteiro(defenseBonus) : null,
        armor_penalty: isArmor ? inteiro(armorPenalty) : null,
        armor_weight: category === 'armadura' ? armorWeight : null,
      };

      return item ? forgeApi.update(item.id, payload) : forgeApi.create(payload);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['forge'] });
      // O item entra (ou muda) no "Escolher do catálogo" de todas as fichas.
      void queryClient.invalidateQueries({ queryKey: ['reference'] });
      onSaved?.(saved);
      onClose();
    },
  });

  const errors = save.error instanceof ApiError ? save.error.errors : undefined;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={item ? `Editar ${item.name}` : 'Forjar item'}
      subtitle="O item fica disponível para todas as fichas"
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label="Salvar"
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={!name.trim()}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      {save.isError ? (
        <Text variant="small" tone="danger">
          {save.error instanceof ApiError && save.error.message
            ? save.error.message
            : 'Não foi possível salvar o item. Tente de novo.'}
        </Text>
      ) : null}

      <Input label="Nome" value={name} onChangeText={setName} placeholder="Anel de Proteção" error={errors?.name?.[0]} />

      <Select
        label="Tipo de item"
        value={category}
        searchable={false}
        options={(reference.data?.item_categories ?? []).map((c) => ({
          value: c.value as CharacterItem['category'],
          label: c.label,
        }))}
        onChange={(value) => value && setCategory(value)}
      />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Input
          label="Espaços"
          value={slots}
          onChangeText={setSlots}
          keyboardType="decimal-pad"
          hint="0,5 para itens leves"
          containerStyle={{ flex: 1 }}
        />
        <Input
          label="Preço (T$)"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          containerStyle={{ flex: 1 }}
        />
      </View>

      {isWeapon ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="caption" tone="secondary" uppercase>
            Arma
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Input
              label="Dano"
              value={damage}
              onChangeText={setDamage}
              placeholder="1d8"
              autoCapitalize="none"
              containerStyle={{ flex: 1 }}
            />
            <Input
              label="Crítico (margem)"
              value={criticalRange}
              onChangeText={setCriticalRange}
              keyboardType="number-pad"
              placeholder="19"
              containerStyle={{ flex: 1 }}
            />
            <Input
              label="Multiplicador"
              value={criticalMultiplier}
              onChangeText={setCriticalMultiplier}
              keyboardType="number-pad"
              placeholder="2"
              containerStyle={{ flex: 1 }}
            />
          </View>
          <Select
            label="Tipo de dano"
            value={damageType}
            searchable={false}
            clearable
            options={(reference.data?.damage_types ?? []).map((t) => ({ value: t.value, label: t.label }))}
            onChange={setDamageType}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Select label="Ataque" value={attackType} searchable={false} options={ATTACK_TYPES} onChange={setAttackType} />
            </View>
            <View style={{ flex: 1 }}>
              <Select label="Alcance" value={range} searchable={false} options={RANGES} onChange={setRange} />
            </View>
          </View>
        </View>
      ) : null}

      {isArmor ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="caption" tone="secondary" uppercase>
            {category === 'escudo' ? 'Escudo' : 'Armadura'}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Input
              label="Bônus na Defesa"
              value={defenseBonus}
              onChangeText={setDefenseBonus}
              keyboardType="numbers-and-punctuation"
              placeholder="2"
              containerStyle={{ flex: 1 }}
            />
            <Input
              label="Penalidade"
              value={armorPenalty}
              onChangeText={setArmorPenalty}
              keyboardType="numbers-and-punctuation"
              placeholder="-2"
              hint="zero ou negativa"
              error={errors?.armor_penalty?.[0]}
              containerStyle={{ flex: 1 }}
            />
          </View>
          {category === 'armadura' ? (
            <Select
              label="Peso"
              value={armorWeight}
              searchable={false}
              clearable
              options={[
                { value: 'leve', label: 'Leve' },
                { value: 'pesada', label: 'Pesada (anula a Destreza na Defesa e tira 3 m)' },
              ]}
              onChange={setArmorWeight}
            />
          ) : null}
        </View>
      ) : null}

      <Input label="Descrição" value={description} onChangeText={setDescription} multiline />

      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" tone="secondary" uppercase>
          O que o item dá
        </Text>
        <HelpNote collapsible>
          Cada bônus soma sozinho na ficha de quem estiver com o item equipado — e sai quando ele é guardado
          na mochila. O detalhamento da ficha mostra o nome do item ao lado do número, para todo mundo saber de
          onde ele veio.
        </HelpNote>
        <ItemEffectsEditor
          drafts={drafts}
          onChange={setDrafts}
          defaultScope={isWeapon ? 'this' : 'all'}
          errors={errors}
        />
      </View>
    </Sheet>
  );
}
