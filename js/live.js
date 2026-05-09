const FIGHT_FIRST = [
  'Kael', 'Sova', 'Gorrath', 'Pyra', 'Malgrath', 'Drav', 'Ixen',
  'Theron', 'Lyra', 'Vorn', 'Crael', 'Zeth', 'Runa', 'Brek', 'Asha',
  'Thorn', 'Vex', 'Sera', 'Oryn', 'Dusk',
];

const FIGHT_LAST = [
  'the Undying', 'Nightblade', 'Ironwall', 'Ashborn', 'Wraithbane',
  'Stormcall', 'Shadowmere', 'Coldstrike', 'Darkfire', 'the Bold',
  'Blackthorn', 'Voidwalker', 'Grimfang', 'Emberveil', 'Stoneheart',
];

const ARENAS = ['The Rust Cage', 'The Pit', 'The Street', 'The Gallows'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickName(usedNames) {
  let name;
  do {
    name = `${FIGHT_FIRST[randInt(0, FIGHT_FIRST.length - 1)]} ${FIGHT_LAST[randInt(0, FIGHT_LAST.length - 1)]}`;
  } while (usedNames.has(name));
  usedNames.add(name);
  return name;
}

function hpColor(hp) {
  if (hp > 50) return '#28c840';
  if (hp > 25) return '#febc2e';
  return '#ff5f57';
}

function nowStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

// --- State ---

const liveState = {
  fights: [],
  selectedId: null,
  bets: {},
  entryRewards: {},
};

const LIVE_PERSIST_KEY = 'colosseum_live';

function saveLiveState() {
  const data = {
    fights: liveState.fights.map(f => ({
      id: f.id, arena: f.arena, round: f.round,
      nameA: f.nameA, nameB: f.nameB,
      hpA: f.hpA, hpB: f.hpB,
      log: f.log.slice(0, 30),
      status: f.status, winner: f.winner,
    })),
    bets: liveState.bets,
    entryRewards: liveState.entryRewards,
  };
  localStorage.setItem(LIVE_PERSIST_KEY, JSON.stringify(data));
}

function loadLiveState() {
  try {
    const data = JSON.parse(localStorage.getItem(LIVE_PERSIST_KEY));
    if (!data || !Array.isArray(data.fights) || data.fights.length !== ARENAS.length) return null;
    return data;
  } catch { return null; }
}

// --- Fight simulation ---

function createFight(id, usedNames) {
  return {
    id,
    arena: ARENAS[id - 1],
    round: randInt(1, 5),
    nameA: pickName(usedNames),
    nameB: pickName(usedNames),
    hpA: 100,
    hpB: 100,
    log: [],
    status: 'ongoing',
    winner: null,
    tickTimeout: null,
  };
}

function fightTick(fight) {
  if (fight.status !== 'ongoing') return;

  const reward   = liveState.entryRewards[fight.id];
  const NPC_SPD  = 7;
  const atkChance = (reward?.spd != null)
    ? reward.spd / (reward.spd + NPC_SPD)
    : 0.5;
  const atkA  = Math.random() < atkChance;
  const atker = atkA ? fight.nameA : fight.nameB;
  const defdr = atkA ? fight.nameB : fight.nameA;
  const roll  = Math.random();

  const isPlayer       = reward?.atk != null &&
    ((atkA && reward.playerSide === 'A') || (!atkA && reward.playerSide === 'B'));
  const npcHitsPlayer  = reward?.def != null &&
    ((!atkA && reward.playerSide === 'A') || (atkA && reward.playerSide === 'B'));

  let text, dmg = 0;

  if (roll < 0.12) {
    text = `${defdr} dodges ${atker}'s strike!`;
  } else if (roll < 0.28) {
    const raw = isPlayer ? randInt(1, 3) + reward.atk : randInt(22, 35);
    dmg  = npcHitsPlayer ? Math.max(1, raw - Math.floor(reward.def / 2)) : raw;
    text = `${atker} lands a critical hit on ${defdr} for ${dmg}!`;
    if (atkA) fight.hpB = Math.max(0, fight.hpB - dmg);
    else      fight.hpA = Math.max(0, fight.hpA - dmg);
  } else {
    const raw = isPlayer ? randInt(1, 3) + reward.atk : randInt(8, 18);
    dmg  = npcHitsPlayer ? Math.max(1, raw - Math.floor(reward.def / 2)) : raw;
    text = `${atker} strikes ${defdr} for ${dmg}.`;
    if (atkA) fight.hpB = Math.max(0, fight.hpB - dmg);
    else      fight.hpA = Math.max(0, fight.hpA - dmg);
  }

  const entry = { time: nowStr(), text };
  fight.log.unshift(entry);

  const isKO = fight.hpA <= 0 || fight.hpB <= 0;
  if (isKO) {
    fight.status = 'finished';
    fight.winner = fight.hpA <= 0 ? 'B' : 'A';
    const winName = fight.winner === 'A' ? fight.nameA : fight.nameB;
    fight.log.unshift({ time: nowStr(), text: `\u{1F480} ${winName} wins by knockout!` });
    resolveBet(fight);
    resolveEntry(fight);
    markFightEntryFinished(fight.id);
    scheduleArenaRefresh(fight.arena);
  }

  if (String(fight.id) === String(liveState.selectedId)) {
    patchFight(fight, entry, isKO);
  }

  saveLiveState();

  if (!isKO) scheduleTick(fight);
}

function scheduleTick(fight) {
  fight.tickTimeout = setTimeout(() => fightTick(fight), randInt(2800, 5500));
}

function scheduleArenaRefresh(arenaName) {
  fetch('/api/upcoming-fights/refresh-arena', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ arena: arenaName }),
  })
    .then(r => r.json())
    .then(newFight => {
      if (newFight && newFight.id && typeof window.refreshUpcomingArena === 'function') {
        window.refreshUpcomingArena(newFight);
      }
    })
    .catch(() => {});
}

