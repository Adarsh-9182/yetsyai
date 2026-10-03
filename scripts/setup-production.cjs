const fs = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");
const { createClient } = require("@supabase/supabase-js");

const args = process.argv.slice(2);
const storage = args.includes("--storage");
const envIndex = args.indexOf("--env-file");
const allowed = new Set(["--storage", "--env-file"]);
if (envIndex >= 0 && !args[envIndex + 1]) {
  console.error("Provide a local environment file after --env-file.");
  process.exit(1);
}
for (let index = 0; index < args.length; index++) {
  if (index === envIndex + 1 && envIndex >= 0) continue;
  if (!allowed.has(args[index])) {
    console.error("Usage: npm run setup:check [-- --env-file FILE] (or setup:storage)");
    process.exit(1);
  }
}
try {
  if (envIndex >= 0) {
    const file = parseEnv(fs.readFileSync(path.resolve(args[envIndex + 1]), "utf8"));
    // Existing shell variables take precedence. Never print environment values.
    for (const [key, value] of Object.entries(file)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } else {
    require("@next/env").loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  }
} catch {
  console.error("Could not read the local environment file.");
  process.exit(1);
}

let failures = 0;
function check(name, valid, guidance) {
  console.log(`${valid ? "OK" : "MISSING/INVALID"} ${name}${valid ? "" : `: ${guidance}`}`);
  if (!valid) failures++;
}
function url(name, predicate) {
  try {
    const value = new URL(process.env[name] || "");
    return predicate(value);
  } catch {
    return false;
  }
}
function origin(value, suffix) {
  return value.protocol === "https:" && value.hostname.endsWith(suffix)
    && !value.username && !value.password && !value.search && !value.hash
    && value.pathname === "/" && !value.port;
}
function present(name) {
  return Boolean(process.env[name]?.trim());
}

check("NEXT_PUBLIC_SUPABASE_URL", url("NEXT_PUBLIC_SUPABASE_URL", value => origin(value, ".supabase.co")), "use the managed project's HTTPS origin");
check("SUPABASE_SERVICE_ROLE_KEY", present("SUPABASE_SERVICE_ROLE_KEY"), "store the server secret locally; never commit it");
if (!storage) {
  check("NEXT_PUBLIC_SUPABASE_ANON_KEY", present("NEXT_PUBLIC_SUPABASE_ANON_KEY"), "use the project's anon or publishable key");
  check("DATABASE_URL", url("DATABASE_URL", value => /^(postgres|postgresql):$/.test(value.protocol)
    && value.port === "5432" && Boolean(value.username && value.password)
    && value.searchParams.get("sslmode") === "require"
    && value.searchParams.get("connection_limit") === "1"), "use PostgreSQL on port 5432 with sslmode=require and connection_limit=1");
  check("VIDEO_PROVIDER", process.env.VIDEO_PROVIDER === "huggingface", "set huggingface for the free backend");
  check("HF_SPACE_URL", url("HF_SPACE_URL", value => origin(value, ".hf.space")), "use your private Space's HTTPS root origin");
  check("HF_TOKEN", present("HF_TOKEN"), "use a token with access to your private Space");
  check("HF_STUDIO_SECRET", (process.env.HF_STUDIO_SECRET?.length || 0) >= 32, "use a random shared secret of at least 32 characters");
  check("CRON_SECRET", (process.env.CRON_SECRET?.length || 0) >= 32, "use a separate random maintenance secret");
  check("ENABLE_PAID_GENERATION", process.env.ENABLE_PAID_GENERATION !== "true", "keep paid generation disabled");
  check("ALLOW_GUEST_GENERATION", process.env.ALLOW_GUEST_GENERATION !== "true", "keep guest generation disabled");
  for (const name of ["ACCOUNT_DAILY_RENDER_LIMIT", "GLOBAL_DAILY_RENDER_LIMIT", "GLOBAL_CONCURRENT_RENDER_LIMIT"]) {
    const value = process.env[name];
    check(name, value === undefined || /^[1-9]\d*$/.test(value), "use a positive integer or leave unset for the default");
  }
}
if (failures) process.exit(1);
if (!storage) {
  console.log("Configuration syntax is ready. This does not verify credentials, migrations, email delivery or GPU inference.");
  process.exit(0);
}

async function provisionStorage() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucketName = "studio-media";
  const fileSizeLimit = 40 * 1024 * 1024;
  const allowedMimeTypes = ["video/mp4", "image/jpeg", "image/png"];
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError || !buckets) throw new Error("Cannot inspect storage. Check the project URL, server key and network access.");
  const existing = buckets.find(bucket => bucket.id === bucketName);
  if (existing) {
    const types = existing.allowed_mime_types || [];
    if (existing.public || Number(existing.file_size_limit) !== fileSizeLimit
      || types.length !== allowedMimeTypes.length || !allowedMimeTypes.every(type => types.includes(type))) {
      throw new Error("Existing studio-media settings differ. Set it private, limit uploads to 40 MiB and allow only video/mp4, image/jpeg and image/png in Supabase. No existing settings were changed.");
    }
    console.log("OK studio-media already exists with the required private bucket settings.");
  } else {
    const { error } = await client.storage.createBucket(bucketName, { public: false, fileSizeLimit, allowedMimeTypes });
    if (error) throw new Error("Could not create studio-media. Check storage permissions and retry.");
    console.log("OK created private studio-media bucket (40 MiB, MP4/JPEG/PNG).");
  }
  console.log("Bucket settings do not verify existing object policies. Review policies, apply migrations and complete the account/render checks in docs/SETUP.md.");
}
provisionStorage().catch(error => {
  // Only messages created above are emitted; raw provider errors can contain URLs.
  const known = ["Cannot inspect storage.", "Existing studio-media settings differ.", "Could not create studio-media."];
  console.error(known.some(prefix => error.message?.startsWith(prefix)) ? error.message : "Storage setup failed. Check configuration and network access.");
  process.exitCode = 1;
});
