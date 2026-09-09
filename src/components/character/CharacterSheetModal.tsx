import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { Character } from '@/api/types';
import { Button, Chip, ErrorState, Loading, Select, Sheet, Text } from '@/components/ui';
import { useCharacter } from '@/hooks/useCharacters';
import { SHEET_TABS } from '@/rules';
import { spacing } from '@/theme';
import { AttributeGrid } from './AttributeGrid';
import { CharacterStats } from './CharacterHeader';
import { AbilitiesContent } from './tabs/AbilitiesTab';
import { BackgroundContent } from './tabs/BackgroundTab';
import { CombatContent } from './tabs/CombatTab';
import { EquipmentContent } from './tabs/EquipmentTab';
import { NotesContent } from './tabs/NotesTab';
import { PowersContent } from './tabs/PowersTab';
import { SkillsContent } from './tabs/SkillsTab';
import { SpellsContent } from './tabs/SpellsTab';

type Aba = (typeof SHEET_TABS)[number]['key'];

/**
 * A ficha inteira em um painel, para consultar sem sair da tela.
 *
 * Nasceu do tabuleiro. Lá o jogador passa a luta inteira olhando o mapa, e
 * tudo o que o turno dele exige — quanto tem de Defesa, o bônus do ataque, o
 * texto do poder que ele quer usar, o custo da magia — morava atrás de uma
 * navegação que descarrega o mapa e o traz de volta rolado e recentrado.
 *
 * São as mesmas abas da ficha, e o mesmo conteúdo: cada uma delas é o
 * componente que a rota correspondente monta (`tabs/`), e não uma segunda
 * versão resumida. Uma cópia enxuta pareceria a ficha, discordaria dela na
 * primeira mudança de regra, e mandaria o jogador conferir na tela grande
 * justamente quando a resposta importasse.
 *
 * Os atributos e a faixa de Defesa aparecem só na aba de combate. Na ficha eles
 * moram no cabeçalho, valendo para todas; aqui, repetidos em cima de cada aba,
 * comeriam metade da altura de um painel que já é a metade de baixo da tela.
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
  const [aba, setAba] = useState<Aba>('index');

  const query = useCharacter(visible ? characterId : null);

  const personagem = query.data;

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
            label="Abrir em tela cheia"
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

          {/* As abas quebram em linha em vez de rolarem para o lado: numa lista
              horizontal, as últimas ficam além da borda sem nada na tela dizendo
              que existem, e "Magias" é exatamente a que o jogador procura. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {SHEET_TABS.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                tone={aba === item.key ? 'gold' : 'neutral'}
                selected={aba === item.key}
                compact
                onPress={() => setAba(item.key)}
              />
            ))}
          </View>

          <Conteudo aba={aba} characterId={characterId} character={personagem} />
        </View>
      ) : null}
    </Sheet>
  );
}

function Conteudo({
  aba,
  characterId,
  character,
}: {
  aba: Aba;
  characterId: number;
  character: Character;
}) {
  if (aba === 'pericias') return <SkillsContent characterId={characterId} character={character} />;
  if (aba === 'equipamento')
    return <EquipmentContent characterId={characterId} character={character} />;
  if (aba === 'poderes') return <PowersContent characterId={characterId} character={character} />;
  if (aba === 'magias') return <SpellsContent characterId={characterId} character={character} />;
  if (aba === 'habilidades')
    return <AbilitiesContent characterId={characterId} character={character} />;
  if (aba === 'background')
    return <BackgroundContent characterId={characterId} character={character} />;
  if (aba === 'anotacoes') return <NotesContent characterId={characterId} character={character} />;

  return (
    <View style={{ gap: spacing.md }}>
      <AttributeGrid attributes={character.attributes} />

      <CharacterStats character={character} />

      <CombatContent characterId={characterId} character={character} />
    </View>
  );
}
