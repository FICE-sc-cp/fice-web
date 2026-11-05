/**
 * Local fake of the Bot API for the merch bot. Point MERCH_BOT_API_ROOT here and
 * use a made-up token, never the real one.
 *
 *   npx ts-node --transpile-only scripts/fake-telegram.ts [port] [botUsername]
 *
 *   POST /_update                     queues an update, assigning update_id
 *   POST /_member?status=member       what getChatMember answers; &user=<id> for one person
 *   POST /_fail {method?, thread?, chat?, code, description, retry_after?}  refuse matching
 *                                     calls; an empty body clears all refusals
 *   GET  /_log                        everything the bot sent
 */
import { createServer, IncomingMessage, ServerResponse } from 'node:http';

interface Fault {
  method?: string;
  thread?: number;
  chat?: number;
  code: number;
  description: string;
  retry_after?: number;
}
type Payload = Record<string, unknown>;

const port = Number(process.argv[2] ?? 8081);
const username = process.argv[3] ?? 'merch_test_bot';
const members = new Map<string, string>();
const updates: object[] = [];
const log: { method: string; payload: Payload }[] = [];
let faults: Fault[] = [];
let nextUpdate = 1;
let nextMessage = 1000;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Fields of a grammY upload. A file is logged by its size, JSON fields come back parsed. */
function multipart(body: Buffer, boundary: string): Payload {
  const fields: Payload = {};
  for (const part of body.toString('latin1').split(`--${boundary}`)) {
    const name = /name="([^"]+)"/.exec(part)?.[1];
    if (!name) continue;
    const raw = part.slice(part.indexOf('\r\n\r\n') + 4, -2);
    if (/filename=/.test(part)) {
      fields[name] = `<file ${raw.length} bytes>`;
      continue;
    }
    const text = Buffer.from(raw, 'latin1').toString('utf8');
    try {
      fields[name] = JSON.parse(text);
    } catch {
      fields[name] = text;
    }
  }
  return fields;
}

function parse(req: IncomingMessage, body: Buffer): Payload {
  const boundary = /boundary=(.+)$/.exec(
    req.headers['content-type'] ?? '',
  )?.[1];
  if (boundary) return multipart(body, boundary);
  return body.length ? (JSON.parse(body.toString('utf8')) as Payload) : {};
}

function send(res: ServerResponse, body: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function telegram(method: string, payload: Payload): Promise<unknown> {
  if (method === 'getMe') {
    return { id: 1, is_bot: true, first_name: 'Test', username };
  }
  if (method === 'getUpdates') {
    const deadline = Date.now() + 1_000;
    while (!updates.length && Date.now() < deadline) await sleep(50);
    return updates.splice(0);
  }
  if (method === 'getChatMember') {
    const user = Number(payload.user_id);
    const status =
      members.get(String(user)) ?? members.get('*') ?? 'administrator';
    return { status, user: { id: user, is_bot: false, first_name: 'Fake' } };
  }
  if (
    /^(deleteWebhook|setChatMenuButton|answerCallbackQuery|setMessageReaction)$/.test(
      method,
    )
  ) {
    return true;
  }
  return {
    message_id: ++nextMessage,
    chat: { id: payload.chat_id },
    date: 0,
  };
}

async function onRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://fake');
  const body = await readBody(req);
  if (url.pathname === '/_log') return send(res, log);
  if (url.pathname === '/_update') {
    updates.push({ update_id: nextUpdate++, ...parse(req, body) });
    return send(res, { ok: true });
  }
  if (url.pathname === '/_member') {
    const user = url.searchParams.get('user') ?? '*';
    members.set(user, url.searchParams.get('status') ?? 'administrator');
    return send(res, { ok: true });
  }
  if (url.pathname === '/_fail') {
    faults = body.length
      ? [...faults, parse(req, body) as unknown as Fault]
      : [];
    return send(res, { ok: true });
  }
  const method = /^\/bot[^/]+\/(\w+)$/.exec(url.pathname)?.[1];
  if (!method) return send(res, { ok: false, description: 'Not Found' }, 404);
  const payload = parse(req, body);
  if (method !== 'getMe' && method !== 'getUpdates') {
    log.push({ method, payload });
    console.log(method, JSON.stringify(payload));
  }
  const fault = faults.find(
    (f) =>
      (!f.method || f.method === method) &&
      (!f.thread || f.thread === payload.message_thread_id) &&
      (!f.chat || f.chat === payload.chat_id),
  );
  if (fault) {
    return send(
      res,
      {
        ok: false,
        error_code: fault.code,
        description: fault.description,
        parameters: { retry_after: fault.retry_after },
      },
      fault.code,
    );
  }
  send(res, { ok: true, result: await telegram(method, payload) });
}

createServer((req, res) => void onRequest(req, res)).listen(port, '127.0.0.1');
console.log(`Fake Telegram on http://127.0.0.1:${port} as @${username}`);
