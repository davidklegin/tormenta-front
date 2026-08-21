import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ApiError } from '@/api';
import type { AttributeKey } from '@/api/types';
import { Button, Card, Chip, HelpNote, Input, Loading, Screen, Select, Text } from '@/components/ui';
import { PageHeader } from '@/components/layout';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useCreateCharacter } from '@/hooks/useCharacters';
import { useReference } from '@/hooks/useReference';
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER, signed } from '@/rules';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Criação de personagem (briefing §9).
 *
 * Segue a ordem do livro: atributos, raça, classe, origem e divindade
 * (p. 17 a 105). Os modificadores raciais e os PV/PM iniciais são aplicados
 * pelo servidor a partir dos catálogos, então a tela só coleta as escolhas.
 */
export default function NewCharacterScreen() {
  const reference = useReference();
  const campaigns = useCampaigns();
  const createCharacter = useCreateCharacter();

  const [name, setName] = useState('');
  const [raceId, setRaceId] = useState<number | null>(null);
  const [raceVariant, setRaceVariant] = useState<string | null>(null);
  const [racialChoices, setRacialChoices] = useState<AttributeKey[]>([]);
  const [classKey, setClassKey] = useState<string | null>(null);
  const [level, setLevel] = useState('1');
  const [originId, setOriginId] = useState<number | null>(null);
  const [deityId, setDeityId] = useState<number | null>(null);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [attributes, setAttributes] = useState<Record<AttributeKey, number>>({
    for: 0,
    des: 0,
    con: 0,
    int: 0,
    sab: 0,
    car: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const race = useMemo(
    () => reference.data?.races.find((entry) => entry.id === raceId) ?? null,
    [reference.data?.races, raceId]
  );

  const gameClass = useMemo(
    () => reference.data?.classes.find((entry) => entry.key === classKey) ?? null,
    [reference.data?.classes, classKey]
  );

  /** Modificadores raciais previstos, incluindo as escolhas livres. */
  const racialPreview = useMemo(() => {
    if (!race) return {} as Partial<Record<AttributeKey, number>>;

    const base: Partial<Record<AttributeKey, number>> = {
      ...(raceVariant && race.variants?.[raceVariant]
        ? race.variants[raceVariant].attribute_modifiers
        : (race.attribute_modifiers ?? {})),
    };

    for (const key of racialChoices) {
      base[key] = (base[key] ?? 0) + race.free_choice_bonus;
    }

    return base;
  }, [race, raceVariant, racialChoices]);

  function toggleRacialChoice(key: AttributeKey) {
    if (!race) return;
    if (race.excluded_attributes?.includes(key)) return;

    setRacialChoices((previous) => {
      if (previous.includes(key)) {
        return previous.filter((entry) => entry !== key);
      }

      if (previous.length >= race.free_choices) {
        return previous;
      }

      return [...previous, key];
    });
  }

  async function handleSubmit() {
    if (name.trim().length < 2) {
      setError('Informe o nome do personagem.');

      return;
    }

    if (!classKey) {
      setError('Escolha uma classe.');

      return;
    }

    if (race && race.free_choices > 0 && racialChoices.length !== race.free_choices) {
      setError(
        `${race.name} recebe +${race.free_choice_bonus} em ${race.free_choices} atributos diferentes.`
      );

      return;
    }

    setError(null);

    try {
      const character = await createCharacter.mutateAsync({
        name: name.trim(),
        race_id: raceId,
        race_variant: raceVariant,
        racial_attribute_choices: racialChoices.length > 0 ? racialChoices : undefined,
        origin_id: originId,
        deity_id: deityId,
        campaign_id: campaignId,
        attributes,
        classes: [{ key: classKey, level: Math.max(1, Number.parseInt(level, 10) || 1), is_primary: true }],
      });

      router.replace(`/(app)/personagens/${character.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.fieldError('name') ?? err.fieldError('classes') ?? err.message)
          : 'Não foi possível criar o personagem.'
      );
    }
  }

  if (reference.isLoading) {
    return (
      <Screen>
        <Loading label="Carregando catálogos do livro…" />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ maxWidth: 760 }}>
      <PageHeader title="Novo personagem" subtitle="Tormenta20" back backLabel="Meus personagens" />

      <HelpNote>
        Só o nome e a classe são obrigatórios. Raça, origem e divindade podem ficar para depois — dá para
        completar a ficha a qualquer momento.
      </HelpNote>

      <Card title="Identidade">
        <View style={{ gap: spacing.md }}>
          <Input label="Nome" value={name} onChangeText={setName} placeholder="Como será chamado na mesa" />

          <Select
            label="Raça"
            value={raceId}
            options={(reference.data?.races ?? []).map((entry) => ({
              value: entry.id,
              label: entry.name,
              description: describeRace(entry),
            }))}
            onChange={(value) => {
              setRaceId(value);
              setRaceVariant(null);
              setRacialChoices([]);
            }}
            clearable
          />

          {race?.variants ? (
            <Select
              label="Herança"
              value={raceVariant}
              options={Object.entries(race.variants).map(([key, variant]) => ({
                value: key,
                label: variant.name,
                description: describeModifiers(variant.attribute_modifiers),
              }))}
              onChange={setRaceVariant}
              searchable={false}
            />
          ) : null}

          {/* Raças com "+1 em três atributos diferentes" (p. 18) */}
          {race && race.free_choices > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="smallStrong" tone="secondary">
                Escolha {race.free_choices} atributos para +{race.free_choice_bonus}
                {race.excluded_attributes?.length
                  ? ` (exceto ${race.excluded_attributes.map((key) => ATTRIBUTE_LABELS[key].short).join(', ')})`
                  : ''}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {ATTRIBUTE_ORDER.map((key) => {
                  const excluded = race.excluded_attributes?.includes(key) ?? false;

                  return (
                    <Chip
                      key={key}
                      label={ATTRIBUTE_LABELS[key].short}
                      selected={racialChoices.includes(key)}
                      tone={excluded ? 'neutral' : 'primary'}
                      onPress={excluded ? undefined : () => toggleRacialChoice(key)}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 2 }}>
              <Select
                label="Classe"
                value={classKey}
                options={(reference.data?.classes ?? []).map((entry) => ({
                  value: entry.key,
                  label: entry.name,
                  description: entry.short_description ?? undefined,
                }))}
                onChange={setClassKey}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Nível" value={level} onChangeText={setLevel} keyboardType="number-pad" />
            </View>
          </View>

          <Select
            label="Origem"
            value={originId}
            options={(reference.data?.origins ?? []).map((entry) => ({
              value: entry.id,
              label: entry.name,
              description: entry.skills?.join(', '),
            }))}
            onChange={setOriginId}
            clearable
          />

          <Select
            label="Divindade"
            value={deityId}
            options={(reference.data?.deities ?? []).map((entry) => ({
              value: entry.id,
              label: entry.name,
              description: entry.title ?? undefined,
            }))}
            onChange={setDeityId}
            clearable
          />

          <Select
            label="Campanha"
            value={campaignId}
            options={(campaigns.data ?? []).map((entry) => ({ value: entry.id, label: entry.name }))}
            onChange={setCampaignId}
            clearable
            hint="Você pode vincular depois, na ficha."
          />
        </View>
      </Card>

      <Card title="Atributos" subtitle="Quanto seu personagem é bom em cada coisa">
        <View style={{ gap: spacing.md }}>
          <HelpNote collapsible source="Livro base, p. 17">
            Aqui o número já é o bônus que entra nas rolagens: 0 é a média de uma pessoa comum, 2 é claramente
            acima da média e 4 é excepcional. Valores negativos também existem.
          </HelpNote>

          {ATTRIBUTE_ORDER.map((key) => {
            const racial = racialPreview[key] ?? 0;
            const total = attributes[key] + racial;

            return (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text variant="body">{ATTRIBUTE_LABELS[key].full}</Text>
                  {racial !== 0 ? (
                    <Text variant="caption" tone="muted">
                      raça {signed(racial)}
                    </Text>
                  ) : null}
                </View>

                <Stepper
                  value={attributes[key]}
                  onChange={(value) => setAttributes((previous) => ({ ...previous, [key]: value }))}
                />

                <View style={{ width: 52, alignItems: 'flex-end' }}>
                  <Text
                    variant="numeric"
                    style={{ fontSize: 20 }}
                    tone={racial !== 0 ? 'primary' : 'default'}
                  >
                    {signed(total)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {gameClass ? (
        <Card title={`${gameClass.name}`} subtitle="O que a classe concede">
          <View style={{ gap: spacing.xs }}>
            <Text variant="small" tone="secondary">
              PV: {gameClass.base_hp} + Constituição no 1º nível, depois {gameClass.hp_per_level} +
              Constituição por nível
            </Text>
            <Text variant="small" tone="secondary">
              PM: {gameClass.mp_per_level} por nível
            </Text>
            {gameClass.fixed_skills?.length ? (
              <Text variant="small" tone="secondary">
                Perícias: {gameClass.fixed_skills.join(', ').replace(/\|/g, ' ou ')}
                {gameClass.extra_skills ? ` + ${gameClass.extra_skills} a sua escolha` : ''}
              </Text>
            ) : null}
            {gameClass.proficiencies?.length ? (
              <Text variant="small" tone="secondary">
                Proficiências: {gameClass.proficiencies.join(', ').replace(/_/g, ' ')}
              </Text>
            ) : null}
          </View>
        </Card>
      ) : null}

      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : null}

      <Button
        label="Criar personagem"
        onPress={handleSubmit}
        loading={createCharacter.isPending}
        fullWidth
        size="lg"
      />

      <Text variant="small" tone="muted" center>
        Você pode editar tudo depois, inclusive nível e atributos.
      </Text>
    </Screen>
  );
}

/** Controle de −/+ para os atributos, que variam pouco e em passos de 1. */
function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <StepperButton label="−" onPress={() => onChange(Math.max(-5, value - 1))} />
      <View style={{ width: 34, alignItems: 'center' }}>
        <Text variant="bodyStrong">{value}</Text>
      </View>
      <StepperButton label="+" onPress={() => onChange(Math.min(20, value + 1))} />
    </View>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceHover : colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text variant="bodyStrong" tone="secondary">
        {label}
      </Text>
    </Pressable>
  );
}

function describeRace(race: {
  attribute_modifiers: Partial<Record<AttributeKey, number>> | null;
  free_choices: number;
  free_choice_bonus: number;
  excluded_attributes: AttributeKey[] | null;
}): string {
  const parts: string[] = [];

  if (race.free_choices > 0) {
    const except = race.excluded_attributes?.length
      ? ` (exceto ${race.excluded_attributes.map((key) => ATTRIBUTE_LABELS[key].short).join(', ')})`
      : '';
    parts.push(`+${race.free_choice_bonus} em ${race.free_choices} atributos${except}`);
  }

  const fixed = describeModifiers(race.attribute_modifiers ?? {});
  if (fixed) parts.push(fixed);

  return parts.join(' · ');
}

function describeModifiers(modifiers: Partial<Record<AttributeKey, number>>): string {
  return Object.entries(modifiers)
    .map(([key, value]) => `${ATTRIBUTE_LABELS[key as AttributeKey].short} ${signed(value as number)}`)
    .join(', ');
}
