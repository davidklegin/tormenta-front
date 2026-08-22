import { useMemo, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, charactersApi } from '@/api';
import type { AttributeKey, Character } from '@/api/types';
import {
  Button,
  Card,
  Chip,
  ErrorState,
  HelpNote,
  Input,
  Loading,
  Screen,
  Select,
  Text,
} from '@/components/ui';
import { PageHeader } from '@/components/layout';
import {
  RaceFields,
  modificadoresRaciais,
  pendenciaDeEscolhas,
  type RaceChoice,
} from '@/components/character/RaceFields';
import { useLinkableCampaigns } from '@/hooks/useCampaigns';
import { useCharacter, useDeleteCharacter, useUpdateCharacter } from '@/hooks/useCharacters';
import { useReference } from '@/hooks/useReference';
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER, previewDefense, signed } from '@/rules';
import { ArquivoGrandeDemaisError } from '@/utils/arquivo';
import { prepararImagemParaUpload } from '@/utils/imagem';
import { spacing } from '@/theme';

/**
 * Edição da ficha.
 *
 * Envia a `version` que foi lida: se a ficha tiver mudado em outro dispositivo,
 * o servidor responde 409 e avisamos em vez de sobrescrever em silêncio.
 */
export default function EditCharacterScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);
  const query = useCharacter(characterId);

  if (query.isLoading) {
    return (
      <Screen>
        <Loading label="Carregando ficha…" />
      </Screen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Screen>
        <PageHeader title="Editar ficha" back />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  return <EditForm character={query.data} />;
}

function EditForm({ character }: { character: Character }) {
  const queryClient = useQueryClient();
  const reference = useReference();
  const campaigns = useLinkableCampaigns();
  const updateCharacter = useUpdateCharacter(character.id);
  const deleteCharacter = useDeleteCharacter();

  const [name, setName] = useState(character.name);
  const [experience, setExperience] = useState(String(character.experience));
  const [campaignId, setCampaignId] = useState<number | null>(character.campaign?.id ?? null);
  const [raca, setRaca] = useState<RaceChoice>({
    raceId: character.race?.id ?? null,
    variant: character.race?.variant ?? null,
    choices: character.racial_attribute_choices ?? [],
  });
  const [originId, setOriginId] = useState<number | null>(character.origin?.id ?? null);
  const [deityId, setDeityId] = useState<number | null>(character.deity?.id ?? null);
  const [displacement, setDisplacement] = useState(String(character.displacement.base));
  const [proficiencies, setProficiencies] = useState(character.proficiencies ?? '');
  const [defenseOther, setDefenseOther] = useState(String(character.defense.other_bonus));
  const [defenseAttribute, setDefenseAttribute] = useState<AttributeKey>(character.defense.attribute);
  const [attributes, setAttributes] = useState<Record<AttributeKey, string>>(
    () =>
      Object.fromEntries(
        character.attributes.map((attribute) => [attribute.key, String(attribute.base)])
      ) as Record<AttributeKey, string>
  );
  const [keyAttribute, setKeyAttribute] = useState<AttributeKey | null>(character.key_attribute.selected);
  const [classLevels, setClassLevels] = useState<Record<number, string>>(() =>
    Object.fromEntries(character.classes.map((entry) => [entry.game_class_id, String(entry.level)]))
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const race = useMemo(
    () => reference.data?.races.find((entry) => entry.id === raca.raceId) ?? null,
    [reference.data?.races, raca.raceId]
  );

  /**
   * Modificadores da raça que está selecionada agora — e não os gravados.
   *
   * É o que faz a prévia de PM e Defesa acompanhar a troca de raça antes de
   * salvar: quem sai de elfo para anão vê a Constituição subir na hora.
   */
  const racialPreview = useMemo(
    () => modificadoresRaciais(race, raca.variant, raca.choices),
    [race, raca.variant, raca.choices]
  );

  /**
   * Acerta o deslocamento quando a raça muda.
   *
   * O anão anda 6m, o hynne também (p. 20 e 27) — é regra da raça, e o campo
   * logo abaixo precisa mostrar isso na hora. Mas só quando o valor em tela
   * ainda era o padrão da raça anterior: quem digitou um número próprio, por
   * montaria ou poder, não pode perdê-lo por trocar de raça.
   */
  function aplicarPadroesDaRaca(novaRaceId: number | null) {
    const nova = reference.data?.races.find((entry) => entry.id === novaRaceId) ?? null;

    if (!nova) return;

    const anterior = reference.data?.races.find((entry) => entry.id === raca.raceId) ?? null;
    const atual = Number.parseInt(displacement, 10) || 0;
    // 9m é o passo padrão do livro para criaturas Médias.
    const padraoAnterior = anterior?.default_displacement ?? 9;

    if (atual === padraoAnterior) {
      setDisplacement(String(nova.default_displacement));
    }
  }

  /** Atributo-chave em uso: a escolha do jogador ou o herdado da classe. */
  const effectiveKeyAttribute = keyAttribute ?? character.key_attribute.value;

  /**
   * Prévia dos PM com os níveis e atributos ainda em edição — o mesmo cálculo
   * que o servidor refaz ao salvar: PM por nível de cada classe + atributo-chave.
   */
  const mpPreview = useMemo(() => {
    const fromClasses = character.classes.reduce((total, entry) => {
      const perLevel = reference.data?.classes.find((c) => c.key === entry.key)?.mp_per_level ?? 0;
      const level = Number.parseInt(classLevels[entry.game_class_id] ?? '1', 10) || 1;

      return total + perLevel * level;
    }, 0);

    const bonus = effectiveKeyAttribute ? previewAttributeTotal(effectiveKeyAttribute) : 0;

    return { total: Math.max(0, fromClasses + bonus), fromClasses, bonus };
  }, [character.classes, reference.data?.classes, classLevels, effectiveKeyAttribute, attributes]);

  /**
   * Prévia da Defesa com o atributo e o bônus ainda em edição — a mesma conta
   * que o DefenseCalculator refaz ao salvar.
   */
  const defensePreview = useMemo(
    () =>
      previewDefense({
        attributeValue: previewAttributeTotal(defenseAttribute),
        items: character.items,
        otherBonus: Number.parseInt(defenseOther, 10) || 0,
      }),
    [character.items, defenseAttribute, defenseOther, attributes]
  );

  /**
   * Total de um atributo: a base em edição, o racial da raça em edição e o
   * resto do que já estava gravado (bônus e temporários).
   */
  function previewAttributeTotal(key: AttributeKey): number {
    const gravado = character.attributes.find((entry) => entry.key === key);
    const base = Number.parseInt(attributes[key] ?? '0', 10) || 0;
    const outros = (gravado?.total ?? 0) - (gravado?.base ?? 0) - (gravado?.racial ?? 0);

    return base + (racialPreview[key] ?? 0) + outros;
  }

  const uploadAvatar = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled || !result.assets[0]) return null;

      // Sobe como veio do recorte, sem reduzir: o servidor aceita 50 MB. O
      // preparo só acerta nome e tipo — e barra o que passa do teto.
      const imagem = await prepararImagemParaUpload(result.assets[0], 'avatar');
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(imagem.uri);
        const blob = await response.blob();
        formData.append('avatar', blob, imagem.name);
      } else {
        formData.append('avatar', {
          uri: imagem.uri,
          name: imagem.name,
          type: imagem.type,
        } as never);
      }

      return charactersApi.uploadAvatar(character.id, formData);
    },
    onSuccess: (updated) => {
      if (updated) {
        queryClient.setQueryData(['character', character.id], updated);
        void queryClient.invalidateQueries({ queryKey: ['characters'] });
        setMessage('Foto atualizada.');
      }
    },
    onError: (falha) =>
      setError(
        falha instanceof ArquivoGrandeDemaisError
          ? falha.message
          : 'Não foi possível enviar a foto.'
      ),
  });

  async function handleSave() {
    setError(null);
    setMessage(null);

    const pendencia = pendenciaDeEscolhas(race, raca.choices);

    if (pendencia) {
      setError(pendencia);

      return;
    }

    try {
      await updateCharacter.mutateAsync({
        name: name.trim(),
        version: character.version,
        experience: Number.parseInt(experience, 10) || 0,
        campaign_id: campaignId,
        race_id: raca.raceId,
        race_variant: raca.variant,
        origin_id: originId,
        deity_id: deityId,
        base_displacement: Number.parseInt(displacement, 10) || 9,
        proficiencies: proficiencies.trim() || null,
        defense_attribute: defenseAttribute,
        defense_other_bonus: Number.parseInt(defenseOther, 10) || 0,
        attributes: Object.fromEntries(
          ATTRIBUTE_ORDER.map((key) => [key, Number.parseInt(attributes[key] ?? '0', 10) || 0])
        ),
        racial_attribute_choices: raca.choices,
        key_attribute: keyAttribute,
        classes: character.classes.map((entry) => ({
          game_class_id: entry.game_class_id,
          level: Number.parseInt(classLevels[entry.game_class_id] ?? '1', 10) || 1,
          is_primary: entry.is_primary,
        })),
      });

      setMessage('Ficha salva.');
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        setError('Esta ficha foi alterada em outro dispositivo. Recarregue antes de salvar.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível salvar a ficha.');
      }
    }
  }

  function confirmDelete() {
    const remove = async () => {
      await deleteCharacter.mutateAsync(character.id);
      router.replace('/(app)/(tabs)/personagens');
    };

    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Excluir ${character.name}? Esta ação não pode ser desfeita.`)) {
        void remove();
      }

      return;
    }

    Alert.alert('Excluir personagem', `Excluir ${character.name}? Esta ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void remove() },
    ]);
  }

  return (
    <Screen contentStyle={{ maxWidth: 760 }}>
      <PageHeader title="Editar ficha" subtitle={character.name} back />

      <Card title="Identidade">
        <View style={{ gap: spacing.md }}>
          <Input label="Nome" value={name} onChangeText={setName} />

          <Button
            label={character.avatar_url ? 'Trocar foto' : 'Adicionar foto'}
            variant="secondary"
            onPress={() => uploadAvatar.mutate()}
            loading={uploadAvatar.isPending}
          />

          <Select
            label="Campanha"
            value={campaignId}
            options={(campaigns.data ?? []).map((entry) => ({ value: entry.id, label: entry.name }))}
            onChange={setCampaignId}
            clearable
            hint="Qualquer mesa serve — você não precisa participar dela para levar a ficha."
          />

          <RaceFields
            races={reference.data?.races ?? []}
            value={raca}
            onChange={(escolha) => {
              setRaca(escolha);
              aplicarPadroesDaRaca(escolha.raceId);
            }}
          />

          {/* O tamanho não tem campo próprio: vem da raça e é aplicado ao
              salvar, então precisa ao menos estar dito em algum lugar. */}
          {race && race.default_size !== character.size.value ? (
            <Text variant="small" tone="secondary">
              Ao salvar, o tamanho passa a ser {tamanhoLegivel(race.default_size)} — é o da raça {race.name}.
            </Text>
          ) : null}

          <Select
            label="Origem"
            value={originId}
            options={(reference.data?.origins ?? []).map((entry) => ({ value: entry.id, label: entry.name }))}
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
        </View>
      </Card>

      <Card title="Níveis de classe" subtitle="A soma define o nível de personagem (p. 35)">
        <View style={{ gap: spacing.md }}>
          {character.classes.map((entry) => (
            <Input
              key={entry.id}
              label={entry.name ?? 'Classe'}
              value={classLevels[entry.game_class_id] ?? '1'}
              onChangeText={(text) =>
                setClassLevels((previous) => ({ ...previous, [entry.game_class_id]: text }))
              }
              keyboardType="number-pad"
            />
          ))}
          <Text variant="small" tone="muted">
            PV e PM máximos são recalculados automaticamente ao salvar.
          </Text>
        </View>
      </Card>

      <Card title="Atributos" subtitle="Valores base, antes dos modificadores raciais">
        <View style={{ gap: spacing.md }}>
          {ATTRIBUTE_ORDER.map((key) => (
            <Input
              key={key}
              label={ATTRIBUTE_LABELS[key].full}
              value={attributes[key] ?? '0'}
              onChangeText={(text) => setAttributes((previous) => ({ ...previous, [key]: text }))}
              keyboardType="numbers-and-punctuation"
            />
          ))}
        </View>
      </Card>

      <Card title="Atributo-chave" subtitle="Somado uma vez aos seus PM totais">
        <View style={{ gap: spacing.md }}>
          <HelpNote collapsible source="Livro base, p. 32">
            Cada classe tem seus atributos-chave — Inteligência ou Carisma para o arcanista, Sabedoria para o
            clérigo, Força para o bárbaro. Os sugeridos pela classe aparecem com ★, mas você pode escolher
            qualquer um.
          </HelpNote>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {ATTRIBUTE_ORDER.map((key) => {
              const suggested = character.key_attribute.suggested.includes(key);

              return (
                <Chip
                  key={key}
                  label={`${ATTRIBUTE_LABELS[key].short} ${signed(previewAttributeTotal(key))}${suggested ? ' ★' : ''}`}
                  selected={effectiveKeyAttribute === key}
                  tone={suggested ? 'primary' : 'neutral'}
                  onPress={() => setKeyAttribute(key)}
                />
              );
            })}
          </View>

          <Text variant="small" tone="secondary">
            PM totais: {mpPreview.fromClasses} das classes
            {effectiveKeyAttribute
              ? `, ${ATTRIBUTE_LABELS[effectiveKeyAttribute].full} ${signed(mpPreview.bonus)}`
              : ''}{' '}
            → {mpPreview.total}
          </Text>

          {keyAttribute !== null && character.key_attribute.suggested.length > 0 ? (
            <Button
              label="Voltar ao atributo da classe"
              variant="secondary"
              onPress={() => setKeyAttribute(null)}
            />
          ) : null}
        </View>
      </Card>

      <Card title="Defesa" subtitle="Qual atributo entra na conta">
        <View style={{ gap: spacing.md }}>
          <HelpNote collapsible source="Livro base, p. 106 e 152">
            A Defesa começa em 10 e soma o atributo escolhido aqui mais o que armadura e escudo derem.
            Destreza (★) é o padrão do livro, mas há habilidades que trocam esse atributo — Autoconfiança do
            nobre soma Carisma, Couraceiro do inventor soma Inteligência. Armadura pesada anula essa parcela
            seja qual for o atributo; quem tem uma exceção, como Armadura Brilhante, registra o valor em
            "Outros bônus".
          </HelpNote>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {ATTRIBUTE_ORDER.map((key) => {
              const padrao = key === 'des';

              return (
                <Chip
                  key={key}
                  label={`${ATTRIBUTE_LABELS[key].short} ${signed(previewAttributeTotal(key))}${padrao ? ' ★' : ''}`}
                  selected={defenseAttribute === key}
                  tone={padrao ? 'primary' : 'neutral'}
                  onPress={() => setDefenseAttribute(key)}
                />
              );
            })}
          </View>

          <Input
            label="Outros bônus na Defesa"
            value={defenseOther}
            onChangeText={setDefenseOther}
            keyboardType="numbers-and-punctuation"
            hint="Poderes e efeitos fora da fórmula 10 + atributo + armadura + escudo."
          />

          <Text variant="small" tone="secondary">
            {describeDefense(defenseAttribute, defensePreview, Number.parseInt(defenseOther, 10) || 0)}
          </Text>
        </View>
      </Card>

      <Card title="Combate e progressão">
        <View style={{ gap: spacing.md }}>
          <Input
            label="Experiência (XP)"
            value={experience}
            onChangeText={setExperience}
            keyboardType="number-pad"
          />
          <Input
            label="Deslocamento base (metros)"
            value={displacement}
            onChangeText={setDisplacement}
            keyboardType="number-pad"
            hint="Padrão 9m; anões e hynne usam 6m."
          />
          <Input
            label="Proficiências"
            value={proficiencies}
            onChangeText={setProficiencies}
            multiline
            placeholder="Armas marciais e escudos"
          />
        </View>
      </Card>

      {message ? (
        <Text variant="small" tone="success">
          {message}
        </Text>
      ) : null}
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : null}

      <Button
        label="Salvar ficha"
        onPress={handleSave}
        loading={updateCharacter.isPending}
        fullWidth
        size="lg"
      />
      <Button label="Excluir personagem" variant="danger" onPress={confirmDelete} fullWidth />
    </Screen>
  );
}

