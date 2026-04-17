# TabPulse

Auto-refresh any tab on a schedule with a live visual countdown. Set the interval once and TabPulse keeps refreshing the tab even when the popup is closed.

## What it does

You open TabPulse on any tab, pick a refresh interval from the preset buttons or type a custom one, and toggle it on. A circular ring countdown animates in real time showing how long until the next refresh. The ring goes from full to empty and resets each cycle. The popup also shows the tab's favicon, title, and hostname so you always know which tab you are configuring.

Preset intervals are 5 seconds, 10 seconds, 30 seconds, 1 minute, and 5 minutes. For anything else you can type any number of seconds into the custom interval field and hit Apply. The interval updates immediately even if auto-refresh is already running.

There is also a manual refresh button with a spin animation if you want to trigger an immediate refresh without waiting for the timer.

The last refreshed time updates every few seconds in the popup so you can confirm the extension is working, showing things like "Last refreshed 12s ago" or "Just refreshed".

## How it works technically

The service worker owns all the alarm scheduling and persists state to chrome.storage.local. This means TabPulse keeps refreshing tabs even after the popup closes, which is important because Chrome terminates popup scripts as soon as you close them. Each tab gets its own named alarm using the tab ID, so you can have multiple tabs refreshing at different intervals simultaneously.

The popup resyncs state from the background every 5 seconds while it is open to keep the countdown accurate.

Chrome system pages like chrome:// URLs cannot be refreshed by extensions. TabPulse detects this and shows a notice instead of the normal UI.

## How to install

Clone or download this repo, open Chrome and go to chrome://extensions, enable Developer Mode, click Load unpacked, and select this folder.

## Permissions

The tabs permission is needed to reload the active tab. Alarms powers the refresh scheduling reliably in the background service worker. Storage saves each tab's refresh state so settings persist.
