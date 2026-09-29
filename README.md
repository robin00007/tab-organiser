# Tab Organiser

A Chrome extension that sorts your tabs into tab groups using rules you write.
No account, no server, no external database — your rules live in
`chrome.storage.local` inside your own browser profile.

## Install (unpacked)

```bash
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and pick the `dist/` folder

The options page opens on first install with four starter groups ready to go.

## How it works

A group is a **name**, a **colour** and a list of **rules**. When a tab finishes
loading, the extension walks your groups in order and drops the tab into the
first one whose rules match. That ordering is the priority knob — put the
specific groups above the broad ones:

```
Work   →  URL starts with  https://github.com/acme/
Dev    →  Domain           github.com
```

With those in that order, `github.com/acme/api` goes to **Work** and every other
GitHub URL goes to **Dev**.

### Rule types

| Type | Matches | Example |
| --- | --- | --- |
| `Domain` | the host and all its subdomains | `youtube.com` also catches `music.youtube.com` |
| `URL starts with` | a URL prefix, with or without the scheme | `github.com/myorg/` |
| `Contains` | text anywhere in the URL **or** the page title | `invoice` |
| `Regex` | a JavaScript regular expression against the URL | `^https://.*\.atlassian\.net/browse/` |

Paste a whole list of domains at once with **Paste a list** on any group.

### Getting back to the editor

The welcome banner is a one-time greeting, not a setup wizard — dismissing it
changes nothing. Everything stays editable. Three ways back in:

- Click the toolbar icon, then **Manage groups, rules and templates** at the
  bottom of the popup (or the gear in its header)
- Right-click the toolbar icon → **Options**
- `chrome://extensions` → Tab Organiser → **Details** → **Extension options**

On that page, **Groups** edits what you have (rename, recolour, reorder, add or
delete rules, delete the group) and **Templates** adds more prebuilt groups at
any time. **New group** at the bottom of Groups starts an empty one.

To add the site you are looking at without opening the editor: open the popup on
that tab and, when no group matches it, pick one from the dropdown and hit
**Add**.

### Organising tabs you already have

**Organise now** — in the popup or the options page header — sweeps the tabs that
are already open. It is also the first thing the onboarding banner offers you.

### What it will not touch

- Browser pages: `chrome://`, extension pages, `about:`, `file:`, devtools
- Pinned tabs, unless you turn on **Include pinned tabs**
- **Groups you created yourself in Chrome.** A Chrome group is only considered
  "ours" when its title matches one of your group names, so renaming a group in
  Chrome quietly hands it back to you.

### Settings worth knowing

- **Auto-organise new tabs** — group tabs as they load. Off shows an `off` badge
  on the toolbar icon.
- **Organise on browser startup** — sweep restored tabs when Chrome opens.
- **Move tabs that no longer fit** — a tab in one of your groups that navigates
  elsewhere moves to the group that now matches.
- **Release tabs that match nothing** — pull tabs out of your groups when no
  rule matches any more. Off by default.

Groups, rules and settings export to a JSON file from the **Backup** tab.

## Development

```bash
npm run build       # icons + typecheck + bundle to dist/
npm run typecheck   # tsc --noEmit
npm run test        # matching-engine unit tests
npm run package     # build, then zip dist/ for upload
```

After a rebuild, hit the reload button on the extension card in
`chrome://extensions` to pick up the new service worker.

### Layout

```
src/lib/          matching engine, storage schema, Chrome-group orchestration
src/background/   MV3 service worker — events, debouncing, message handling
src/popup/        toolbar popup
src/options/      full settings page
src/ui/           shared components, theme, config hook
scripts/          generates the PNG icons from code
tests/            unit tests for the matching engine (node --test)
```

The pages and the service worker are bundled separately: the worker is emitted
as one self-contained script so it never depends on chunk resolution at runtime.

### Design notes

- **Chrome groups are identified by title.** Chrome gives tab groups an id that
  does not survive a browser restart, so there is nothing stable to store. Using
  the title means no persisted mapping to keep in sync — and it gives the
  "renaming hands it back to you" behaviour for free.
- **Groups are per window.** Chrome has no cross-window groups, so a sweep
  creates one group per window per rule-group and batches tabs into a single
  `tabs.group` call per bucket.
- **Storage is `local`, not `sync`.** `storage.sync` has an 8 KB per-item cap,
  which a few hundred rules would blow through. JSON export covers moving
  between machines.

## Permissions

| Permission | Why |
| --- | --- |
| `tabs` | read tab URLs and titles to match them against your rules |
| `tabGroups` | create groups and set their title, colour and collapsed state |
| `storage` | keep your groups and settings in this browser profile |

No host permissions, no network access. Nothing leaves the browser.

## Licence

MIT — see [LICENSE](LICENSE).
