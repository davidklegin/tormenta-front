import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { AttributeKey, RaceAbility, RaceBuildOption, ReferenceRace } from '@/api/types';
import { Chip, HelpNote, Icon, Select, Text } from '@/components/ui';
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER, signed } from '@/rules';
import { spacing } from '@/theme';

/**
 * A ordem em que os tamanhos aparecem para quem escolhe (Tabela 1-21, p. 106).
 *
 * As variantes chegam num objeto JSON, e o banco reordena as chaves dele ao
 * gravar: sem isto, o golem oferece "Médio, Grande, Pequeno".
 */
const ORDEM_DOS_TAMANHOS = ['minusculo', 'pequeno', 'medio', 'grande', 'enorme', 'colossal'];

/** O que a ficha guarda sobre a raça: qual é, qual herança, quais escolhas. */
export type RaceChoice = {
  raceId: number | null;
  variant: string | null;
  choices: AttributeKey[];
};

/**
 * Escolha de raça — cadastro e edição usam o mesmo bloco.
 *
 * São três campos amarrados: a raça, a variante (a herança do suraggel ou o
 * tamanho do golem) e os atributos das raças que dão "+1 em três atributos
 * diferentes" (p. 18). Trocar a raça invalida os outros dois, e é justamente
 * aí que duas cópias do formulário sairiam do lugar — por isso um componente
 * só.
 *
 * Abaixo dos campos vem o que a raça dá e a ficha não calcula: as imunidades
 * do golem, a fonte de energia, o poder geral que substitui a origem. Quem
 * está montando o primeiro personagem não tem o livro aberto ao lado, e um
 * seletor que só mostra "For +2, Con +1, Car –1" não deixa escolher entre dez
 * chassis de golem.
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
  const variantes = useMemo(() => ordenarVariantes(race), [race]);

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
        // Raça nova, escolhas do zero: a variante e os atributos livres
        // pertenciam à anterior.
        onChange={(raceId) => onChange({ raceId, variant: null, choices: [] })}
        clearable
      />

      {race && variantes.length > 0 ? (
        <Select
          // "Herança" para o suraggel, "Tamanho" para o golem — é a raça que
          // diz qual pergunta a variante responde.
          label={race.variant_label ?? 'Herança'}
          value={value.variant}
          options={variantes.map(([key, variant]) => ({
            value: key,
            label: variant.name,
            description: descreverModificadores(variant.attribute_modifiers),
          }))}
          onChange={(variant) => onChange({ ...value, variant })}
          searchable={false}
          hint={
            race.variant_label === 'Tamanho' && !value.variant
              ? 'Sem escolher, a ficha fica Médio.'
              : undefined
          }
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

      {race?.attribute_note ? (
        <Text variant="small" tone="muted">
          {race.attribute_note}
        </Text>
      ) : null}

      {race?.skips_origin ? (
        <HelpNote tone="warning">
          {`${race.name} é construído pronto para um propósito e não teve infância: não escolhe origem, e recebe um poder geral no lugar dela.`}
        </HelpNote>
      ) : null}

      {race ? <DetalhesDaRaca race={race} /> : null}
    </View>
  );
}

/**
 * O que a raça é, além dos números: o resumo e as habilidades.
 *
 * Recolhido, porque a maior parte é texto longo — o golem sozinho traz cinco
 * habilidades, uma delas com dez maravilhas mecânicas — e quem já sabe o que
 * está escolhendo não precisa rolar por tudo isso até chegar na classe.
 */
function DetalhesDaRaca({ race }: { race: ReferenceRace }) {
  const [aberto, setAberto] = useState(false);
  const habilidades = race.abilities ?? [];

  if (!race.description && habilidades.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      {race.description ? (
        <Text variant="small" tone="secondary">
          {race.description}
        </Text>
      ) : null}

      {habilidades.length > 0 ? (
        <>
          <Pressable
            onPress={() => setAberto((atual) => !atual)}
            accessibilityRole="button"
            accessibilityLabel={`${aberto ? 'Ocultar' : 'Ver'} as habilidades de ${race.name}`}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
          >
            <Icon name="expandir" size={16} />
            <Text variant="smallStrong" tone="primary">
              {aberto ? 'Ocultar habilidades' : `Ver as ${habilidades.length} habilidades de raça`}
            </Text>
          </Pressable>

          {aberto ? (
            <View style={{ gap: spacing.md }}>
              {habilidades.map((habilidade) => (
                <Habilidade key={habilidade.name} habilidade={habilidade} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Habilidade({ habilidade }: { habilidade: RaceAbility }) {
  return (
    <View style={{ gap: spacing.xxs }}>
      <Text variant="smallStrong">
        {habilidade.name}
        {habilidade.source ? ` (${habilidade.source})` : ''}
      </Text>

      {habilidade.text ? (
        <Text variant="small" tone="secondary">
          {habilidade.text}
        </Text>
      ) : null}

      <Opcoes options={habilidade.options} />
    </View>
  );
}

/**
 * As escolhas de dentro de uma habilidade — a fonte de energia do golem, e as
 * maravilhas mecânicas dentro do chassi mashin, que são escolha de escolha.
 */
function Opcoes({ options }: { options?: RaceBuildOption[] }) {
  if (!options?.length) return null;

  return (
    <View style={{ gap: spacing.xs, paddingLeft: spacing.md, marginTop: spacing.xxs }}>
      {options.map((opcao) => (
        <View key={opcao.name} style={{ gap: spacing.xxs }}>
          <Text variant="small">
            <Text variant="smallStrong">{opcao.name}</Text>
            {opcao.text ? ` — ${opcao.text}` : ''}
          </Text>

          <Opcoes options={opcao.options} />
        </View>
      ))}
    </View>
  );
}

/**
 * As variantes na ordem em que fazem sentido para quem escolhe.
 *
 * Tamanho segue a tabela de criaturas; herança não tem ordem natural e fica
 * como veio.
 *
 * @return pares [chave, variante] prontos para virar opções do seletor
 */
function ordenarVariantes(race: ReferenceRace | null) {
  const entradas = Object.entries(race?.variants ?? {});

  return entradas.sort(
    ([, a], [, b]) =>
      ORDEM_DOS_TAMANHOS.indexOf(a.size ?? '') - ORDEM_DOS_TAMANHOS.indexOf(b.size ?? '')
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

/**
 * "For +2, Con +1, Car −1" — na ordem da ficha, e não na do objeto.
 *
 * A ordem das chaves do JSON é do banco, que as reordena ao gravar; sem isto o
 * golem de ferro se apresenta como "Car −1, Con +1, For +2", que não é como
 * ninguém lê uma linha de atributos.
 */
export function descreverModificadores(modificadores: Partial<Record<AttributeKey, number>>): string {
  return ATTRIBUTE_ORDER.filter((key) => (modificadores[key] ?? 0) !== 0)
    .map((key) => `${ATTRIBUTE_LABELS[key].short} ${signed(modificadores[key] as number)}`)
    .join(', ');
}
