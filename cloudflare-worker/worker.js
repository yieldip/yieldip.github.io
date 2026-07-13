// Contact form proxy: verifies Cloudflare Turnstile server-side, then
// forwards the submission to Google Forms. The real Google Forms URL
// never touches the browser, so bots can no longer discover and hit it
// directly — every submission must pass Turnstile verification first.

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/u/0/d/e/1FAIpQLScMDvABiHF0w8nQo7U9MOuAJs25ZUHTICmkjEvzZoR1ue-H7g/formResponse";

const ALLOWED_ORIGINS = new Set([
  "https://yieldip.com",
  "https://www.yieldip.com",
]);

const FIELD_MAP = {
  firstName: "entry.559885826",
  lastName: "entry.2129925112",
  email: "entry.2021414221",
  company: "entry.1682581518",
  service: "entry.1514591211",
  message: "entry.326191174",
};

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://yieldip.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers });
    }

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return new Response("Bad request", { status: 400, headers });
    }

    // Honeypot — mirrors the page-level check as defense in depth.
    if ((formData.get("website") || "").toString().trim() !== "") {
      // Pretend success so the bot has no signal to react to.
      return new Response("OK", { status: 200, headers });
    }

    const token = formData.get("cf-turnstile-response");
    if (!token) {
      return new Response("Missing verification token", { status: 400, headers });
    }

    const verifyRes = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token.toString(),
          remoteip: request.headers.get("CF-Connecting-IP") || "",
        }),
      }
    );
    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      return new Response("Verification failed", { status: 403, headers });
    }

    const googlePayload = new URLSearchParams();
    for (const [field, entryId] of Object.entries(FIELD_MAP)) {
      googlePayload.set(entryId, (formData.get(field) || "").toString());
    }

    await fetch(GOOGLE_FORM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: googlePayload,
    });

    return new Response("OK", { status: 200, headers });
  },
};
