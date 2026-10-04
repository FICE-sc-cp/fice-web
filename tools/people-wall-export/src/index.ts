import { chmod, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Api, TelegramClient, errors } from "telegram";
import { LogLevel } from "telegram/extensions/Logger.js";
import { StringSession } from "telegram/sessions/index.js";
import {
  buildArchive,
  fullNameOf,
  parseChatRef,
  readConfig,
  type ConfigDepartment,
  type ExportedDepartment,
  type ExportedPerson,
} from "./archive.ts";

const ENV_FILE = ".env";
const SESSION_FILE = ".session";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function credentials(): Promise<{ apiId: number; apiHash: string }> {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch {}
  let apiId = process.env.TG_API_ID ?? "";
  let apiHash = process.env.TG_API_HASH ?? "";
  if (!apiId || !apiHash) {
    console.log("Потрібні api_id та api_hash з https://my.telegram.org → API development tools.");
    apiId = await ask("api_id: ");
    apiHash = await ask("api_hash: ");
    await writeFile(ENV_FILE, `TG_API_ID=${apiId}\nTG_API_HASH=${apiHash}\n`, { mode: 0o600 });
    console.log(`Збережено в ${ENV_FILE} (лише на цьому компʼютері, файл у .gitignore).`);
  }
  if (!/^\d+$/.test(apiId) || !apiHash) throw new Error("Некоректні api_id або api_hash.");
  return { apiId: Number(apiId), apiHash };
}

async function withFloodWait<T>(label: string, task: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      return await task();
    } catch (err) {
      if (err instanceof errors.FloodWaitError) {
        console.log(`  Telegram просить зачекати ${err.seconds} с (${label})…`);
        await sleep((err.seconds + 1) * 1000);
        continue;
      }
      throw err;
    }
  }
}

interface Counters {
  bots: number;
  deleted: number;
}

function keep(user: Api.TypeUser | undefined, counters: Counters): user is Api.User {
  if (!(user instanceof Api.User)) return false;
  if (user.bot) {
    counters.bots += 1;
    return false;
  }
  if (user.deleted) {
    counters.deleted += 1;
    return false;
  }
  return true;
}

async function chatMembers(
  client: TelegramClient,
  entity: Api.TypeEntityLike,
  counters: Counters,
): Promise<Api.User[]> {
  return withFloodWait("список учасників", async () => {
    const local: Counters = { bots: 0, deleted: 0 };
    const users: Api.User[] = [];
    for await (const user of client.iterParticipants(entity, {})) {
      if (keep(user, local)) users.push(user);
    }
    counters.bots += local.bots;
    counters.deleted += local.deleted;
    return users;
  });
}

async function topicPosters(
  client: TelegramClient,
  entity: Api.TypeEntityLike,
  threadId: number,
  counters: Counters,
): Promise<Api.User[]> {
  return withFloodWait("повідомлення гілки", async () => {
    const local: Counters = { bots: 0, deleted: 0 };
    const seen = new Set<string>();
    const users: Api.User[] = [];
    let scanned = 0;
    for await (const message of client.iterMessages(entity, { replyTo: threadId })) {
      scanned += 1;
      if (scanned % 1000 === 0) console.log(`  переглянуто ${scanned} повідомлень…`);
      const id = message.senderId?.toString();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const sender = (message.sender ?? (await message.getSender())) as Api.TypeUser | undefined;
      if (keep(sender, local)) users.push(sender);
    }
    counters.bots += local.bots;
    counters.deleted += local.deleted;
    return users;
  });
}

async function avatarOf(
  client: TelegramClient,
  user: Api.User,
  cache: Map<string, Buffer | null>,
): Promise<Buffer | null> {
  const id = user.id.toString();
  if (cache.has(id)) return cache.get(id) ?? null;
  let avatar: Buffer | null = null;
  if (user.photo instanceof Api.UserProfilePhoto) {
    const data = await withFloodWait("аватарка", () =>
      client.downloadProfilePhoto(user, { isBig: false }),
    );
    avatar = Buffer.isBuffer(data) && data.length > 0 ? data : null;
  }
  cache.set(id, avatar);
  return avatar;
}

