import { RefreshControl, View } from 'react-native';
import {
  BackButton,
  Divider,
  ErrorState,
  Loading,
  Screen,
  Text,
  ThemeToggle,
  TitlePlate,
} from '@/components/ui';
import { useCharacter } from '@/hooks/useCharacters';
import { useAuthStore } from '@/store/auth';
import { useVitalsStore } from '@/store/vitals';
import { SHEET_TABS } from '@/rules';
import { spacing, useTheme } from '@/theme';
import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import type { Character } from '@/api/types';
import { CharacterHeader } from './CharacterHeader';
import { SheetTabs } from './SheetTabs';

/**
 * Casca comum das abas da ficha: carrega o personagem, trata erro e monta
 * cabeçalho, abas e a linha que diz para que serve a aba aberta.
 *
 * Concentrar isso aqui evita repetir o mesmo encanamento em oito telas — e faz
 * com que uma melhoria de navegação valha para todas de uma vez.
 */
export function SheetScreen({
  characterId,
  children,
}: {
  characterId: number;
  children: (character: Character) => React.ReactNode;
}) {
  const { colors } = useTheme();
  const query = useCharacter(characterId);
  const pathname = usePathname();

  const meuId = useAuthStore((estado) => estado.user?.id ?? null);
  const escolherNoMarcador = useVitalsStore((estado) => estado.escolher);
  const donoDaFicha = query.data?.player?.id ?? null;

  // Abrir a própria ficha passa o marcador flutuante para ela: é a ficha que o
  // jogador está usando na mesa, e ver os PV de outro personagem na pastilha
  // enquanto se lê esta seria pior do que não ter pastilha nenhuma.
  useEffect(() => {
    if (meuId !== null && donoDaFicha === meuId) {
      escolherNoMarcador(characterId);
    }
  }, [meuId, donoDaFicha, characterId, escolherNoMarcador]);

  const segmento = pathname.split('/').pop() ?? 'index';
  const aba = SHEET_TABS.find((tab) => tab.key === segmento) ?? SHEET_TABS[0];

  if (query.isLoading) {
    return (
      <Screen>
        <Loading label="Abrindo a ficha…" />
      </Screen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Screen>
        <BackButton />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  const character = query.data;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <BackButton label="Meus personagens" />
        <ThemeToggle />
      </View>

      <CharacterHeader character={character} />
      <Divider />

      <View style={{ gap: spacing.space2 }}>
        <SheetTabs characterId={characterId} />
        <TitlePlate label={aba.label} size="sm" />
        <Text variant="small" tone="muted">
          {aba.hint}
        </Text>
      </View>

      {children(character)}
    </Screen>
  );
}
