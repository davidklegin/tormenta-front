import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { palettes, type Palette, type ThemeName } from './palettes';
import { elevation, type Elevation } from './tokens';
import { applyDocumentTheme, readStoredThemeSync, THEME_STORAGE_KEY, writeStoredThemeSync } from './webTheme';

/**
 * Tema do aplicativo.
 *
 * Três coisas moram aqui: qual paleta está valendo, como o usuário escolheu, e
 * como isso sobrevive ao fechar o app.
 *
 * ## Por que Contexto, e não um objeto importado
 *
 * A paleta antiga era um objeto estático que cada arquivo importava. Isso não
 * dá para alternar em tempo de execução: o valor é capturado uma vez e nada
 * reavalia. Contexto resolve porque atravessa as fronteiras de memoização — o
 * React Navigation memoiza as telas, e um simples "renderizar a raiz de novo"
 * não chegaria nelas.
 *
 * ## Como o primeiro quadro sai no tema certo
 *
 * Na web, a preferência é lida do `localStorage` de forma síncrona, antes do
 * primeiro render — e o script embutido em `public/index.html` já pintou o
 * `<html>` com o tema salvo antes mesmo do bundle carregar. Nenhum piscar.
 *
 * No celular não existe HTML para preparar, então a leitura é assíncrona e a
 * raiz do app espera `ready` para desenhar. A tela de abertura do sistema cobre
 * essa fração de segundo, e o usuário nunca vê o tema errado aparecer e trocar.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

export type ThemeContextValue = {
  /** Tema em vigor, já resolvido contra o sistema. */
  theme: ThemeName;
  /** O que o usuário escolheu; `system` significa "siga o aparelho". */
  preference: ThemePreference;
  /** Paleta em vigor. É o que os componentes leem. */
  colors: Palette;
  /** Sombras calculadas para a paleta em vigor. */
  elevation: Elevation;
  isDark: boolean;
  /** Preferência já lida do armazenamento. */
  ready: boolean;
  setPreference: (preference: ThemePreference) => void;
  /** Alterna claro↔escuro, fixando a escolha. */
  toggle: () => void;
};

function normalizar(valor: string | null | undefined): ThemePreference | null {
  return valor === 'light' || valor === 'dark' || valor === 'system' ? valor : null;
}

/** Na web dá para saber a preferência salva antes do primeiro render; no resto, não. */
const PREFERENCIA_INICIAL = normalizar(readStoredThemeSync());

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const doSistema = useColorScheme();
  const [preference, definirPreferencia] = useState<ThemePreference>(PREFERENCIA_INICIAL ?? 'system');
  const [ready, setReady] = useState(Platform.OS === 'web');
  const primeiraAplicacao = useRef(true);

  // No celular a leitura é assíncrona. Só aqui — na web o valor já entrou no
  // estado inicial, e reler causaria um render a mais sem motivo.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let ativo = true;

    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((valor) => {
        if (!ativo) return;
        const salva = normalizar(valor);
        if (salva) definirPreferencia(salva);
      })
      .catch(() => {
        // Armazenamento indisponível: segue o aparelho.
      })
      .finally(() => {
        if (ativo) setReady(true);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const theme: ThemeName = preference === 'system' ? (doSistema === 'light' ? 'light' : 'dark') : preference;

  const palette = palettes[theme];

  // Mantém o documento e a moldura nativa alinhados com a paleta. A moldura
  // nativa importa no Android: sem ela, o vão sob a barra de gestos pisca na
  // cor antiga durante a troca.
  useEffect(() => {
    applyDocumentTheme(theme, palette);

    void SystemUI.setBackgroundColorAsync(palette.bg).catch(() => {
      // Plataforma sem suporte; a cor de fundo das telas já cobre o caso.
    });
  }, [theme, palette]);

  // Persiste a escolha. Pula a primeira passagem para não regravar o que
  // acabou de ser lido.
  useEffect(() => {
    if (primeiraAplicacao.current) {
      primeiraAplicacao.current = false;

      return;
    }

    writeStoredThemeSync(preference);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, preference).catch(() => {
      // Sem persistência: vale para esta execução.
    });
  }, [preference]);

  const setPreference = useCallback((proxima: ThemePreference) => definirPreferencia(proxima), []);

  const toggle = useCallback(() => {
    definirPreferencia((atual) => {
      const vigente = atual === 'system' ? (doSistema === 'light' ? 'light' : 'dark') : atual;

      return vigente === 'dark' ? 'light' : 'dark';
    });
  }, [doSistema]);

  const valor = useMemo<ThemeContextValue>(
    () => ({
      theme,
      preference,
      colors: palette,
      elevation: elevation(palette),
      isDark: theme === 'dark',
      ready,
      setPreference,
      toggle,
    }),
    [theme, preference, palette, ready, setPreference, toggle]
  );

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}

/** Paleta e controles do tema. Todo componente que pinta algo passa por aqui. */
export function useTheme(): ThemeContextValue {
  const contexto = useContext(ThemeContext);

  if (!contexto) {
    throw new Error('useTheme precisa de um <ThemeProvider> acima na árvore.');
  }

  return contexto;
}

/** Atalho para quem só quer as cores. */
export function useColors(): Palette {
  return useTheme().colors;
}
