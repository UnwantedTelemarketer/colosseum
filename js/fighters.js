const RECRUIT_COST = 100;
const MAX_SLOTS = 6;

const RECOVERY_KEY        = 'colosseum_recovery';
const RECOVERY_RESTING_MS = 5  * 60 * 1000;
const RECOVERY_INJURED_MS = 20 * 60 * 1000;

let recoveryDisplayInterval = null;

function getRecoveryTimes() {
  try { return JSON.parse(localStorage.getItem(RECOVERY_KEY)) || {}; }
  catch { return {}; }
}

function saveRecoveryTimes(obj) {
  localStorage.setItem(RECOVERY_KEY, JSON.stringify(obj));
}

function formatRecovery(ms) {
  if (ms <= 0) return 'Ready soon...';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function setFighterRecovery(fighterId, status, recoverAt, fighterName) {
  let f = fighters.find(f => String(f.id) === String(fighterId));
  if (!f && fighterName) f = fighters.find(f => f.name === fighterName);
  if (!f) return;
  f.status = status;
  const times = getRecoveryTimes();
  times[f.name] = { recoverAt, setAt: Date.now() };
  saveRecoveryTimes(times);
  renderFighters();
  if (typeof api !== 'undefined' && api.isLoggedIn()) {
    api.put('/api/me/fighters', { fighters });
  }
}

function checkRecovery() {
  const times = getRecoveryTimes();
  const now = Date.now();
  let changed = false;
  fighters.forEach(f => {
    if (f.status === 'resting' || f.status === 'injured') {
      const rec = times[f.name];
      if (rec && now >= rec.recoverAt) {
        f.status = 'ready';
        delete times[f.name];
        changed = true;
      }
    }
  });
  if (changed) {
    saveRecoveryTimes(times);
    renderFighters();
    if (typeof api !== 'undefined' && api.isLoggedIn()) {
      api.put('/api/me/fighters', { fighters });
    }
  }
}

window.gameState = { teamName: null };

let coins = 100;
let fighters = [];
let selectedFighterId = null;

const CLASSES = [
  { name: 'Fighter', icon: '⚔️', atk: 5, def: 5, spd: [5, 10] },
];

const FIRST_NAMES = [
  'Kael', 'Sova', 'Gorrath', 'Pyra', 'Malgrath', 'Drav', 'Ixen',
  'Theron', 'Lyra', 'Vorn', 'Crael', 'Zeth', 'Runa', 'Brek', 'Asha',
  'Thorn', 'Vex', 'Sera', 'Oryn', 'Dusk',
];

const LAST_NAMES = [
  'the Undying', 'Nightblade', 'Ironwall', 'Ashborn', 'Wraithbane',
  'Stormcall', 'Shadowmere', 'Coldstrike', 'Darkfire', 'the Bold',
  'Blackthorn', 'Voidwalker', 'Grimfang', 'Emberveil', 'Stoneheart',
];

const INVENTORY = {
  armor:  [{ id: 'bronze_armor', name: 'Bronze Armor',        icon: '⛓', color: '#CD7F32', desc: '+5 DEF', defBonus: 5 }],
  weapon: [{ id: 'bronze_sword', name: 'Bronze Shortsword',   icon: '⚔', color: '#CD7F32',  desc: '+5 ATK', atkBonus: 5 }],
  shield: [{ id: 'bronze_shield',name: 'Bronze Shield',       icon: '⛊', color: '#CD7F32',  desc: '+3 DEF', defBonus: 3 }],
};

function getEffectiveAtk(fighter) {
  let atk = fighter.atk || 0;
  const weapon = fighter.equipment?.weapon;
  if (weapon) {
    const inv = (INVENTORY.weapon || []).find(w => w.id === weapon.id);
    atk += inv?.atkBonus || weapon.atkBonus || 0;
  }
  return atk;
}

function getEffectiveSpd(fighter) {
  return fighter.spd || 0;
}

function getEffectiveDef(fighter) {
  let def = fighter.def !== undefined ? fighter.def : (fighter.defense || 0);
  const armor = fighter.equipment?.armor;
  if (armor) {
    const inv = (INVENTORY.armor || []).find(a => a.id === armor.id);
    def += inv?.defBonus || armor.defBonus || 0;
  }
  const shield = fighter.equipment?.shield;
  if (shield) {
    const inv = (INVENTORY.shield || []).find(s => s.id === shield.id);
    def += inv?.defBonus || shield.defBonus || 0;
  }
  return def;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function statValue(val) {
  return Array.isArray(val) ? rand(...val) : val;
}

function generateFighter() {
  const cls = pick(CLASSES);
  const atk = statValue(cls.atk);
  const def = statValue(cls.def);
  const spd = statValue(cls.spd);
  return {
    id: Date.now() + Math.random(),
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    class: cls.name,
    icon: cls.icon,
    atk,
    def,
    spd,
    wins: 0,
    losses: 0,
    status: 'ready',
    atk_xp: atk * 10,
    def_xp: def * 10,
    spd_xp: spd * 10,
    equipment: { armor: null, weapon: null, shield: null },
  };
}

function updateCoinsDisplay() {
  document.getElementById('coins-tab').textContent = `${coins} Coins`;
}

// --- Equipment picker ---

function openEquipPicker(fighterId, slotType) {
  const f = fighters.find(f => String(f.id) === String(fighterId));
  if (!f) return;
  if (!f.equipment) f.equipment = { armor: null, weapon: null, shield: null };

  const items = INVENTORY[slotType] || [];
  const current = f.equipment[slotType];
  const label = slotType.charAt(0).toUpperCase() + slotType.slice(1);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'equip-picker-overlay';

  overlay.innerHTML = `
    <div class="equip-picker">
      <div class="icon-modal-header">
        <span>Select ${label}</span>
        <button class="modal-close" id="equip-close-btn">×</button>
      </div>
      <div class="equip-picker-list">
        ${items.map(item => `
          <div class="equip-picker-item${current && current.id === item.id ? ' equip-selected' : ''}" data-item-id="${item.id}">
            <div class="equip-picker-item-icon" style="color:${item.color}">${item.icon}</div>
            <div class="equip-picker-item-info">
              <div class="equip-picker-item-name">${item.name}</div>
              <div class="equip-picker-item-desc">${item.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#equip-close-btn').addEventListener('click', closeEquipPicker);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeEquipPicker(); });

  overlay.querySelectorAll('.equip-picker-item').forEach(el => {
    el.addEventListener('click', () => {
      equipItem(fighterId, slotType, el.dataset.itemId || null);
      closeEquipPicker();
    });
  });
}

function closeEquipPicker() {
  const overlay = document.getElementById('equip-picker-overlay');
  if (overlay) overlay.remove();
}

function equipItem(fighterId, slotType, itemId) {
  const f = fighters.find(f => String(f.id) === String(fighterId));
  if (!f) return;
  if (!f.equipment) f.equipment = { armor: null, weapon: null, shield: null };

  if (itemId) {
    f.equipment[slotType] = (INVENTORY[slotType] || []).find(i => i.id === itemId) || null;
  } else {
    f.equipment[slotType] = null;
  }

  renderFighterDetail(fighterId);

  if (typeof api !== 'undefined' && api.isLoggedIn()) {
    api.put('/api/me/fighters', { fighters });
  }
}

// --- Detail panel ---

function slotHTML(slotType, label, emptyIcon, equipment) {
  const item = equipment?.[slotType] || null;
  return `
    <div class="equipment-slot${item ? ' equipped' : ''}" data-slot-type="${slotType}">
      <div class="equipment-slot-icon" style="${item ? `opacity:1; color:${item.color}` : ''}">${item ? item.icon : emptyIcon}</div>
      <div class="equipment-slot-type">${label}</div>
      <div class="equipment-slot-name">${item ? item.name : 'Empty'}</div>
    </div>
  `;
}

function renderFighterDetail(id) {
  if (recoveryDisplayInterval) {
    clearInterval(recoveryDisplayInterval);
    recoveryDisplayInterval = null;
  }

  const main = document.getElementById('roster-main');
  const f = fighters.find(f => String(f.id) === String(id));

  if (!f) {
    main.innerHTML = `
      <div class="roster-main-empty">
        <div class="roster-empty-icon">⚔️</div>
        <div class="roster-empty-label">${fighters.length ? 'Select a fighter' : 'No fighters yet'}</div>
      </div>
    `;
    return;
  }

  if (!f.equipment) f.equipment = { armor: null, weapon: null, shield: null };
  const baseDef  = f.def !== undefined ? f.def : (f.defense || 0);
  const effAtk   = getEffectiveAtk(f);
  const effDef   = getEffectiveDef(f);
  const atkBonus = effAtk - f.atk;
  const defBonus = effDef - baseDef;

  const statXp = (bonus, xp) => bonus > 0
    ? `<span class="stat-bonus">+${bonus}</span>`
    : (xp != null ? xp + ' xp' : '');

  main.innerHTML = `
    <div class="fighter-detail">
      <div class="fighter-detail-header">
        <div class="fighter-detail-icon">${f.icon}</div>
        <div class="fighter-detail-identity">
          <div class="fighter-detail-name">${f.name}</div>
          <div class="fighter-detail-meta">
            <span class="fighter-detail-class">${f.class}</span>
            <span class="fighter-status status-${f.status}">${f.status}</span>
          </div>
        </div>
      </div>

      <div class="fighter-detail-stats">
        <div class="detail-stat">
          <div class="detail-stat-label">ATK</div>
          <div class="detail-stat-bar-track"><div class="detail-stat-bar-fill" style="width:${Math.min(effAtk, 100)}%"></div></div>
          <div class="detail-stat-value${atkBonus > 0 ? ' stat-boosted' : ''}">${effAtk}</div>
          <div class="detail-stat-xp">${statXp(atkBonus, f.atk_xp)}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">DEF</div>
          <div class="detail-stat-bar-track"><div class="detail-stat-bar-fill" style="width:${Math.min(effDef, 100)}%"></div></div>
          <div class="detail-stat-value${defBonus > 0 ? ' stat-boosted' : ''}">${effDef}</div>
          <div class="detail-stat-xp">${statXp(defBonus, f.def_xp)}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">SPD</div>
          <div class="detail-stat-bar-track"><div class="detail-stat-bar-fill" style="width:${f.spd}%"></div></div>
          <div class="detail-stat-value">${f.spd}</div>
          <div class="detail-stat-xp">${f.spd_xp != null ? f.spd_xp + ' xp' : ''}</div>
        </div>
      </div>

      <div class="fighter-detail-record">
        <span class="record-wins">${f.wins}W</span>
        <span class="record-sep">/</span>
        <span class="record-losses">${f.losses}L</span>
        <span class="record-label">career</span>
      </div>

      ${(() => {
        if (f.status === 'ready') return '';
        const times = getRecoveryTimes();
        const rec   = times[f.name];
        if (!rec) return '';
        const now       = Date.now();
        const remaining = Math.max(0, rec.recoverAt - now);
        const pct       = Math.max(0, Math.min(100, (1 - remaining / (rec.recoverAt - rec.setAt)) * 100));
        const injured   = f.status === 'injured';
        return `
          <div class="recovery-section">
            <div class="recovery-top">
              <span class="equipment-section-label">${injured ? 'Injured' : 'Resting'}</span>
              <span class="recovery-time" id="recovery-time-${f.id}">${formatRecovery(remaining)}</span>
            </div>
            <div class="recovery-track">
              <div class="recovery-fill${injured ? ' recovery-fill-injured' : ''}" id="recovery-fill-${f.id}" style="width:${pct}%"></div>
            </div>
            <div class="recovery-desc">${injured ? 'KO — extended recovery period' : 'Recovering after fight'}</div>
          </div>
        `;
      })()}

      <div class="fighter-detail-equipment">
        <div class="equipment-section-label">Equipment</div>
        <div class="equipment-slots">
          ${slotHTML('armor',  'Armor',  '~', f.equipment)}
          ${slotHTML('weapon', 'Weapon', '~', f.equipment)}
          ${slotHTML('shield', 'Shield', '~', f.equipment)}
        </div>
        <div class="equipment-unequip-row">
          ${['armor', 'weapon', 'shield'].map(slot => `
            <div class="equipment-unequip-cell">
              ${f.equipment[slot] ? `<button class="unequip-btn" data-slot="${slot}">Remove</button>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  main.querySelectorAll('.equipment-slot').forEach(slot => {
    slot.addEventListener('click', () => openEquipPicker(id, slot.dataset.slotType));
  });

  main.querySelectorAll('.unequip-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      equipItem(id, btn.dataset.slot, null);
    });
  });

  if (f && f.status !== 'ready') {
    const times = getRecoveryTimes();
    const rec   = times[f.name];
    if (rec) {
      recoveryDisplayInterval = setInterval(() => {
        const now       = Date.now();
        const remaining = rec.recoverAt - now;
        if (remaining <= 0) {
          clearInterval(recoveryDisplayInterval);
          recoveryDisplayInterval = null;
          checkRecovery();
          return;
        }
        const pct    = Math.max(0, Math.min(100, (1 - remaining / (rec.recoverAt - rec.setAt)) * 100));
        const timeEl = document.getElementById(`recovery-time-${f.id}`);
        const fillEl = document.getElementById(`recovery-fill-${f.id}`);
        if (timeEl) timeEl.textContent  = formatRecovery(remaining);
        if (fillEl) fillEl.style.width  = pct + '%';
      }, 1000);
    }
  }
}

// --- Sidebar ---

function selectFighter(id) {
  selectedFighterId = id;
  document.querySelectorAll('.roster-entry').forEach(e => {
    e.classList.toggle('active', String(e.dataset.fighterId) === String(id));
  });
  renderFighterDetail(id);
}

function renderFighters() {
  const sidebar = document.getElementById('roster-sidebar');

  sidebar.querySelectorAll('.roster-entry, .roster-recruit').forEach(el => el.remove());

  fighters.forEach(f => {
    const entry = document.createElement('div');
    entry.className = 'roster-entry' + (String(f.id) === String(selectedFighterId) ? ' active' : '');
    entry.dataset.fighterId = f.id;
    entry.innerHTML = `
      <div class="roster-entry-icon">${f.icon}</div>
      <div class="roster-entry-info">
        <div class="roster-entry-name">${f.name}</div>
        <div class="roster-entry-class">${f.class}</div>
      </div>
      <div class="roster-entry-dot dot-${f.status}"></div>
    `;
    entry.addEventListener('click', () => selectFighter(f.id));
    sidebar.appendChild(entry);
  });

  if (fighters.length < MAX_SLOTS) {
    const noTeam     = !window.gameState.teamName;
    const cantAfford = coins < RECRUIT_COST;
    const recruit    = document.createElement('div');

    if (noTeam || cantAfford) {
      recruit.className = 'roster-recruit';
      recruit.innerHTML = `
        <div class="roster-recruit-icon">+</div>
        <span>${noTeam ? 'Create a team first' : `Need ${RECRUIT_COST - coins} more coins`}</span>
      `;
    } else {
      recruit.className = 'roster-recruit clickable';
      recruit.innerHTML = `
        <div class="roster-recruit-icon">+</div>
        <span>Recruit (100 coins)</span>
      `;
      recruit.addEventListener('click', recruitFighter);
    }
    sidebar.appendChild(recruit);
  }

  document.getElementById('fighters-count').textContent =
    `Your Roster — ${fighters.length} / ${MAX_SLOTS}`;

  if (typeof renderProfileStats === 'function') renderProfileStats();

  const stillSelected = fighters.find(f => String(f.id) === String(selectedFighterId));
  if (stillSelected) {
    renderFighterDetail(selectedFighterId);
  } else if (fighters.length > 0) {
    selectFighter(fighters[0].id);
  } else {
    renderFighterDetail(null);
  }
}

function recruitFighter() {
  if (coins < RECRUIT_COST || fighters.length >= MAX_SLOTS) return;
  const newFighter = generateFighter();
  coins -= RECRUIT_COST;
  fighters.push(newFighter);
  selectedFighterId = newFighter.id;
  updateCoinsDisplay();
  renderFighters();
  if (typeof api !== 'undefined' && api.isLoggedIn()) {
    api.put('/api/me/fighters', { fighters });
    api.put('/api/me', { coins });
  }
}

updateCoinsDisplay();
renderFighters();
checkRecovery();
setInterval(checkRecovery, 10000);
