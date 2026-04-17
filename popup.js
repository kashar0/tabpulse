// TabPulse Popup
// Manages UI state, countdown ticker, and messaging to the service worker.

const CIRCUMFERENCE = 2 * Math.PI * 52; // ring-fg radius = 52

// DOM refs
const btnManual       = document.getElementById('btnManual');
const tabFavicon      = document.getElementById('tabFavicon');
const tabFaviconFB    = document.getElementById('tabFaviconFallback');
const tabTitleEl      = document.getElementById('tabTitle');
const tabUrlEl        = document.getElementById('tabUrl');
const countdownSec    = document.getElementById('countdownSection');
const ringFgEl        = document.getElementById('ringFg');
const countdownValEl  = document.getElementById('countdownValue');
const countdownLblEl  = document.getElementById('countdownLabel');
const lastRefreshEl   = document.getElementById('lastRefresh');
const intervalGrid    = document.getElementById('intervalGrid');
const customRow       = document.getElementById('customRow');
const customInput     = document.getElementById('customInput');
const btnApply        = document.getElementById('btnApply');
const toggleEl        = document.getElementById('toggleAutoRefresh');
const toggleSublabel  = document.getElementById('toggleSublabel');
const statusDot       = document.getElementById('statusDot');
const statusText      = document.getElementById('statusText');

let activeTabId   = null;
let localState    = null; // { enabled, interval, nextRefreshAt, lastRefreshedAt }
let ticker        = null;
let resyncTimer   = null;

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  activeTabId = tab.id;

  // Check if this is a system page we can't refresh
  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:'))) {
    showSystemPageNotice();
    return;
  }

  renderTabInfo(tab);

  const { state } = await sendBg({ action: 'getState', tabId: activeTabId });
  localState = state ?? { enabled: false, interval: 60, nextRefreshAt: null, lastRefreshedAt: null };

  applyStateToUI(localState);
  attachListeners();

  // Resync state from background every 5s (catches refreshes that happened while popup was open)
  resyncTimer = setInterval(async () => {
    const { state: fresh } = await sendBg({ action: 'getState', tabId: activeTabId });
    if (fresh) {
      localState = fresh;
      updateLastRefresh(fresh.lastRefreshedAt);
    }
  }, 5000);
}

// ── Tab Info ─────────────────────────────────────────────────────────────────

function renderTabInfo(tab) {
  const title = tab.title || 'Untitled';
  let hostname = '';
  try { hostname = new URL(tab.url).hostname; } catch (_) { hostname = tab.url; }

  tabTitleEl.textContent = title;
  tabUrlEl.textContent   = hostname;

  if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://') && tab.favIconUrl.trim() !== '') {
    tabFavicon.src = tab.favIconUrl;
    tabFavicon.style.display = 'block';
    tabFaviconFB.style.display = 'none';
  } else {
    tabFavicon.style.display = 'none';
    tabFaviconFB.style.display = 'flex';
    tabFaviconFB.textContent = (hostname[0] || '?').toUpperCase();
  }
}

function showSystemPageNotice() {
  const container = document.querySelector('.container');
  container.innerHTML = `
    <header class="header">
      <div class="logo">
        <svg class="logo-icon" viewBox="0 0 32 32" fill="none">
          <path d="M 16 5 A 11 11 0 1 1 6 19" stroke="#00e5c8" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <polyline points="3,16 6,19 9,16" stroke="#00e5c8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <polyline points="8,16 11,16 13,11 15,21 17,13.5 18.5,18.5 20.5,16 24,16" stroke="#00e5c8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        <span class="logo-text">TabPulse</span>
      </div>
    </header>
    <div class="system-page-notice">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="12" cy="15.5" r="0.8" fill="currentColor"/>
      </svg>
      <p><strong>Can't refresh this page</strong><br>
      TabPulse can't refresh Chrome system pages.<br>
      Navigate to a regular website to use TabPulse.</p>
    </div>
  `;
}

// ── State → UI ───────────────────────────────────────────────────────────────

function applyStateToUI(state) {
  // Interval buttons
  highlightIntervalBtn(state.interval);

  // Toggle
  toggleEl.checked = state.enabled;

  if (state.enabled) {
    countdownSec.classList.remove('hidden');
    statusDot.classList.add('active');
    statusText.textContent = `Refreshing every ${formatInterval(state.interval)}`;
    toggleSublabel.textContent = `Every ${formatInterval(state.interval)}`;
    startTicker();
  } else {
    countdownSec.classList.add('hidden');
    statusDot.classList.remove('active');
    statusText.textContent = 'Auto-refresh off';
    toggleSublabel.textContent = 'Off';
    stopTicker();
  }

  updateLastRefresh(state.lastRefreshedAt);
}

