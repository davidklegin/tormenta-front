import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, charactersApi } from '@/api';
import type { AttributeKey, Character } from '@/api/types';
import { Button, Card, ErrorState, Input, Loading, Screen, Select, Text } from '@/components/ui';
import { PageHeader } from '@/components/layout';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useCharacter, useDeleteCharacter, useUpdateCharacter } from '@/hooks/useCharacters';
import { useReference } from '@/hooks/useReference';
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER } from '@/rules';
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
  const campaigns = useCampaigns();
  const updateCharacter = useUpdateCharacter(character.id);
  const deleteCharacter = useDeleteCharacter();

  const [name, setName] = useState(character.name);
  const [experience, setExperience] = useState(String(character.experience));
  const [campaignId, setCampaignId] = useState<number | null>(character.campaign?.id ?? null);
  const [originId, setOriginId] = useState<number | null>(character.origin?.id ?? null);
  const [deityId, setDeityId] = useState<number | null>(character.deity?.id ?? null);
  const [displacement, setDisplacement] = useState(String(character.displacement.base));
  const [proficiencies, setProficiencies] = useState(character.proficiencies ?? '');
  const [defenseOther, setDefenseOther] = useState(String(character.defense.other_bonus));
  const [attributes, setAttributes] = useState<Record<AttributeKey, string>>(
    () =>
      Object.fromEntries(
        character.attributes.map((attribute) => [attribute.key, String(attribute.base)])
      ) as Record<AttributeKey, string>
  );
  const [classLevels, setClassLevels] = useState<Record<number, string>>(() =>
    Object.fromEntries(character.classes.map((entry) => [entry.game_class_id, String(entry.level)]))
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadAvatar = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return null;

      const asset = result.assets[0];
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        formData.append('avatar', blob, asset.fileName ?? 'avatar.jpg');
      } else {
        formData.append('avatar', {
          uri: asset.uri,
          name: asset.fileName ?? 'avatar.jpg',
          type: asset.mimeType ?? 'image/jpeg',
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
    onError: () => setError('Não foi possível enviar a foto.'),
  });

  async function handleSave() {
    setError(null);
    setMessage(null);

    try {
      await updateCharacter.mutateAsync({
        name: name.trim(),
        version: character.version,
        experience: Number.parseInt(experience, 10) || 0,
        campaign_id: campaignId,
        origin_id: originId,
        deity_id: deityId,
        base_displacement: Number.parseInt(displacement, 10) || 9,
        proficiencies: proficiencies.trim() || null,
        defense_other_bonus: Number.parseInt(defenseOther, 10) || 0,
        attributes: Object.fromEntries(
          ATTRIBUTE_ORDER.map((key) => [key, Number.parseInt(attributes[key] ?? '0', 10) || 0])
        ),
        racial_attribute_choices: character.racial_attribute_choices ?? undefined,
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
          />

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
            label="Outros bônus na Defesa"
            value={defenseOther}
            onChangeText={setDefenseOther}
            keyboardType="numbers-and-punctuation"
            hint="Poderes e efeitos fora da fórmula 10 + Des + armadura + escudo."
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
