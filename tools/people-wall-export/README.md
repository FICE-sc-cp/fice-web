# People wall export

Collects the members of the department Telegram chats for the people walls
(«сердечка») on the website. Run it on your own computer with your own
Telegram account; it is not part of any Docker image.

The bot only sees people who write in a chat or join after it. This tool
gets everyone at once:

- **A chat ID** (`-1001234567890`): all members of the chat.
- **A forum topic** (`-1001234567890/12`): everyone who has posted in that
  topic, since topics have no member list.
- **Skipped:** bots and deleted accounts.
- **Saved for each person:** the Telegram ID, the full name and a small
  avatar. Usernames are never saved.

## 1. Get api_id and api_hash (once)

1. Open <https://my.telegram.org> and log in with your phone number.
2. Go to **API development tools** and create an app (any name, e.g. "fice
   export", platform "Desktop").
3. Copy **App api_id** and **App api_hash**.

The tool asks for them on the first run and saves them in `.env` in this folder.

## 2. Download the config

In the admin panel open **Люди департаментів → Імпорт з Telegram → Конфіг для
експорту**. Put the downloaded `people-wall-config.json` into this folder. It
lists the departments that have a Telegram chat ID set in the department form.

## 3. Run the export

You need Node.js 20.12 or newer.

```bash
cd tools/people-wall-export
npm install
npm start
```

On the first run it asks for your phone number, the login code Telegram sends
you and, if you have one, your two-step verification password. The login is
saved in `.session` here, so later runs don't ask again.

Options:

```bash
npm start -- --config path/to/people-wall-config.json --out people-wall.zip
```

When Telegram asks the tool to slow down (FLOOD_WAIT), it waits and then
continues. Large chats can take a few minutes. The result is one file,
`people-wall-YYYY-MM-DD.zip`.

Your account must be a member of every chat in the config. In a group where
the member list is hidden from members, you must be an admin to see everyone.

## 4. Import

Upload the zip in **Люди департаментів → Імпортувати архів**. The import:

- **Adds and updates:** it adds new people and refreshes the names of people
  the bot already knows, matching by department and Telegram ID.
- **Never shows a hidden person again.**
- **Keeps photos:** it doesn't replace an existing photo.
- **Avoids duplicates:** it doesn't add a person when the department already
  has a manual entry with the same name; those people are listed after the
  import instead.

At the end it shows how many people were added, updated and skipped.

## Keep these files private

`.env` (api_id and api_hash), `.session` (your logged-in Telegram session), the
config and the exported zip are all in `.gitignore`. Never commit or send
`.env` or `.session`: anyone with `.session` can use your Telegram account. To
log out, delete `.session` and end the session in Telegram → Settings →
Devices.
