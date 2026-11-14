# Base Tele X WA

This project runs a Telegram control bot for linked WhatsApp sessions.

## Requirements

- Node.js 22.12 or newer
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your numeric Telegram user ID

## Setup

Run these commands from this directory (`Anix`):

```sh
npm install
cp .env.example .env
```

Edit `.env` and set `BOT_TOKEN` and `OWNER_TELEGRAM_ID`. Keep `.env` private; it contains credentials.

## Run

```sh
npm start
```

Open the Telegram bot and use `/pair` to link a WhatsApp number. Existing paired sessions saved in `session/` are restored automatically. Keep that directory private and backed up; it contains WhatsApp login credentials.

In WhatsApp, `.tgsticker <Telegram pack link> [number to send]` sends stickers from a public Telegram sticker pack, starting at the first sticker. It sends one by default and accepts up to 30 per command (for example, `.tgsticker https://t.me/addstickers/PackName 30`). Static, animated TGS, and video WebM stickers are supported; animated formats are converted to WebP. Animated TGS conversion requires Chromium's Linux runtime libraries to be available on the host.

`.ask <question>` asks the existing AI service a question. You can also reply to a text message with `.ask` to ask about that text. `.menu` uses the bundled `assets/menu.mp4` in both WhatsApp and Telegram while keeping the existing command buttons. `.vv2` sends replied-to view-once media to the command user's private chat; `.vv` keeps its existing behavior and replies in the current chat.

The menu also includes utility, game, and group commands: `.calc (12 + 8) * 3`, `.roll 2d6`, `.choose tea | coffee`, `.rps rock`, `.guess`, `.trivia`, `.poll question | option 1 | option 2`, `.remind 30m call mum`, `.reminders`, `.cancelreminder <id>`, `.weather <city>`, `.translate <language code> <text>`, `.qr <text>`, and `.sticker` (reply to a photo or short video). Reminders are saved with each WhatsApp session and restored after reconnecting. QR codes are generated locally; weather and translation use public online services. `.getpfp` is an alias for `.getdp`, and `.checkdevice` reports only the bot's own linked-session diagnostics.

For the standalone WhatsApp pairing flow, run `npm run dev` and follow the terminal prompt. `npm run vf` is an optional dependency/update monitor, not required to run the bot.

## Deploy on Render

The repository includes a Render Blueprint (`render.yaml`) and a Dockerfile. The service is configured as a paid, always-on background worker with 1 CPU, 2 GB RAM, and a 1 GB persistent disk mounted at `/app/session`; this disk keeps WhatsApp logins, per-session settings, and Telegram panel data across restarts. The free Render plan does not provide the persistent disk this bot needs. Render outages are still possible, so this is not an absolute uptime guarantee. Render shows the current charges before you apply the Blueprint.

1. Push the repository to GitHub, then in Render choose **New + → Blueprint** and connect this repository. Render will read `render.yaml` from the repository root.
2. Provide `BOT_TOKEN` (from [@BotFather](https://t.me/BotFather)) and `OWNER_TELEGRAM_ID` (your numeric Telegram user ID) when prompted. Keep both values private; do not commit `.env`.
3. Review the paid worker and persistent disk, then apply the Blueprint. The Docker image includes Chromium for animated Telegram-sticker conversion.
4. Wait for the worker logs to show the Telegram bot has started, then open the bot and send `/start`. Use `/pair <phone number>` to link WhatsApp.
5. The Render disk starts empty; existing WhatsApp sessions on another machine are not included in the GitHub repo and must be paired again (or securely migrated to the disk).
6. Automatic deploys are disabled in the Blueprint to avoid an unexpected restart. To deploy later code changes, open the Render service and choose **Manual Deploy → Deploy latest commit**.

The video and application code are included in the repository; credentials and session files are not.
