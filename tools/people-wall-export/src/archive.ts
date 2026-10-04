import { strToU8, zipSync } from "fflate";

export const CONFIG_FORMAT = "fice-people-wall-config/1";
export const ARCHIVE_FORMAT = "fice-people-wall/1";

export interface ConfigDepartment {
  departmentId: string;
  name: string;
  chat: string;
}

export interface ChatRef {
  chatId: string;
  threadId: number | null;
}

export interface ExportedPerson {
  telegramId: string;
  fullName: string;
  avatar: Buffer | null;
}

export interface ExportedDepartment {
  departmentId: string;
  name: string;
  chat: string;
  source: "members" | "topic";
  people: ExportedPerson[];
}

export function readConfig(raw: string): ConfigDepartment[] {
  const config = JSON.parse(raw) as {
    format?: string;
    departments?: Partial<ConfigDepartment>[];
  };
  if (config.format !== CONFIG_FORMAT || !Array.isArray(config.departments)) {
    throw new Error(
      "Це не конфіг експорту. Завантаж його в адмінці на сторінці «Люди департаментів».",
    );
  }
  return config.departments.filter(
    (d): d is ConfigDepartment =>
      typeof d.departmentId === "string" &&
      typeof d.name === "string" &&
      typeof d.chat === "string",
  );
}

export function parseChatRef(chat: string): ChatRef {
  const match = /^\s*(-\d+)\s*(?:\/\s*(\d+)\s*)?$/.exec(chat);
  if (!match) throw new Error(`Некоректний chat ID: ${chat}`);
  return {
    chatId: match[1],
    threadId: match[2] ? Number(match[2]) : null,
  };
}

export function fullNameOf(
  user: { firstName?: string | null; lastName?: string | null },
  id: string,
): string {
  return (
    [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim() || `id${id}`
  );
}

export function buildArchive(
  departments: ExportedDepartment[],
  skipped: { bots: number; deleted: number },
  exportedAt = new Date(),
): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const manifest = {
    format: ARCHIVE_FORMAT,
    exportedAt: exportedAt.toISOString(),
    skipped,
    departments: departments.map((d) => ({
      departmentId: d.departmentId,
      name: d.name,
      chat: d.chat,
      source: d.source,
      people: d.people.map((p) => {
        const avatar = p.avatar ? `avatars/${p.telegramId}.jpg` : null;
        if (p.avatar && avatar) files[avatar] = new Uint8Array(p.avatar);
        return { telegramId: p.telegramId, fullName: p.fullName, avatar };
      }),
    })),
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(files, { level: 6 });
}
