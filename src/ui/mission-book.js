import { findMission, missionChapters, missionStats, missionStatus } from '../core/missions.js';
import { icon } from './icons.js';

const fmt=new Intl.NumberFormat('pt-BR');
const statuses={complete:'Concluída',ready:'Recompensa disponível',active:'Em andamento',locked:'Bloqueada'};
const symbols={complete:'circle-check',ready:'flag',active:'book-open',locked:'lock-keyhole'};

export function missionBook(state,progress,selected,notice) {
  const stats=missionStats(state);
  const {completed,xp,level,start,next}=progress;
  const all=missionChapters.flatMap(chapter=>chapter.missions);
  const mission=findMission(selected) ?? all.find(entry=>!completed.includes(entry.id)) ?? all.at(-1);
  const status=missionStatus(mission,completed,stats);
  return `<div class="mission-account">
    <div><strong>Nível ${level}</strong><span>${fmt.format(xp)} / ${fmt.format(next)} XP</span></div>
    <progress value="${xp-start}" max="${next-start}" aria-label="XP até o próximo nível"></progress>
  </div>
  <div class="mission-spread">
    <nav class="mission-index" aria-label="Capítulos do livro de missões">${missionChapters.map(chapter=>`<section>
      <h3>${chapter.name}</h3>
      ${chapter.missions.map(entry=>{
        const entryStatus=missionStatus(entry,completed,stats);
        return `<button type="button" data-action="mission-select" data-value="${entry.id}" aria-pressed="${entry===mission}">
          ${icon(symbols[entryStatus])}<span>${entry.title}</span><span class="mission-index-status" title="${statuses[entryStatus]}">${statuses[entryStatus]}</span>
        </button>`;
      }).join('')}</section>`).join('')}
    </nav>
    <section class="mission-page" aria-labelledby="mission-active-title">
      <p class="mission-status" data-status="${status}">${icon(symbols[status])}${statuses[status]}</p>
      <h3 id="mission-active-title">${mission.title}</h3>
      <ul>${mission.objectives.map(([key,target,label])=>`<li>${icon(stats[key]>=target?'circle-check':'flag')}
        <span>${label}</span><strong>${fmt.format(Math.min(stats[key],target))} / ${fmt.format(target)}</strong></li>`).join('')}</ul>
      <div class="mission-reward"><strong>+${fmt.format(mission.xp)} XP</strong>
        ${status==='ready'&&!notice?`<button type="button" class="primary" data-action="mission-claim" data-value="${mission.id}">Resgatar XP</button>`:''}
      </div>
      ${notice?`<p class="mission-note">${notice}</p>`:status==='locked'?'<p class="mission-note">Conclua as missões anteriores para liberar esta etapa.</p>':''}
    </section>
  </div>`;
}