/**
 * Conta da Defesa em uma linha, na mesma ordem do detalhamento da ficha.
 *
 * A parcela anulada pela armadura pesada é dita pelo nome do atributo em vez de
 * "anulada": a concordância mudaria de atributo para atributo.
 */
/** O tamanho vem do catálogo em minúsculas; a tela mostra como no livro. */
function tamanhoLegivel(size: string): string {
  const nomes: Record<string, string> = {
    minusculo: 'Minúsculo',
    pequeno: 'Pequeno',
    medio: 'Médio',
    grande: 'Grande',
    enorme: 'Enorme',
    colossal: 'Colossal',
  };

  return nomes[size] ?? size;
}

function describeDefense(
  attribute: AttributeKey,
  preview: ReturnType<typeof previewDefense>,
  otherBonus: number
): string {
  const parts = ['10 base'];

  parts.push(
    preview.blockedByHeavyArmor
      ? `armadura pesada anula ${ATTRIBUTE_LABELS[attribute].short}`
      : `${ATTRIBUTE_LABELS[attribute].short} ${signed(preview.attributePart)}`
  );

  if (preview.fromItems !== 0) parts.push(`equipamento ${signed(preview.fromItems)}`);
  if (otherBonus !== 0) parts.push(`outros ${signed(otherBonus)}`);

  return `Defesa: ${parts.join(', ')} → ${preview.total}`;
}
