import { useMemo, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, charactersApi } from '@/api';
import type { AttributeKey, Character, CharacterClassAbility } from '@/api/types';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  ErrorState,
  HelpNote,
  Icon,
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
import {
  ATTRIBUTE_LABELS,
  ATTRIBUTE_ORDER,
  describeOrigin,
  previewDefense,
  previewDisplacement,
  signed,
} from '@/rules';
import { ArquivoGrandeDemaisError } from '@/utils/arquivo';
import { prepararImagemParaUpload } from '@/utils/imagem';
import { spacing, useTheme } from '@/theme';

/**
 * Uma linha do editor de classes. `chave` só identifica a linha na tela: a
 * classe dela pode mudar, e a linha nova ainda nem tem classe.
 */
type LinhaDeClasse = { chave: string; gameClassId: number | null; level: string };

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
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const reference = useReference();
  const campaigns = useLinkableCampaigns();
  const updateCharacter = useUpdateCharacter(character.id);
  const deleteCharacter = useDeleteCharacter();

  const [name, setName] = useState(character.name);
  const [experience, setExperience] = useState(String(character.experience));
  const [campaignId, setCampaignId] = useState<number | null>(character.campaign?.id ?? null);
  const [reserva, setReserva] = useState(character.is_reserve);
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
  const [damageReduction, setDamageReduction] = useState(String(character.damage_reduction.declared));
  const [ignoresArmorPenalty, setIgnoresArmorPenalty] = useState(character.ignores_armor_penalty);
  const [keepsDefenseAttribute, setKeepsDefenseAttribute] = useState(
    character.heavy_armor.keeps_defense_attribute
  );
  const [keepsDisplacement, setKeepsDisplacement] = useState(
    character.heavy_armor.keeps_displacement
  );
  const [attributes, setAttributes] = useState<Record<AttributeKey, string>>(
    () =>
      Object.fromEntries(
        character.attributes.map((attribute) => [attribute.key, String(attribute.base)])
      ) as Record<AttributeKey, string>
  );
  const [keyAttribute, setKeyAttribute] = useState<AttributeKey | null>(character.key_attribute.selected);
  // A primária vai na primeira linha: é a posição que o servidor lê como
  // primária quando a lista volta.
  const [classes, setClasses] = useState<LinhaDeClasse[]>(() =>
    [...character.classes]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      .map((entry) => ({
        chave: String(entry.id),
        gameClassId: entry.game_class_id,
        level: String(entry.level),
      }))
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
   * Tamanho que a ficha terá depois de salvar: o da variante escolhida
   * (Pequeno, Médio ou Grande, no golem) ou o padrão da raça.
   */
  const tamanhoDaRaca = useMemo(() => {
    if (!race) return null;

    return (raca.variant ? race.variants?.[raca.variant]?.size : undefined) ?? race.default_size;
  }, [race, raca.variant]);

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

  /** A classe do catálogo de cada linha, na mesma ordem; nula na linha ainda vazia. */
  const classesEscolhidas = useMemo(
    () => classes.map((linha) => reference.data?.classes.find((c) => c.id === linha.gameClassId) ?? null),
    [classes, reference.data?.classes]
  );

  /**
   * Atributos-chave sugeridos pelas classes em edição — a primária primeiro,
   * sem repetir —, a mesma lista que o servidor monta. Trocar de classe troca
   * as estrelas na hora, antes de salvar.
   */
  const suggestedKeyAttributes = useMemo<AttributeKey[]>(() => {
    if (!reference.data) return character.key_attribute.suggested;

    const lista: AttributeKey[] = [];

    for (const gameClass of classesEscolhidas) {
      for (const key of gameClass?.key_attributes ?? []) {
        if (!lista.includes(key)) lista.push(key);
      }
    }

    return lista;
  }, [reference.data, classesEscolhidas, character.key_attribute.suggested]);

  /** Atributo-chave em uso: a escolha do jogador ou o herdado da classe. */
  const effectiveKeyAttribute = keyAttribute ?? suggestedKeyAttributes[0] ?? null;

  /**
   * Prévia dos PM com as classes, os níveis e os atributos ainda em edição — o
   * mesmo cálculo que o servidor refaz ao salvar: PM por nível de cada classe +
   * atributo-chave.
   */
  const mpPreview = useMemo(() => {
    const fromClasses = classes.reduce((total, linha, indice) => {
      const perLevel = classesEscolhidas[indice]?.mp_per_level ?? 0;

      return total + perLevel * nivelDaLinha(linha);
    }, 0);

    const bonus = effectiveKeyAttribute ? previewAttributeTotal(effectiveKeyAttribute) : 0;

    return { total: Math.max(0, fromClasses + bonus), fromClasses, bonus };
  }, [classes, classesEscolhidas, effectiveKeyAttribute, attributes]);

  /**
   * Habilidades de uma classe que saiu da ficha. Elas não somem sozinhas —
   * foram escritas pelo jogador, e podem ter anotação dele —, mas precisam
   * ser ditas, senão o guerreiro que virou arcanista segue com Ataque Especial.
   */
  const habilidadesDeClasseQueSaiu = useMemo(
    () =>
      character.class_abilities.filter(
        (habilidade) =>
          habilidade.game_class_id !== null &&
          !classes.some((linha) => linha.gameClassId === habilidade.game_class_id)
      ),
    [character.class_abilities, classes]
  );

  function trocarClasse(indice: number, gameClassId: number | null) {
    setClasses((anteriores) =>
      anteriores.map((linha, i) => (i === indice ? { ...linha, gameClassId } : linha))
    );
  }

  function trocarNivel(indice: number, level: string) {
    setClasses((anteriores) => anteriores.map((linha, i) => (i === indice ? { ...linha, level } : linha)));
  }

  function somarClasse() {
    setClasses((anteriores) => [
      ...anteriores,
      { chave: `nova-${Date.now()}`, gameClassId: null, level: '1' },
    ]);
  }

  function tirarClasse(indice: number) {
    setClasses((anteriores) => anteriores.filter((_, i) => i !== indice));
  }

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
        keepsAttributeInHeavyArmor: keepsDefenseAttribute,
      }),
    [character.items, defenseAttribute, defenseOther, keepsDefenseAttribute, attributes]
  );

  /**
   * Prévia do passo com a dispensa ainda em edição. A sobrecarga fica de fora
   * — é outra regra, e o número gravado na ficha já a desconta.
   */
  const displacementPreview = useMemo(
    () =>
      previewDisplacement({
        base: Number.parseInt(displacement, 10) || 0,
        items: character.items,
        keepsDisplacementInHeavyArmor: keepsDisplacement,
      }),
    [character.items, displacement, keepsDisplacement]
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

    if (classes.some((linha) => linha.gameClassId === null)) {
      setError('Escolha a classe de cada linha em “Classe e nível” — ou tire a que ficou vazia.');

      return;
    }

    try {
      await updateCharacter.mutateAsync({
        name: name.trim(),
        version: character.version,
        experience: Number.parseInt(experience, 10) || 0,
        // Na reserva, a ficha fica fora das campanhas; e vincular é o que a
        // tira de lá — o servidor não aceita as duas coisas juntas.
        campaign_id: reserva ? null : campaignId,
        is_reserve: reserva,
        race_id: raca.raceId,
        race_variant: raca.variant,
        origin_id: race?.skips_origin ? null : originId,
        deity_id: deityId,
        base_displacement: Number.parseInt(displacement, 10) || 9,
        proficiencies: proficiencies.trim() || null,
        defense_attribute: defenseAttribute,
        defense_other_bonus: Number.parseInt(defenseOther, 10) || 0,
        damage_reduction: Math.max(0, Number.parseInt(damageReduction, 10) || 0),
        ignores_armor_penalty: ignoresArmorPenalty,
        heavy_armor_keeps_defense_attribute: keepsDefenseAttribute,
        heavy_armor_keeps_displacement: keepsDisplacement,
        attributes: Object.fromEntries(
          ATTRIBUTE_ORDER.map((key) => [key, Number.parseInt(attributes[key] ?? '0', 10) || 0])
        ),
        racial_attribute_choices: raca.choices,
        key_attribute: keyAttribute,
        classes: classes.map((linha, indice) => ({
          game_class_id: linha.gameClassId as number,
          level: nivelDaLinha(linha),
          is_primary: indice === 0,
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
            value={reserva ? null : campaignId}
            options={(campaigns.data ?? []).map((entry) => ({ value: entry.id, label: entry.name }))}
            onChange={(id) => {
              setCampaignId(id);
              // Vincular é como a ficha sai da reserva.
              if (id !== null) setReserva(false);
            }}
            clearable
            hint={
              character.is_reserve && !reserva && campaignId !== null
                ? 'Ao salvar, a ficha sai da reserva e a mesa passa a ver.'
                : 'Qualquer mesa serve — você não precisa participar dela para levar a ficha.'
            }
          />

          <Checkbox
            label="Guardar na reserva"
            checked={reserva}
            onChange={(marcado) => {
              setReserva(marcado);
              if (marcado) setCampaignId(null);
            }}
            hint={
              reserva && character.campaign
                ? `Ao salvar, a ficha sai de ${character.campaign.name} e só você e o mestre passam a ver.`
                : 'Só você e o mestre veem a ficha. Quando vincular a uma campanha, ela sai da reserva e a mesa passa a ver.'
            }
          />

          <RaceFields
            races={reference.data?.races ?? []}
            value={raca}
            onChange={(escolha) => {
              setRaca(escolha);
              aplicarPadroesDaRaca(escolha.raceId);

              // Golem: construído pronto, sem infância e sem origem.
              const nova = reference.data?.races.find((entry) => entry.id === escolha.raceId);
              if (nova?.skips_origin) setOriginId(null);
            }}
          />

          {/* O tamanho não tem campo próprio: vem da raça — ou da variante,
              no golem, que escolhe entre Pequeno, Médio e Grande — e é
              aplicado ao salvar, então precisa ao menos estar dito. */}
          {tamanhoDaRaca && tamanhoDaRaca !== character.size.value ? (
            <Text variant="small" tone="secondary">
              Ao salvar, o tamanho passa a ser {tamanhoLegivel(tamanhoDaRaca)} —{' '}
              {raca.variant && race?.variants?.[raca.variant]?.size
                ? 'é o que você escolheu acima'
                : `é o da raça ${race?.name}`}
              .
            </Text>
          ) : null}

          <Select
            label="Origem"
            value={originId}
            options={(reference.data?.origins ?? []).map((entry) => ({
              value: entry.id,
              label: entry.name,
              description: describeOrigin(entry),
            }))}
            onChange={setOriginId}
            clearable
            disabled={race?.skips_origin ?? false}
            hint={
              race?.skips_origin
                ? `${race.name} recebe um poder geral no lugar da origem.`
                : undefined
            }
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

      <Card title="Classe e nível" subtitle="A soma dos níveis de classe é o nível de personagem (p. 35)">
        <View style={{ gap: spacing.md }}>
          {classes.map((linha, indice) => (
            <View key={linha.chave} style={{ gap: spacing.xs }}>
              {/* Pela base: o rótulo do Select é maior que o do Input, e
                  alinhados pelo topo os dois campos ficam em alturas diferentes. */}
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' }}>
                <View style={{ flex: 2 }}>
                  <Select
                    label={indice === 0 ? 'Classe' : 'Outra classe'}
                    value={linha.gameClassId}
                    // Cada classe entra uma vez só: a que já está noutra linha
                    // sobe de nível lá, e não aparece de novo aqui.
                    options={(reference.data?.classes ?? [])
                      .filter(
                        (entry) =>
                          entry.id === linha.gameClassId ||
                          !classes.some((outra) => outra.gameClassId === entry.id)
                      )
                      .map((entry) => ({
                        value: entry.id,
                        label: entry.name,
                        description: entry.short_description ?? undefined,
                      }))}
                    onChange={(id) => trocarClasse(indice, id)}
                    placeholder="Escolha a classe…"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Nível"
                    value={linha.level}
                    onChangeText={(text) => trocarNivel(indice, text)}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              {classes.length > 1 ? (
                <View style={{ flexDirection: 'row' }}>
                  <Button
                    label={indice === 0 ? 'Tirar a classe principal' : 'Tirar esta classe'}
                    variant="ghost"
                    size="sm"
                    onPress={() => tirarClasse(indice)}
                  />
                </View>
              ) : null}
            </View>
          ))}

          <Button
            label="Somar outra classe (multiclasse)"
            variant="secondary"
            onPress={somarClasse}
            icon={<Icon name="adicionar" size={16} color={colors.textMuted} />}
          />

          <HelpNote collapsible source="Livro base, p. 35">
            Para trocar de classe, escolha outra no campo Classe. Multiclasse é quando o personagem, ao subir
            de nível, pega o nível de uma classe diferente — um guerreiro 3 que vira guerreiro 3 / ladino 1
            tem nível de personagem 4. A primeira linha é a classe principal.
          </HelpNote>

          {habilidadesDeClasseQueSaiu.length > 0 ? (
            <HelpNote tone="warning">
              {`As habilidades de ${nomesDasClasses(habilidadesDeClasseQueSaiu)} continuam na aba Habilidades (${habilidadesDeClasseQueSaiu.map((habilidade) => habilidade.name).join(', ')}). Depois de salvar, apague lá as que não valem mais.`}
            </HelpNote>
          ) : null}

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
              const suggested = suggestedKeyAttributes.includes(key);

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

          {keyAttribute !== null && suggestedKeyAttributes.length > 0 ? (
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
            seja qual for o atributo; quem tem uma exceção, como Armadura Brilhante, marca a dispensa logo
            abaixo em vez de somar o valor à mão em "Outros bônus".
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

          <Input
            label="Redução de dano (RD)"
            value={damageReduction}
            onChangeText={setDamageReduction}
            keyboardType="number-pad"
            hint="Sai de cada golpe antes dos PV. Armadura de adamante, linhagem dracônica, forma monstruosa."
          />

          <Checkbox
            label="Ignora a penalidade de armadura"
            checked={ignoresArmorPenalty}
            onChange={setIgnoresArmorPenalty}
            hint="Para quem tem habilidade que anula a penalidade da armadura e do escudo em Acrobacia, Furtividade e Ladinagem. O −5 por excesso de carga continua valendo."
          />

          <Checkbox
            label="Armadura pesada não anula o atributo na Defesa"
            checked={keepsDefenseAttribute}
            onChange={setKeepsDefenseAttribute}
            hint="Para quem tem a exceção, como Armadura Brilhante (nobre, 8º nível). Só devolve o atributo na Defesa; os 3m de deslocamento têm caixa própria em Combate e progressão."
          />
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

          <Checkbox
            label="Armadura pesada não reduz o deslocamento"
            checked={keepsDisplacement}
            onChange={setKeepsDisplacement}
            hint="Para quem anda igual de armadura completa — os chassis de golem, por exemplo. Os 3m por excesso de carga continuam valendo."
          />

          <Text variant="small" tone="secondary">
            {describeDisplacement(displacementPreview)}
          </Text>
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

/** Nível digitado numa linha de classe: vazio ou inválido conta como 1, e nunca menos. */
function nivelDaLinha(linha: LinhaDeClasse): number {
  return Math.max(1, Number.parseInt(linha.level, 10) || 1);
}

/** "guerreiro" ou "guerreiro e ladino", com o nome que a ficha já traz em cada habilidade. */
function nomesDasClasses(habilidades: CharacterClassAbility[]): string {
  const nomes = [
    ...new Set(habilidades.map((habilidade) => habilidade.game_class_name ?? 'uma classe que saiu')),
  ];

  const ultimo = nomes.pop() ?? '';

  return nomes.length > 0 ? `${nomes.join(', ')} e ${ultimo}` : ultimo;
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

/**
 * O passo em uma linha: quanto sai da ficha e o que a armadura pesada fez com
 * ele — ou deixou de fazer, quando a dispensa está marcada.
 */
function describeDisplacement(preview: ReturnType<typeof previewDisplacement>): string {
  if (preview.reducedByHeavyArmor) {
    return `Deslocamento: armadura pesada −3m → ${preview.total}m`;
  }

  if (preview.waived) {
    return `Deslocamento: ${preview.total}m — a armadura pesada não reduz`;
  }

  return `Deslocamento: ${preview.total}m`;
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
