# Modelos de Valdória

Os seis modelos humanos, o cavalo e a carroça com rodas raiadas estão em `moradores-e-carroca.blend`. Os modelos usam pigmentos nos vértices e têm articulações nomeadas para a caminhada, as braçadas e o giro das rodas. O jogo carrega o GLB compacto de `src/assets/moradores-e-carroca.glb`. Para regenerar o arquivo, execute `blender --background --factory-startup --python-exit-code 1 --python models/build_villagers.py`.

Os modelos e a heráldica são originais. Os arquivos editáveis de arquitetura, adereços, vegetação e caracteres ficam em `src/models`. As primitivas descrevem dimensões em metros e usam Y para cima, com a fachada principal orientada para +Z. A igreja e a capela são exportadas para `src/assets` pelo comando `npm run models`. A exportação preserva os nomes dos materiais usados na iluminação.

Portões, grade, ponte levadiça, rodas, pás, chamas, bandeiras e membros são grupos com pivôs próprios. As peças estáticas são agrupadas por material e as partes móveis ficam separadas.

O medalhão acima do portão foi modelado no SolidCraft. O arquivo editável é `selo-valdoria.sc` e o jogo carrega o modelo `src/assets/selo.glb`. O SolidCraft exporta em metros e converte de Z para Y como eixo vertical.

O Castelo Nível 1 foi construído no Blender 5.2.1 a partir da referência de composição enviada pelo usuário. O projeto `castelo-nivel-1.blend` inclui a geometria, texturas originais empacotadas, câmera de apresentação e poses de portão e bandeiras. As fontes das texturas e dos modelos ficam em `build_stockade.py`. O jogo carrega `src/assets/castelo-nivel-1.glb` e controla as animações conforme o estado do reino.

As dobradiças do portão original usam duas chapas biseladas, um pino e seis rebites modelados no SolidCraft. As fontes ficam em `dobradica-palicada.sc`, com a exportação em `src/assets/dobradica-palicada.glb`. Nas novas muralhas, as ferragens fazem parte dos conjuntos abaixo.

Os conjuntos modulares das muralhas de nível 1 e 2 foram modelados no SolidCraft. Cada arquivo `muralhas-nivel-N.sc` contém a paliçada, o portão de duas folhas e o módulo de esquina. Para refazer os arquivos editáveis e os GLBs do jogo, execute `python models/build_fortifications.py 1` e `python models/build_fortifications.py 2` com `solidcraft-cli` no PATH.

Os níveis 3 a 10 usam perfis de arcos do SolidCraft, editáveis em `arcos-muralhas.sc`. Exporte esse projeto para `models/arcos-muralhas.glb` para atualizar o arquivo de entrada do Blender. O projeto `muralhas-niveis-3-a-10.blend` contém um conjunto por nível, com alvenaria, torres, telhados, ornamentos e duas folhas separadas por portão. Gere novamente os oito GLBs com `blender --background --factory-startup --python-exit-code 1 --python models/build_high_fortifications.py`.

As evoluções do castelo inicial ficam em `castelos-niveis-3-a-10.blend`. O script `build_castle_progression.py` usa os arcos do SolidCraft nos níveis 3 a 9 e chama `build_imperial_palace.py` para modelar o nível 10. Os níveis 1 e 2 usam o projeto original do castelo e o kit de paliçada correspondente.

O projeto `palacio-imperial.blend` inclui o castelo do nível 10, uma câmera e a iluminação de estúdio usada em `palacio-imperial.png`. O script `build_imperial_palace.py` exporta a coleção jogável em `stockade-nivel-10.glb` com compressão Meshopt. As propriedades `castleLeaf` e `castleFlag` ligam as dobradiças e os mastros aos efeitos do jogo.

O script `build_housing.py` gera as dez moradias editáveis em `moradias-niveis-1-a-10.blend` e os modelos jogáveis `moradia-nivel-*.glb`, compactados com Meshopt. A cena do Blender inclui a câmera e a iluminação da prancha `moradias-niveis-1-a-10.png`. O jogo adapta as evoluções aos lotes de cada moradia do catálogo e usa proporções próprias para as casas geminadas e as alas do solar.

O script `build_watchtowers.py` reúne as dez torres de vigia na cena editável `torres-de-vigia-niveis-1-a-10.blend` e exporta `watch-nivel-*.glb` para o catálogo de Edifícios públicos. O jogo usa as propriedades `watchPennant` e `watchFlame` para animar as flâmulas e as chamas de sinalização.

O script `build_orchard_farms.py` gera as dez fazendas com pomar, a cena editável com iluminação de estúdio e os modelos `farm-nivel-*.glb`. O arquivo `src/core/farm-layouts.json` é exportado junto com as malhas e registra as colisões de cada nível. A propriedade `farmRotor` liga o eixo do moinho à animação de rotação no jogo.

O script `build_noble_houses.py` gera a linha própria da Casa nobre de pedra em `casas-nobres-niveis-1-a-10.blend` e os modelos `noble-nivel-*.glb` no lote de 11 × 10 m. As fontes usam a propriedade `nobleFountain` para animar os jatos no jogo.

O script `build_markets.py` gera a cena `mercados-niveis-1-a-10.blend`, os modelos `market-nivel-*.glb` e as colisões compiladas em `src/core/market-layouts.json`. A galeria tem painéis de vidro translúcido, e os relógios, flâmulas e fontes usam propriedades exportadas para suas animações.

O script `build_watermills.py` gera a cena `moinhos-dagua-niveis-1-a-10.blend` e os modelos `watermill-nivel-*.glb`. Os eixos laterais usam `watermillWheel` para girar as rodas no jogo, e `watermillFlow` anima os filetes de água das comportas e dos aquedutos.

O script `build_windmills.py` gera a cena `moinhos-de-vento-niveis-1-a-10.blend` e os modelos `windmill-nivel-*.glb`. Cada modelo exporta um eixo `windmillRotor` para o giro das pás, com espaço para a rotação no lote de 9 × 9 m.

O script `build_sanctuaries.py` reúne as duas linhas de dez construções em `capelas-niveis-1-a-10.blend` e `igrejas-niveis-1-a-10.blend`. Ele mantém os modelos originais no nível 1 e exporta as ampliações em `chapel-nivel-*.glb` e `church-nivel-*.glb`. O arquivo `src/core/sanctuary-layouts.json` registra a área e as colisões de cada nível.
