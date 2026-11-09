<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/pochtar-logo-dark.svg">
  <img alt="Почтарь" src="docs/pochtar-logo.svg" height="64">
</picture>

# eterpost-subscription-facade

[English](README.md) | **Русский**

Публичный HTTP-сервер со страницами подписки и отписки для рассылок
[mail-server](https://github.com/Eterpost/eterpost-server). Человек переходит по
ссылке из письма, subscription-facade передаёт адрес и код в API mail-server и
показывает HTML-страницу с результатом:

```
(человек) -----------------> (subscription-facade) -----------------------------> (mail-server)
  ^   GET /subscribe?...              |       ^     POST /mailings/<id>/subscribe      |
  |   GET /unsubscribe?...            |       |     POST /mailings/<id>/unsubscribe    |
  |                                   |       |                                        |
  |-----------------------------------|       |----------------------------------------|
      HTML-страница с ответом                                 JSON
```

mail-server не рассчитан на доступ из интернета, поэтому снаружи должен быть
доступен только subscription-facade, а mail-server — лишь из внутренней сети. Как устроена
вся система (mail-server, subscription-facade,
[mail-sorter](https://github.com/Eterpost/eterpost-sorter)), описано в README
mail-server.

## Ссылки в письмах

| Страница | Параметры | Вызов mail-server |
|---|---|---|
| `/subscribe` | `mailingId`, `email`, `code` | `POST /mailings/<mailingId>/subscribe` |
| `/unsubscribe` | `mailingId`, `email`, `code` (необязателен) | `POST /mailings/<mailingId>/unsubscribe` |

`mailingId` — только число; если он задан в конфигурации, параметр из ссылки не
используется.

Ссылка подтверждения подписки — в шаблоне письма mail-server
`templates/confirm-subscription.hbs`:

```
https://subscribe.example.com/subscribe?mailingId={{mailing.id}}&email={{subscriptionRequest.email}}&code={{subscriptionRequest.code}}
```

Ссылка отписки — в тексте рассылки (коды получателям назначаются, когда у рассылки
включена «возможность подписки через API»):

```
https://subscribe.example.com/unsubscribe?mailingId={{mailing.id}}&email={{receiver.email}}&code={{receiver.code}}
```

## Отслеживание открытий и переходов

Если у рассылки включено отслеживание, mail-server вставляет в письма ссылки на
facade (`server.tracking.url` в mail-server — публичный адрес facade):

| Адрес | Что делает | Вызов mail-server |
|---|---|---|
| `/t/o/<рассылка>/<токен>` | отдаёт прозрачную картинку 1×1, даже если mail-server недоступен | `POST /tracking/open` |
| `/t/c/<рассылка>/<токен>/<номер>` | перенаправляет (302) на исходную ссылку; неизвестная — 404 | `POST /tracking/click` |

Исходный адрес ссылки хранит mail-server, в адресе перехода его нет, поэтому
через facade нельзя перенаправить на произвольный адрес. В nginx для этого
нужен `location /t/` на facade (см. `deploy/lxc/nginx` в mail-server).

## Установка и запуск

Нужен Node.js 22.23 или новее.

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

Свои шаблоны можно подложить в `/app/templates/*.hbs`, иначе используются
`*.hbs.example`.

## Конфигурация

Файл `config.json` в корне проекта накладывается поверх `config.default.json`:

```json
{
  "backend": "http://192.168.12.34:8000",
  "apiKey": "ep_...",
  "mailingId": null,
  "port": 8001,
  "host": "127.0.0.1"
}
```

- `backend` — адрес API mail-server;
- `apiKey` — ключ API mail-server (выдаётся командой `api-keys add` mail-server,
  передаётся в заголовке `Authorization: Bearer`); нужен, когда на mail-server
  включена проверка ключей;
- `mailingId` — если задан, все запросы идут к этой рассылке;
- `port` — порт HTTP-сервера;
- `host` — адрес для приёма соединений (по умолчанию все интерфейсы); за
  обратным прокси лучше `127.0.0.1`.

## Шаблоны страниц

Шаблоны [Handlebars](https://handlebarsjs.com/) в каталоге `templates`:

- `base.hbs` — общий макет страницы (оформление, стили, скрипты); содержимое
  страниц подставляется на место `{{> @partial-block }}`;
- `subscribe.hbs` — результат подписки;
- `unsubscribe.hbs` — результат отписки;
- `error.hbs` — страница, когда mail-server недоступен (ответ 500). Если шаблона
  нет, отдаётся текст «Internal Server Error».

Шаблоны получают:

- `email` — адрес из ссылки;
- `subscribeSuccess` / `unsubscribeSuccess` — удалось ли действие;
- `text` — HTML из настроек рассылки (`extraData.textAfterSubscribe` /
  `textAfterUnsubscribe` в mail-server), если он задан; выводится как есть
  (`{{{ text }}}`).

Если mail-server недоступен, отдаётся ответ 500.

## Разработка

- `npm test` — сборка и тесты (`node:test`, mail-server подменяется локальным HTTP-сервером);
- `npm run lint`, `npm run typecheck`;
- `npm run watch` и `npm run watch-run` — пересборка и перезапуск при изменениях.

## Ошибки и пожелания

Ошибки и пожелания принимаются в Bugzilla Etersoft: продукт Eterpost,
компонент eterpost-subscription-facade — [завести задачу](https://bugs.etersoft.ru/enter_bug.cgi?product=Eterpost&component=eterpost-subscription-facade).

## ![AGPL](https://www.gnu.org/graphics/agplv3-88x31.png) Лицензия

GNU AGPL v3, см. [LICENSE](LICENSE).
