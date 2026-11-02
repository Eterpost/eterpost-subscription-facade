import { Request, Response } from 'express';
import { catchPromise } from './catchPromise';


export type MailingAction = 'subscribe' | 'unsubscribe';

export interface Backend {
  apiKey?: string;
  url: string;
}

/**
 * Обработчик страницы подписки/отписки: передаёт email и code из ссылки
 * в mail-server (POST /mailings/<id>/<action>) и показывает шаблон <action>
 * с результатом. Шаблон получает email, text (текст из рассылки, если есть)
 * и флаг subscribeSuccess/unsubscribeSuccess.
 */
export function mailingAction (
  action: MailingAction, backend: Backend, fixedMailingId: number | null
) {
  return catchPromise(async function (req: Request, res: Response) {
    const email = queryString(req, 'email');
    const code = queryString(req, 'code') ?? (action === 'unsubscribe' ? null : undefined);
    const mailingId = fixedMailingId ?? queryString(req, 'mailingId');

    let result: BackendResult = { success: false };
    // mailingId попадает в путь запроса к mail-server, поэтому допускаются только цифры
    if (email && mailingId !== undefined && /^\d+$/.test(String(mailingId))) {
      result = await callBackend(backend, `/mailings/${mailingId}/${action}`, { code, email });
    }

    res.render(action, {
      email,
      text: result.text,
      [`${action}Success`]: result.success
    });
  });
}

interface BackendResult {
  success: boolean;
  text?: string;
}

async function callBackend (
  backend: Backend, path: string, body: object
): Promise<BackendResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (backend.apiKey) {
    headers.Authorization = `Bearer ${backend.apiKey}`;
  }
  const response = await fetch(backend.url + path, {
    body: JSON.stringify(body),
    headers,
    method: 'POST'
  });
  if (!response.ok) {
    return { success: false };
  }
  const json = await response.json() as { data?: { text?: string } };
  return { success: true, text: json.data?.text };
}

function queryString (req: Request, name: string): string | undefined {
  const value = req.query[name];
  return typeof value === 'string' ? value : undefined;
}
