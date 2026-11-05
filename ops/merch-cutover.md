# Merch cut-over runbook

"You" is the owner. "Dev" is whoever runs the commands on the VM. Everything before Stage 3 is safe during the running sale. Nothing happens to customers until you suspend the old API.

## What only you can do

| Thing | Why it is yours |
|---|---|
| Decide the moment | A sale is open (news of 2026-10-31) |
| Every push to `main` | A push is a production release within 2 minutes |
| Render dashboard: read `DATABASE_URL`, `BOT_TOKEN`, `ADMIN_OWNER_IDS`, `GOOGLE_SHEETS_ID`; suspend `merchfice-api`; change `merchbot-1ezk` | Only that dashboard has them |
| @BotFather | Tied to your account |
| Test with a real account in the real admin chat | |

**Never** put the real `BOT_TOKEN` on a laptop, and never start a bot with it outside the VM at the planned moment. Starting a bot deletes the live webhook, and the old bot goes silent with no error. For all development create a separate test bot in @BotFather.

## Stage 1: ship dark (any time)

| # | Who | What | How you know it worked |
|---|---|---|---|
| 1 | You | Decide what happens to the uncommitted syllabus work: commit it first, or dev commits merch by hunks. `scripts/` must never be added | |
| 2 | You | Approve the merch commits, all except the header link and sitemap, with `MERCH_BOT_TOKEN` left empty. The migration only adds tables | Deploy report is green |
| 3 | Dev | `curl -s https://fice-sc.kpi.ua/api-proxy/health` | `"merch":"disabled"`, all other bots `running`, old bot works as before |

If a deploy fails, nothing changed: the old containers keep running.

## Stage 2: rehearse (any time, repeat as often as you like)

| # | Who | What | How you know it worked |
|---|---|---|---|
| 1 | You | In Render open `merchfice-api`, Environment. Copy `DATABASE_URL` and `BOT_TOKEN`. Use the direct Neon host. Do not use the URL in `E:\merchFICE\.env`: it is an old, nearly empty database. Note whether `GOOGLE_SHEETS_ID` is set | |
| 2 | Dev | On the VM: `df -h`, `free -h`, `docker compose logs server \| grep "sharp is unavailable"`, and whether port 5432 to Neon is open | If not open, the fallback under "Running the import on the VM" |
| 3 | Dev | Dry run (see "Running the import on the VM"). Read the report with you | Row counts look like the real shop, not 1 product. A "table is missing" stop means the stale URL |
| 4 | You, dev | Check the size histogram. Rerun with `--no-size=...` if stickers use some other word | |
| 5 | Dev | Same line with `--apply`. It reads the old database and calls `getFile`. The old bot does not notice | Exit 0 or 2. Read what 2 lists |
| 6 | You | Open `https://fice-sc.kpi.ua/merch` directly. Check prices, photos, order. Nobody can order yet: the Telegram step answers `Оформлення через сайт тимчасово недоступне: бот не налаштований.` | |
| 7 | You | If the Google Sheet stays: share a spreadsheet with `GOOGLE_SERVICE_ACCOUNT_EMAIL` as editor and keep its id | |
| 8 | You | In @BotFather check whether a named Mini App or Main Mini App exists for the bot. Write down its URL | |
| 9 | You | Prepare the redirect for `merchbot-1ezk` (below), so the step takes one click. Pick a quiet hour | |

Each `--apply` replaces the previous rehearsal. Categories, tags and templates need the admin Mini App, which needs the live bot, so they wait until after go-live. The catalog works without them: no chips are shown.

## Stage 3: go-live, about 20 minutes

Do not push to `main` during this. Order matters. Orders reach the old API directly from the Mini App, not through the webhook, so **suspending the old API is what stops orders**, and it comes first. After that nothing is lost: Telegram keeps button clicks and messages queued until the new bot picks them up.

| # | Who | What | Check |
|---|---|---|---|
| 1 | You | Optional, a day before: warn customers with the old `📢 Розсилка` | |
| 2 | Dev | `bash ops/backup.sh db pre-merch` | New file in `/home/ubuntu/backups` |
| 3 | You | Render: **Suspend `merchfice-api`**. The old database is frozen from this second. People with the app open see errors | `https://merchfice-api.onrender.com/health` no longer answers `ok` |
| 4 | Dev | Last import: dry run, then `--apply`. Photos were copied in rehearsal, so it takes seconds | Exit 0 or 2 |
| 5 | You, dev | Add to `/home/ubuntu/fice-web/.env`: `MERCH_BOT_TOKEN`, `MERCH_OWNER_IDS` (old `ADMIN_OWNER_IDS`), and `GOOGLE_MERCH_SPREADSHEET_ID` if kept | Never paste the token into a chat |
| 6 | Dev | `docker compose up -d server`. API and bots restart for about 30 s, the site stays up | `curl -s http://127.0.0.1:3001/health` shows `"merch":"running"` |
| 7 | Dev | `docker compose exec server sh -c 'wget -qO- "https://api.telegram.org/bot$MERCH_BOT_TOKEN/getWebhookInfo"'` | `"url":""`, `pending_update_count` falling to 0. The first start removed the webhook and kept the queue |
| 8 | You | Render: replace `merchbot-1ezk` with the file below. Up to 5 minutes for Cloudflare | An old `🛍 Відкрити каталог` button opens the new Mini App |
| 9 | You | @BotFather: if step 8 of rehearsal found a named Mini App, set its URL to `https://fice-sc.kpi.ua/merch-app`. The menu button is set by the server, leave it. No `/setdomain`: there is no Login Widget | `t.me/merch_ficebot` menu opens the new catalog |
| 10 | You | Smoke test below | Every line passes |
| 11 | You | Approve the last commit: `Мерч` in the header and the sitemap | Link visible on the site |
| 12 | You | Tell the admins, then the customers. Point any uptime monitor at `https://fice-sc.kpi.ua/api-proxy/health` | |

