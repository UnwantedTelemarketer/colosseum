const tabs = document.querySelectorAll('.tab');
const indicator = document.getElementById('tab-indicator');

function moveIndicator(tab) {
  indicator.style.left = tab.offsetLeft + 'px';
  indicator.style.width = tab.offsetWidth + 'px';
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (!tab.dataset.tab) return;
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    moveIndicator(tab);
  });
});

// Position on load without playing the transition
const activeTab = document.querySelector('.tab.active');
indicator.style.transition = 'none';
moveIndicator(activeTab);
requestAnimationFrame(() => {
  indicator.style.transition = '';
});

// Dynamic ⫘ title pattern
function fillTitlePattern() {
  const titleEl = document.querySelector('.window-title');
  const titlebar = document.querySelector('.window-titlebar');
  const dots = document.querySelector('.window-dots');
  if (!titleEl || !titlebar) return;

  const label = "Pinkle's Secret Colosseum";
  const char = '⫘';

  const style = window.getComputedStyle(titleEl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const charW  = ctx.measureText(char).width;
  const coreW  = ctx.measureText(' ' + label + ' ').width;

  const tbStyle   = window.getComputedStyle(titlebar);
  const padH      = parseFloat(tbStyle.paddingLeft) + parseFloat(tbStyle.paddingRight);
  const gapPx     = parseFloat(tbStyle.gap) || 12;
  const dotsW     = dots ? dots.offsetWidth : 0;
  const available = titlebar.offsetWidth - padH - dotsW - gapPx;

  const count = Math.max(0, Math.floor((available - coreW) / 2 / charW));
  titleEl.textContent = char.repeat(count - 2) + ' ' + label + ' ' + char.repeat(count - 2);
}

fillTitlePattern();
if (window.ResizeObserver) {
  new ResizeObserver(fillTitlePattern).observe(document.querySelector('.window-titlebar'));
}
