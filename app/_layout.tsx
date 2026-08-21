import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError, setUnauthorizedHandler } from '@/api';
import { Loading } from '@/components/ui';
import { closeRealtime } from '@/realtime/useCampaignChannel';
import { useAuthStore } from '@/store/auth';
import { MotionProvider, ThemeProvider, useAppFonts, useTheme } from '@/theme';

/**
 * Raiz do aplicativo.
 *
 * Monta os provedores compartilhados (tema, movimento, cache de dados, áreas
 * seguras, gestos) e resolve o estado da sessão antes de decidir qual pilha de
 * telas exibir.
 *
 * O tema é o provedor mais externo de propósito: tudo abaixo dele — inclusive a
 * tela de carregamento — precisa saber em que paleta desenhar. Fosse montado
 * depois, o primeiro quadro sairia na cor errada e o usuário veria a troca.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Não insistir em erro de autorização ou validação: repetir não muda
        // o resultado e só atrasa a resposta ao usuário.
        if (error instanceof ApiError && [401, 403, 404, 422].includes(error.status)) {
          return false;
        }

        return failureCount < 2;
      },
      // Sem cache de dados: tudo nasce obsoleto (staleTime 0), some da memória
      // assim que a tela desmonta (gcTime 0) e é buscado de novo a cada
      // montagem, foco e reconexão. O app nunca mostra número que não tenha
      // acabado de vir do servidor.
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
    },
    mutations: { retry: false },
  },
});

export default function RootLayout() {
  return (
    <ThemeProvider>
      <MotionProvider>
        <AppShell />
      </MotionProvider>
    </ThemeProvider>
  );
}

/**
 * Separado da raiz porque precisa ler o tema — e um componente não consegue
 * consumir um contexto que ele mesmo monta.
 */
function AppShell() {
  const { colors, isDark, ready: temaResolvido } = useTheme();
  const fontesCarregadas = useAppFonts();

  const bootstrap = useAuthStore((state) => state.bootstrap);
  const clearSession = useAuthStore((state) => state.clearSession);
  const status = useAuthStore((state) => state.status);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Token expirado ou revogado: encerra a sessão e volta ao login.
    setUnauthorizedHandler(() => {
      closeRealtime();
      queryClient.clear();
      clearSession();
    });

    void bootstrap().finally(() => setReady(true));

    return () => setUnauthorizedHandler(null);
  }, [bootstrap, clearSession]);

  // Enquanto o tema salvo não voltou do armazenamento, nada é desenhado: é o
  // que garante que ninguém veja o tema errado piscar antes do certo. No
  // celular, a tela de abertura do sistema cobre esse instante; na web o tema
  // já veio resolvido do script embutido no HTML e isto nem chega a ser falso.
  if (!temaResolvido) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={isDark ? 'light' : 'dark'} />

          {!ready || !fontesCarregadas || status === 'loading' ? (
            <View style={{ flex: 1, backgroundColor: colors.bg }}>
              <Loading label="Preparando sua mesa…" />
            </View>
          ) : (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="styleguide" />
            </Stack>
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
