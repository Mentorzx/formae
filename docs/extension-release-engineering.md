# Extension Release Engineering

The extension release path is intentionally small and reproducible.

## Local verification

Run the browser-extension contract tests first:

```bash
node --test apps/extension/src/*.test.js
```

Then verify deterministic packaging for both Chrome and Firefox:

```bash
node scripts/verify-extension-release.mjs
```

That command packages the extension twice in isolated temporary directories and
fails if any of these drift across rebuilds:

- Chrome `zip` checksum
- Firefox `xpi` checksum
- packaged `package-metadata.json`
- release manifest

Then run the privacy-oriented package audit:

```bash
node scripts/audit-extension-package.mjs
```

That audit repackages the extension in a temporary directory and fails if the
staged release contains files or text that should never ship, such as:

- `.env` files
- local artifacts or fixtures
- `.test.js` files
- unsanitized `jsessionid=` strings
- direct `SIGAA_USERNAME=` or `SIGAA_PASSWORD=` assignments
- embedded private-key blocks

## Release build

To produce the publishable artifacts locally:

```bash
node scripts/package-extension.mjs
```

The script emits:

- `dist/releases/formae-extension-<version>.zip`
- `dist/releases/formae-extension-<version>.zip.sha256`
- `dist/releases/formae-extension-<version>.xpi`
- `dist/releases/formae-extension-<version>.xpi.sha256`
- `dist/releases/formae-extension-<version>.release-manifest.json`

## Determinism baseline

`scripts/package-extension.mjs` normalizes staged file timestamps from
`SOURCE_DATE_EPOCH` when provided, or falls back to the current Git commit
timestamp. The packaged metadata intentionally avoids output-directory-specific
paths so that CI can compare rebuilds byte-for-byte.

## CI

- `verify-extension-release.yml` runs on `push` to `main` and on pull requests
  touching extension packaging paths.
- `release-extension.yml` reruns the same reproducibility and package-audit
  gates before publishing GitHub release assets for tags.
- `publish-extension-stores.yml` is a manual workflow intended for store
  publication once publisher secrets exist.

## Store publication

The repository now includes:

- AMO metadata in `apps/extension/store/amo-metadata.json`
- Chrome listing copy in `apps/extension/store/chrome-listing.pt-BR.md`
- a readiness checklist in `apps/extension/store/store-readiness-checklist.md`
- `scripts/publish-chrome-webstore.mjs` for Chrome Web Store API upload/publish
- `scripts/publish-firefox-amo.mjs` for AMO signing/submission

The Chrome path still requires a one-time manual bootstrap in the Developer
Dashboard because the store listing and privacy fields must be completed before
publishing a new item.
