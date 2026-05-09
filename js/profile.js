const ICONS = [
  '@','#','$','%','&',
  '*','✓','۝','ʬ','ʭ',
  'ʘ','ɸ','Ͳ','ࠍ','⸎',
  '〠','〷','꫞','۞','۩',
];

const COLORS = [
  '#e8e8e8','#aaaaaa','#666666','#222222',
  '#c8a84b','#ff8c42','#ff5f57','#e8445a',
  '#28c840','#06b6d4','#4a9eff','#6366f1',
  '#a855f7','#ec4899','#10b981','#f59e0b',
];

let currentIcon = '@';
let currentColor = '#e8e8e8';
let currentBgColor = '#222222';
let pendingIcon = currentIcon;
let pendingColor = currentColor;
let pendingBgColor = currentBgColor;

const avatar  = document.getElementById('profile-avatar');
const overlay = document.getElementById('icon-modal-overlay');
const preview = document.getElementById('icon-preview');
const iconGrid = document.getElementById('icon-grid');
const colorPalette = document.getElementById('color-palette');
const bgColorPalette = document.getElementById('bg-color-palette');

// Build icon grid
ICONS.forEach(icon => {
  const btn = document.createElement('div');
  btn.className = 'icon-option';
  btn.textContent = icon;
  btn.dataset.icon = icon;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    pendingIcon = icon;
    preview.textContent = pendingIcon;
  });
  iconGrid.appendChild(btn);
});

// Build icon color palette
COLORS.forEach(color => {
  const swatch = document.createElement('div');
  swatch.className = 'color-swatch';
  swatch.style.background = color;
  swatch.dataset.color = color;
  swatch.addEventListener('click', () => {
    document.querySelectorAll('#color-palette .color-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
    pendingColor = color;
    preview.style.color = pendingColor;
  });
  colorPalette.appendChild(swatch);
});

// Build background color palette
COLORS.forEach(color => {
  const swatch = document.createElement('div');
  swatch.className = 'color-swatch';
  swatch.style.background = color;
  swatch.dataset.color = color;
  swatch.addEventListener('click', () => {
    document.querySelectorAll('#bg-color-palette .color-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
    pendingBgColor = color;
    preview.style.background = pendingBgColor;
  });
  bgColorPalette.appendChild(swatch);
});

function openModal() {
  pendingIcon = currentIcon;
  pendingColor = currentColor;
  pendingBgColor = currentBgColor;

  preview.textContent = currentIcon;
  preview.style.color = currentColor;
  preview.style.background = currentBgColor;

  document.querySelectorAll('.icon-option').forEach(b =>
    b.classList.toggle('selected', b.dataset.icon === currentIcon)
  );
  document.querySelectorAll('#color-palette .color-swatch').forEach(s =>
    s.classList.toggle('selected', s.dataset.color === currentColor)
  );
  document.querySelectorAll('#bg-color-palette .color-swatch').forEach(s =>
    s.classList.toggle('selected', s.dataset.color === currentBgColor)
  );

  overlay.classList.add('open');
}

function closeModal() {
  overlay.classList.remove('open');
}

function applyChanges() {
  currentIcon = pendingIcon;
  currentColor = pendingColor;
  currentBgColor = pendingBgColor;
  avatar.textContent = currentIcon;
  avatar.style.color = currentColor;
  avatar.style.background = currentBgColor;
  closeModal();
  if (typeof api !== 'undefined' && api.isLoggedIn()) {
    api.put('/api/me', {
      icon: currentIcon,
      icon_color: currentColor,
      icon_bg_color: currentBgColor,
    });
  }
}

// --- Team creation ---

function renderTeamField() {
  const display = document.getElementById('team-name-display');
  display.innerHTML = '';

  document.getElementById('flag-field').style.display =
    window.gameState.teamName ? '' : 'none';

  if (window.gameState.teamName) {
    display.textContent = window.gameState.teamName;
    return;
  }

  if (typeof api === 'undefined' || !api.isLoggedIn()) {
    display.textContent = '—';
    return;
  }

  const btn = document.createElement('button');
  btn.className = 'create-team-btn';
  btn.textContent = '+ Create Team';
  btn.addEventListener('click', showTeamInput);
  display.appendChild(btn);
}

function showTeamInput() {
  const display = document.getElementById('team-name-display');
  display.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'team-input-wrap';

  const input = document.createElement('input');
  input.className = 'team-name-input';
  input.type = 'text';
  input.placeholder = 'Team name...';
  input.maxLength = 24;

  const confirm = document.createElement('button');
  confirm.className = 'team-name-confirm';
  confirm.textContent = '✓';

  function submit() {
    const name = input.value.trim();
    if (!name) return;
    window.gameState.teamName = name;
    renderTeamField();
    renderFighters();
    if (typeof api !== 'undefined' && api.isLoggedIn()) {
      api.put('/api/me', { team_name: name });
    }
  }

  confirm.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') renderTeamField();
  });

  wrap.appendChild(input);
  wrap.appendChild(confirm);
  display.appendChild(wrap);
  input.focus();
}

function renderProfileStats() {
  const totalWins   = fighters.reduce((s, f) => s + (f.wins   || 0), 0);
  const totalLosses = fighters.reduce((s, f) => s + (f.losses || 0), 0);
  const total       = totalWins + totalLosses;
  const winRate     = total > 0 ? Math.round(totalWins / total * 100) + '%' : '—';

  const w = document.getElementById('stat-wins');
  const l = document.getElementById('stat-losses');
  const fi = document.getElementById('stat-fights');

  const w_text = document.getElementById('stat-wins-word');
  const l_text = document.getElementById('stat-losses-word');
  const fi_text = document.getElementById('stat-fights-word');

  const r = document.getElementById('stat-winrate');
  if (w)  w.textContent  = totalWins;
  if (l)  l.textContent  = totalLosses;
  if (fi) fi.textContent = total;

  if (totalWins > 1) w_text.textContent = "Wins" 
  else w_text.textContent = "Win"

  if (totalLosses > 1) l_text.textContent = "Losses" 
  else l_text.textContent = "Loss"

  if (total > 1) fi_text.textContent = "Fights" 
  else fi_text.textContent = "Fight"

  if (r)  r.textContent  = winRate;
}

renderTeamField();
renderProfileStats();

document.getElementById('edit-icon-btn').addEventListener('click', openModal);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-apply').addEventListener('click', applyChanges);

// Close on backdrop click
overlay.addEventListener('click', e => {
  if (e.target === overlay) closeModal();
});
