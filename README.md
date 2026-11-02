# subscription-facade

Публичный HTTP-сервер со страницами подписки и отписки для рассылок
[mail-server](https://github.com/Etersoft/mail-server). Человек переходит по
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

У API mail-server нет аутентификации, поэтому из интернета должен быть доступен
только subscription-facade, а mail-server — лишь из внутренней сети. Как устроена
вся система (mail-server, subscription-facade,
[mail-sorter](https://github.com/Etersoft/mail-sorter)), описано в README
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
