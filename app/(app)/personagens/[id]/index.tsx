import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { charactersApi } from '@/api';
import type { Character } from '@/api/types';
import { Button, Card, HelpNote, Icon, Text } from '@/components/ui';
import { AttackManager } from '@/components/character/AttackManager';
import { AttributeGrid } from '@/components/character/AttributeGrid';
import { ConditionManager } from '@/components/character/ConditionManager';
import { ResourceManager } from '@/components/character/ResourceManager';
import { SheetScreen } from '@/components/character/SheetScreen';
import { VitalTracker } from '@/components/character/VitalTracker';
import { useUpdateVitals } from '@/hooks/useCharacters';
import { formatSlots, formatTibar, signed } from '@/rules';
import { spacing, useResponsive, useTheme, vitalColors } from '@/theme';

/**
 * Aba Combate — o que se usa durante a sessão (briefing §19).
 *
 * A ordem segue a frequência de uso na mesa: primeiro vida e mana, que mudam a
 * cada turno; depois condições; então atributos e ataques, consultados a cada
 * rolagem; por último carga e experiência, que quase não mudam durante o jogo.
 */
export default function CharacterOverviewScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <CombatContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}

function CombatContent({ characterId, character }: { characterId: number; character: Character }) {
  const { colors } = useTheme();
  const vitais = vitalColors(colors);

  const { isDesktop } = useResponsive();
  const queryClient = useQueryClient();
  const vitals = useUpdateVitals(characterId);

  const podeAlterar = character.permissions.can_update_vitals;

  const descansar = useMutation({
    mutationFn: () => charactersApi.rest(characterId, 'normal'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['character', characterId] });
    },
  });

  const ajustar = (campo: 'current_hp' | 'current_mp') => (delta: number) =>
    vitals.mutate({ deltas: { [campo]: delta } });

  const definir = (campo: 'current_hp' | 'current_mp') => (valor: number) =>
    vitals.mutate({ absolutes: { [campo]: valor } });

  const pvAcimaDoMaximo = character.hp.current > character.hp.max;

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Vida e mana */}
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <VitalTracker
            label="Pontos de Vida"
            icon="vida"
            current={character.hp.current}
            max={character.hp.max}
            temp={character.hp.temp}
            color={vitais.hp}
            trackColor={vitais.hpTrack}
            editable={podeAlterar}
            onChange={ajustar('current_hp')}
            onSetValue={definir('current_hp')}
            footnote={
              character.hp.is_dead
                ? 'Morto.'
                : character.hp.is_down
                  ? `Inconsciente e sangrando. Morre em ${character.hp.death_threshold} PV.`
                  : undefined
            }
          />
        </View>

        <View style={{ flex: 1 }}>
          <VitalTracker
            label="Pontos de Mana"
            icon="mana"
            current={character.mp.current}
            max={character.mp.max}
            temp={character.mp.temp}
            color={vitais.mp}
            trackColor={vitais.mpTrack}
            editable={podeAlterar}
            onChange={ajustar('current_mp')}
            onSetValue={definir('current_mp')}
          />
        </View>
      </View>

      {pvAcimaDoMaximo ? (
        <HelpNote>
          Você está acima do total de vida. O app aceita isso — cabe à mesa decidir se o excesso vale como
          pontos temporários ou como um aumento do total.
        </HelpNote>
      ) : null}

      {podeAlterar ? (
        <Button
          label="Descanso noturno"
          variant="secondary"
          onPress={() => descansar.mutate()}
          loading={descansar.isPending}
          icon={<Icon name="descanso" size={18} color={colors.textMuted} />}
        />
      ) : null}

      <ConditionManager characterId={characterId} conditions={character.conditions} editable={podeAlterar} />

      <ResourceManager characterId={characterId} resources={character.resources} editable={podeAlterar} />

      <Card title="Atributos" subtitle="O número já é o modificador que entra nas rolagens">
        <AttributeGrid attributes={character.attributes} />
      </Card>

      <AttackManager
        characterId={characterId}
        attacks={character.attacks}
        editable={character.permissions.can_update}
      />

      {/* Defesa, com a conta aberta */}
      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="defesa" size={20} color={colors.textMuted} />
            <Text variant="heading" style={{ flex: 1 }}>
              Defesa
            </Text>
            <Text variant="numeric" tone="primary">
              {character.defense.total}
            </Text>
          </View>

          <View style={{ gap: spacing.xs }}>
            {character.defense.breakdown.map((parte, index) => (
              <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="small" tone="secondary">
                  {parte.label}
                </Text>
                <Text variant="smallStrong">{signed(parte.value)}</Text>
              </View>
            ))}
          </View>

          <HelpNote collapsible source="Livro base, p. 106">
            A Defesa é o número que o inimigo precisa alcançar para te acertar. Ela começa em 10 e soma sua
            Destreza mais o que armadura e escudo derem.
          </HelpNote>
        </View>
      </Card>

      {/* Carga e dinheiro */}
      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="carga" size={20} color={colors.textMuted} />
            <Text variant="heading" style={{ flex: 1 }}>
              Carga
            </Text>
          </View>

          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="small" tone="secondary">
                Espaços usados
              </Text>
              <Text variant="smallStrong" tone={character.carry.overloaded ? 'warning' : 'default'}>
                {formatSlots(character.carry.used)} / {formatSlots(character.carry.limit)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="small" tone="secondary">
                Dinheiro
              </Text>
              <Text variant="smallStrong" tone="gold">
                {formatTibar(character.money_tibar)}
              </Text>
            </View>
          </View>

          {character.carry.overloaded ? (
            <HelpNote tone="warning" source="Livro base, p. 141">
              Você está sobrecarregado: sofre −5 de penalidade de armadura e perde 3m de deslocamento. Largue
              itens na aba Mochila para voltar ao normal.
            </HelpNote>
          ) : null}
        </View>
      </Card>

      {/* Experiência */}
      <Card title="Experiência" subtitle={character.progression.tier}>
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="small" tone="secondary">
              XP atual
            </Text>
            <Text variant="smallStrong">{character.experience.toLocaleString('pt-BR')}</Text>
          </View>

          {character.progression.xp_next_level !== null ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="small" tone="secondary">
                Faltam para o {character.level + 1}º nível
              </Text>
              <Text variant="smallStrong">
                {(character.progression.xp_to_next_level ?? 0).toLocaleString('pt-BR')}
              </Text>
            </View>
          ) : (
            <Text variant="small" tone="gold">
              Nível máximo alcançado.
            </Text>
          )}
        </View>
      </Card>
    </View>
  );
}
