import { View } from 'react-native';
import type { AttributeKey, ReferenceRace } from '@/api/types';
import { Chip, Select, Text } from '@/components/ui';
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER, signed } from '@/rules';
import { spacing } from '@/theme';

/** O que a ficha guarda sobre a raça: qual é, qual herança, quais escolhas. */
export type RaceChoice = {
  raceId: number | null;
  variant: string | null;
  choices: AttributeKey[];
};

/**
 * Escolha de raça — cadastro e edição usam o mesmo bloco.
 *
 * São três campos amarrados: a raça, a herança (só suraggel tem) e os
 * atributos das raças que dão "+1 em três atributos diferentes" (p. 18).
 * Trocar a raça invalida os outros dois, e é justamente aí que duas cópias do
 * formulário sairiam do lugar — por isso um componente só.
 */
export function RaceFields({
  races,
  value,
  onChange,
  label = 'Raça',
}: {
  races: ReferenceRace[];
  value: RaceChoice;
  onChange: (escolha: RaceChoice) => void;
  label?: string;
}) {
  const race = races.find((entry) => entry.id === value.raceId) ?? null;

  return (
    <View style={{ gap: spacing.md }}>
      <Select
        label={label}
        value={value.raceId}
        options={races.map((entry) => ({
          value: entry.id,
          label: entry.name,
          description: descreverRaca(entry),
        }))}
        // Raça nova, escolhas do zero: a herança e os atributos livres
        // pertenciam à anterior.
        onChange={(raceId) => onChange({ raceId, variant: null, choices: [] })}
        clearable
      />

      {race?.variants ? (
        <Select
          label="Herança"
          value={value.variant}
          options={Object.entries(race.variants).map(([key, variant]) => ({
            value: key,
            label: variant.name,
            description: descreverModificadores(variant.attribute_modifiers),
          }))}
          onChange={(variant) => onChange({ ...value, variant })}
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
              const vetado = race.excluded_attributes?.includes(key) ?? false;

              return (
                <Chip
                  key={key}
                  label={ATTRIBUTE_LABELS[key].short}
                  selected={value.choices.includes(key)}
                  tone={vetado ? 'neutral' : 'primary'}
                  onPress={
                    vetado
                      ? undefined
                      : () => onChange({ ...value, choices: alternar(value.choices, key, race) })
                  }
                />
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Marca ou desmarca um atributo, respeitando o teto de escolhas da raça. */
function alternar(escolhas: AttributeKey[], key: AttributeKey, race: ReferenceRace): AttributeKey[] {
  if (escolhas.includes(key)) {
    return escolhas.filter((entry) => entry !== key);
  }

  return escolhas.length >= race.free_choices ? escolhas : [...escolhas, key];
}

/**
 * Modificadores raciais previstos — os fixos da raça (ou da herança) mais as
 * escolhas livres. Mesma conta que o servidor refaz ao salvar.
 */
export function modificadoresRaciais(
  race: ReferenceRace | null,
  variant: string | null,
  choices: AttributeKey[]
): Partial<Record<AttributeKey, number>> {
  if (!race) return {};

  const total: Partial<Record<AttributeKey, number>> = {
    ...(variant && race.variants?.[variant]
      ? race.variants[variant].attribute_modifiers
      : (race.attribute_modifiers ?? {})),
  };

  for (const key of choices.slice(0, race.free_choices)) {
    total[key] = (total[key] ?? 0) + race.free_choice_bonus;
  }

  return total;
}

/**
 * Aviso quando faltam escolhas livres, para a tela barrar antes de enviar.
 * Devolve null quando está tudo certo.
 */
export function pendenciaDeEscolhas(race: ReferenceRace | null, choices: AttributeKey[]): string | null {
  if (!race || race.free_choices === 0 || choices.length === race.free_choices) {
    return null;
  }

  return `${race.name} recebe +${race.free_choice_bonus} em ${race.free_choices} atributos diferentes.`;
}

export function descreverRaca(race: ReferenceRace): string {
  const partes: string[] = [];

  if (race.free_choices > 0) {
    const exceto = race.excluded_attributes?.length
      ? ` (exceto ${race.excluded_attributes.map((key) => ATTRIBUTE_LABELS[key].short).join(', ')})`
      : '';
    partes.push(`+${race.free_choice_bonus} em ${race.free_choices} atributos${exceto}`);
  }

  const fixos = descreverModificadores(race.attribute_modifiers ?? {});
  if (fixos) partes.push(fixos);

  return partes.join(' · ');
}

export function descreverModificadores(modificadores: Partial<Record<AttributeKey, number>>): string {
  return Object.entries(modificadores)
    .map(([key, value]) => `${ATTRIBUTE_LABELS[key as AttributeKey].short} ${signed(value as number)}`)
    .join(', ');
}
