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
loading, the extension finds every group whose rules match and drops the tab into
the one that matched *most specifically*:

```
Dev    →  Domain           github.com
Work   →  URL starts with  https://github.com/acme/
```

`github.com/acme/api` goes to **Work** even though **Dev** is listed first,
because `github.com/acme/` pins down more of the URL than `github.com` does.
Every other GitHub URL goes to **Dev**.

### When two groups cover the same site

Specificity is measured in characters of the URL a rule pins down, ignoring the
scheme. So a site can live in two groups at once:

```
Social            →  Domain           instagram.com                        (13)
Content creation  →  URL starts with  https://www.instagram.com/robin0007  (27)
```

`instagram.com/robin0007/reels` goes to **Content creation**; anything else on
Instagram goes to **Social**. A group is judged on its best matching rule, not
its first, and when two groups pin down exactly as much, the one higher up the
list wins — so **Groups** order is still the tie-breaker. **Try a URL** at the
bottom of the Groups tab shows the winner and every runner-up, with the rule
that decided it.

### Rule types

| Type | Matches | Example |
| --- | --- | --- |
| `Domain` | the host and all its subdomains | `youtube.com` also catches `music.youtube.com` |
| `URL starts with` | a URL prefix, with or without the scheme | `github.com/myorg/` |
| `Contains` | text anywhere in the URL **or** the page title | `invoice` |
| `Regex` | a JavaScript regular expression against the URL | `^https://.*\.atlassian\.net/browse/` |

Paste a whole list of domains at once with **Paste a list** on any group.

### Finding an open tab

Three ways to search the tabs you already have open, by title or address:

- The **search field** at the top of the popup. Arrow keys move through the
  results, `Enter` jumps to the tab, `Esc` clears the field, and the `×` on a
  row closes that tab. Each result shows the Chrome group it is sitting in.
- `Alt+Shift+O` opens the popup with the field already focused. Rebind it at
  `chrome://extensions/shortcuts`.
- Type `tab` in the address bar, then `Tab` or a space, then your query. Picking
  a suggestion focuses that tab, pulling its window forward if it is in another
  one.

- On the **new tab page**, type `/tab` and then your query (see below).

Every word you type has to land somewhere, so adding a word narrows the list.
Only tabs that are open right now are searched — nothing is indexed or kept, and
browser pages like `chrome://extensions` are findable even though they are never
organised.

### New tab page

Opening a tab shows a big clock, a time-of-day greeting and one search bar, over
a background that changes with the hour (morning, afternoon, evening, night). The
backdrop is drawn in CSS — no images, no network.

What you type decides what is searched:

| Type | What happens |
| --- | --- |
| `some words` | Search the web with **your own** default search engine |
| `github.com`, `localhost:3000` | An **Open** row comes first; the web search is one arrow key down |
| `/tab xyz` | Search your open tabs. `Enter` jumps to one and closes the blank tab you came from |
| `/tab` | List every open tab, current window first — a quick switcher |
| `/` | List the available commands; `Tab` or `Enter` completes one |

An unknown `/something` is simply searched for as typed, so nothing is swallowed.
Typing a page that is already open merges into the tab you already have (see
*Duplicate tabs*). Arrow keys move, `Esc` clears.

Set your name, a 12/24-hour clock and a fixed background scene under **Settings →
New tab page**.

Things to know before installing:

- It **replaces Chrome's new tab page**. An extension cannot hand it back
  mid-session; disable or remove the extension to get Chrome's own page again.
  Chrome allows one extension to own the new tab, so if you have another new-tab
  extension the most recently installed one wins.
- The `search` permission is what lets the bar use your default search engine
  instead of one hard-coded here.
- The search bar asks for keyboard focus as the page opens. If Chrome leaves the
  cursor in the address bar instead, click the bar, or use the `tab` address-bar
  keyword for tab search.

#### Adding a search source

Every source is one object that satisfies `Provider` in
[`src/lib/universal.ts`](src/lib/universal.ts). To add, say, bookmarks:

1. Create `src/newtab/providers/bookmarks.ts` exporting a `Provider` with
   `trigger: '/bm'`, a `label`, a `hint`, and a `search(query)` that returns
   `Result` rows — each row carries its own `activate()`, so the search bar never
   needs to know what kind of thing it is showing.
2. Add it to `COMMANDS` in `src/newtab/providers/index.ts`. It then appears in the
   `/` command list and in the hint under the bar.
