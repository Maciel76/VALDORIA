import { buildingLevel, buildingStyle } from '../core/building-levels.js';
import { countTroops, getTroop, troopRanges, troopTypes } from '../core/army.js';
import { icon } from './icons.js';

const fmt=new Intl.NumberFormat('pt-BR');
const filters={all:'Todas',...troopRanges};
export const troopImage = unit => `${import.meta.env.BASE_URL}tropas/${unit.id}.png`;

export function duration(seconds) {
  const mins=Math.floor(seconds/60);
  return mins ? `${mins} min ${seconds%60} s` : `${seconds} s`;
}

export function armyPanel(state,barracks,selected,filter,amount) {
  const level=buildingLevel(barracks);
  const orders=state.army?.orders.filter(order=>order.barracks===barracks.id)??[];
  const reserve=state.army?.reserve??{};
  const visible=troopTypes.filter(unit=>filter==='all'||unit.range===filter);
  const unlocked=selected.level<=level;
  return `<div class="army-shell">
    <div class="army-summary">
      <div><strong>${buildingStyle(barracks)}</strong><span>Nível ${level} de 10</span></div>
      <span>${icon('users-round')} <b>${fmt.format(countTroops(state))}</b> na reserva do reino</span>
    </div>
    <div class="army-layout">
      <section class="army-roster" aria-label="Unidades do quartel">
        <div class="army-filters" role="group" aria-label="Alcance da unidade">${Object.entries(filters).map(([id,name])=>
          `<button type="button" data-action="army-filter" data-value="${id}" aria-pressed="${id===filter}">${name}</button>`).join('')}</div>
        <div class="army-cards">${visible.map(unit=>{
          const available=unit.level<=level;
          return `<button type="button" class="army-card${available?'':' locked'}" data-action="army-unit" data-value="${unit.id}" aria-pressed="${unit===selected}">
            <span class="army-portrait"><img src="${troopImage(unit)}" width="360" height="420" alt="">
              <span class="army-rank">${available?'':icon('lock-keyhole')} Nv. ${unit.level}</span></span>
            <span class="army-card-title"><strong>${unit.name}</strong><small>${troopRanges[unit.range]}</small></span>
          </button>`;
        }).join('')}</div>
      </section>
      <div class="army-recruitment">
        <section class="army-detail">
          <h3>${selected.name}</h3><p>${troopRanges[selected.range]} · Nível ${selected.level}</p>
          <dl class="army-stats">
            <div><dt>Força</dt><dd>${selected.power}</dd></div>
            <div><dt>Defesa</dt><dd>${selected.defense}</dd></div>
            <div><dt>Na reserva</dt><dd>${fmt.format(reserve[selected.id]??0)}</dd></div>
          </dl>
          ${unlocked?`<label class="army-amount">Quantidade <input id="army-amount" type="number" inputmode="numeric" min="1" max="20" step="1" value="${amount}" required></label>
            <button class="primary" type="button" data-action="train-unit" data-value="${selected.id}" data-cost="${selected.cost}" data-seconds="${selected.seconds}">${icon('coins')}<span>Treinar · <b id="army-cost"></b> de ouro</span></button>
            <p class="army-time" id="army-time"></p>`:
            `<p class="army-lock">${icon('lock-keyhole')} Melhore o quartel para o nível ${selected.level} para treinar esta unidade.</p>`}
        </section>
        <section class="army-queue">
          <h3>Fila deste quartel</h3>
          ${orders.length?`<ol>${orders.map(order=>`<li><span><b>${order.amount}×</b> ${getTroop(order.unit).name}</span>
            <time data-ready-at="${order.readyAt}"></time></li>`).join('')}</ol>`:'<p>Nenhum treinamento em andamento.</p>'}
        </section>
        <section class="army-queue">
          <h3>Reserva do reino</h3>
          ${countTroops(state)?`<ul>${troopTypes.filter(unit=>reserve[unit.id]).map(unit=>
            `<li><span>${unit.name}</span><b>${fmt.format(reserve[unit.id])}</b></li>`).join('')}</ul>`:'<p>Nenhuma tropa treinada.</p>'}
        </section>
      </div>
    </div>
  </div>`;
}
