# TabPulse

TabPulse lets you set any tab to auto-refresh on a schedule. You pick the interval, it keeps refreshing, and a live countdown in the popup shows you exactly when the next refresh is coming.

## Who this is useful for

If you monitor dashboards, watch live scores, track order pages, or keep an eye on anything that updates on a regular basis, TabPulse saves you from hitting F5 over and over. Set the interval once and forget about it.

## How to use it

Open the tab you want to auto-refresh, click the TabPulse icon, set the refresh interval in seconds or minutes, and start it. The countdown ticks down in real time. You can pause or stop it anytime from the same popup.

## How to install

Clone or download this repo, open Chrome and go to chrome://extensions, enable Developer Mode, click Load unpacked, and select this folder.

## Permissions it uses

It needs the tabs permission to refresh the active tab, alarms to schedule the refresh intervals accurately, and storage to remember your settings for each tab.

## Built with

Manifest V3 and plain JavaScript using Chrome's tabs, alarms, and storage APIs.
