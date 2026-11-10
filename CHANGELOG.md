# Changelog

All notable changes to eterpost-subscription-facade. Versions follow
[Semantic Versioning](https://semver.org/); before 1.0 a minor version brings new features and
a patch version brings fixes.

## 0.2.0 — 2026-11-10

The first tagged release under the Eterpost organization.

- Open counter and tracked links of letters: `/t/o/<mailing>/<token>` answers a transparent
  image, `/t/c/<mailing>/<token>/<link>` redirects to the original address known to
  eterpost-server (no open redirect).
- An API key is sent to eterpost-server; with spaces it must be a system key
  (`api-keys add subscription-facade --system`).
- Subscription pages: clearer texts, an error page, the browser dark theme, the Eterpost name
  and favicon.
- `host` option for the listen address.
- Licensed under AGPL-3.0 like the other Eterpost projects; English README.
- Modernized for Node.js 22; Dockerfile.

## 0.1.0

The original Etersoft subscription-facade (2018–2019).
