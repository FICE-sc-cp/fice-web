export const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'TELEGRAM_BOT_TOKEN',
  'USER_BOT_TOKEN',
  'USER_BOT_USERNAME',
  'ADMIN_GROUP_CHAT_ID',
  'MINI_APP_URL',
  'USER_MINI_APP_URL',
  'PUBLIC_WEB_URL',
  'CORS_ORIGIN',
] as const;

const HTTPS_URLS = ['MINI_APP_URL', 'USER_MINI_APP_URL', 'PUBLIC_WEB_URL'];

type Env = Record<string, unknown>;

export function isProduction(env: Env = process.env): boolean {
  return str(env.APP_ENV) === 'production';
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function productionEnvErrors(env: Env): string[] {
  const errors: string[] = [];

  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!str(env[key])) errors.push(`${key} is required`);
  }

  if (str(env.AUTH_DISABLED) === 'true') {
    errors.push('AUTH_DISABLED=true is not allowed');
  }

  const adminToken = str(env.TELEGRAM_BOT_TOKEN);
  const userToken = str(env.USER_BOT_TOKEN);
  if (adminToken && userToken && adminToken === userToken) {
    errors.push('TELEGRAM_BOT_TOKEN and USER_BOT_TOKEN must be different bots');
  }

  const groupId = str(env.ADMIN_GROUP_CHAT_ID);
  if (groupId && !/^-?\d+$/.test(groupId)) {
    errors.push('ADMIN_GROUP_CHAT_ID must be a numeric chat id');
  }

  const username = str(env.USER_BOT_USERNAME);
  if (username && !/^[A-Za-z0-9_]{5,32}$/.test(username)) {
    errors.push('USER_BOT_USERNAME must be the bot username without "@"');
  }

  for (const key of HTTPS_URLS) {
    const value = str(env[key]);
    if (value && !isHttpsUrl(value)) errors.push(`${key} must be an https URL`);
  }

  const origins = str(env.CORS_ORIGIN);
  if (origins) {
    for (const origin of origins.split(',').map((o) => o.trim())) {
      if (!isHttpsUrl(origin) || new URL(origin).origin !== origin) {
        errors.push(`CORS_ORIGIN entry "${origin}" must be an https origin`);
      }
    }
  }

  return errors;
}

export function validateEnv(env: Env): Env {
  if (!isProduction(env)) return env;
  const errors = productionEnvErrors(env);
  if (errors.length) {
    throw new Error(
      `Refusing to start with APP_ENV=production:\n- ${errors.join('\n- ')}`,
    );
  }
  return env;
}
