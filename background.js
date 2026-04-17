// TabPulse Service Worker
// Owns all alarm management and storage. Survives popup close.

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('tabpulse_')) return;
  const tabId = parseInt(alarm.name.split('_')[1]);
  const key = `tab_${tabId}`;
  const result = await chrome.storage.local.get(key);
  const state = result[key];

  if (!state?.enabled) {
    chrome.alarms.clear(alarm.name);
    return;
  }

  try {
    await chrome.tabs.reload(tabId);
    const now = Date.now();
    state.lastRefreshedAt = now;
    state.nextRefreshAt = now + state.interval * 1000;
    await chrome.storage.local.set({ [key]: state });
  } catch (e) {
    // Tab closed or inaccessible — clean up
    chrome.alarms.clear(alarm.name);
    await chrome.storage.local.remove(key);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg).then(sendResponse).catch((err) => {
    sendResponse({ success: false, error: err.message });
  });
  return true; // keep channel open for async
});

async function handleMessage(msg) {
  const { action, tabId } = msg;
  const key = `tab_${tabId}`;
  const alarmName = `tabpulse_${tabId}`;

  switch (action) {
    case 'getState': {
      const r = await chrome.storage.local.get(key);
      return { success: true, state: r[key] ?? null };
    }

    case 'setEnabled': {
      const { enabled, interval } = msg;
      if (enabled) {
        const now = Date.now();
        const state = {
          enabled: true,
          interval,
          nextRefreshAt: now + interval * 1000,
          lastRefreshedAt: null,
        };
        await chrome.storage.local.set({ [key]: state });
        await chrome.alarms.clear(alarmName);
        chrome.alarms.create(alarmName, {
          delayInMinutes: interval / 60,
          periodInMinutes: interval / 60,
        });
        return { success: true, state };
      } else {
        await chrome.alarms.clear(alarmName);
        const r = await chrome.storage.local.get(key);
        const state = { ...(r[key] ?? {}), enabled: false, nextRefreshAt: null };
        await chrome.storage.local.set({ [key]: state });
        return { success: true, state };
      }
    }

    case 'setInterval': {
      const { interval } = msg;
      const r = await chrome.storage.local.get(key);
      const existing = r[key] ?? {};
      await chrome.alarms.clear(alarmName);
      const now = Date.now();
      const state = { ...existing, interval, nextRefreshAt: now + interval * 1000 };
      if (state.enabled) {
        chrome.alarms.create(alarmName, {
          delayInMinutes: interval / 60,
          periodInMinutes: interval / 60,
        });
      }
      await chrome.storage.local.set({ [key]: state });
      return { success: true, state };
    }

    case 'manualRefresh': {
      try {
        await chrome.tabs.reload(tabId);
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}
