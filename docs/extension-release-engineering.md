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
- `release-extension.yml` reruns the same release gates before publishing GitHub
  release assets for tags.
