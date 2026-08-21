import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { charactersApi } from '@/api';
import type { Character } from '@/api/types';
import { Button, Card, Input, Text } from '@/components/ui';
import { SheetScreen } from '@/components/character/SheetScreen';
import { spacing } from '@/theme';

/**
 * Aba História (briefing §14).
 *
 * Campos livres, como o livro sugere no quadro "Descrição" (p. 107): história,
 * personalidade, aparência, objetivos, aliados, inimigos e organizações.
 */
const FIELDS = [
  { key: 'story', label: 'História', placeholder: 'De onde veio, o que viveu antes de se aventurar…' },
  { key: 'personality', label: 'Personalidade', placeholder: 'Como age, o que valoriza, manias…' },
  { key: 'appearance', label: 'Aparência', placeholder: 'Cor dos olhos, cicatrizes, trajes…' },
  { key: 'goals', label: 'Objetivos', placeholder: 'O que persegue nesta campanha' },
  { key: 'allies', label: 'Aliados', placeholder: 'Quem ajuda, quem deve favores' },
  { key: 'enemies', label: 'Inimigos', placeholder: 'Quem persegue, quem foi ferido' },
  { key: 'organizations', label: 'Organizações', placeholder: 'Guildas, igrejas, ordens' },
  { key: 'notes', label: 'Outras informações', placeholder: 'O que mais importar' },
] as const;

export default function BackgroundScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <BackgroundContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}

function BackgroundContent({ characterId, character }: { characterId: number; character: Character }) {
  const queryClient = useQueryClient();
  const canEdit = character.permissions.can_update;

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((field) => [field.key, character.background[field.key] ?? '']))
  );
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      charactersApi.update(characterId, {
        name: character.name,
        version: character.version,
        background_story: values.story,
        background_personality: values.personality,
        background_appearance: values.appearance,
        background_goals: values.goals,
        background_allies: values.allies,
        background_enemies: values.enemies,
        background_organizations: values.organizations,
        background_notes: values.notes,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['character', characterId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (!canEdit) {
    return (
      <View style={{ gap: spacing.md }}>
        {FIELDS.map((field) => {
          const value = character.background[field.key];
          if (!value) return null;

          return (
            <Card key={field.key} title={field.label}>
              <Text variant="body" tone="secondary">
                {value}
              </Text>
            </Card>
          );
        })}

        {FIELDS.every((field) => !character.background[field.key]) ? (
          <Text variant="small" tone="muted">
            Este personagem ainda não tem história registrada.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {FIELDS.map((field) => (
        <Input
          key={field.key}
          label={field.label}
          value={values[field.key] ?? ''}
          onChangeText={(text) => setValues((previous) => ({ ...previous, [field.key]: text }))}
          placeholder={field.placeholder}
          multiline
        />
      ))}

      {saved ? (
        <Text variant="small" tone="success">
          História salva.
        </Text>
      ) : null}

      <Button label="Salvar história" onPress={() => save.mutate()} loading={save.isPending} fullWidth />
    </View>
  );
}
