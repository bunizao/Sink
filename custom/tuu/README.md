# Fork UI

The terminal homepage and error page belong to this fork. Keep their implementation here instead of modifying upstream's application files.

`modules/tuu.ts` is automatically loaded by Nuxt. It selects `Home.vue` for `/`, registers `Layout.vue` as `tuu-home`, selects `Error.vue`, and loads the local stylesheet and head plugin. It also includes these runtime files in Nuxt's application type check.

## Files

- `Home.vue`: terminal commands, authentication checks, and short-link creation through Sink's existing API. Public GitHub statistics are cached for five minutes in memory and per-tab session storage.
- `Cat.vue`: the isolated animation component; it pauses when the page is hidden or reduced motion is requested.
- `Error.vue`: terminal error screen and return-home action; its flicker and recovery timers pause and clean up together.
- `Layout.vue`: homepage layout.
- `theme.css`: imports upstream's unchanged stylesheet, explicitly includes this directory in Tailwind's class scan, and scopes the monospace font to `.tuu-terminal` so dashboard typography follows upstream.
- `Toaster.vue`: forwards dashboard notifications through a lazy component, keeping notification code out of the homepage.
- `head.ts`: points favicon and touch-icon entries to the fork's assets under `public/tuu/`, including on the error page.

The terminal font is served locally from `public/tuu/fonts/`; its SIL Open Font License is included alongside the asset. It is preloaded only on terminal screens.

Links prefetch only after pointer hover or keyboard focus, rather than merely becoming visible. The initial HTML does not prefetch unrelated routes. Other pages still load their required chunks on navigation.

Keep reusable terminal styles scoped to the components or prefixed with `.tuu-terminal`. Avoid redefining upstream's global theme tokens. Homepage GitHub statistics are fetched here rather than through an upstream presentation composable.

## Upstream updates

The upstream homepage, hero component, error page, root application, global CSS, and root icon files are intentionally unchanged. `.nuxtrc` sets production compression and the precompiled i18n runtime before upstream modules initialize. The fork module disables blanket route prefetch hints, defers notifications, and isolates the public brand-icon imports from the large analytics icon set. Allow them to update normally. `.github/sync-upstream-excluded-paths.txt` protects only the fork module, this directory, the namespaced icons, and existing deployment/workflow overrides.

The synchronization test exercises simultaneous upstream frontend updates and conflicts inside the fork-owned directories, including newly added files and deleted local files. It also checks that similarly named directories remain eligible for upstream updates.

After an upstream sync, run:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm types:check
pnpm test:sync-upstream
pnpm build
pnpm test --run
```

Then check `/`, `/dashboard/login`, and a nonexistent short link in a browser. Verify the terminal's `sudo` command, authenticated short-link creation, duplicate-slug errors, mobile layout, and icons. Git merges cannot detect incompatible API or framework changes; these checks cover that remaining integration risk.

## Performance regression checks

With Python Playwright installed and a local preview already running, run:

```sh
python custom/tuu/check-performance.py http://localhost:7469
```

The browser checks cover visible/hidden/reduced-motion animation, statistics caching across reloads, cache expiry and invalidation, and leaving the error screen during its recovery timeout. They also enforce a 400 KB / 18-script homepage budget and check lazy notifications and all 11 locales with the production i18n compiler removed. They stub only the public GitHub statistics request and use local routes.
