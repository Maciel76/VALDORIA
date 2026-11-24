export const categories = [
  ['housing', 'Moradias', 'house'], ['trade', 'Comércio e produção', 'store'],
  ['civic', 'Edifícios públicos', 'landmark'], ['castle', 'Castelos', 'castle'],
  ['walls', 'Muralhas e torres', 'brick-wall'], ['roads', 'Caminhos e pisos', 'route'],
  ['decor', 'Decorações', 'flower-2'], ['green', 'Árvores e jardins', 'tree-pine'],
  ['lights', 'Iluminação', 'flame'], ['banners', 'Estandartes', 'flag']
].map(([id, name, icon]) => ({ id, name, icon }));

const byCategory = {
  housing: [
    ['hut','Casebre de palha',110,6,6,'Uma casa pequena de pau a pique para os primeiros moradores.',3],
    ['peasant','Casa de camponês',180,8,7,'Uma moradia com chaminé de pedra e telhas de barro.',5],
    ['timber','Casa de enxaimel',285,9,8,'Dois pavimentos com vigas aparentes e beiral pronunciado.',8],
    ['terrace','Casas geminadas',410,14,8,'Duas moradias com entradas independentes.',12],
    ['noble','Casa nobre de pedra',580,11,10,'Uma residência de pedra com janelas arqueadas.',10],
    ['manor','Solar senhorial',860,17,13,'Residência em alas com jardim e pórtico.',16]
  ],
  trade: [
    ['tavern','Taverna',310,10,8,'Um ponto de encontro com varanda, placa e balcão.',0,5],
    ['inn','Hospedaria',390,13,9,'Abrigo com quartos e galeria de madeira.',4,6],
    ['smith','Ferraria',270,9,8,'Forja aberta com bigorna, braseiro e bancada.',0,5],
    ['bakery','Padaria',215,8,7,'Forno de pedra e uma vitrine para o pão do dia.',0,4],
    ['market','Mercado',290,13,11,'Barracas de tecido reunidas em torno de uma praça.',0,9],
    ['sawmill','Serraria',315,11,9,'Estrutura aberta com serra e pilhas de troncos.',0,6],
    ['windmill','Moinho de vento',420,9,9,'Torre de moinho com pás movidas pelo vento.',0,5],
    ['watermill','Moinho d’água',460,11,10,'Moinho com roda lateral que pode ser instalado à margem do rio.',0,6],
    ['barn','Celeiro',235,10,8,'Celeiro com grandes portas de madeira e fardos no interior.',0,4],
    ['farm','Fazenda com pomar',380,18,15,'Um galpão, horta e fileiras de árvores frutíferas.',0,8]
  ],
  civic: [
    ['chapel','Capela',420,9,12,'Uma pequena nave de pedra com torre sineira.',0,3],
    ['church','Igreja de pedra',720,14,19,'Nave com rosácea, contrafortes e torre alta.',0,7],
    ['abbey','Mosteiro',980,24,19,'Alas de pedra em torno de um claustro aberto.',0,10],
    ['council','Casa do conselho',590,13,11,'Um salão público com pórtico e estandarte.',0,7],
    ['barracks','Quartel da guarda',520,14,11,'Alojamento da guarda com pátio de treino.',0,10],
    ['stable','Estábulo',330,12,8,'Cobertura ampla para cavalos e carroças.',0,5],
    ['watch','Torre de vigia',300,6,6,'Torre alta de madeira para vigiar os arredores.',0,3]
  ],
  castle: [
    ['stockade','Castelo Nível 1',980,34,34,'Paliçada de cedro com portão de duas folhas, casa da guarda, fogueira e torre de vigia acessível.',0,7],
    ['keep','Grande castelo',2300,34,34,'Fortaleza com salão, torres, pátio e ponte levadiça.',0,15]
  ],
  walls: [
    ['villageWall','Muralha da vila',1200,0,0,'Cerca todo o território com uma muralha de nível 1 e três portões.'],
    ['wall','Muralha reta',48,4,2,'Trecho de pedra com ameias. Permite construir em linha.'],
    ['wallShort','Muralha curta',36,3,1.4,'Trecho de três metros para completar encaixes perto de torres e esquinas.'],
    ['corner','Muralha de canto',64,4,4,'Trecho em ângulo para unir duas muralhas.'],
    ['squareTower','Torre quadrada',235,6,6,'Torre de pedra com ameias no terraço.'],
    ['roundTower','Torre circular',258,6,6,'Torre circular com cobertura de ardósia.'],
    ['woodGate','Portão de madeira',120,6,2,'Portão de duas folhas para paliçadas e cercas.'],
    ['cityGate','Portão do reino',290,8,4,'Portão de pedra com duas folhas que se abrem para dentro da muralha.'],
    ['drawGate','Portão fortificado',385,8,10,'Portão com grade e ponte levadiça operáveis.'],
    ['steps','Escadaria da muralha',74,2,7,'Escadaria de pedra para alcançar a ronda.'],
    ['lowWall','Mureta de pedra',25,4,0.7,'Mureta baixa para delimitar jardins e pátios.'],
    ['palisade','Paliçada',31,4,1,'Muralha de madeira de nível 1. Permite construir em linha e reforçar com uma base de pedra no nível 2.']
  ],
  roads: [
    ['dirt','Estrada de terra',8,2,2,'Estrada de terra batida para ligar os lotes.'],
    ['cobbles','Rua de pedras',13,2,2,'Módulo de pedras irregulares para ruas movimentadas.'],
    ['gravel','Caminho de cascalho',10,2,2,'Trilha clara para jardins, pomares e arredores.'],
    ['paving','Piso de pátio',15,2,2,'Lajes quadradas para praças e pátios.'],
    ['walkway','Passarela de madeira',20,2,2,'Pranchas sobre apoios baixos.'],
    ['bridge','Ponte de madeira',115,5,18,'Ponte com corrimãos para cruzar o rio ou um fosso.']
  ],
  decor: [
    ['bench','Banco de madeira',20,2,0.6,'Assento com pés de ferro.'],
    ['table','Mesa rústica',35,2.5,1.7,'Mesa com bancos compridos.'],
    ['well','Poço',57,2.6,2.6,'Poço de pedra com telhado e balde.'],
    ['fountain','Fonte de pedra',105,4.4,4.4,'Bacia com um jato de água no centro.'],
    ['statue','Estátua',120,2,2,'Um guardião esculpido em pedra.'],
    ['barrel','Barril',18,0.8,0.8,'Barril de carvalho com aros de ferro.'],
    ['crates','Caixotes',22,1.4,1.2,'Caixas de carga empilhadas.'],
    ['logs','Pilha de lenha',24,2,1.2,'Toras prontas para a lareira.'],
    ['cart','Carroça decorativa',72,2,4,'Carroça com rodas raiadas.'],
    ['stall','Barraca de feira',65,3.4,2.5,'Toldo listrado com bancada de mercadorias.'],
    ['sign','Placa de estabelecimento',17,0.6,0.5,'Placa de madeira com ferragens.'],
    ['scarecrow','Espantalho',19,0.7,0.7,'Espantalho de palha e roupa remendada.'],
    ['fence','Cerca de madeira',17,2,0.3,'Cerca rural de dois travessões.'],
    ['flowers','Canteiro de flores',24,2,1,'Flores de campo em moldura baixa.'],
    ['planter','Jardineira de pedra',31,2.4,1.2,'Jardineira com flores e ervas.'],
    ['arch','Arco com trepadeiras',70,2.7,1,'Arco sombreado coberto de folhas.'],
    ['brazier','Braseiro',46,0.9,0.9,'Recipiente de ferro para carvão em brasa.'],
    ['target','Alvo de treinamento',26,1.1,0.8,'Alvo pintado sobre suporte de madeira.'],
    ['rack','Suporte para armas',42,1.8,0.7,'Mostruário medieval com lanças e escudos.'],
    ['sundial','Relógio de sol',48,1.1,1.1,'Mostrador de pedra moldado para jardins.']
  ],
  green: [
    ['oak','Carvalho',48,1.15,1.15,'Copa larga e tronco espesso.'],
    ['pine','Pinheiro',37,0.9,0.9,'Conífera de copa em camadas.'],
    ['cypress','Cipreste',32,0.65,0.65,'Árvore alta de copa estreita.'],
    ['willow','Salgueiro',45,1,1,'Ramos pendentes próprios para as margens.'],
    ['birch','Bétula',36,0.65,0.65,'Tronco claro e copa delicada.'],
    ['apple','Macieira',39,0.7,0.7,'Árvore frutífera com maçãs vermelhas.'],
    ['pear','Pereira',39,0.7,0.7,'Frutífera com copa alongada.'],
    ['cherry','Cerejeira',45,0.75,0.75,'Copa rosada em flor.'],
    ['shrub','Arbusto ornamental',16,0.65,0.65,'Vegetação baixa para caminhos e bordas.'],
    ['deadTree','Árvore seca',25,0.85,0.85,'Galhos expostos e tronco retorcido.'],
    ['bedSquare','Canteiro quadrado',26,3,3,'Borda de pedra com terra para plantio.'],
    ['bedRect','Canteiro retangular',33,5,3,'Canteiro de madeira para pequenos pomares.'],
    ['bedRound','Canteiro circular',31,3,3,'Borda circular de pedra com terra para plantio.'],
    ['bedLong','Canteiro alongado',40,8,2.5,'Comprido canteiro de madeira.']
  ],
  lights: [
    ['torch','Tocha de poste',29,0.5,0.5,'Tocha para caminhos e portões.'],
    ['lantern','Lanterna suspensa',39,0.7,0.7,'Lanterna de ferro em suporte de madeira.'],
    ['bonfire','Fogueira',52,1.8,1.8,'Fogueira com círculo de pedras.']
  ],
  banners: [
    ['sun','Sol de Valdória'],['stag','Cervo de Arven'],['star','Estrela de Bruma'],['moon','Lua do Vale'],
    ['oakMark','Folha de Carvalho'],['river','Ondas de Avelar'],['rose','Rosa de Vidral'],['towerMark','Torre de Pedra'],
    ['crown','Coroa de Âmbar'],['mount','Picos da Fronteira'],['lily','Lírio de Nascente'],['quill','Pluma de Lúmen']
  ].map(([id,name], i) => [id,name,32,0.55,0.55,`Estandarte ${['em mastro','para fachada','para muralha'][i % 3]} com brasão fictício.`])
};

const retiredWallPieces = new Set(['wall','wallShort','corner','squareTower','roundTower','cityGate','drawGate','steps','lowWall']);

export const flags = ['#8b303a','#345b52','#323f71','#5b3565','#576336','#345f7b','#ab5356','#53506c','#866021','#434747','#47776b','#923b42'];
export const catalogue = Object.fromEntries(categories.flatMap(({ id: category }) =>
  byCategory[category].map(([id,name,price,w,d,description,homes=0,jobs=0], index) => [id,{
    id, name, price, w, d, description, homes, jobs, category, index,
    purchasable: !retiredWallPieces.has(id),
    line: ['roads','walls'].includes(category) && ['dirt','cobbles','gravel','paving','walkway','wall','lowWall','palisade'].includes(id),
    grid: category === 'roads' && id !== 'bridge' ? 2 : category === 'walls' ? 0.5 :
      ['decor','green','lights','banners'].includes(category) ? 0.25 : 1,
    support: ['roads','decor','green','lights','banners'].includes(category)
  }])
));

