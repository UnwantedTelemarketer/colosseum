const SHOPKEEPER_ART = `                     ^#B#&&G~
                      .B&&&&&&:
                       5&&&&&G
                       .5B#BJ..::.
                      .^!YPGG##&&#G~
                   :?G&&&&&&&&&&&&&&Y.
                :?B&&&#&&&&&&&&&&&&&&#~
              :B&&&&BG5PPG&&&&&&&&G?#&&5
............. :YPPPPPPPB&Y5&&&&&&&&^7&&#
#BBBBBB#BBBBB#BBBBBBBB^.!5B&&&&&&&&BB&&!
&&&&&&&&&&&&&&&&&&&&&&~  7&&&&&&&&&&&&G
&&&&&&&&&&&&&&&&&&&&&&~   G&&&&&&&&&&B:
&&&&&&&&&&&&&&&&&&&&&&~   P&&&&&&&&&&^
&&&&&&&&&&&&&&&&&&&&&&~  :&&&&&&&&&&B.
&&&&&&&&&&&&&&&&&&&&&&~  J&&&&GP&&&&J
&&&&&&&&&&&&&&&&&&&&&&~ .#&&&&~G&&&&:
&&&&&&&&&&&&&&&&&&&&&&~ 7&&&&P^&&&&G
&&&&&&&&&&&&&&&&&&&&&&~ 7&&&&#YP#&&7
&&&&&&&&&&&&&&&&&&&&&&~  ~P&&&&B5PB.
&&&&&&&&&&&&&&&&&&&&&&~    ^5#&&&BJ.
&&&&&&&&&&&&&&&&&&&&&&~      ?P#&&&B7.
&&&&&&&&&&&&&&&&&&&&&&~     .#B55#&&&#~
&&&&&&&&&&&&&&&&&&&&&&~     7&&&B^5&&#~
PPPPPPPPPPPPPPPPPPPPPP^     !#&#Y !#5.  `;

const SHOP_TIERS = [
  {
    id: 'iron', label: 'Iron', color: '#8B8B8B',
    items: [
      { id: 'iron_armor',  name: 'Iron Armor',  slot: 'armor',  icon: '⛓', desc: '+10 DEF', defBonus: 10, price: 300  },
      { id: 'iron_sword',  name: 'Iron Sword',  slot: 'weapon', icon: '⚔', desc: '+10 ATK', atkBonus: 10, price: 300  },
      { id: 'iron_shield', name: 'Iron Shield', slot: 'shield', icon: '⛊', desc: '+7 DEF',  defBonus:  7, price: 200  },
    ],
  },
  {
    id: 'steel', label: 'Steel', color: '#C0C0C0',
    items: [
      { id: 'steel_armor',  name: 'Steel Armor',  slot: 'armor',  icon: '⛓', desc: '+20 DEF', defBonus: 20, price: 700  },
      { id: 'steel_sword',  name: 'Steel Sword',  slot: 'weapon', icon: '⚔', desc: '+20 ATK', atkBonus: 20, price: 700  },
      { id: 'steel_shield', name: 'Steel Shield', slot: 'shield', icon: '⛊', desc: '+15 DEF', defBonus: 15, price: 500  },
    ],
  },
  {
    id: 'mithril', label: 'Mithril', color: '#5BC8F5',
    items: [
      { id: 'mithril_armor',  name: 'Mithril Armor',  slot: 'armor',  icon: '⛓', desc: '+35 DEF', defBonus: 35, price: 2000 },
      { id: 'mithril_sword',  name: 'Mithril Sword',  slot: 'weapon', icon: '⚔', desc: '+35 ATK', atkBonus: 35, price: 2000 },
      { id: 'mithril_shield', name: 'Mithril Shield', slot: 'shield', icon: '⛊', desc: '+25 DEF', defBonus: 25, price: 1500 },
    ],
  },
];