function resolveEntry(fight) {
  const reward = liveState.entryRewards[fight.id];
  if (!reward) return;

  const won = fight.winner === reward.playerSide;

  if (won) {
    coins += reward.prize;
    updateCoinsDisplay();
    if (typeof api !== 'undefined' && api.isLoggedIn()) api.put('/api/me', { coins });
  }

  if (reward.fighterId || reward.fighterName) {
    let f = typeof fighters !== 'undefined'
      ? fighters.find(f => String(f.id) === String(reward.fighterId))
      : null;
    if (!f && reward.fighterName && typeof fighters !== 'undefined')
      f = fighters.find(f => f.name === reward.fighterName);

    if (f) {
      if (won) f.wins = (f.wins || 0) + 1;
      else     f.losses = (f.losses || 0) + 1;
    }

    if (typeof setFighterRecovery === 'function') {
      const status     = won ? 'resting' : 'injured';
      const recoveryMs = won ? RECOVERY_RESTING_MS : RECOVERY_INJURED_MS;
      setFighterRecovery(reward.fighterId, status, Date.now() + recoveryMs, reward.fighterName);
    }
  }

  delete liveState.entryRewards[fight.id];
}

function resolveBet(fight) {
  const bet = liveState.bets[fight.id];
  if (!bet || bet.resolved) return;
  if (bet.side === fight.winner) {
    coins += bet.amount * 2;
    bet.resolved = 'won';
  } else {
    bet.resolved = 'lost';
  }
  updateCoinsDisplay();
  if (typeof api !== 'undefined' && api.isLoggedIn()) {
    api.put('/api/me', { coins });
  }
}

// --- DOM patches (no full re-render) ---

function patchFight(fight, lastEntry, isKO) {
  const hpFillA = document.getElementById(`hp-a-${fight.id}`);
  const hpFillB = document.getElementById(`hp-b-${fight.id}`);
  const hpValA  = document.getElementById(`hp-val-a-${fight.id}`);
  const hpValB  = document.getElementById(`hp-val-b-${fight.id}`);

  if (hpFillA) { hpFillA.style.width = fight.hpA + '%'; hpFillA.style.background = hpColor(fight.hpA); }
  if (hpFillB) { hpFillB.style.width = fight.hpB + '%'; hpFillB.style.background = hpColor(fight.hpB); }
  if (hpValA)  hpValA.textContent = fight.hpA + ' HP';
  if (hpValB)  hpValB.textContent = fight.hpB + ' HP';

  const log = document.getElementById(`fight-log-${fight.id}`);
  if (log) {
    const el = document.createElement('div');
    el.className = 'fight-log-entry';
    el.innerHTML = `<span class="log-time">${lastEntry.time}</span>${lastEntry.text}`;
    log.prepend(el);
    if (isKO && fight.log.length > 0) {
      const koEl = document.createElement('div');
      koEl.className = 'fight-log-entry log-entry-ko';
      koEl.innerHTML = `<span class="log-time">${fight.log[0].time}</span>${fight.log[0].text}`;
      log.prepend(koEl);
    }
    while (log.children.length > 50) log.lastChild.remove();
  }

  if (isKO) {
    const detail = document.getElementById(`fight-detail-${fight.id}`);
    if (detail) {
      const betSection = detail.querySelector('.bet-section');
      if (betSection) betSection.outerHTML = buildBetHTML(fight, liveState.bets[fight.id]);
    }
  }
}

