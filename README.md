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

Every word you type has to land somewhere, so adding a word narrows the list.
Only tabs that are open right now are searched — nothing is indexed or kept, and
browser pages like `chrome://extensions` are findable even though they are never
organised.

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
npm run test        # matching-engine and tab-search unit tests
npm run package     # build, then zip dist/ for upload
```

After a rebuild, hit the reload button on the extension card in
`chrome://extensions` to pick up the new service worker.

### Layout

```
src/lib/          matching engine, tab search, storage schema, Chrome-group orchestration
src/background/   MV3 service worker — events, debouncing, message handling
src/popup/        toolbar popup
src/options/      full settings page
src/ui/           shared components, theme, config hook
scripts/          generates the PNG icons from code
tests/            unit tests for the matching engine and tab search (node --test)
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
- **Storage is `local`, not `sync`.** `storage.sync` has an 8 KB per-item cap,
  which a few hundred rules would blow through. JSON export covers moving
  between machines.

## Permissions

| Permission | Why |
| --- | --- |
| `tabs` | read tab URLs and titles to match them against your rules, and to search them |
| `tabGroups` | create groups and set their title, colour and collapsed state |
| `storage` | keep your groups and settings in this browser profile |

No host permissions, no network access. Nothing leaves the browser.

## Licence

MIT — see [LICENSE](LICENSE).
