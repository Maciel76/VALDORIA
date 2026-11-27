export const npcSites = [
  {id:'npc-grifo',name:'Bastião do Grifo',alias:'Guarda do Grifo',x:.347,y:.343,preview:'keep'},
  {id:'npc-avelar',name:'Forte de Avelar',alias:'Companhia de Avelar',x:.483,y:.734,preview:'stockade'},
  {id:'npc-vidral',name:'Castelo de Vidral',alias:'Casa de Vidral',x:.805,y:.586,preview:'keep'},
  {id:'npc-lumen',name:'Paliçada de Lúmen',alias:'Vigias de Lúmen',x:.198,y:.277,preview:'stockade'},
  {id:'npc-bruma',name:'Torre da Bruma',alias:'Sentinelas da Bruma',x:.592,y:.353,preview:'roundTower'}
].map(site=>({...site,kind:'npc',castles:1}));

export const npcSite = id => npcSites.find(site=>site.id===id);
