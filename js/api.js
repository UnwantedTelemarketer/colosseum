// --- Client-side API module ---
// Exposes a global `api` object for auth token management and authenticated fetch helpers.

const api = (() => {
  const TOKEN_KEY = 'colosseum_token';
  const USERNAME_KEY = 'colosseum_username';

  // Token helpers
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(t, username) {
    localStorage.setItem(TOKEN_KEY, t);
    if (username) localStorage.setItem(USERNAME_KEY, username);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function getUsername() {
    return localStorage.getItem(USERNAME_KEY) || '';
  }

  // Authenticated fetch helpers
  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(path, opts);
    const data = await res.json();
    return data;
  }

  function get(path) {
    return request('GET', path);
  }

  function put(path, body) {
    return request('PUT', path, body);
  }

  function post(path, body) {
    return request('POST', path, body);
  }

  // Load profile from server and apply it to the current game state
  async function loadProfile() {
    try {
      const data = await get('/api/me');
      if (data.error) return;

      // Apply coins
      if (typeof data.coins === 'number') {
        coins = data.coins;
      }

      // Apply fighters — server uses `defense`, local uses `def`; normalise to `def`
      if (Array.isArray(data.fighters)) {
        fighters = data.fighters.map(f => {
          function resolveItem(slot, id) {
            if (!id || typeof INVENTORY === 'undefined') return null;
            return (INVENTORY[slot] || []).find(i => i.id === id) || null;
          }
          return {
            id: f.id,
            name: f.name,
            class: f.class,
            icon: f.icon,
            atk: f.atk,
            def: f.defense !== undefined ? f.defense : (f.def || 0),
            spd: f.spd,
            wins: f.wins,
            losses: f.losses,
            status: f.status,
            atk_xp: f.atk_xp ?? 50,
            def_xp: f.def_xp ?? 50,
            spd_xp: f.spd_xp ?? 50,
            equipment: {
              armor:  resolveItem('armor',  f.equip_armor),
              weapon: resolveItem('weapon', f.equip_weapon),
              shield: resolveItem('shield', f.equip_shield),
            },
          };
        });
      }

      // Apply profile icon/colors to avatar
      const avatar = document.getElementById('profile-avatar');
      if (avatar) {
        if (data.icon) {
          avatar.textContent = data.icon;
          currentIcon = data.icon;
        }
        if (data.icon_color) {
          avatar.style.color = data.icon_color;
          currentColor = data.icon_color;
        }
        if (data.icon_bg_color) {
          avatar.style.background = data.icon_bg_color;
          currentBgColor = data.icon_bg_color;
        }
      }

      // Apply team name
      if (data.team_name) {
        window.gameState.teamName = data.team_name;
        if (typeof renderTeamField === 'function') renderTeamField();
      }

      // Apply daily claimed at — store on the api object for coins.js to read
      api._dailyClaimedAt = data.daily_claimed_at || null;

      // Update profile username
      const profileUsernameEl = document.getElementById('profile-username');
      if (profileUsernameEl && data.username) {
        profileUsernameEl.textContent = data.username;
      }

      // Refresh UI
      if (typeof updateCoinsDisplay === 'function') updateCoinsDisplay();
      if (typeof renderFighters === 'function') renderFighters();
    } catch (err) {
      console.warn('api.loadProfile failed:', err);
    }
  }

  return {
    getToken,
    setToken,
    clearToken,
    isLoggedIn,
    getUsername,
    get,
    put,
    post,
    loadProfile,
    _dailyClaimedAt: null,
  };
})();

// --- Topbar login/logout state (set immediately, no API wait) ---

(function initTopbar() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;

  if (api.isLoggedIn()) {
    // Replace login button with username + logout button
    topbar.innerHTML = `<button class="logout-btn" id="logout-btn">Log out</button>`;
    document.getElementById('logout-btn').addEventListener('click', () => {
      api.clearToken();
      window.location.reload();
    });
  }
  // If not logged in the existing login button stays as-is
  if (!api.isLoggedIn()) {
    const coinsTab = document.getElementById('coins-tab');
    const coinsContent = document.getElementById('tab-coins');
    if (coinsTab) coinsTab.style.display = 'none';
    if (coinsContent) coinsContent.style.display = 'none';

    const fightersTab = document.querySelector('[data-tab="fighters"]');
    const fightersContent = document.getElementById('tab-fighters');
    if (fightersTab) fightersTab.style.display = 'none';
    if (fightersContent) fightersContent.style.display = 'none';
  }
})();

// --- Set profile username immediately from localStorage (no flash) ---
if (api.isLoggedIn()) {
  const el = document.getElementById('profile-username');
  if (el) el.textContent = api.getUsername();
}

// --- Auto-load profile on page load if logged in ---
if (api.isLoggedIn()) api.loadProfile();