function markFightEntryFinished(fightId) {
  const entry = document.querySelector(`.fight-entry[data-fight="${fightId}"]`);
  if (entry) entry.classList.add('finished');
}

// --- Bet UI ---

function buildBetHTML(fight, bet) {
  if (fight.status === 'finished') {
    if (!bet) {
      const w = fight.winner === 'A' ? fight.nameA : fight.nameB;
      return `<div class="bet-section bet-finished">Fight over — ${w} wins!</div>`;
    }
    if (bet.resolved === 'won') return `<div class="bet-section bet-won">You won! +${bet.amount} coins profit</div>`;
    return `<div class="bet-section bet-lost">You lost ${bet.amount} coins.</div>`;
  }

  if (bet) {
    const on = bet.side === 'A' ? fight.nameA : fight.nameB;
    return `<div class="bet-section bet-placed">🪙 ${bet.amount} coins on ${on}</div>`;
  }

  return `
    <div class="bet-section" id="bet-section-${fight.id}">
      <div class="bet-label">Place a Bet</div>
      <div class="bet-controls">
        <button class="bet-side-btn active" data-side="A">${fight.nameA.split(' ')[0]}</button>
        <button class="bet-side-btn" data-side="B">${fight.nameB.split(' ')[0]}</button>
        <input class="bet-input" id="bet-input-${fight.id}" type="number" min="1" value="10" placeholder="Coins">
        <button class="bet-confirm-btn" id="bet-confirm-${fight.id}">Bet</button>
      </div>
    </div>
  `;
}

