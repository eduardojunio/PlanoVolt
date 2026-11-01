# PlanoVolt

Mobile-first, PT-BR circuit planning app. React/TypeScript, Vite, React Router, Dexie/IndexedDB, Zod, Vitest, Playwright and local jsPDF export. No backend, accounts, telemetry or cloud storage.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
npm run test:e2e
```

Browser regression tests use locally installed Chrome (`channel: chrome`) and Poppler's `pdftotext` / `pdfinfo`. Install Chrome or adjust `playwright.config.ts` for your CI browser. Serve the production build to test offline operation; the development server intentionally does not register a service worker.

## Deployment

Production URL: [planovolt.eduardomacedo.net](https://planovolt.eduardomacedo.net).

The [Pages workflow](.github/workflows/deploy.yml) validates every push and pull request targeting `main`. On Ubuntu with Node.js 24, it installs locked dependencies with `npm ci`, runs unit tests, builds the production app, and runs the complete Playwright suite with Chrome and Poppler. Failed browser checks retain reports in the workflow's artifacts for seven days. Only a successful push to `main`, or a successful manual run on `main`, publishes the tested `dist/` artifact. Pull requests never deploy. No additional deployment secrets are required.

Deployments use the `github-pages` environment and run one at a time without cancelling an active deployment. GitHub may replace intermediate queued deployments during rapid pushes. A failed build or test leaves the previously deployed site published. To recover from a faulty release, revert its commit on `main`; the revert goes through the same validation and deployment pipeline. The workflow can also be rerun from the repository's Actions tab.

### Initial domain setup

1. In repository **Settings → Pages**, select **GitHub Actions** as the build source and set the custom domain to `planovolt.eduardomacedo.net`.
2. At the DNS provider for `eduardomacedo.net`, create a CNAME record named `planovolt` pointing to `eduardojunio.github.io` (without a scheme or repository path). Remove conflicting records for that hostname. If the provider offers a proxy, use DNS-only mode during GitHub validation and certificate issuance.
3. In **Settings → Environments → github-pages**, allow deployments only from the `main` branch, without required reviewers.
4. After DNS validation and certificate issuance finish, enable **Enforce HTTPS** in Pages settings. Propagation and certificate issuance may delay initial availability. Actions deployments configure the custom domain through Pages settings; no artifact `CNAME` file is required.
5. Merge the workflow into `main` and follow its first successful run. Verify HTTPS, asset loading, hash-route refresh, offline readiness, and PDF export at the production URL. Verify the next push deploys automatically and offers the existing update prompt to an open client.

The app serves static files at the custom domain's origin root; Vite's default base `/` is intentional. React Router uses URL fragments, so installation identifiers stay in the browser and never enter HTTP request paths or hosting logs. The service worker, manifest, and PDF font paths also assume this root deployment. GitHub Pages manages HTTP cache headers; this workflow does not configure them. `localhost` is suitable for local service-worker testing.

## Technical scope

Dedicated resistive PF=1 loads, 127/220 V, phase-neutral or phase-phase; copper/PVC70, two loaded conductors. B1/B2 circular conduit reference arrangements, C a single multicore cable directly on a wall. Bounded conductor catalog 2.5–35 mm² and breaker catalog 6–63 A. Unsupported conditions, unknown temperature and missing grouping data never receive invented recommendations. See [the technical specification](docs/technical-spec.md) before changing numerical behavior.

`evaluatePlan(input, ruleset)` is independent of React, storage and PDF. It reports each alternative's state, rejected candidates, criteria, assumptions, issues and materials. A known failed check blocks; insufficient calculation data means draft; open professional checks prevent validation. Essential checks cannot be marked not-applicable. Positive checks require evidence and are cleared conservatively after technical input or version changes. Failures persist until explicitly reassessed.

The supplied standard is not redistributed. Its exact identity and checksum are in the specification. Font files are bundled under the SIL Open Font License (`public/fonts/OFL.txt`; web-font licensing also ships with `@fontsource/noto-sans`). The resistance model uses supplementary manufacturer data and requires cable compatibility verification. A 16 A minimum candidate in the oven example is deliberate; the PRD's illustrative 20 A is not inferred as a normative rounding rule.

## Local data and offline behavior

Draft strings preserve incomplete decimal-comma entries. Changes autosave after 400 ms, with a visible save state; explicit save confirms only after the IndexedDB transaction succeeds. Records are validated on load, migrations run transactionally, writes/deletions are ordered, and no persisted numerical result is trusted. Unsupported/corrupt records are preserved and fail visibly.

The production worker atomically caches application assets and the PDF font. Offline availability appears after installation succeeds. New builds wait and can be activated from Home after saving; editing sessions retain the running ruleset. Prior asset caches are retained so another open tab can finish editing/exporting with its existing build; the browser can reclaim these caches. Export clones and deeply freezes an input/evaluation snapshot before loading the bundled font, and paginates all report sections locally.

Browser storage can be cleared or evicted. Export PDFs for human-readable copies; they are not restorable backups of editable plans. Browser storage failures never display a saved-success message. No service sends installation information to a server.

## Release status

Development complete is distinct from pilot release. Engineering approval of source extraction, resistance assumptions, device selection, independent reference cases and classification remains pending. Physical mid-range Android performance and electrician usability testing remain pilot tasks. UI and PDFs retain the engine-review warning, even when an individual plan has all covered checks satisfied. This application does not issue compliance reports or certifications.
