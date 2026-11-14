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

The repository includes a Render Blueprint (`render.yaml`) and a Dockerfile. The Blueprint uses a free web service with an HTTP health endpoint at `/health`, allowing it to run on Render's Free plan. This is a limited, best-effort setup—not a 24/7 service: Render may spin it down after 15 minutes without inbound traffic, and its filesystem is ephemeral. WhatsApp login files, per-session settings, and Telegram panel data can be lost when the service restarts or spins down, in which case you must pair the WhatsApp number again. Use persistent storage and an always-on paid service if you need reliable sessions and continuous availability.

1. In Render choose **New + → Blueprint** and connect this GitHub repository. Render will read `render.yaml` from the repository root.
2. Provide `BOT_TOKEN` (from [@BotFather](https://t.me/BotFather)) and `OWNER_TELEGRAM_ID` (your numeric Telegram user ID) when prompted. Keep both values private; do not commit `.env`.
3. Review the Free web service, then apply the Blueprint. The Docker image includes Chromium for animated Telegram-sticker conversion.
4. Wait for the deploy to become live. Open the service URL followed by `/health`; it should return `ok`. Then open the Telegram bot and send `/start`. Use `/pair <phone number>` to link WhatsApp.
5. Existing WhatsApp sessions on another machine are not included in the GitHub repo and must be paired again.
6. Automatic deploys are enabled: later pushes to `main` deploy automatically. To trigger a deploy manually, open the Render service and choose **Manual Deploy → Deploy latest commit**.

The video and application code are included in the repository; credentials and session files are not. Existing WhatsApp sessions with an older saved menu image setting migrate to the video on first startup; `.setmenuimg` can still enable a custom photo, and `.setmenuimg reset` switches back to the video.
