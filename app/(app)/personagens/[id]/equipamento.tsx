import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, charactersApi } from '@/api';
import type { Character, CharacterItem, ReferenceItem } from '@/api/types';
import {
  Button,
  Card,
  Chip,
  DetailRow,
  HelpNote,
  Icon,
  Input,
  ProgressBar,
  Select,
  Sheet,
  Text,
} from '@/components/ui';
import { SheetScreen } from '@/components/character/SheetScreen';
import { ShowcaseButton } from '@/components/showcase';
import { useReference } from '@/hooks/useReference';
import { describeCatalogItem, formatSlots, formatTibar } from '@/rules';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Aba Equipamento (briefing §10).
 *
 * Cada item traz quantidade, espaços e se está equipado. Os espaços seguem a
 * regra do livro (p. 141): itens leves ocupam meio espaço, armaduras pesadas
 * ocupam cinco, e mil moedas ocupam um. Passar do limite marca sobrecarregado.
 */
export default function EquipmentScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <EquipmentContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}

function EquipmentContent({ characterId, character }: { characterId: number; character: Character }) {
  const { colors } = useTheme();

  const queryClient = useQueryClient();
  const reference = useReference();
  const canEdit = character.permissions.can_update;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CharacterItem | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [money, setMoney] = useState(String(character.money_tibar));

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['character', characterId] });
  };

  const toggleEquipped = useMutation({
    mutationFn: (item: CharacterItem) =>
      charactersApi.updateItem(characterId, item.id, { equipped: !item.equipped }),
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: (itemId: number) => charactersApi.removeItem(characterId, itemId),
    onSuccess: invalidate,
  });

  const saveMoney = useMutation({
    mutationFn: (value: number) => charactersApi.updateMoney(characterId, value),
    onSuccess: () => {
      invalidate();
      setMoneyOpen(false);
    },
  });

  // O detalhe sai da lista, e não de uma cópia no estado: equipar o item ou
  // mudar a quantidade atualiza o painel aberto sem fechar e abrir de novo.
  const detail = useMemo(
    () => character.items.find((item) => item.id === detailId) ?? null,
    [character.items, detailId]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, CharacterItem[]> = {};

    for (const item of character.items) {
      const key = item.category_label;
      groups[key] = groups[key] ?? [];
      groups[key].push(item);
    }

    return Object.entries(groups);
  }, [character.items]);

  const carry = character.carry;

  return (
    <View style={{ gap: spacing.md }}>
      {/* Carga e dinheiro */}
      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text variant="caption" tone="secondary" uppercase>
              Espaços
            </Text>
            <Text variant="bodyStrong" tone={carry.overloaded ? 'warning' : 'default'}>
              {formatSlots(carry.used)} / {formatSlots(carry.limit)}
            </Text>
          </View>

          <ProgressBar
            value={carry.used}
            max={carry.limit}
            color={carry.overloaded ? colors.warning : colors.info}
            trackColor={colors.infoFill}
          />

          {carry.overloaded ? (
            <HelpNote tone="warning" source="Livro base, p. 141">
              {`Você passou do limite: sofre −5 de penalidade de armadura e perde 3m de deslocamento. O máximo absoluto é ${formatSlots(carry.hard_limit)} espaços.`}
            </HelpNote>
          ) : (
            <HelpNote collapsible source="Livro base, p. 141">
              Peso é contado em espaços, não em quilos. Um item comum ocupa 1 espaço; poções e pergaminhos
              ocupam meio; armaduras pesadas ocupam 5. Cada mil moedas ocupam 1.
            </HelpNote>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text variant="caption" tone="secondary" uppercase>
                Dinheiro
              </Text>
              <Text variant="bodyStrong" tone="gold">
                {formatTibar(character.money_tibar)}
              </Text>
              {carry.money_slots > 0 ? (
                <Text variant="caption" tone="muted">
                  ocupa {formatSlots(carry.money_slots)} espaço(s)
                </Text>
              ) : null}
            </View>
            {canEdit ? (
              <Button label="Alterar" variant="secondary" size="sm" onPress={() => setMoneyOpen(true)} />
            ) : null}
          </View>
        </View>
      </Card>

      {canEdit ? (
        <Button
          label="Adicionar item"
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : null}

      {character.items.length === 0 ? (
        <Text variant="small" tone="muted">
          Nenhum item no inventário.
        </Text>
      ) : (
        grouped.map(([label, items]) => (
          <Card key={label} title={label} padded={false}>
            {items.map((item, index) => (
              <View
                key={item.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderBottomWidth: index === items.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                }}
              >
                {canEdit ? (
                  <Pressable
                    onPress={() => toggleEquipped.mutate(item)}
                    hitSlop={8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.equipped }}
                    accessibilityLabel={`${item.name} equipado`}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: radius.sm,
                      borderWidth: 1.5,
                      borderColor: item.equipped ? colors.success : colors.borderStrong,
                      backgroundColor: item.equipped ? colors.success : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.equipped ? (
                      <Text variant="caption" style={{ color: colors.onPrimary }}>
                        ✓
                      </Text>
                    ) : null}
                  </Pressable>
                ) : null}

                <Pressable
                  style={{ flex: 1, minWidth: 0 }}
                  onPress={() => setDetailId(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Detalhes de ${item.name}`}
                >
                  <Text variant="body" numberOfLines={1}>
                    {item.name}
                    {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {formatSlots(item.total_slots)} espaço(s)
                    {item.defense_bonus ? ` · Defesa +${item.defense_bonus}` : ''}
                    {item.armor_penalty ? ` · armadura ${item.armor_penalty}` : ''}
                  </Text>
                </Pressable>

                {canEdit ? (
                  <Pressable
                    onPress={() => removeItem.mutate(item.id)}
                    hitSlop={8}
                    accessibilityLabel="Remover item"
                  >
                    <Icon name="remover" size={18} color={colors.textSubtle} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Card>
        ))
      )}

      {/* Detalhe do item.
          Antes, tocar num item abria direto o formulário — e só para quem podia
          editar, de modo que a descrição ficava inalcançável para todos os
          outros. O painel resolve as duas coisas: qualquer um lê o item, e é
          daqui que ele é exibido aos outros. */}
      <Sheet
        visible={detail !== null}
        onClose={() => setDetailId(null)}
        title={detail?.name ?? ''}
        subtitle={detail?.category_label}
      >
        {detail ? (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
              {detail.quantity > 1 ? <Chip label={`×${detail.quantity}`} compact /> : null}
              {detail.equipped ? <Chip label="equipado" compact tone="success" /> : null}
            </View>

            <View style={{ gap: spacing.xs }}>
              <DetailRow label="Espaços" value={formatSlots(detail.total_slots)} />
              <DetailRow label="Preço" value={detail.price !== null ? formatTibar(detail.price) : null} />
              <DetailRow label="Defesa" value={detail.defense_bonus ? `+${detail.defense_bonus}` : null} />
              <DetailRow
                label="Penalidade de armadura"
                value={detail.armor_penalty ? String(detail.armor_penalty) : null}
              />
              <DetailRow label="Peso da armadura" value={detail.armor_weight} />
            </View>

            <Text variant="body" tone="secondary">
              {detail.description || 'Sem descrição.'}
            </Text>

            <ShowcaseButton kind="item" characterId={characterId} resourceId={detail.id} />

            {canEdit ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  label="Editar"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setEditing(detail);
                    setDetailId(null);
                    setFormOpen(true);
                  }}
                />
                <Button
                  label="Remover"
                  variant="danger"
                  style={{ flex: 1 }}
                  onPress={() => {
                    removeItem.mutate(detail.id);
                    setDetailId(null);
                  }}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </Sheet>

      {/* A key força um formulário novo a cada item aberto: sem isso o estado
          inicial ficaria preso no primeiro item selecionado. */}
      <ItemForm
        key={editing?.id ?? 'novo'}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        characterId={characterId}
        item={editing}
        catalog={reference.data?.items ?? []}
        onSaved={invalidate}
      />

      <Sheet
        visible={moneyOpen}
        onClose={() => setMoneyOpen(false)}
        title="Dinheiro"
        subtitle="Valor em T$ (Tibar de prata)"
        footer={
          <>
            <Button
              label="Cancelar"
              variant="ghost"
              onPress={() => setMoneyOpen(false)}
              style={{ flex: 1 }}
            />
            <Button
              label="Salvar"
              onPress={() => saveMoney.mutate(Number.parseFloat(money.replace(',', '.')) || 0)}
              loading={saveMoney.isPending}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        {saveMoney.isError ? (
          <Text variant="small" tone="danger">
            {saveMoney.error instanceof ApiError && saveMoney.error.message
              ? saveMoney.error.message
              : 'Não foi possível salvar o dinheiro. Tente de novo.'}
          </Text>
        ) : null}

        <Input
          label="Tibares (T$)"
          value={money}
          onChangeText={setMoney}
          keyboardType="decimal-pad"
          hint="TC vale T$ 0,1 e TO vale T$ 10. Cada mil moedas ocupam 1 espaço."
        />
      </Sheet>
    </View>
  );
}

/** Formulário de item, com preenchimento a partir do catálogo do livro. */
function ItemForm({
  visible,
  onClose,
  characterId,
  item,
  catalog,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  characterId: number;
  item: CharacterItem | null;
  catalog: ReferenceItem[];
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [slots, setSlots] = useState(String(item?.slots ?? 1));
  const [catalogId, setCatalogId] = useState<number | null>(item?.item_id ?? null);
  const [description, setDescription] = useState(item?.description ?? '');

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        quantity: Number.parseInt(quantity, 10) || 1,
        slots: Number.parseFloat(slots.replace(',', '.')) || 1,
        description: description.trim() || undefined,
        item_id: catalogId ?? undefined,
      };

      return item
        ? charactersApi.updateItem(characterId, item.id, payload)
        : charactersApi.createItem(characterId, payload);
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
      title={item ? 'Editar item' : 'Novo item'}
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Salvar" onPress={() => save.mutate()} loading={save.isPending} style={{ flex: 1 }} />
        </>
      }
    >
      {/* Sem este aviso a falha era silenciosa: o formulário continuava aberto
          como se nada tivesse acontecido, e o jogador clicava em Salvar de novo. */}
      {save.isError ? (
        <Text variant="small" tone="danger">
          {save.error instanceof ApiError && save.error.message
            ? save.error.message
            : 'Não foi possível salvar o item. Tente de novo.'}
        </Text>
      ) : null}

      <Select
        label="Do livro (opcional)"
        value={catalogId}
        options={catalog.map((entry) => ({
          value: entry.id,
          label: entry.name,
          description: describeCatalogItem(entry),
        }))}
        onChange={(value) => {
          setCatalogId(value);
          const found = catalog.find((entry) => entry.id === value);
          if (found) {
            setName(found.name);
            setSlots(String(found.slots));
            // A regra do item (o que o fogo alquímico faz) só chega à ficha se
            // vier junto. O que o jogador já escreveu à mão manda: um item
            // adaptado na mesa não é sobrescrito pela troca de catálogo.
            if (!description.trim() && found.description) setDescription(found.description);
          }
        }}
        clearable
        placeholder="Escolher do catálogo do livro"
      />

      <Input label="Nome" value={name} onChangeText={setName} />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Input
          label="Quantidade"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          containerStyle={{ flex: 1 }}
        />
        <Input
          label="Espaços (un.)"
          value={slots}
          onChangeText={setSlots}
          keyboardType="decimal-pad"
          containerStyle={{ flex: 1 }}
          hint="0,5 para poções"
        />
      </View>

      <Input label="Descrição" value={description} onChangeText={setDescription} multiline />
    </Sheet>
  );
}