const POTIONS = [
  { id: 'health_potion',   name: 'Health Potion',   icon: '⚕', color: '#e05555', desc: 'Restores a fighter to Ready', price: 75  },
  { id: 'strength_elixir', name: 'Strength Elixir', icon: '⚗', color: '#e07a35', desc: 'Grants +10 ATK XP',          price: 100 },
  { id: 'speed_tonic',     name: 'Speed Tonic',     icon: '⚗', color: '#5BC8F5', desc: 'Grants +10 SPD XP',          price: 100 },
];

const PURCHASED_KEY = 'colosseum_purchased';
const POTIONS_KEY   = 'colosseum_potions';

function getPurchased() {
  try { return JSON.parse(localStorage.getItem(PURCHASED_KEY)) || []; }
  catch { return []; }
}

function savePurchased(list) {
  localStorage.setItem(PURCHASED_KEY, JSON.stringify(list));
}

function getPotions() {
  try { return JSON.parse(localStorage.getItem(POTIONS_KEY)) || {}; }
  catch { return {}; }
}

function savePotions(obj) {
  localStorage.setItem(POTIONS_KEY, JSON.stringify(obj));
}

function buyPotion(potionId) {
  const potion = POTIONS.find(p => p.id === potionId);
  if (!potion || coins < potion.price) return;

  coins -= potion.price;
  const stock = getPotions();
  stock[potionId] = (stock[potionId] || 0) + 1;
  savePotions(stock);
  updateCoinsDisplay();

  if (typeof api !== 'undefined' && api.isLoggedIn()) {
    api.put('/api/me', { coins });
  }

  renderShop();
}

function syncInventory() {
  INVENTORY.armor  = [{ id: 'bronze_armor',  name: 'Bronze Armor',      icon: '⛓', color: '#CD7F32', desc: '+5 DEF', defBonus: 5 }];
  INVENTORY.weapon = [{ id: 'bronze_sword',  name: 'Bronze Shortsword', icon: '⚔', color: '#CD7F32', desc: '+5 ATK', atkBonus: 5 }];
  INVENTORY.shield = [{ id: 'bronze_shield', name: 'Bronze Shield',     icon: '⛊', color: '#CD7F32', desc: '+3 DEF', defBonus: 3 }];

  const purchased = getPurchased();
  for (const tier of SHOP_TIERS) {
    for (const item of tier.items) {
      if (purchased.includes(item.id)) {
        INVENTORY[item.slot].push({ ...item, color: tier.color });
      }
    }
  }
}

function buyItem(itemId) {
  let foundItem = null, foundTier = null;
  for (const tier of SHOP_TIERS) {
    const item = tier.items.find(i => i.id === itemId);
    if (item) { foundItem = item; foundTier = tier; break; }
  }
  if (!foundItem || coins < foundItem.price) return;

  const purchased = getPurchased();
  if (purchased.includes(itemId)) return;

  coins -= foundItem.price;
  purchased.push(itemId);
  savePurchased(purchased);
  syncInventory();
  updateCoinsDisplay();

  if (typeof api !== 'undefined' && api.isLoggedIn()) {
    api.put('/api/me', { coins });
  }

  renderShop();
}

let activeShopTab = 'armor';