3. If it needs a new permission (bookmarks and history both do), add it to the
   manifest and the permissions table below.

### Duplicate tabs

Open a page that is already open and the new tab never sticks around: it closes,
the tab you already had comes to the front (pulling its window forward if it is in
another one) and reloads. It works for links, `Ctrl/Cmd+Click`, the address bar —
anything that opens a new tab.

- "Same page" means the same address, including the query and the `#fragment`,
  so `…/mail/#inbox` and `…/mail/#sent` stay separate tabs. `www.` and `http` vs
  `https` also count as different.
- Only a tab's **first** page is checked. Clicking a link inside a tab you are
  already using never closes that tab.
- **Duplicate** from the tab's right-click menu is deliberate, so it is kept.
- Only `http` and `https` pages count. Popup windows are never closed, and an
  incognito tab only merges with another incognito tab.
- Turn it off with **Merge duplicate tabs** in Settings.

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
- **New tab page** — your name, a 12/24-hour clock and a fixed background scene.
- **Merge duplicate tabs** — opening a page that is already open closes the new
  tab and reloads the existing one. On by default.
- **Move tabs that no longer fit** — a tab in one of your groups that navigates
  elsewhere moves to the group that now matches.
- **Release tabs that match nothing** — pull tabs out of your groups when no
  rule matches any more. Off by default.

Groups, rules and settings export to a JSON file from the **Backup** tab.

## Development

```bash
npm run build       # icons + typecheck + bundle to dist/
npm run typecheck   # tsc --noEmit
npm run test        # matching, tab search, duplicates, new-tab parsing and clock unit tests
npm run package     # build, then zip dist/ for upload
```

After a rebuild, hit the reload button on the extension card in
`chrome://extensions` to pick up the new service worker.

### Layout

```
src/lib/          matching engine, tab search, duplicate merging, universal-search parsing,
                  greeting and clock, storage schema, Chrome-group orchestration
src/background/   MV3 service worker — events, debouncing, message handling
src/popup/        toolbar popup
src/newtab/       new tab page — clock, background, search bar and its providers/
src/options/      full settings page
src/ui/           shared components, theme, config hook
scripts/          generates the PNG icons from code
tests/            unit tests for the pure logic in src/lib (node --test)
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
- **Specificity beats list order.** Ranking by how much of the URL a rule pins
  down means a URL like `instagram.com/you` reaches the right group without the
  user having to reason about which group to drag above which. List order is
  kept as the tie-breaker so the old behaviour still applies when two rules are
  equally precise.
- **Search reads live tabs, never an index.** `chrome.tabs.query` is the only
  source, so there is nothing to keep fresh, nothing to invalidate and no record
  of what you have had open.
- **A tab is "new" until its first web page commits.** Chrome reports a freshly
  opened tab with an empty `url` and the target in `pendingUrl`, whereas a
  duplicated tab already carries its `url`. Tracking "has this tab shown a page
  yet" therefore separates *opening* a page from *navigating* to one, without
  asking the user to tell us which they meant. The set is held in memory; if the
  service worker is recycled mid-load the tab is simply not merged.
- **Merges are serialised.** Two identical tabs opened together would each see
  the other as the original and both close, so merges run through one queue.
- **Search sources are plugins.** The bar parses what you typed, picks a
  `Provider`, and shows whatever `Result` rows it returns; each row knows how to
  activate itself. The parsing and URL heuristics are pure functions in
  `src/lib/universal.ts`, so they are unit-tested without a browser, while
  everything that touches Chrome lives in `src/newtab/providers/`.
- **The new tab navigates itself rather than opening another.** That lets the
  duplicate merge recognise a page that is already open with no extra code.
- **The clock ticks on the minute, not the second.** No seconds are shown, so a
  1 s interval would be 59 wasted renders in 60; the time is re-read when the tab
  becomes visible because browsers throttle timers in background tabs.
- **Storage is `local`, not `sync`.** `storage.sync` has an 8 KB per-item cap,
  which a few hundred rules would blow through. JSON export covers moving
  between machines.

## Permissions

| Permission | Why |
| --- | --- |
| `tabs` | read tab URLs and titles to match them against your rules, and to search them |
| `tabGroups` | create groups and set their title, colour and collapsed state |
| `storage` | keep your groups and settings in this browser profile |
| `search` | run a web search from the new tab page with your default search engine |

No host permissions, no network access. Nothing leaves the browser.

## Licence

MIT — see [LICENSE](LICENSE).
