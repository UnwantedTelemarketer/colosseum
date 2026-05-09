(function () {
  let fights = [];
  let timerInterval = null;
  const transitioned = new Set();

  const ENTRIES_KEY = 'colosseum_entries';

  function getEntries() {
    try { return JSON.parse(localStorage.getItem(ENTRIES_KEY)) || {}; }
    catch { return {}; }
  }

  function saveEntries(obj) {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(obj));
  }

  function cleanEntries() {
    const valid = new Set(fights.map(f => String(f.id)));
    const cleaned = Object.fromEntries(
      Object.entries(getEntries()).filter(([k]) => valid.has(k))
    );
    saveEntries(cleaned);
  }

  function formatCountdown(ms) {
    if (ms <= 0) return 'Starting...';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function openFighterPicker(fightId) {
    const myFighters = typeof fighters !== 'undefined' ? fighters : [];
    if (!myFighters.length) return;

    const entries    = getEntries();
    const current    = entries[String(fightId)];
    const occupiedIds = new Set(
      Object.entries(entries)
        .filter(([k]) => k !== String(fightId))
        .map(([, v]) => String(v.fighterId))
    );

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'fighter-pick-overlay';
    overlay.innerHTML = `
      <div class="equip-picker">
        <div class="icon-modal-header">
          <span>Choose Fighter</span>
          <button class="modal-close" id="fighter-pick-close">×</button>
        </div>
        <div class="equip-picker-list">
          ${myFighters.map(f => {
            const isSelected  = current && String(current.fighterId) === String(f.id);
            const isOccupied  = occupiedIds.has(String(f.id));
            const isNotReady  = f.status !== 'ready';
            const unavailable = isOccupied || isNotReady;
            const def = f.def ?? f.defense ?? 0;
            let subtext = `${f.class} · ${f.atk} ATK / ${def} DEF`;
            if (isOccupied) subtext = 'Entered in another fight';
            else if (f.status === 'injured') subtext = 'Injured — recovering';
            else if (f.status === 'resting') subtext = 'Resting — recovering';
            return `
              <div class="equip-picker-item${isSelected ? ' equip-selected' : ''}${unavailable ? ' equip-picker-occupied' : ''}"
                   data-fighter-id="${f.id}"${unavailable ? ' data-occupied="1"' : ''}>
                <div class="equip-picker-item-icon">${f.icon}</div>
                <div class="equip-picker-item-info">
                  <div class="equip-picker-item-name">${f.name}</div>
                  <div class="equip-picker-item-desc">${subtext}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('#fighter-pick-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelectorAll('.equip-picker-item:not([data-occupied])').forEach(el => {
      el.addEventListener('click', () => {
        const fighter = myFighters.find(f => String(f.id) === el.dataset.fighterId);
        if (fighter) enterFight(fightId, fighter);
        overlay.remove();
      });
    });
  }

  function enterFight(fightId, fighter) {
    const fight = fights.find(f => String(f.id) === String(fightId));
    if (!fight) return;

    if (typeof coins === 'undefined' || coins < fight.entry) return;

    coins -= fight.entry;
    if (typeof updateCoinsDisplay === 'function') updateCoinsDisplay();
    if (typeof api !== 'undefined' && api.isLoggedIn()) api.put('/api/me', { coins });

    const entries = getEntries();
    entries[String(fightId)] = {
      fighterId: fighter.id,
      fighterName: fighter.name,
      prize: fight.prize,
      entry: fight.entry,
    };
    saveEntries(entries);
    renderUpcoming();
  }

  function withdrawFight(fightId) {
    const entries = getEntries();
    const entry   = entries[String(fightId)];
    if (!entry) return;

    // Refund
    if (typeof coins !== 'undefined') {
      coins += entry.entry || 0;
      if (typeof updateCoinsDisplay === 'function') updateCoinsDisplay();
      if (typeof api !== 'undefined' && api.isLoggedIn()) api.put('/api/me', { coins });
    }

    delete entries[String(fightId)];
    saveEntries(entries);
    renderUpcoming();
  }

  function renderUpcoming() {
    const container = document.getElementById('tab-upcoming');
    if (!container) return;

    const loggedIn   = api.isLoggedIn();
    const myFighters = typeof fighters !== 'undefined' ? fighters : [];
    const entries    = getEntries();

    if (!fights.length) {
      container.innerHTML = `
        <div class="upcoming-header">
          <span class="upcoming-title">Upcoming Fights</span>
        </div>
        <div class="upcoming-empty">
          <div class="upcoming-empty-icon">...</div>
          <div class="upcoming-empty-label">No fights scheduled</div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="upcoming-header">
          <span class="upcoming-title">Upcoming Fights — 4 Arenas</span>
        </div>
        <div class="upcoming-list">
          ${fights.map(f => {
            const remaining  = new Date(f.starts_at).getTime() - Date.now();
            const entry      = entries[String(f.id)];
            const isLive     = transitioned.has(f.id) || remaining <= 0;

            let entryHTML;
            if (isLive) {
              entryHTML = `<span class="upcoming-now-live">&#x26A1; Now Live</span>`;
            } else if (entry) {
              const icon = (myFighters.find(mf => String(mf.id) === String(entry.fighterId)))?.icon || '⚔️';
              entryHTML = `
                <div class="upcoming-entered">
                  <span class="upcoming-entered-icon">${icon}</span>
                  <span class="upcoming-entered-name">${entry.fighterName}</span>
                  <button class="upcoming-withdraw-btn" data-fight-id="${f.id}">×</button>
                </div>
              `;
            } else if (!loggedIn) {
              entryHTML = `<button class="upcoming-enter-btn" disabled>Log in to enter</button>`;
            } else if (!myFighters.length) {
              entryHTML = `<button class="upcoming-enter-btn" disabled>No fighters</button>`;
            } else if (coins < f.entry) {
              entryHTML = `<button class="upcoming-enter-btn" disabled>Need ${(f.entry - coins).toLocaleString()} more</button>`;
            } else {
              entryHTML = `<button class="upcoming-enter-btn" data-fight-id="${f.id}">Enter Fighter</button>`;
            }

            return `
              <div class="upcoming-card${isLive ? ' upcoming-card-live' : ''}">
                <div class="upcoming-card-left">
                  <div class="upcoming-arena-label">Arena</div>
                  <div class="upcoming-fight-name">${f.name}</div>
                  <div class="upcoming-vs">vs. <span>${f.opponent}</span></div>
                  <div class="upcoming-meta">
                    <div class="upcoming-meta-item">
                      <span class="upcoming-meta-label">Entry</span>
                      <span class="upcoming-meta-value">&#x1FA99; ${f.entry.toLocaleString()}</span>
                    </div>
                    <div class="upcoming-meta-item">
                      <span class="upcoming-meta-label">Prize</span>
                      <span class="upcoming-meta-value">&#x1FA99; ${f.prize.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div class="upcoming-card-right">
                  <div class="upcoming-timer-wrap">
                    <div class="upcoming-timer${remaining <= 0 ? ' starting' : ''}" id="timer-${f.id}">${formatCountdown(remaining)}</div>
                    <div class="upcoming-timer-label">Starts In</div>
                  </div>
                  ${entryHTML}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    document.getElementById('generate-btn')?.addEventListener('click', generateFights);

    container.querySelectorAll('.upcoming-enter-btn[data-fight-id]').forEach(btn => {
      btn.addEventListener('click', () => openFighterPicker(btn.dataset.fightId));
    });

    container.querySelectorAll('.upcoming-withdraw-btn[data-fight-id]').forEach(btn => {
      btn.addEventListener('click', () => withdrawFight(btn.dataset.fightId));
    });
  }

  function tickTimers() {
    const now = Date.now();
    fights.forEach(f => {
      const remaining = new Date(f.starts_at).getTime() - now;
      const el = document.getElementById('timer-' + f.id);
      if (el) {
        el.textContent = formatCountdown(remaining);
        if (remaining <= 0) el.classList.add('starting');
        else el.classList.remove('starting');
      }

      if (remaining <= 0 && !transitioned.has(f.id)) {
        transitioned.add(f.id);
        const entry = getEntries()[String(f.id)] || null;
        if (typeof window.startArenaFight === 'function') {
          window.startArenaFight(f, entry);
        }
        // Swap card to "Now Live" state
        renderUpcoming();
      }
    });
  }

  function startTimers() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tickTimers, 1000);
  }

  async function generateFights() {
    const btn = document.getElementById('generate-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
    try {
      const data = await api.post('/api/upcoming-fights/generate', {});
      if (Array.isArray(data)) {
        fights = data;
        transitioned.clear();
        localStorage.removeItem(ENTRIES_KEY);
        renderUpcoming();
        startTimers();
      }
    } catch (err) {
      console.warn('Failed to generate fights:', err);
      if (btn) { btn.disabled = false; btn.textContent = 'Generate Fights'; }
    }
  }

  async function loadFights() {
    try {
      const data = await api.get('/api/upcoming-fights');
      if (Array.isArray(data)) fights = data;
    } catch (err) {
      console.warn('Failed to load upcoming fights:', err);
    }
    cleanEntries();
    renderUpcoming();
    startTimers();
  }

  window.refreshUpcomingArena = function(newFight) {
    const idx = fights.findIndex(f => f.name === newFight.name);
    if (idx !== -1) {
      transitioned.delete(fights[idx].id);
      fights[idx] = newFight;
    } else {
      fights.push(newFight);
    }
    renderUpcoming();
  };

  loadFights();
})();
