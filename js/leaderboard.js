(function () {
  let loaded = false;

  function winRate(wins, losses) {
    const total = wins + losses;
    return total > 0 ? Math.round(wins / total * 100) + '%' : '—';
  }

  function rankBadge(i) {
    if (i === 0) return '<span class="lb-rank lb-rank-gold">1</span>';
    if (i === 1) return '<span class="lb-rank lb-rank-silver">2</span>';
    if (i === 2) return '<span class="lb-rank lb-rank-bronze">3</span>';
    return `<span class="lb-rank">${i + 1}</span>`;
  }

  function render(rows) {
    const container = document.getElementById('tab-leaderboard');
    if (!container) return;

    if (!rows.length) {
      container.innerHTML = `
        <div class="lb-header">
          <span class="lb-title">Top Fighters</span>
        </div>
        <div class="lb-empty">
          <div class="lb-empty-icon">🏆</div>
          <div class="lb-empty-label">No fights recorded yet</div>
        </div>
      `;
      document.getElementById('lb-refresh')?.addEventListener('click', load);
      return;
    }

    container.innerHTML = `
      <div class="lb-header">
        <span class="lb-title">Top Fighters</span>
      </div>
      <div class="lb-table">
        <div class="lb-row lb-heading">
          <div class="lb-col-rank"></div>
          <div class="lb-col-fighter">Fighter</div>
          <div class="lb-col-owner">Team</div>
          <div class="lb-col-record">W / L</div>
          <div class="lb-col-rate">Win Rate</div>
        </div>
        ${rows.map((r, i) => `
          <div class="lb-row${i < 3 ? ' lb-row-top' : ''}">
            <div class="lb-col-rank">${rankBadge(i)}</div>
            <div class="lb-col-fighter">
              <span class="lb-fighter-icon">${r.icon}</span>
              <div class="lb-fighter-info">
                <div class="lb-fighter-name">${r.name}</div>
                <div class="lb-fighter-stats">
                  <span class="lb-stat lb-stat-atk">⚔ ${r.atk}</span>
                  <span class="lb-stat lb-stat-def">⛊ ${r.defense}</span>
                  <span class="lb-stat lb-stat-spd">↯ ${r.spd}</span>
                </div>
              </div>
            </div>
            <div class="lb-col-owner">
              <span class="lb-owner-avatar" style="color:${r.icon_color};background:${r.icon_bg_color}">${r.user_icon}</span>
              <span class="lb-owner-name">${r.team_name || r.username}</span>
            </div>
            <div class="lb-col-record">
              <span class="lb-wins">${r.wins}</span>
              <span class="lb-sep">/</span>
              <span class="lb-losses">${r.losses}</span>
            </div>
            <div class="lb-col-rate">${winRate(r.wins, r.losses)}</div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('lb-refresh')?.addEventListener('click', load);
  }

  function renderLoading() {
    const container = document.getElementById('tab-leaderboard');
    if (!container) return;
    container.innerHTML = `
      <div class="lb-header">
        <span class="lb-title">Top Fighters</span>
      </div>
      <div class="lb-empty">
        <div class="lb-empty-label">Loading...</div>
      </div>
    `;
  }

  async function load() {
    renderLoading();
    try {
      const data = await fetch('/api/leaderboard').then(r => r.json());
      render(Array.isArray(data) ? data : []);
      loaded = true;
    } catch {
      render([]);
    }
  }

  // Lazy-load when the tab is first opened; refresh button reloads
  document.querySelector('[data-tab="leaderboard"]')?.addEventListener('click', () => {
    if (!loaded) load();
  });
})();