function attachBetListeners(fight) {
  const section = document.getElementById(`bet-section-${fight.id}`);
  if (!section) return;

  let selectedSide = 'A';

  section.querySelectorAll('.bet-side-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSide = btn.dataset.side;
      section.querySelectorAll('.bet-side-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  const confirmBtn = document.getElementById(`bet-confirm-${fight.id}`);
  if (!confirmBtn) return;

  confirmBtn.addEventListener('click', () => {
    if (fight.status !== 'ongoing') return;
    const input  = document.getElementById(`bet-input-${fight.id}`);
    const amount = parseInt(input?.value, 10);
    if (!amount || amount < 1 || amount > coins) return;

    coins -= amount;
    liveState.bets[fight.id] = { side: selectedSide, amount };
    updateCoinsDisplay();

    if (typeof api !== 'undefined' && api.isLoggedIn()) {
      api.put('/api/me', { coins });
    }

    section.outerHTML = buildBetHTML(fight, liveState.bets[fight.id]);
    saveLiveState();
  });
}

// --- Render ---

function renderLiveDetail(fight) {
  const main = document.querySelector('.live-main');
  if (!fight) {
    main.innerHTML = `
      <div class="live-empty">
        <div class="live-empty-icon">&#x1F4E1;</div>
        <div class="live-empty-label">Select a fight</div>
      </div>
    `;
    return;
  }

  main.innerHTML = `
    <div class="fight-detail" id="fight-detail-${fight.id}">
      <div class="fight-contestants">
        <div class="contestant">
          <div class="contestant-name">${fight.nameA}</div>
          <div class="contestant-hp-track">
            <div class="contestant-hp-fill" id="hp-a-${fight.id}"
              style="width:${fight.hpA}%;background:${hpColor(fight.hpA)}"></div>
          </div>
          <div class="contestant-hp-val" id="hp-val-a-${fight.id}">${fight.hpA} HP</div>
        </div>
        <div class="fight-vs">VS</div>
        <div class="contestant contestant-right">
          <div class="contestant-name">${fight.nameB}</div>
          <div class="contestant-hp-track contestant-hp-track-r">
            <div class="contestant-hp-fill" id="hp-b-${fight.id}"
              style="width:${fight.hpB}%;background:${hpColor(fight.hpB)}"></div>
          </div>
          <div class="contestant-hp-val" id="hp-val-b-${fight.id}">${fight.hpB} HP</div>
        </div>
      </div>

      ${buildBetHTML(fight, liveState.bets[fight.id])}

      <div class="fight-log-label">Action Log</div>
      <div class="fight-log" id="fight-log-${fight.id}">
        ${fight.log.map(e =>
          `<div class="fight-log-entry"><span class="log-time">${e.time}</span>${e.text}</div>`
        ).join('')}
      </div>
    </div>
  `;

  attachBetListeners(fight);
}

function renderFightList() {
  const selector = document.getElementById('live-selector');
  selector.querySelectorAll('.fight-entry').forEach(el => el.remove());

  liveState.fights.forEach((fight, idx) => {
    const entry = document.createElement('div');
    const finished = fight.status === 'finished';
    entry.className = 'fight-entry' + (idx === 0 ? ' active' : '') + (finished ? ' finished' : '');
    entry.dataset.fight = fight.id;
    entry.innerHTML = `
      <div class="fight-entry-top">
        <div class="live-dot"></div>
        <span class="fight-number">${fight.arena}</span>
        <span class="fight-round">Rnd ${fight.round}</span>
      </div>
      <div class="fight-matchup">${fight.nameA} vs ${fight.nameB}</div>
    `;
    entry.addEventListener('click', () => {
      document.querySelectorAll('.fight-entry').forEach(e => e.classList.remove('active'));
      entry.classList.add('active');
      liveState.selectedId = fight.id;
      renderLiveDetail(liveState.fights.find(f => f.id === fight.id));
    });
    selector.appendChild(entry);
  });
}

// --- Init ---

(function init() {
  const saved = loadLiveState();

  if (saved) {
    saved.fights.forEach(s => liveState.fights.push({ ...s, tickTimeout: null }));
    Object.assign(liveState.bets, saved.bets || {});
    Object.assign(liveState.entryRewards, saved.entryRewards || {});
  } else {
    const usedNames = new Set();
    for (let i = 1; i <= ARENAS.length; i++) {
      liveState.fights.push(createFight(i, usedNames));
    }
  }

  renderFightList();

  if (liveState.fights.length > 0) {
    liveState.selectedId = liveState.fights[0].id;
    renderLiveDetail(liveState.fights[0]);
  }

  liveState.fights.forEach(f => { if (f.status === 'ongoing') scheduleTick(f); });
})();

// --- Transition from upcoming ---

window.startArenaFight = function(upcomingFight, entry) {
  const idx = liveState.fights.findIndex(f => f.arena === upcomingFight.name);
  if (idx === -1) return;

  const old = liveState.fights[idx];
  if (old.tickTimeout) clearTimeout(old.tickTimeout);
  delete liveState.bets[old.id];
  delete liveState.entryRewards[old.id];

  const fighterName = (entry && entry.fighterName)
    ? entry.fighterName
    : pickName(new Set([upcomingFight.opponent]));

  const newFight = {
    id: old.id,
    arena: upcomingFight.name,
    round: randInt(1, 5),
    nameA: fighterName,
    nameB: upcomingFight.opponent,
    hpA: 100,
    hpB: 100,
    log: [{ time: nowStr(), text: `The fight begins in ${upcomingFight.name}!` }],
    status: 'ongoing',
    winner: null,
    tickTimeout: null,
  };

  liveState.fights[idx] = newFight;

  if (entry) {
    let playerAtk = null, playerDef = null, playerSpd = null;
    if (typeof fighters !== 'undefined') {
      const f = fighters.find(f => String(f.id) === String(entry.fighterId))
             || fighters.find(f => f.name === entry.fighterName);
      if (f) {
        if (typeof getEffectiveAtk === 'function') playerAtk = getEffectiveAtk(f);
        if (typeof getEffectiveDef === 'function') playerDef = getEffectiveDef(f);
        if (typeof getEffectiveSpd === 'function') playerSpd = getEffectiveSpd(f);
      }
    }
    liveState.entryRewards[newFight.id] = {
      prize: entry.prize,
      playerSide: 'A',
      fighterId: entry.fighterId,
      fighterName: entry.fighterName,
      atk: playerAtk,
      def: playerDef,
      spd: playerSpd,
    };
  }

  // Update sidebar entry
  const sidebarEl = document.querySelector(`.fight-entry[data-fight="${old.id}"]`);
  if (sidebarEl) {
    sidebarEl.classList.remove('finished');
    const numEl   = sidebarEl.querySelector('.fight-number');
    const matchEl = sidebarEl.querySelector('.fight-matchup');
    if (numEl)   numEl.textContent   = newFight.arena;
    if (matchEl) matchEl.textContent = `${newFight.nameA} vs ${newFight.nameB}`;
  }

  if (String(liveState.selectedId) === String(newFight.id)) {
    renderLiveDetail(newFight);
  }

  saveLiveState();
  scheduleTick(newFight);
};
