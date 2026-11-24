# Modelos de Valdória

Os seis modelos humanos, o cavalo e a carroça com rodas raiadas estão em `moradores-e-carroca.blend`. Os modelos usam pigmentos nos vértices e têm articulações nomeadas para a caminhada, as braçadas e o giro das rodas. O jogo carrega o GLB compacto de `src/assets/moradores-e-carroca.glb`. Para regenerar o arquivo, execute `blender --background --factory-startup --python-exit-code 1 --python models/build_villagers.py`.

Os modelos e a heráldica são originais. Os arquivos editáveis de arquitetura, adereços, vegetação e caracteres ficam em `src/models`. As primitivas descrevem dimensões em metros e usam Y para cima, com a fachada principal orientada para +Z. A igreja e a capela são exportadas para `src/assets` pelo comando `npm run models`. A exportação preserva os nomes dos materiais usados na iluminação.

Portões, grade, ponte levadiça, rodas, pás, chamas, bandeiras e membros são grupos com pivôs próprios. As peças estáticas são agrupadas por material e as partes móveis ficam separadas.

O medalhão acima do portão foi modelado no SolidCraft. O arquivo editável é `selo-valdoria.sc` e o jogo carrega o modelo `src/assets/selo.glb`. O SolidCraft exporta em metros e converte de Z para Y como eixo vertical.

O Castelo Nível 1 foi construído no Blender 5.2.1 a partir da referência de composição enviada pelo usuário. O projeto `castelo-nivel-1.blend` inclui a geometria, texturas originais empacotadas, câmera de apresentação e poses de portão e bandeiras. As fontes das texturas e dos modelos ficam em `build_stockade.py`. O jogo carrega `src/assets/castelo-nivel-1.glb` e controla as animações conforme o estado do reino.

As dobradiças do portão original usam duas chapas biseladas, um pino e seis rebites modelados no SolidCraft. As fontes ficam em `dobradica-palicada.sc`, com a exportação em `src/assets/dobradica-palicada.glb`. Nas novas muralhas, as ferragens fazem parte dos conjuntos abaixo.

Os conjuntos modulares das muralhas de nível 1 e 2 foram modelados no SolidCraft. Cada arquivo `muralhas-nivel-N.sc` contém a paliçada, o portão de duas folhas e o módulo de esquina. Para refazer os arquivos editáveis e os GLBs do jogo, execute `python models/build_fortifications.py 1` e `python models/build_fortifications.py 2` com `solidcraft-cli` no PATH.
