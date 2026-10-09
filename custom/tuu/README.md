# Fork UI

The terminal homepage and error page belong to this fork. Keep their implementation here instead of modifying upstream's application files.

`modules/tuu.ts` is automatically loaded by Nuxt. It selects `Home.vue` for `/`, registers `Layout.vue` as `tuu-home`, selects `Error.vue`, and loads the local stylesheet and head plugin. It also includes these runtime files in Nuxt's application type check.

## Files

- `Home.vue`: terminal commands, cat animation, authentication checks, and short-link creation through Sink's existing API.
- `Error.vue`: terminal error screen and return-home action.
- `Layout.vue`: homepage layout.
- `theme.css`: imports upstream's unchanged stylesheet, explicitly includes this directory in Tailwind's class scan, and scopes the monospace font to `.tuu-terminal` so dashboard typography follows upstream.
- `head.ts`: points favicon and touch-icon entries to the fork's assets under `public/tuu/`, including on the error page.

Keep reusable terminal styles scoped to the components or prefixed with `.tuu-terminal`. Avoid redefining upstream's global theme tokens. Homepage GitHub statistics are fetched here rather than through an upstream presentation composable.

## Upstream updates

The upstream homepage, hero component, error page, global CSS, and root icon files are intentionally unchanged. Allow them to update normally. `.github/sync-upstream-excluded-paths.txt` protects only the fork module, this directory, the namespaced icons, and existing deployment/workflow overrides.

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