async function exportDepartment(
  client: TelegramClient,
  dept: ConfigDepartment,
  chats: Map<string, Api.TypeEntityLike>,
  counters: Counters,
  avatars: Map<string, Buffer | null>,
): Promise<ExportedDepartment | null> {
  const { chatId, threadId } = parseChatRef(dept.chat);
  const entity = chats.get(chatId);
  if (!entity) {
    console.log(`✗ ${dept.name}: чат ${chatId} не знайдено серед твоїх чатів — пропускаю.`);
    return null;
  }
  console.log(`→ ${dept.name} (${dept.chat})`);
  const users =
    threadId === null
      ? await chatMembers(client, entity, counters)
      : await topicPosters(client, entity, threadId, counters);

  const people: ExportedPerson[] = [];
  for (const user of users) {
    const telegramId = user.id.toString();
    people.push({
      telegramId,
      fullName: fullNameOf(user, telegramId),
      avatar: await avatarOf(client, user, avatars),
    });
  }
  console.log(`  ${people.length} людей`);
  return {
    departmentId: dept.departmentId,
    name: dept.name,
    chat: dept.chat,
    source: threadId === null ? "members" : "topic",
    people,
  };
}

async function main() {
  const configPath = arg("config", "people-wall-config.json");
  const outPath = arg("out", `people-wall-${new Date().toISOString().slice(0, 10)}.zip`);
  if (!existsSync(configPath)) {
    throw new Error(
      `Не знайдено ${configPath}. Завантаж конфіг в адмінці («Люди департаментів» → «Конфіг для експорту») і поклади його в цю папку.`,
    );
  }
  const departments = readConfig(await readFile(configPath, "utf8"));
  if (!departments.length) {
    throw new Error("У конфігу немає департаментів із Telegram chat ID.");
  }

  const { apiId, apiHash } = await credentials();
  const saved = existsSync(SESSION_FILE) ? (await readFile(SESSION_FILE, "utf8")).trim() : "";
  const client = new TelegramClient(new StringSession(saved), apiId, apiHash, {
    connectionRetries: 5,
    floodSleepThreshold: 300,
  });
  client.setLogLevel(LogLevel.ERROR);

  await client.start({
    phoneNumber: () => ask("Номер телефону (+380…): "),
    phoneCode: () => ask("Код із Telegram: "),
    password: () => ask("Пароль двоетапної перевірки (2FA): "),
    onError: (err) => console.error(err.message),
  });
  await writeFile(SESSION_FILE, String(client.session.save()), { mode: 0o600 });
  await chmod(SESSION_FILE, 0o600).catch(() => undefined);

  try {
    const chats = new Map<string, Api.TypeEntityLike>();
    for (const dialog of await withFloodWait("список чатів", () => client.getDialogs({}))) {
      if (dialog.id && dialog.entity) chats.set(dialog.id.toString(), dialog.entity);
    }

    const counters: Counters = { bots: 0, deleted: 0 };
    const avatars = new Map<string, Buffer | null>();
    const exported: ExportedDepartment[] = [];
    for (const dept of departments) {
      const result = await exportDepartment(client, dept, chats, counters, avatars);
      if (result) exported.push(result);
    }

    await writeFile(outPath, buildArchive(exported, counters));
    const total = exported.reduce((n, d) => n + d.people.length, 0);
    console.log(
      `\nГотово: ${outPath} — ${exported.length} департамент(ів), ${total} записів, ` +
        `пропущено ботів: ${counters.bots}, видалених акаунтів: ${counters.deleted}.`,
    );
    console.log("Завантаж цей файл в адмінці: «Люди департаментів» → «Імпорт з Telegram».");
  } finally {
    await client.disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`Помилка: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
