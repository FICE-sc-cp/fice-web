import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const JAR_API_URL = 'https://api.monobank.ua/bank/jar/';
export const JAR_PUBLIC_URL = 'https://send.monobank.ua/jar/';
const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_KEEP_MS = 5 * 60_000;
export const JAR_REUSE_MS = 2 * 60_000;
const UAH = 980;
const MAX_KOPECKS = 99_999_999_999_999;
const WIDGET_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const SEND_ID_RE = /^[A-Za-z0-9]{4,32}$/;

export interface JarWidgetLink {
  widgetId: string;
  sendId: string | null;
}

export interface JarSnapshot {
  amountKopecks: number;
  goalKopecks: number;
  closed: boolean;
  sendId: string | null;
}

export type JarFetchResult =
  | { kind: 'ok'; jar: JarSnapshot }
  | { kind: 'invalid' }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'rate-limited' }
  | { kind: 'unavailable'; reason: string };

export function parseJarWidget(
  link: string | null | undefined,
): JarWidgetLink | null {
  if (!link) return null;
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  const host = url.hostname;
  if (
    url.protocol !== 'https:' ||
    (host !== 'monobank.ua' && !host.endsWith('.monobank.ua'))
  ) {
    return null;
  }
  const widgetId = url.searchParams.get('jar');
  if (!widgetId || !WIDGET_ID_RE.test(widgetId)) return null;
  const sendId = url.searchParams.get('sendId');
  return {
    widgetId,
    sendId: sendId && SEND_ID_RE.test(sendId) ? sendId : null,
  };
}

export function jarPublicUrl(sendId: string | null): string | null {
  return sendId ? `${JAR_PUBLIC_URL}${sendId}` : null;
}

export function jarSnapshotData(
  jar: JarSnapshot,
  fallbackSendId: string | null,
) {
  const jarUrl = jarPublicUrl(jar.sendId ?? fallbackSendId);
  return {
    currentAmount: new Prisma.Decimal(jar.amountKopecks).div(100),
    ...(jar.goalKopecks > 0 && {
      goalAmount: new Prisma.Decimal(jar.goalKopecks).div(100),
    }),
    ...(jarUrl && { jarUrl }),
    jarHasGoal: jar.goalKopecks > 0,
    jarSyncedAt: new Date(),
    jarSyncError: null,
  };
}

function isKopecks(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_KOPECKS
  );
}

export function parseJarResponse(body: unknown): JarFetchResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { kind: 'unavailable', reason: 'відповідь не є обʼєктом' };
  }
  const data = body as Record<string, unknown>;

  if (data.currency !== undefined && data.currency !== UAH) {
    return {
      kind: 'unsupported',
      reason: 'Банка має бути в гривнях (UAH), інші валюти не підтримуються',
    };
  }
  if (!isKopecks(data.amount)) {
    return { kind: 'unavailable', reason: 'некоректна сума у відповіді' };
  }
  const goal = data.goal ?? 0;
  if (!isKopecks(goal)) {
    return { kind: 'unavailable', reason: 'некоректна ціль у відповіді' };
  }

  return {
    kind: 'ok',
    jar: {
      amountKopecks: data.amount,
      goalKopecks: goal,
      closed: data.closed === true,
      sendId:
        typeof data.jarId === 'string' && SEND_ID_RE.test(data.jarId)
          ? data.jarId
          : null,
    },
  };
}

@Injectable()
export class MonobankJarClient {
  private readonly recent = new Map<string, { at: number; jar: JarSnapshot }>();

  async fetch(widgetId: string, maxAgeMs = 0): Promise<JarFetchResult> {
    const now = Date.now();
    for (const [id, entry] of this.recent) {
      if (now - entry.at > CACHE_KEEP_MS) this.recent.delete(id);
    }
    const cached = this.recent.get(widgetId);
    if (maxAgeMs > 0 && cached && now - cached.at <= maxAgeMs) {
      return { kind: 'ok', jar: cached.jar };
    }

    const result = await this.request(widgetId);
    if (result.kind === 'ok') {
      this.recent.set(widgetId, { at: Date.now(), jar: result.jar });
    }
    return result;
  }

  private async request(widgetId: string): Promise<JarFetchResult> {
    let res: Response;
    try {
      res = await fetch(`${JAR_API_URL}${encodeURIComponent(widgetId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const timedOut =
        (err as { name?: unknown } | null)?.name === 'TimeoutError';
      const reason = timedOut
        ? 'Monobank не відповів за 10 секунд'
        : 'немає звʼязку з Monobank';
      return { kind: 'unavailable', reason };
    }

    if (res.status === 429) return { kind: 'rate-limited' };
    if (res.status === 404) return { kind: 'invalid' };

    let body: unknown = null;
    try {
      body = JSON.parse(await res.text());
    } catch {
      body = null;
    }

    if (res.status === 400) {
      const errText =
        body && typeof body === 'object' && 'errText' in body
          ? String((body as { errText: unknown }).errText)
          : '';
      if (/alias/i.test(errText)) return { kind: 'invalid' };
      return {
        kind: 'unavailable',
        reason: `Monobank повернув помилку 400 ${errText}`.trim(),
      };
    }
    if (!res.ok) {
      return {
        kind: 'unavailable',
        reason: `Monobank повернув помилку ${res.status}`,
      };
    }
    if (body === null) {
      return { kind: 'unavailable', reason: 'Monobank повернув не JSON' };
    }
    return parseJarResponse(body);
  }
}
