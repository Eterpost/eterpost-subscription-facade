<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/eterpost-logo-dark.svg">
  <img alt="Eterpost" src="docs/eterpost-logo.svg" height="64">
</picture>

# eterpost-subscription-facade

**English** | [Русский](README.ru.md)

A public HTTP server with the subscribe and unsubscribe pages for mailings of
[mail-server](https://github.com/Eterpost/eterpost-server). A person follows a
link from a letter, subscription-facade passes the address and the code to the
mail-server API and shows an HTML page with the result:

```
(person) ------------------> (subscription-facade) -----------------------------> (mail-server)
  ^   GET /subscribe?...              |       ^     POST /mailings/<id>/subscribe      |
  |   GET /unsubscribe?...            |       |     POST /mailings/<id>/unsubscribe    |
  |                                   |       |                                        |
  |-----------------------------------|       |----------------------------------------|
          HTML page with the result                           JSON
```

mail-server is not meant to be reachable from the internet, so only
subscription-facade should be public, and mail-server only reachable from the
internal network. The whole system (mail-server, subscription-facade,
[mail-sorter](https://github.com/Eterpost/eterpost-sorter)) is described in the
mail-server README.

## Links in letters

| Page | Parameters | mail-server call |
|---|---|---|
| `/subscribe` | `mailingId`, `email`, `code` | `POST /mailings/<mailingId>/subscribe` |
| `/unsubscribe` | `mailingId`, `email`, `code` (optional) | `POST /mailings/<mailingId>/unsubscribe` |

`mailingId` must be a number; if it is set in the configuration, the parameter
from the link is ignored.

The subscription confirmation link goes into the mail-server letter template
`templates/confirm-subscription.hbs`:

```
https://subscribe.example.com/subscribe?mailingId={{mailing.id}}&email={{subscriptionRequest.email}}&code={{subscriptionRequest.code}}
```

The unsubscribe link goes into the mailing text (receivers get codes when the
mailing has "subscription through the API" turned on):

```
https://subscribe.example.com/unsubscribe?mailingId={{mailing.id}}&email={{receiver.email}}&code={{receiver.code}}
```

## Installation and start

Node.js 22.23 or newer is required.

```
$ npm ci
$ npm run build
$ for f in templates/*.example; do cp "$f" "${f%.example}"; done
$ npm start
```

### Docker

```
$ docker build -t subscription-facade .
$ docker run -v $PWD/config.json:/app/config.json -p 8001:8001 subscription-facade
```

Your own templates can be mounted as `/app/templates/*.hbs`; otherwise
`*.hbs.example` are used.

## Configuration

`config.json` in the project root is applied over `config.default.json`:

```json
{
  "backend": "http://192.168.12.34:8000",
  "apiKey": "ep_...",
  "mailingId": null,
  "port": 8001,
  "host": "127.0.0.1"
}
```

- `backend` — the mail-server API address;
- `apiKey` — a mail-server API key (issued with the mail-server `api-keys add`
  command, sent in the `Authorization: Bearer` header); needed when mail-server
  checks keys;
- `mailingId` — if set, all requests go to this mailing;
- `port` — the HTTP server port;
- `host` — the address to listen on (all interfaces by default); behind a
  reverse proxy `127.0.0.1` is better.

## Page templates

[Handlebars](https://handlebarsjs.com/) templates in the `templates` directory:

- `base.hbs` — the common page layout (design, styles, scripts); page content
  is inserted in place of `{{> @partial-block }}`;
- `subscribe.hbs` — the subscription result;
- `unsubscribe.hbs` — the unsubscription result;
- `error.hbs` — the page shown when mail-server is unavailable (response 500).
  Without this template the response is the text "Internal Server Error".

Templates receive:

- `email` — the address from the link;
- `subscribeSuccess` / `unsubscribeSuccess` — whether the action succeeded;
- `text` — HTML from the mailing settings (`extraData.textAfterSubscribe` /
  `textAfterUnsubscribe` in mail-server), if set; it is output as is
  (`{{{ text }}}`).

If mail-server is unavailable, the response is 500.

## Development

- `npm test` — build and tests (`node:test`, mail-server is replaced with a local HTTP server);
- `npm run lint`, `npm run typecheck`;
- `npm run watch` and `npm run watch-run` — rebuild and restart on changes.
