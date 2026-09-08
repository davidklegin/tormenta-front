import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, ErrorState, Loading, Select, Sheet, Text } from '@/components/ui';
import { useCharacter, useUpdateVitals } from '@/hooks/useCharacters';
import { spacing, useTheme, vitalColors } from '@/theme';
import { AttackManager } from './AttackManager';
import { AttributeGrid } from './AttributeGrid';
import { CharacterStats } from './CharacterHeader';
import { ConditionManager } from './ConditionManager';
import { VitalTracker } from './VitalTracker';

/**
 * A ficha em um painel, para consultar sem sair da tela.
 *
 * Nasceu do tabuleiro. Lá o jogador passa a luta inteira olhando o mapa, e
 * tudo o que ele precisa saber no turno — quanto tem de Defesa, o bônus do
 * ataque, quanto sobrou de mana, que condição está pegando nele — morava atrás
 * de uma navegação que descarrega o mapa e o traz de volta rolado e recentrado.
 *
 * O que entra aqui é o que se usa **durante** a rodada, na ordem em que a mesa
 * pergunta. O que ficou de fora — perícias, equipamento, magias, história — é
 * consulta de mesa parada, e continua a um toque no rodapé, na ficha inteira.
 *
 * A ficha só é carregada enquanto o painel está aberto: no tabuleiro, manter o
 * personagem inteiro em memória a sessão toda seria pagar por uma tela que
 * ninguém está olhando.
 */
export function CharacterSheetModal({
  characterId,
  fichas,
  visible,
  onClose,
  onTrocarFicha,
}: {
  characterId: number;
  /** As outras fichas desta pessoa na mesa, para trocar sem fechar o painel. */
  fichas?: { id: number; name: string }[];
  visible: boolean;
  onClose: () => void;
  onTrocarFicha?: (characterId: number) => void;
}) {
  const { colors } = useTheme();
  const vitais = vitalColors(colors);

  const query = useCharacter(visible ? characterId : null);
  const vitals = useUpdateVitals(characterId);

  const personagem = query.data;
  const podeAlterar = personagem?.permissions.can_update_vitals ?? false;

  const ajustar = (campo: 'current_hp' | 'current_mp') => (delta: number) =>
    vitals.mutate({ deltas: { [campo]: delta } });

  const definir = (campo: 'current_hp' | 'current_mp') => (valor: number) =>
    vitals.mutate({ absolutes: { [campo]: valor } });

  const abrirFichaInteira = () => {
    onClose();
    router.push(`/(app)/personagens/${characterId}`);
  };

  const outras = fichas ?? [];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={personagem?.name ?? outras.find((ficha) => ficha.id === characterId)?.name ?? 'Ficha'}
      subtitle={
        personagem
          ? [personagem.class_label, `nível ${personagem.level}`, personagem.race?.name]
              .filter(Boolean)
              .join(' · ')
          : undefined
      }
      footer={
        <>
          <Button
            label="Ficha inteira"
            variant="ghost"
            onPress={abrirFichaInteira}
            style={{ flex: 1 }}
          />
          <Button label="Fechar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        </>
      }
    >
      {query.isLoading ? <Loading label="Abrindo a ficha…" /> : null}

      {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}

      {personagem ? (
        <View style={{ gap: spacing.md }}>
          {/* Com duas fichas na mesma mesa, o painel tem de dizer de quem são
              os números — e deixar trocar sem voltar ao mapa. */}
          {outras.length > 1 && onTrocarFicha ? (
            <Select
              label="Personagem"
              value={characterId}
              options={outras.map((ficha) => ({ value: ficha.id, label: ficha.name }))}
              onChange={(id) => {
                if (id !== null) onTrocarFicha(id);
              }}
              searchable={outras.length > 6}
            />
          ) : null}

          <AttributeGrid attributes={personagem.attributes} />

          <CharacterStats character={personagem} />

          <VitalTracker
            label="Pontos de Vida"
            icon="vida"
            current={personagem.hp.current}
            max={personagem.hp.max}
            temp={personagem.hp.temp}
            color={vitais.hp}
            trackColor={vitais.hpTrack}
            editable={podeAlterar}
            onChange={ajustar('current_hp')}
            onSetValue={definir('current_hp')}
            footnote={
              personagem.hp.is_dead
                ? 'Morto.'
                : personagem.hp.is_down
                  ? `Inconsciente e sangrando. Morre em ${personagem.hp.death_threshold} PV.`
                  : undefined
            }
          />

          <VitalTracker
            label="Pontos de Mana"
            icon="mana"
            current={personagem.mp.current}
            max={personagem.mp.max}
            temp={personagem.mp.temp}
            color={vitais.mp}
            trackColor={vitais.mpTrack}
            editable={podeAlterar}
            onChange={ajustar('current_mp')}
            onSetValue={definir('current_mp')}
          />

          <ConditionManager
            characterId={characterId}
            conditions={personagem.conditions}
            editable={podeAlterar}
          />

          <AttackManager
            characterId={characterId}
            attacks={personagem.attacks}
            editable={personagem.permissions.can_update}
          />

          {podeAlterar ? null : (
            <Text variant="small" tone="muted">
              Esta ficha não é sua: o painel mostra os números, mas não os altera.
            </Text>
          )}
        </View>
      ) : null}
    </Sheet>
  );
}
