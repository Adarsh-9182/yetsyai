# NutritiScan

An AI health assistant that helps people understand symptoms **and** eat to
prevent problems — combining a careful symptom-guidance chat with a nutrition
and prevention angle. Built to be clearer, safer, and more useful than a plain
symptom checker.

> ⚠️ NutritiScan provides general health and nutrition information for
> educational purposes only. It is not a substitute for professional medical
> advice, diagnosis, or treatment.

---

## What's inside (the whole app in 4 files)

| File | What it is |
|------|-----------|
| `server.js` | The **back-end**. Holds the secret key, talks to the Claude AI, serves the site. The health-assistant "personality" and all safety rules live here in `SYSTEM_PROMPT`. |
| `public/index.html` | The **web page** people see — landing page + chat box. |
| `public/styles.css` | How it looks. |
| `public/app.js` | The chat logic in the browser: sends your message to `server.js`, shows the reply. |

---

## Run it on your computer (first time)

You need [Node.js](https://nodejs.org) version 18 or newer installed.

**1. Get a free Claude API key**
- Go to <https://console.anthropic.com>
- Sign up, then open **Settings → API Keys → Create Key**
- Copy the key (it starts with `sk-ant-...`). You only see it once.

**2. Add your key to the project**
- Copy the example file to a real one:
  ```bash
  cp .env.example .env
  ```
- Open `.env` and paste your key after the `=`:
  ```
  ANTHROPIC_API_KEY=sk-ant-your-real-key-here
  ```
- The `.env` file is private and is never uploaded (it's in `.gitignore`).

**3. Install and start**
```bash
npm install
npm start
```

**4. Open it**
Visit <http://localhost:3000> and start chatting.

To auto-restart the server whenever you edit a file, use `npm run dev` instead.

---

## Cost

Every message uses the Claude API, which is pay-as-you-go. New accounts get
free credits to start. To lower cost later, open `server.js` and change:
```js
const MODEL = "claude-opus-5";
```
to `"claude-sonnet-5"` (cheaper) or `"claude-haiku-4-5"` (cheapest).

---

## Roadmap ideas (next steps)

- Streaming replies (words appear as they're written)
- User accounts and saved conversation history
- Food/label photo scanning
- A "talk to a real clinician" hand-off
- Deploy to the web so anyone can use it
