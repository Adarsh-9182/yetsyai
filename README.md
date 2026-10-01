# Yetsyai

Yetsyai is an AI video creation studio for turning prompts or reference images into cinematic clips. It connects to fal.ai's Kling 3.0 Standard queue API, saves render history in SQLite, and supports video playback and MP4 download.

## Run locally

Requires Node.js 18.18 or newer.

```bash
npm ci
cp .env.example .env
# Add your fal.ai key as FAL_KEY in .env (keep it server-only).
npm run db:push
npm run dev
```

Open <http://localhost:3000>. Get a key from [fal.ai](https://fal.ai/dashboard/keys) and fund the provider account before submitting a live render. Without a key the studio shows setup instructions and does not simulate successful generation.

Choose Text to video, describe a scene, select the aspect ratio and duration, then Generate. For Image to video, add a JPG or PNG starting frame. Queue updates and completed videos appear in My videos. History survives refreshes in the same browser workspace.

```bash
npm test
npm run build
```

Tests use a temporary database and mocked provider responses, with no paid calls.

## Current scope

- Generation supports 5/10-second videos, three text-video aspect ratios, optional audio and a negative prompt.
- Starting-frame images are JPG/PNG, up to 3 MB; their aspect ratio determines the output.
- Workspaces use an anonymous browser cookie; account login and billing are still pending.
- Videos stay on the provider CDN. Permanent asset storage is pending; download outputs you want to keep.
- Explore contains photo references from Unsplash and prompt templates, clearly separate from generated videos.

This is a private development MVP. Public deployment needs account authentication, spending controls, and durable storage. See [video architecture and limits](docs/VIDEO-STUDIO.md).

## Stack

Next.js 14 · React · TypeScript · Tailwind CSS · Lucide · Prisma / SQLite · fal.ai
