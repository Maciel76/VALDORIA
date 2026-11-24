# Reino de Valdória

Jogo 3D de construção e exploração medieval para navegador. Desenvolva uma aldeia, monte fortificações e visite os castelos publicados por outros jogadores.

## Executar

Use Node.js 22.12+ ou 20.19+. O jogo precisa de um navegador com WebGL 2. No terminal desta pasta:

```sh
npm install
npm run dev
```

Abra [http://localhost:5179](http://localhost:5179). A API usa a mesma origem do jogo. O banco padrão é `reino_valdoria`, coleção `kingdoms`, em `mongodb://127.0.0.1:27017`. Copie `.env.example` para `.env` para alterar portas, host e conexão. Com MongoDB indisponível, ainda é possível construir, explorar e salvar no IndexedDB. Use `MONGODB_URI=disabled` para forçar o modo local.

No Windows com nvm, se `node --version` informar que nenhuma versão está ativa, selecione uma versão instalada com `nvm use`. Os testes locais usaram Node.js 22.23.3.

```sh
npm run build
npm start
```

A produção serve o build em [http://localhost:4189](http://localhost:4189). Para jogar em rede, os participantes devem acessar a mesma instância. Use o endereço IP da máquina servidora na rede local e permita a porta do jogo no firewall. Para acesso pela internet, disponibilize a instância atrás de HTTPS. O projeto foi entregue localmente.

## Construir, explorar e visitar

- Na primeira abertura, **Reino principal** mostra uma aldeia jogável com 5.000 moedas e um **Castelo Nível 1**. Em **Configurações → Trocar reino**, **Terreno vazio** inicia do zero. A **Cidade demonstrativa** tem um salvamento próprio e inclui o Grande Castelo de pedra, fortificações e moinho d’água. O último território selecionado reabre automaticamente.
- Em um reino sem muro, use **Construir → Muralhas e torres → Muralha da vila** para instalar o perímetro de nível 1 com três portões por 1.200 de ouro. A muralha acompanha as expansões do território automaticamente. Abra **Fortificações da vila** nas ferramentas da câmera para enquadrar a muralha inteira ou um dos três portões. A muralha começa no nível 1 e evolui por 850 de ouro. Cada portão começa no nível 1 e evolui separadamente por 250 de ouro. Selecione um portão para abrir ou fechar. No modo de caminhada, também é possível usar **E** próximo a ele.
- Em **Construir**, selecione uma peça e posicione a prévia. Clique no terreno ou pressione Enter para confirmar. R e Shift+R giram, Esc cancela e as setas ajustam a prévia. Ative **Linha** para vias e muralhas, ou **Repetir** para continuar colocando a mesma peça.
- Clique em uma construção para mover, girar ou excluir. Mover e girar são gratuitos. Ctrl+Z desfaz a última operação, inclusive uma linha inteira ou expansão. Uma exclusão só devolve a peça quando desfeita. O custo de expansão aparece antes da compra e cada lado cresce em faixas de 36 m.
- Na visão aérea, arraste para girar, use o botão direito para deslocar e a roda para aproximar. **Enquadrar castelo**, no lado direito, aproxima a câmera do castelo. **Explorar** alterna para caminhada com WASD ou setas. Arraste para olhar, use J para capturar o mouse e E perto do portão para operá-lo. Em telas de toque, use os botões de caminhada e toque no portão para selecioná-lo.
- No **Mapa-múndi**, crie um perfil e use **Publicar meu reino**. A publicação mostra um retrato do Reino principal no atlas. Use **Atualizar meu reino** para publicar mudanças posteriores. Busque pelo jogador ou reino, selecione um marcador e abra a visita 3D pelo botão de visitar. Jogadores identificados que estiverem na mesma visita veem os avatares uns dos outros. Cada jogador edita seu próprio reino.
- O **Código de acesso** do perfil serve para recuperá-lo em outro navegador. Quando o navegador e o servidor têm versões diferentes, escolha a versão a manter. Ao carregar a versão do servidor, a versão local vai para **Cópia de conflito**. Progresso local fica vinculado ao navegador e ao endereço que o abriu.

## Castelo Nível 1

A fortificação inicial tem paliçada chanfrada, tábuas e palha texturizadas, salão da guarda aberto, torre de vigia com escada, estandartes pintados, trilha de lajes, barricas e fogueira. Os dois lados do portão giram em torno de dobradiças modeladas no SolidCraft. A colisão acompanha a abertura. A fogueira emite fumaça, brasas e luz ao anoitecer. Bandeiras e fogo são animados em tempo real e respeitam a preferência por movimento reduzido.

O [arquivo editável do Blender](models/castelo-nivel-1.blend) tem materiais e texturas empacotados e poses do portão e da bandeira na linha do tempo. As [ferragens editáveis](models/dobradica-palicada.sc) estão em SolidCraft. Os GLBs usados pelo jogo ficam em `src/assets/`. Para regenerar a fortificação no Blender, execute:

```sh
blender --background --factory-startup --python-exit-code 1 --python models/build_stockade.py
```

`npm run models` regenera a capela e a igreja. Consulte [a ficha dos ativos](models/ASSETS.md) para os eixos e origens.

## Verificação

```sh
npm test
npm run build
python -m pip install playwright
python -m playwright install chromium
npm run test:browser
```

Para incluir o multiplayer real nos testes de API e navegador, defina `VALDORIA_TEST_MONGO` com a URI do MongoDB antes de executá-los. Cada execução cria e remove um banco isolado com prefixo `reino_valdoria_test_`. Para usar o Edge instalado no Windows, defina também `VALDORIA_BROWSER_CHANNEL=msedge`.

A verificação cobre posicionamento, rotação, muralhas, jardins, apoios, portões, pontes, vias, economia, persistência, revisões, duas sessões multiplayer e navegação por toque. O renderizador agrupa peças estáticas e reutiliza geometrias. A qualidade **Leve** reduz resolução, remove sombras e limita moradores visuais.

A cidade demonstrativa tem 149 objetos colocados, incluindo 17 edifícios. Na janela de teste de 1280 × 800, o Edge automatizado com o renderizador por software SwiftShader registrou 1,5 FPS e 484 chamadas de desenho na qualidade Padrão. Esse cenário mede a execução por software.

O atlas é compartilhado. A edição acontece individualmente e visitas são de leitura, com presença atualizada a cada poucos segundos. A primeira versão se concentra em construção, decoração e exploração medieval.