Redirect file for `merchbot-1ezk`, one `index.html`:

```html
<!doctype html><meta charset=utf-8><title>Мерч ФІОТ</title>
<script>location.replace('https://fice-sc.kpi.ua/merch-app'+location.search+location.hash)</script>
```

It keeps `?page=pickup&order_id=N` and the signed Telegram data after `#`, so old buttons in chat history go on working. Try it on Android, iOS and Desktop. Keep this site alive for good: those buttons never go away.

**Smoke test,** with a real account:

- [ ] `/start` shows the welcome, `💬 Підтримка` and `🛍 Відкрити каталог`.
- [ ] Catalog opens from the menu button at once, photos show, filters appear once labels exist.
- [ ] A t-shirt: colour switches the photo, lightbox zooms, add to cart.
- [ ] Checkout in the Mini App: recipient, delivery, payment block, test receipt, submit.
- [ ] `✅ Замовлення #... прийнято...` arrives in the chat. The card appears in the orders topic with the receipt.
- [ ] `🔄 Взяти в роботу`: toast at once, card edits, customer message arrives.
- [ ] `📦 Готове до видачі` on a `В корпусі` order: the button opens the Mini App, a slot can be chosen, the note appears under the card.
- [ ] Cancel the test order: stock is back. Press the old button again: toast, no change.
- [ ] One old `ostatus:` button on a pre-cut-over card. One old `🗓 Обрати час видачі` button on Android, iOS and Desktop.
- [ ] `💬 Підтримка`: message reaches the support topic, reply reaches the customer, 👍 appears. A reply to a pre-cut-over message works.
- [ ] `/admin`: DayF toggle, one prompt, `📦 Управління товарами` opens the admin, a test product saves, shows on the site on reload, deletes.
- [ ] In a normal private browser window: `/merch`, a product link with a preview in Telegram, the Telegram step (press the button, confirm in the bot, watch the page move on), an order through the site.

**Then compare the Mono jar with the orders around the freeze.** Anyone who paid while the old API was down has no order: find them by the screenshots they send to support.

## Rollback

**Before real orders exist on the site:**

1. VM: empty `MERCH_BOT_TOKEN` in `.env`, `docker compose up -d server`. Polling stops.
2. Render: Resume `merchfice-api`.
3. Open `https://merchfice-api.onrender.com/setup/webhook` once, which sets the webhook back.
4. Undo the `merchbot-1ezk` redirect and any BotFather URL change. Reset the menu button in BotFather, because the new code changed it.
5. If the nav commit went out, revert it, or the site shows stale stock.

**After real orders exist on the site:** the same steps, but first list them on the VM:

```sql
SELECT id, status, "totalAmount" FROM "MerchOrder" WHERE "clientKey" IS NOT NULL ORDER BY id;
```

Finish those by hand from the admin chat or copy them to the old database. Bump `orders_id_seq` on Neon past them, or numbers will clash. Stock on Neon no longer matches. At that point a fix forward is usually cheaper.

## After

| When | What |
|---|---|
| First 3 days | Dev: `docker compose logs server \| grep -i merch` |
| Keep suspended 2 weeks | `merchfice-api` and Neon are your rollback |
| After 2 weeks | Archive a dump of Neon, delete the Neon project (it holds names, phones, addresses), delete `merchfice-api` and the unused `merchfice-frontend` on Render, `/revoke` the token in @BotFather, update the VM `.env` in the same minute, then `docker compose up -d server` at once: the running process keeps the revoked token until it restarts, and until then the bot is silent and Mini App logins fail. Check that `/health` shows `"merch":"running"`. The bot and its `file_id`s stay |
| Always | Keep the free `merchbot-1ezk` redirect |
| When ready | Create categories, tags, templates. Replace old photos with high-resolution ones for zoom |
| Your call | Off-site backup copy: orders now live on one VM with their backups |

## Running the import on the VM

```bash
cd /home/ubuntu/fice-web
read -rs OLD_DB; read -rs OLD_TOKEN      # typed, so they stay out of shell history and .env
docker compose run --rm --no-deps \
  -e OLD_MERCH_DATABASE_URL="$OLD_DB" -e OLD_MERCH_BOT_TOKEN="$OLD_TOKEN" \
  server npx ts-node --transpile-only scripts/import-merch.ts
# read the report, then the same line with --apply
unset OLD_DB OLD_TOKEN
```

- `run --rm --no-deps`, not `exec`: a one-off container gets its own 1 GB limit, so the import cannot push the live API into the OOM killer. It mounts `fice_uploads` and sees `postgres` like the service does. `--transpile-only` skips the type check, which is the memory-heavy part. `ts-node` is in the image because `npm ci` keeps dev dependencies, and `.dockerignore` does not drop `scripts/`.
- Use the **direct** Neon host, without `-pooler`, for one long read.
- If the VM cannot reach port 5432: on a laptop `pg_dump --format=plain --no-owner --no-acl "$OLD_DIRECT_URL" > merch.sql`, load it into a throwaway `postgres:15` on the VM, and point `OLD_MERCH_DATABASE_URL` at it. `getFile` still uses the real token. `pg_restore` is not used: table shapes differ, and a newer custom-format dump will not load into 15.
