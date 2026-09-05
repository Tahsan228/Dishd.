/**
 * Verifies every credential in .env.local by actually calling the service.
 * Run: npm run check:env
 *
 * Reports what works, what is missing, and whether the migrations have run.
 * Never prints a secret — only a masked fingerprint so you can tell two keys apart.
 */

const results = [];
const mask = (v) => (v ? `${v.slice(0, 7)}…${v.slice(-4)} (${v.length} chars)` : "");

function record(name, ok, detail, hint) {
  results.push({ name, ok, detail, hint });
}

const {
  NEXT_PUBLIC_SUPABASE_URL: URL_,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE,
  ANTHROPIC_API_KEY: ANTHROPIC,
  STRIPE_SECRET_KEY: STRIPE,
} = process.env;

const filled = (v) => v && !v.startsWith("your-") && v.trim() !== "";

/* ---------------------------------------------------------------- Supabase */
if (!filled(URL_) || !filled(ANON)) {
  record("Supabase URL + anon key", false, "not set",
    "Supabase dashboard -> Project Settings -> API Keys");
} else if (!URL_.startsWith("https://")) {
  record("Supabase URL", false, `looks wrong: ${URL_}`,
    "Should look like https://abcdefgh.supabase.co");
} else if (/\/(rest|auth|storage|realtime)\/v1\/?$/.test(URL_) || URL_.endsWith("/")) {
  record("Supabase URL", false, `has a path appended: ${URL_}`,
    "Use the bare project URL, e.g. https://abcdefgh.supabase.co — drop /rest/v1 and any trailing slash");
} else {
  try {
    const r = await fetch(`${URL_}/rest/v1/known_halal_stores?select=id&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    if (r.status === 200) {
      record("Supabase anon key", true, `${mask(ANON)} — migrations applied`);
    } else if (r.status === 404) {
      record("Supabase anon key", true, `${mask(ANON)} — key works, MIGRATIONS NOT APPLIED`,
        "Run supabase/migrations/0001 then 0002 in the SQL editor");
    } else if (r.status === 401) {
      record("Supabase anon key", false, "rejected (401)",
        "Wrong key. Copy the 'anon public' key, not the service role one");
    } else {
      record("Supabase anon key", false, `unexpected HTTP ${r.status}`, await r.text().catch(() => ""));
    }
  } catch (e) {
    record("Supabase URL", false, `unreachable: ${e.message}`, "Check the project URL");
  }
}

/* Service role: use an endpoint anon genuinely cannot reach. */
if (!filled(SERVICE)) {
  record("Supabase service role", false, "not set",
    "Project Settings -> API Keys -> service_role (click Reveal)");
} else if (SERVICE === ANON) {
  record("Supabase service role", false, "same value as the anon key",
    "You pasted the anon key twice — they are different keys");
} else if (filled(URL_)) {
  try {
    const r = await fetch(`${URL_}/auth/v1/admin/users?per_page=1`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    r.ok
      ? record("Supabase service role", true, mask(SERVICE))
      : record("Supabase service role", false, `rejected (HTTP ${r.status})`,
          "Must be the service_role key, not anon");
  } catch (e) {
    record("Supabase service role", false, e.message);
  }
}

/* --------------------------------------------------------------- Anthropic */
if (!filled(ANTHROPIC)) {
  record("Anthropic API key", false, "not set — receipt verification will not work",
    "console.anthropic.com -> API keys");
} else {
  try {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01" },
    });
    if (r.ok) {
      record("Anthropic API key", true, mask(ANTHROPIC));
    } else if (r.status === 401) {
      record("Anthropic API key", false, "rejected (401)", "Key is wrong or revoked");
    } else if (r.status === 400 || r.status === 429) {
      const body = await r.json().catch(() => ({}));
      record("Anthropic API key", false, body?.error?.message ?? `HTTP ${r.status}`,
        "Key is valid but the account may be out of credit");
    } else {
      record("Anthropic API key", false, `HTTP ${r.status}`);
    }
  } catch (e) {
    record("Anthropic API key", false, e.message);
  }
}

/* ------------------------------------------------------------------ Stripe */
if (!filled(STRIPE)) {
  record("Stripe secret key", false, "not set — card checkout will not work",
    "dashboard.stripe.com -> Developers -> API keys (TEST mode)");
} else if (!STRIPE.startsWith("sk_test_")) {
  record("Stripe secret key", false,
    STRIPE.startsWith("sk_live_") ? "this is a LIVE key" : "not a secret key",
    "Use the TEST secret key (sk_test_…). Never put a live key in a hackathon repo.");
} else {
  try {
    const r = await fetch("https://api.stripe.com/v1/accounts?limit=1", {
      headers: { Authorization: `Bearer ${STRIPE}` },
    });
    if (r.ok) {
      record("Stripe secret key", true, `${mask(STRIPE)} — test mode, Connect enabled`);
    } else {
      const body = await r.json().catch(() => ({}));
      const msg = body?.error?.message ?? `HTTP ${r.status}`;
      record("Stripe secret key", /connect/i.test(msg) ? false : false, msg,
        /connect/i.test(msg)
          ? "Enable Connect: dashboard.stripe.com/test/connect/accounts/overview"
          : "Check the key");
    }
  } catch (e) {
    record("Stripe secret key", false, e.message);
  }
}

/* ------------------------------------------------------------------ Output */
const pad = Math.max(...results.map((r) => r.name.length));
console.log("");
for (const r of results) {
  console.log(`  ${r.ok ? "OK  " : "FAIL"}  ${r.name.padEnd(pad)}  ${r.detail ?? ""}`);
  if (!r.ok && r.hint) console.log(`        ${" ".repeat(pad)}  -> ${r.hint}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed === 0
    ? "\n  All credentials working.\n"
    : `\n  ${failed} of ${results.length} need attention.\n`,
);
process.exit(failed === 0 ? 0 : 1);