function highlightIntervalBtn(interval) {
  const presets = [5, 10, 30, 60, 300];
  document.querySelectorAll('.interval-btn[data-value]').forEach(btn => {
    const v = btn.dataset.value;
    btn.classList.toggle('active', v !== 'custom' && parseInt(v) === interval);
  });
}

function updateLastRefresh(ts) {
  if (!ts) { lastRefreshEl.textContent = ''; return; }
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 5)  { lastRefreshEl.textContent = 'Just refreshed'; return; }
  if (secs < 60) { lastRefreshEl.textContent = `Last refreshed ${secs}s ago`; return; }
  const mins = Math.floor(secs / 60);
  lastRefreshEl.textContent = `Last refreshed ${mins}m ago`;
}

// ── Countdown Ticker ──────────────────────────────────────────────────────────

function startTicker() {
  if (ticker) return;
  ticker = setInterval(updateCountdown, 500);
  updateCountdown(); // immediate first tick
}

function stopTicker() {
  clearInterval(ticker);
  ticker = null;
  countdownValEl.textContent = '--';
  countdownLblEl.textContent = 'seconds';
  ringFgEl.style.strokeDashoffset = CIRCUMFERENCE;
}

function updateCountdown() {
  if (!localState?.enabled || !localState?.nextRefreshAt) return;

  const remaining = Math.max(0, (localState.nextRefreshAt - Date.now()) / 1000);
  const interval  = localState.interval;

  // Display value
  if (remaining >= 3600) {
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    countdownValEl.textContent  = `${h}h${m ? m + 'm' : ''}`;
    countdownLblEl.textContent  = '';
  } else if (remaining >= 60) {
    const m = Math.floor(remaining / 60);
    const s = Math.ceil(remaining % 60);
    countdownValEl.textContent  = `${m}:${String(s).padStart(2, '0')}`;
    countdownLblEl.textContent  = 'min';
  } else {
    countdownValEl.textContent  = String(Math.ceil(remaining));
    countdownLblEl.textContent  = 'seconds';
  }

  // Ring progress
  const fraction = Math.min(remaining / interval, 1);
  ringFgEl.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);
}

// ── Event Listeners ───────────────────────────────────────────────────────────

function attachListeners() {
  // Manual refresh
  btnManual.addEventListener('click', () => {
    btnManual.classList.remove('spinning');
    void btnManual.offsetWidth; // reflow to restart animation
    btnManual.classList.add('spinning');
    btnManual.addEventListener('animationend', () => btnManual.classList.remove('spinning'), { once: true });
    sendBg({ action: 'manualRefresh', tabId: activeTabId });
  });

  // Toggle auto-refresh
  toggleEl.addEventListener('change', async () => {
    const enabled  = toggleEl.checked;
    const interval = getSelectedInterval();
    const { state } = await sendBg({ action: 'setEnabled', tabId: activeTabId, enabled, interval });
    if (state) { localState = state; applyStateToUI(state); }
  });

  // Interval button selection
  intervalGrid.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-value]');
    if (!btn) return;
    const val = btn.dataset.value;

    if (val === 'custom') {
      customRow.classList.toggle('hidden');
      customInput.focus();
      return;
    }

    customRow.classList.add('hidden');
    const interval = parseInt(val);
    highlightIntervalBtn(interval);

    if (localState?.enabled) {
      const { state } = await sendBg({ action: 'setInterval', tabId: activeTabId, interval });
      if (state) { localState = state; applyStateToUI(state); }
    } else {
      localState = { ...localState, interval };
      highlightIntervalBtn(interval);
    }
  });

  // Custom interval apply
  btnApply.addEventListener('click', applyCustomInterval);
  customInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyCustomInterval(); });

  async function applyCustomInterval() {
    const val = parseInt(customInput.value);
    if (!val || val < 1) return;
    customRow.classList.add('hidden');
    customInput.value = '';

    document.querySelectorAll('.interval-btn').forEach(b => b.classList.remove('active'));

    if (localState?.enabled) {
      const { state } = await sendBg({ action: 'setInterval', tabId: activeTabId, interval: val });
      if (state) { localState = state; applyStateToUI(state); }
    } else {
      localState = { ...localState, interval: val };
      statusText.textContent = `Interval set to ${formatInterval(val)}`;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSelectedInterval() {
  const activeBtn = document.querySelector('.interval-btn.active');
  if (activeBtn && activeBtn.dataset.value !== 'custom') {
    return parseInt(activeBtn.dataset.value);
  }
  return localState?.interval ?? 60;
}

function formatInterval(secs) {
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h`;
}

function sendBg(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) { resolve({ success: false }); return; }
      resolve(res ?? { success: false });
    });
  });
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

window.addEventListener('unload', () => {
  clearInterval(ticker);
  clearInterval(resyncTimer);
});
