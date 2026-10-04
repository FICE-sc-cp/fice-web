import assert from "node:assert/strict";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import {
  ARCHIVE_FORMAT,
  buildArchive,
  fullNameOf,
  parseChatRef,
  readConfig,
} from "./archive.ts";

test("parseChatRef reads a group and a forum topic", () => {
  assert.deepEqual(parseChatRef("-1001234567890"), {
    chatId: "-1001234567890",
    threadId: null,
  });
  assert.deepEqual(parseChatRef("-1001234567890/12"), {
    chatId: "-1001234567890",
    threadId: 12,
  });
  assert.throws(() => parseChatRef("@group"));
});

test("readConfig rejects other files", () => {
  assert.throws(() => readConfig(JSON.stringify({ departments: [] })));
  assert.deepEqual(
    readConfig(
      JSON.stringify({
        format: "fice-people-wall-config/1",
        departments: [{ departmentId: "a", name: "Медіа", chat: "-1001" }, { name: "x" }],
      }),
    ),
    [{ departmentId: "a", name: "Медіа", chat: "-1001" }],
  );
});

test("fullNameOf falls back to the id", () => {
  assert.equal(fullNameOf({ firstName: " Олена ", lastName: "Коваль" }, "1"), "Олена Коваль");
  assert.equal(fullNameOf({ firstName: null }, "42"), "id42");
});

test("buildArchive stores one avatar per person and no usernames", () => {
  const avatar = Buffer.from([0xff, 0xd8, 0xff, 1]);
  const zip = buildArchive(
    [
      {
        departmentId: "d1",
        name: "Медіа",
        chat: "-1001",
        source: "members",
        people: [
          { telegramId: "1", fullName: "A", avatar },
          { telegramId: "2", fullName: "B", avatar: null },
        ],
      },
      {
        departmentId: "d2",
        name: "Мерч",
        chat: "-1002/5",
        source: "topic",
        people: [{ telegramId: "1", fullName: "A", avatar }],
      },
    ],
    { bots: 1, deleted: 0 },
  );
  const files = unzipSync(zip);
  assert.deepEqual(Object.keys(files).sort(), ["avatars/1.jpg", "manifest.json"]);
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  assert.equal(manifest.format, ARCHIVE_FORMAT);
  assert.deepEqual(manifest.skipped, { bots: 1, deleted: 0 });
  assert.equal(manifest.departments[0].people[1].avatar, null);
  assert.ok(!JSON.stringify(manifest).includes("username"));
});
