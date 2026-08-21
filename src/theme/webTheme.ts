import { Platform } from 'react-native';
import type { Palette, ThemeName } from './palettes';

/**
 * Ponte com o documento HTML, na web.
 *
 * O aplicativo não escreve as cores aqui: quem define `--bg`, `--primary` e
 * companhia é `public/theme.css`, que o gerador escreve a partir do mesmo
 * `palettes.data.json` que alimenta o React Native. Este módulo só troca o
 * atributo `data-theme` no `<html>` — é a chave que faz o CSS inteiro virar de
 * uma vez, incluindo o fundo da página, o grão de papel e o anel de foco, que
 * são coisas que o React Native não alcança.
 *
 * No Android e no iOS todas as funções daqui não fazem nada.
 */
export const THEME_STORAGE_KEY = 'tormenta20.theme';

const naWeb = Platform.OS === 'web';

/** Aplica o tema ao documento. Idempotente; seguro chamar a cada render. */
export function applyDocumentTheme(theme: ThemeName, palette: Palette): void {
  if (!naWeb || typeof document === 'undefined') return;

  const raiz = document.documentElement;

  if (raiz.getAttribute('data-theme') !== theme) {
    raiz.setAttribute('data-theme', theme);
  }

  // Diz ao navegador em que esquema pintar barra de rolagem, seletor de data e
  // os demais controles nativos, que o CSS da página não alcança.
  raiz.style.colorScheme = palette.scheme;

  // Barra do sistema quando o app está instalado na tela de início.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', palette.bg);
}

/**
 * Lê a preferência salva de forma síncrona, antes do primeiro render.
 *
 * Síncrona de propósito: é isso que permite o primeiro quadro já sair no tema
 * certo. O `localStorage` pode lançar em janela anônima ou com cookies
 * bloqueados, então a falha vira "sem preferência" em vez de derrubar o app.
 */
export function readStoredThemeSync(): string | null {
  if (!naWeb || typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Grava a preferência. Silencia falha de armazenamento pelo mesmo motivo. */
export function writeStoredThemeSync(value: string): void {
  if (!naWeb || typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Sem persistência disponível: o tema vale para esta aba e pronto.
  }
}
