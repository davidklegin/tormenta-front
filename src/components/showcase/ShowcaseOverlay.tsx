import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShowcaseStore } from '@/store/showcase';
import { Button, Sheet } from '@/components/ui';
import { usePlatformChannel } from '@/realtime/usePlatformChannel';
import { spacing, useResponsive } from '@/theme';
import { NoticeHost } from './NoticeHost';
import { ShowcaseDetail, subtituloDaExibicao } from './ShowcaseDetail';
import { ShowcaseNotice } from './ShowcaseNotice';

/**
 * O "Exibir aos outros" do lado de quem recebe (briefing §21).
 *
 * Monta uma vez na área logada, acima de todas as telas: assina o canal da
 * plataforma, empilha os avisos que chegam e abre o painel do item quando o
 * usuário toca em um deles. Nada aqui navega — abrir a exibição de outra pessoa
 * não pode tirar ninguém do meio de um combate, então o painel é um modal sobre
 * a tela em que a pessoa já estava, e fechá-lo devolve exatamente o que havia
 * antes.
 *
 * Os avisos ficam presos ao topo com `pointerEvents="box-none"`: a faixa
 * ocupa a largura da tela para posicioná-los, mas só os próprios avisos
 * recebem toque — o resto continua chegando à tela de baixo.
 */
export function ShowcaseOverlay() {
  usePlatformChannel();

  const insets = useSafeAreaInsets();
  const { isPhone } = useResponsive();

  const avisos = useShowcaseStore((estado) => estado.avisos);
  const aberto = useShowcaseStore((estado) => estado.aberto);
  const abrir = useShowcaseStore((estado) => estado.abrir);
  const dispensar = useShowcaseStore((estado) => estado.dispensar);
  const fechar = useShowcaseStore((estado) => estado.fechar);

  return (
    <>
      {avisos.length > 0 ? (
        <NoticeHost top={insets.top + spacing.space3} aoLado={!isPhone}>
          {avisos.map((aviso) => (
            <View
              key={aviso.id}
              // O contêiner na web não recebe ponteiro; cada aviso reativa o
              // seu, para a faixa invisível não cobrir o topo da página.
              style={{ width: isPhone ? undefined : 380, maxWidth: '100%', pointerEvents: 'auto' }}
            >
              <ShowcaseNotice
                evento={aviso}
                onAbrir={() => abrir(aviso)}
                onDispensar={() => dispensar(aviso.id)}
              />
            </View>
          ))}
        </NoticeHost>
      ) : null}

      <Sheet
        visible={aberto !== null}
        onClose={fechar}
        title={aberto?.title ?? ''}
        subtitle={aberto ? subtituloDaExibicao(aberto) : undefined}
        // O painel não tem nenhuma ação a oferecer — é o item de outra pessoa,
        // e não há o que editar. O rodapé existe só para dar um alvo de saída
        // explícito a quem foi interrompido no meio de outra coisa; fechar pelo
        // fundo continua valendo, mas ninguém deveria precisar adivinhar isso.
        footer={<Button label="Fechar" variant="secondary" onPress={fechar} style={{ flex: 1 }} />}
      >
        {aberto ? <ShowcaseDetail evento={aberto} /> : null}
      </Sheet>
    </>
  );
}
