import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';


export interface Config {
  // Ключ API mail-server (заголовок Authorization: Bearer)
  apiKey?: string;
  // URL API mail-server
  backend: string;
  // Если указан, запросы всегда идут к этой рассылке, иначе — к mailingId из запроса
  mailingId: number | null;
  port: number;
  // Адрес для приёма соединений; не задан — все интерфейсы
  host?: string;
}

const ROOT = join(__dirname, '..', '..');

export function readConfig (): Config {
  const config = readJson(join(ROOT, 'config.default.json')) as Config;
  const userConfigPath = join(ROOT, 'config.json');
  if (existsSync(userConfigPath)) {
    Object.assign(config, readJson(userConfigPath));
  }
  return config;
}

function readJson (path: string): Partial<Config> {
  return JSON.parse(readFileSync(path, 'utf8'));
}