function renderShop() {
  const panel = document.getElementById('shop-items-panel');
  if (!panel) return;

  if (activeShopTab === 'armor') {
    const purchased = getPurchased();
    panel.innerHTML = SHOP_TIERS.map(tier => `
      <div class="shop-tier">
        <div class="shop-tier-header" style="color:${tier.color}">${tier.label}</div>
        <div class="shop-tier-items">
          ${tier.items.map(item => {
            const owned     = purchased.includes(item.id);
            const canAfford = coins >= item.price;
            return `
              <div class="shop-item${owned ? ' owned' : ''}">
                <div class="shop-item-icon" style="color:${tier.color}">${item.icon}</div>
                <div class="shop-item-info">
                  <div class="shop-item-name">${item.name}</div>
                  <div class="shop-item-stat">${item.desc}</div>
                </div>
                <div class="shop-item-right">
                  ${owned
                    ? `<span class="shop-item-owned-label">Owned</span>`
                    : `<button class="shop-buy-btn" data-item-id="${item.id}" ${canAfford ? '' : 'disabled'}>
                         &#x1FA99; ${item.price.toLocaleString()}
                       </button>`
                  }
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');

  } else if (activeShopTab === 'potions') {
    const stock = getPotions();
    panel.innerHTML = `
      <div class="shop-tier">
        <div class="shop-tier-header" style="color:#aaa">Potions</div>
        <div class="shop-tier-items">
          ${POTIONS.map(p => {
            const qty       = stock[p.id] || 0;
            const canAfford = coins >= p.price;
            return `
              <div class="shop-item">
                <div class="shop-item-icon" style="color:${p.color}">${p.icon}</div>
                <div class="shop-item-info">
                  <div class="shop-item-name">${p.name}</div>
                  <div class="shop-item-stat">${p.desc}</div>
                </div>
                <div class="shop-item-right potion-right">
                  ${qty > 0 ? `<span class="potion-qty">x${qty}</span>` : ''}
                  <button class="shop-buy-btn" data-potion-id="${p.id}" ${canAfford ? '' : 'disabled'}>
                    &#x1FA99; ${p.price}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

  } else {
    panel.innerHTML = `
      <div class="shop-misc-empty">
        <div class="shop-misc-icon">⚒</div>
        <div class="shop-misc-label">More items coming soon</div>
      </div>
    `;
  }

  panel.querySelectorAll('.shop-buy-btn:not(:disabled)').forEach(btn => {
    if (btn.dataset.itemId)   btn.addEventListener('click', () => buyItem(btn.dataset.itemId));
    if (btn.dataset.potionId) btn.addEventListener('click', () => buyPotion(btn.dataset.potionId));
  });
}

const SHOPKEEPER_MESSAGES = [
  "Welcome, traveler...",
  "Finest steel in the realm.",
  "Mithril? Aye, it'll cost ya.",
  "Browse all ye like.",
  "No refunds. Store policy.",
  "That armor's saved lives.",
  "Iron's a fine start.",
  "Buy somethin' or get out.",
  "These blades don't sharpen themselves.",
  "Best prices in the colosseum.",
  "What's your record lookin' like?",
  "Coin first, questions later.",
  "The mithril shipment just arrived.",
];

function startTypewriter(el) {
  let msgIndex = Math.floor(Math.random() * SHOPKEEPER_MESSAGES.length);
  let charIndex = 0;
  let erasing = false;

  function tick() {
    const msg = SHOPKEEPER_MESSAGES[msgIndex];

    if (!erasing) {
      charIndex++;
      el.textContent = msg.slice(0, charIndex);
      if (charIndex === msg.length) {
        erasing = true;
        setTimeout(tick, 1800);
      } else {
        setTimeout(tick, 50);
      }
    } else {
      charIndex--;
      el.textContent = msg.slice(0, charIndex);
      if (charIndex === 0) {
        erasing = false;
        let next;
        do { next = Math.floor(Math.random() * SHOPKEEPER_MESSAGES.length); }
        while (next === msgIndex && SHOPKEEPER_MESSAGES.length > 1);
        msgIndex = next;
        setTimeout(tick, 4000);
      } else {
        setTimeout(tick, 28);
      }
    }
  }

  setTimeout(tick, 800);
}

// Shop nav tabs
document.querySelectorAll('.shop-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeShopTab = btn.dataset.shopTab;
    document.querySelectorAll('.shop-nav-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderShop();
  });
});

// Set shopkeeper ASCII art
const artEl = document.getElementById('shopkeeper-art');
if (artEl) artEl.textContent = SHOPKEEPER_ART;

const msgEl = document.getElementById('shopkeeper-message');
if (msgEl) startTypewriter(msgEl);

syncInventory();
renderShop();
