// --- Shop tiers ---
document.querySelectorAll('.tier-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const amount = parseInt(btn.dataset.coins, 10);
    coins += amount;
    updateCoinsDisplay();
    renderFighters();
    spawnConfetti(btn);
    if (typeof api !== 'undefined' && api.isLoggedIn()) {
      api.put('/api/me', { coins });
    }
  });
});

// --- Confetti ---

function spawnConfetti(sourceEl) {
  const rect = sourceEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const COLORS = ['#c8a84b','#febc2e','#ff5f57','#28c840','#4a9eff','#a855f7','#ec4899','#06b6d4'];
  const COUNT = 60;
  const particles = [];

  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('div');
    const size = 4 + Math.random() * 6;
    el.style.cssText = `
      position:fixed; pointer-events:none; z-index:9999; border-radius:2px;
      width:${size}px; height:${size * 1.8}px;
      background:${COLORS[Math.floor(Math.random() * COLORS.length)]};
      left:${cx}px; top:${cy}px;
    `;
    document.body.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8;
    particles.push({
      el,
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 5,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 18,
      alpha: 1,
    });
  }

  function tick() {
    let anyAlive = false;
    particles.forEach(p => {
      if (p.alpha <= 0) return;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.vx *= 0.98;
      p.rotation += p.rotSpeed;
      p.alpha -= 0.02;
      p.el.style.left      = p.x + 'px';
      p.el.style.top       = p.y + 'px';
      p.el.style.transform = `rotate(${p.rotation}deg)`;
      p.el.style.opacity   = p.alpha;
      anyAlive = true;
    });
    if (anyAlive) requestAnimationFrame(tick);
    else particles.forEach(p => p.el.remove());
  }

  requestAnimationFrame(tick);
}

// --- Daily claim ---
const DAILY_KEY = 'colosseum_daily_claimed';
const DAILY_REWARD = 25;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyClaimedAt() {
  // Prefer the server-side value when logged in (set by api.loadProfile)
  if (typeof api !== 'undefined' && api.isLoggedIn() && api._dailyClaimedAt) {
    return api._dailyClaimedAt.slice(0, 10);
  }
  return localStorage.getItem(DAILY_KEY);
}

function initDailyClaim() {
  const btn = document.getElementById('daily-btn');

  // Re-check after profile loads (api.loadProfile runs async)
  const checkClaimed = () => {
    if (getDailyClaimedAt() === todayString()) {
      btn.textContent = 'Claimed';
      btn.disabled = true;
    }
  };

  if (getDailyClaimedAt() === todayString()) {
    btn.textContent = 'Claimed';
    btn.disabled = true;
  } else {
    btn.addEventListener('click', claimDaily);
    // Re-check once the async profile load may have set _dailyClaimedAt
    setTimeout(checkClaimed, 1500);
  }
}

function claimDaily() {
  const btn = document.getElementById('daily-btn');
  const today = todayString();
  localStorage.setItem(DAILY_KEY, today);
  coins += DAILY_REWARD;
  updateCoinsDisplay();
  renderFighters();
  spawnConfetti(btn);
  btn.textContent = 'Claimed';
  btn.disabled = true;
  if (typeof api !== 'undefined' && api.isLoggedIn()) {
    api._dailyClaimedAt = today;
    api.put('/api/me', { coins, daily_claimed_at: today });
  }
}

initDailyClaim();

