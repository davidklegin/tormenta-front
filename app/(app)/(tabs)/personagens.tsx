import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Loading,
  Screen,
  SegmentedControl,
  Text,
} from '@/components/ui';
import { CharacterCard } from '@/components/character/CharacterCard';
import { PageHeader, ResponsiveGrid } from '@/components/layout';
import { useAllCharacters, useCharacters } from '@/hooks/useCharacters';
import { useAuthStore } from '@/store/auth';
import { spacing, useTheme } from '@/theme';

type Aba = 'minhas' | 'todas';

/**
 * Tela inicial do jogador (briefing §8).
 *
 * "Minhas" lista as fichas do usuário. As mesas que ele mestra ficam na aba
 * Campanhas, e não aqui: esta tela é sobre personagens, e o atalho de mestre
 * empurrava as fichas para baixo da dobra em quem mestra mais de uma mesa.
 *
 * "Todas" é a base inteira: a leitura de fichas é aberta (CharacterPolicy::view),
 * então qualquer um abre qualquer ficha, em modo leitura. Editar continua sendo
 * só do dono, e a própria ficha já diz isso pelas `permissions`.
 */
export default function CharactersScreen() {
  const { colors } = useTheme();

  const user = useAuthStore((state) => state.user);

  const [aba, setAba] = useState<Aba>('minhas');
  const [busca, setBusca] = useState('');

  const characters = useCharacters();
  const todos = useAllCharacters(aba === 'todas' ? busca.trim() : '');

  const lista = aba === 'minhas' ? characters : todos;

  return (
    <Screen
      insideTabs
      refreshControl={
        <RefreshControl
          refreshing={lista.isRefetching}
          onRefresh={() => void lista.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        title={`Olá, ${user?.nickname || user?.name?.split(' ')[0] || 'aventureiro'}`}
        subtitle={aba === 'minhas' ? 'Seus personagens' : 'Fichas de toda a comunidade'}
        actions={
          <Button label="Novo personagem" size="sm" onPress={() => router.push('/(app)/personagens/novo')} />
        }
      />

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="personagens" size={18} color={colors.textMuted} />
          <Text variant="caption" tone="secondary" uppercase>
            Personagens
          </Text>
        </View>

        <SegmentedControl
          value={aba}
          onChange={setAba}
          segments={[
            { value: 'minhas', label: 'Meus', badge: characters.data?.length || undefined },
            { value: 'todas', label: 'Todos' },
          ]}
        />

        {aba === 'todas' ? (
          <Input
            placeholder="Buscar ficha pelo nome…"
            value={busca}
            onChangeText={setBusca}
            autoCorrect={false}
          />
        ) : null}

        {lista.isError ? <ErrorState error={lista.error} onRetry={() => void lista.refetch()} /> : null}

        {lista.isLoading ? (
          <Loading label={aba === 'minhas' ? 'Carregando seus personagens…' : 'Procurando fichas…'} />
        ) : (lista.data ?? []).length === 0 ? (
          <ListaVazia aba={aba} busca={busca} />
        ) : (
          <ResponsiveGrid columns={{ phone: 1, tablet: 2, desktop: 3 }}>
            {(lista.data ?? []).map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onPress={() => router.push(`/(app)/personagens/${character.id}`)}
              />
            ))}
          </ResponsiveGrid>
        )}

        {aba === 'todas' && (todos.data ?? []).length > 0 ? (
          <Text variant="caption" tone="muted">
            A lista mostra as fichas com movimento mais recente. Para achar outra, busque pelo nome.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function ListaVazia({ aba, busca }: { aba: Aba; busca: string }) {
  if (aba === 'todas') {
    return (
      <EmptyState
        icon="personagens"
        title={busca.trim() ? 'Nenhuma ficha com esse nome' : 'Nenhuma ficha ainda'}
        description={
          busca.trim()
            ? 'Tente outro termo — a busca procura no nome do personagem.'
            : 'Assim que alguém criar um personagem, ele aparece aqui para toda a comunidade.'
        }
      />
    );
  }

  return (
    <EmptyState
      icon="personagens"
      title="Vamos criar seu primeiro personagem"
      description="A ficha guarda vida, mana, perícias, magias e tudo o que você usa durante a sessão. Dá para preencher aos poucos — comece pelo nome e pela classe."
      actionLabel="Criar personagem"
      onAction={() => router.push('/(app)/personagens/novo')}
    />
  );
}
