import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer, IncomingMessage, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app';
import { Config } from '../src/config';


interface BackendRequest {
  authorization?: string;
  body: unknown;
  contentType?: string;
  url?: string;
}

interface BackendReply {
  body: unknown;
  status: number;
}

const SUCCESS: BackendReply = { body: { data: {}, success: true }, status: 200 };

// Шаблоны *.hbs.example, скопированные под рабочими именами
function prepareTemplates (): string {
  const source = join(__dirname, '..', '..', 'templates');
  const dir = mkdtempSync(join(tmpdir(), 'facade-templates-'));
  for (const name of readdirSync(source)) {
    copyFileSync(join(source, name), join(dir, name.replace(/\.example$/, '')));
  }
  return dir;
}

function listen (server: Server): Promise<string> {
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });
}

function readBody (req: IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
  });
}

describe('subscription-facade', function () {
  let templatesDir: string;
  let backend: Server, backendUrl: string;
  let requests: BackendRequest[];
  let reply: BackendReply;
  const servers: Server[] = [];

  before(async function () {
    templatesDir = prepareTemplates();
    backend = createServer(async (req, res) => {
      requests.push({
        ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
        body: JSON.parse(await readBody(req)),
        contentType: req.headers['content-type'],
        url: req.url
      });
      res.writeHead(reply.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reply.body));
    });
    backendUrl = await listen(backend);
  });

  after(function () {
    backend.close();
    servers.forEach(server => server.close());
    rmSync(templatesDir, { force: true, recursive: true });
  });

  beforeEach(function () {
    requests = [];
    reply = SUCCESS;
  });

  async function startFacade (
    mailingId: number | null = null, apiKey?: string
  ): Promise<string> {
    const config: Config = { apiKey, backend: backendUrl, mailingId, port: 0 };
    const server = createServer(createApp(config, { templatesDir }));
    servers.push(server);
    return listen(server);
  }

  async function get (url: string): Promise<{ status: number, text: string }> {
    const response = await fetch(url);
    return { status: response.status, text: await response.text() };
  }

  it('should subscribe and show success page', async function () {
    const facade = await startFacade();
    const page = await get(`${facade}/subscribe?mailingId=12&email=a%40b.ru&code=xyz`);

    assert.equal(page.status, 200);
    assert.match(page.text, /Подписка подтверждена/);
    assert.match(page.text, /a@b\.ru/);
    assert.deepEqual(requests, [{
      body: { code: 'xyz', email: 'a@b.ru' },
      contentType: 'application/json',
      url: '/mailings/12/subscribe'
    }]);
  });

  it('should show text from mailing on success', async function () {
    reply = { body: { data: { text: '<b>Custom</b>' }, success: true }, status: 200 };
    const facade = await startFacade();
    const page = await get(`${facade}/unsubscribe?mailingId=3&email=a%40b.ru&code=1`);
    assert.match(page.text, /<b>Custom<\/b>/);
  });

  it('should send null code on unsubscribe without code', async function () {
    const facade = await startFacade();
    const page = await get(`${facade}/unsubscribe?mailingId=3&email=a%40b.ru`);
    assert.match(page.text, /Вы отписались/);
    assert.deepEqual(requests[0].body, { code: null, email: 'a@b.ru' });
    assert.equal(requests[0].url, '/mailings/3/unsubscribe');
  });

  it('should show error page when mail-server rejects request', async function () {
    reply = { body: { error: 'Code mismatch.', success: false }, status: 400 };
    const facade = await startFacade();
    const page = await get(`${facade}/subscribe?mailingId=12&email=a%40b.ru&code=bad`);
    assert.equal(page.status, 200);
    assert.match(page.text, /Не удалось подтвердить подписку/);
  });

  it('should pass the API key to mail-server', async function () {
    const facade = await startFacade(null, 'ep_secret');
    await get(`${facade}/subscribe?mailingId=12&email=a%40b.ru&code=x`);
    assert.equal(requests[0].authorization, 'Bearer ep_secret');
  });

  it('should use fixed mailingId from config', async function () {
    const facade = await startFacade(77);
    await get(`${facade}/subscribe?mailingId=12&email=a%40b.ru&code=x`);
    assert.equal(requests[0].url, '/mailings/77/subscribe');
  });

  it('should not pass unsafe mailingId to mail-server', async function () {
    const facade = await startFacade();
    const page = await get(
      `${facade}/subscribe?mailingId=..%2Fcreate-retry%3F&email=a%40b.ru&code=x`
    );
    assert.match(page.text, /Не удалось подтвердить подписку/);
    assert.deepEqual(requests, []);
  });

  it('should escape email in page', async function () {
    reply = { body: { error: 'Not subscribed.', success: false }, status: 400 };
    const facade = await startFacade();
    const page = await get(`${facade}/subscribe?mailingId=1&email=%3Cscript%3E&code=x`);
    assert.doesNotMatch(page.text, /<script>/);
    assert.match(page.text, /&lt;script&gt;/);
  });

  it('should answer 500 when mail-server is unavailable', async function () {
    const config: Config = { backend: 'http://127.0.0.1:1', mailingId: null, port: 0 };
    const server = createServer(createApp(config, { templatesDir }));
    servers.push(server);
    const facade = await listen(server);
    const page = await get(`${facade}/subscribe?mailingId=1&email=a%40b.ru&code=x`);
    assert.equal(page.status, 500);
    assert.match(page.text, /Сервис временно недоступен/);
  });

  describe('tracking', function () {
    it('should report an open and answer with a transparent GIF', async function () {
      const facade = await startFacade(null, 'ep_secret');
      const response = await fetch(`${facade}/t/o/12/k3Jd9Q-_x`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/gif');
      assert.match(response.headers.get('cache-control') || '', /no-store/);
      assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 6).toString(), 'GIF89a');
      assert.deepEqual(requests, [{
        authorization: 'Bearer ep_secret',
        body: { mailingId: 12, token: 'k3Jd9Q-_x' },
        contentType: 'application/json',
        url: '/tracking/open'
      }]);
    });

    it('should answer with the GIF even when mail-server fails', async function () {
      reply = { body: { error: 'oops', success: false }, status: 500 };
      const facade = await startFacade();
      const response = await fetch(`${facade}/t/o/12/tok`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/gif');
    });

    it('should redirect a click to the address from mail-server', async function () {
      reply = {
        body: { data: { url: 'https://example.com/offer?a=1' }, success: true }, status: 200
      };
      const facade = await startFacade();
      const response = await fetch(`${facade}/t/c/12/tok/3`, { redirect: 'manual' });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), 'https://example.com/offer?a=1');
      assert.deepEqual(requests[0].body, { link: 3, mailingId: 12, token: 'tok' });
      assert.equal(requests[0].url, '/tracking/click');
    });

    it('should answer 404 for an unknown link', async function () {
      reply = { body: { error: 'Link not found', success: false }, status: 404 };
      const facade = await startFacade();
      const response = await fetch(`${facade}/t/c/12/tok/3`, { redirect: 'manual' });
      assert.equal(response.status, 404);
    });

    it('should not redirect to a non-http address', async function () {
      reply = { body: { data: { url: 'javascript:alert(1)' }, success: true }, status: 200 };
      const facade = await startFacade();
      const response = await fetch(`${facade}/t/c/12/tok/0`, { redirect: 'manual' });
      assert.equal(response.status, 404);
    });

    it('should not call mail-server for malformed addresses', async function () {
      const facade = await startFacade();
      assert.equal((await fetch(`${facade}/t/o/x1/tok`)).status, 200);
      assert.equal((await fetch(`${facade}/t/c/12/to.k/0`, { redirect: 'manual' })).status, 404);
      assert.equal((await fetch(`${facade}/t/c/12/tok/-1`, { redirect: 'manual' })).status, 404);
      assert.deepEqual(requests, []);
    });
  });

  it('should answer plain text 500 without error template', async function () {
    rmSync(join(templatesDir, 'error.hbs'));
    const config: Config = { backend: 'http://127.0.0.1:1', mailingId: null, port: 0 };
    const server = createServer(createApp(config, { templatesDir }));
    servers.push(server);
    const facade = await listen(server);
    const page = await get(`${facade}/subscribe?mailingId=1&email=a%40b.ru&code=x`);
    assert.equal(page.status, 500);
    assert.equal(page.text, 'Internal Server Error');
  });
});
