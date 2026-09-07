import { View } from 'react-native';
import { router } from 'expo-router';
import type { Character, CharacterSummary } from '@/api/types';
import { Button, ErrorState, HelpNote, Loading, Select, Sheet, Text } from '@/components/ui';
import { VitalTracker } from '@/components/character/VitalTracker';
import { useCharacter, useUpdateVitals } from '@/hooks/useCharacters';
import { useVitalsStore } from '@/store/vitals';
import { spacing, useTheme, vitalColors } from '@/theme';

/**
 * O painel que a pastilha abre.
 *
 * Reaproveita o mesmo `VitalTracker` da aba Combate — os botões de −1/+1, os
 * passos rápidos e o campo de valor exato são os que o jogador já conhece da
 * ficha, e um segundo controle de dano com outro comportamento só criaria
 * dúvida no meio da rodada.
 *
 * A ficha é carregada só enquanto o painel está aberto: a pastilha vive com os
 * números da lista, que já vêm prontos, e não faz sentido manter o detalhe
 * inteiro do personagem na memória o app todo.
 */
/** Classe, nível e mesa — pulando o que a ficha ainda não tem preenchido. */
function subtitulo(personagem: Character) {
  return [personagem.class_label, `nível ${personagem.level}`, personagem.campaign?.name]
    .filter(Boolean)
    .join(' · ');
}

export function VitalsSheet({
  characterId,
  fichas,
  visible,
  onClose,
}: {
  characterId: number;
  fichas: CharacterSummary[];
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const vitais = vitalColors(colors);

  const escolher = useVitalsStore((estado) => estado.escolher);
  const ocultar = useVitalsStore((estado) => estado.ocultar);

  const query = useCharacter(visible ? characterId : null);
  const vitals = useUpdateVitals(characterId);

  const personagem = query.data;
  const podeAlterar = personagem?.permissions.can_update_vitals ?? false;

  const ajustar = (campo: 'current_hp' | 'current_mp') => (delta: number) =>
    vitals.mutate({ deltas: { [campo]: delta } });

  const definir = (campo: 'current_hp' | 'current_mp') => (valor: number) =>
    vitals.mutate({ absolutes: { [campo]: valor } });

  const abrirFicha = () => {
    onClose();
    router.push(`/(app)/personagens/${characterId}`);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={personagem?.name ?? fichas.find((ficha) => ficha.id === characterId)?.name ?? 'Marcador'}
      subtitle={personagem ? subtitulo(personagem) : undefined}
      footer={
        <>
          <Button
            label="Ocultar"
            variant="ghost"
            onPress={() => {
              ocultar();
              onClose();
            }}
            style={{ flex: 1 }}
          />
          <Button label="Fechar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        </>
      }
    >
      {query.isLoading ? <Loading label="Buscando os números…" /> : null}

      {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}

      {personagem ? (
        <View style={{ gap: spacing.md }}>
          {/* Uma ficha só não precisa de escolha; com duas ou mais, o marcador
              tem de dizer de quem são os números — e deixar trocar sem sair da
              tela em que o jogador está. */}
          {fichas.length > 1 ? (
            <Select
              label="Personagem"
              value={characterId}
              options={fichas.map((ficha) => ({
                value: ficha.id,
                label: ficha.name,
                description: `${ficha.class_label} · nível ${ficha.level}`,
              }))}
              onChange={(id) => {
                if (id !== null) escolher(id);
              }}
              searchable={fichas.length > 6}
            />
          ) : null}

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

          {podeAlterar ? null : (
            <HelpNote>Esta ficha não é sua, então o marcador só mostra os números.</HelpNote>
          )}

          <Button label="Abrir a ficha" variant="secondary" onPress={abrirFicha} />

          <Text variant="small" tone="muted">
            Arraste a pastilha para onde preferir. Se ocultá-la, ela volta pelo Perfil.
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}
