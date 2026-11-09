import { Request, Response } from 'express';
import { catchPromise } from './catchPromise';
import { Backend } from './mailingAction';


// Прозрачная картинка 1×1
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// Ответ mail-server ждём недолго: картинка и переход не должны зависать
const BACKEND_TIMEOUT = 5000;

function isId (value: string): boolean {
  return /^\d{1,15}$/.test(value);
}

function isToken (value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

/**
 * Счётчик открытия письма: /t/o/<рассылка>/<токен>. Сообщает mail-server
 * (POST /tracking/open) и всегда отдаёт прозрачную картинку, даже если
 * mail-server недоступен: письмо не должно показывать сломанное изображение
 */
export function trackOpen (backend: Backend) {
  return catchPromise(async function (req: Request, res: Response) {
    const { mailingId, token } = req.params as Record<string, string>;
    if (isId(mailingId) && isToken(token)) {
      try {
        await callBackend(backend, '/tracking/open', { mailingId: Number(mailingId), token });
      } catch (error) {
        console.error('Tracking open: ', error);
      }
    }
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.type('image/gif').send(PIXEL);
  });
}

/**
 * Переход по ссылке: /t/c/<рассылка>/<токен>/<номер>. Исходный адрес даёт
 * mail-server (POST /tracking/click), сам адрес в ссылке не передаётся,
 * поэтому перенаправить на произвольный адрес нельзя
 */
export function trackClick (backend: Backend) {
  return catchPromise(async function (req: Request, res: Response) {
    const { link, mailingId, token } = req.params as Record<string, string>;
    let url: string | undefined;
    if (isId(mailingId) && isToken(token) && isId(link)) {
      const data = await callBackend(backend, '/tracking/click', {
        link: Number(link), mailingId: Number(mailingId), token
      });
      url = data && typeof data.url === 'string' ? data.url : undefined;
    }
    if (!url || !/^https?:\/\//i.test(url)) {
      res.status(404).type('text').send('Ссылка не найдена');
      return;
    }
    res.set('Cache-Control', 'no-store');
    res.redirect(302, url);
  });
}

// data из ответа mail-server или null, если он ответил ошибкой
async function callBackend (
  backend: Backend, path: string, body: object
): Promise<Record<string, unknown> | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (backend.apiKey) {
    headers.Authorization = `Bearer ${backend.apiKey}`;
  }
  const response = await fetch(backend.url + path, {
    body: JSON.stringify(body),
    headers,
    method: 'POST',
    signal: AbortSignal.timeout(BACKEND_TIMEOUT)
  });
  if (!response.ok) {
    return null;
  }
  const json = await response.json() as { data?: Record<string, unknown> };
  return json.data || null;
}
