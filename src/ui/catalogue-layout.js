// The shop groups are independent of the categories used by placement and saves.
// A piece listed by ID takes precedence over its gameplay category's default section.
export const shopGroups = [
  {id:'housing',name:'Moradias',icon:'house',sections:[
    {id:'popular',name:'Casas populares',categories:['housing']},
    {id:'noble',name:'Casas nobres',items:['noble','manor']}
  ]},
  {id:'trade',name:'Comércio e ofícios',icon:'store',sections:[
    {id:'market',name:'Feiras e mercados',items:['market']},
    {id:'hospitality',name:'Tavernas e hospedarias',items:['tavern','inn']},
    {id:'workshops',name:'Oficinas e padarias',categories:['trade']}
  ]},
  {id:'farming',name:'Campo e criação',icon:'wheat',sections:[
    {id:'farms',name:'Fazendas e celeiros',items:['farm','barn']},
    {id:'mills',name:'Moinhos',items:['windmill','watermill']},
    {id:'stables',name:'Estábulos',items:['stable']}
  ]},
  {id:'civic',name:'Igreja e conselho',icon:'landmark',sections:[
    {id:'faith',name:'Edifícios religiosos',categories:['civic']},
    {id:'council',name:'Governo',items:['council']}
  ]},
  {id:'walls',name:'Castelos e defesa',icon:'castle',sections:[
    {id:'castles',name:'Castelos',categories:['castle']},
    {id:'walls',name:'Muralhas e portões',categories:['walls']},
    {id:'guard',name:'Guarda e vigia',items:['barracks','watch']}
  ]},
  {id:'roads',name:'Estradas e pontes',icon:'route',sections:[
    {id:'paths',name:'Estradas e caminhos',categories:['roads']},
    {id:'crossings',name:'Pontes e passarelas',items:['bridge','walkway']},
    {id:'courtyards',name:'Pisos de pátio',items:['paving']}
  ]},
  {id:'decor',name:'Decorações',icon:'flower-2',sections:[
    {id:'props',name:'Objetos e acessórios',categories:['decor']},
    {id:'squares',name:'Praças e mobiliário',items:['bench','table','well','fountain','statue']},
    {id:'gardens',name:'Árvores e jardins',categories:['green'],items:['fence','flowers','planter','arch','sundial']},
    {id:'lighting',name:'Iluminação',categories:['lights'],items:['brazier']},
    {id:'banners',name:'Estandartes',categories:['banners']}
  ]}
];

const sections = shopGroups.flatMap(group=>group.sections.map(section=>({group:group.id,section:section.id,...section})));
const byItem = new Map(sections.flatMap(section=>(section.items??[]).map(id=>[id,section])));
const byCategory = new Map(sections.flatMap(section=>(section.categories??[]).map(id=>[id,section])));

export function shopPosition(item) {
  return byItem.get(item.id)??byCategory.get(item.category);
}
