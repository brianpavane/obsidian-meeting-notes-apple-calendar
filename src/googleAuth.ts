/**
 * @file googleAuth.ts
 * @description Google OAuth 2.0 "installed app" flow for Obsidian.
 *
 * Flow overview:
 *   1. Generate a cryptographically random `state` token for CSRF protection.
 *   2. Start a local HTTP server on 127.0.0.1 to receive the redirect.
 *   3. Open the Google consent URL in the system browser via Electron shell.
 *   4. When Google redirects back, validate the `state` token, then exchange
 *      the authorization code for access + refresh tokens.
 *   5. Shut down the local server.
 *
 * Security notes:
 *   - The `state` parameter guards against CSRF / open-redirect attacks.
 *   - All untrusted data (URL params) is HTML-escaped before being written to
 *     the browser-facing redirect page.
 *   - Fetch calls to Google's token endpoint have a 10-second timeout.
 *   - Token response fields are validated before use.
 *   - The local server binds to 127.0.0.1 only, not 0.0.0.0.
 *   - Port 0 is passed to the OS so an available ephemeral port is assigned
 *     automatically, eliminating fixed-port conflicts.
 *   - Non-GET requests are rejected with 405.
 *   - Requests with a non-localhost `Origin` header are rejected with 403 to
 *     block cross-origin fetch attacks from malicious web pages.
 */

import * as http from "http";
import * as net from "net";
// Electron is available in Obsidian's desktop environment.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { shell } = require("electron") as typeof import("electron");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

/** Read-only access to Google Calendar is all this plugin requires. */
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

/** Milliseconds to wait for the user to complete the browser auth flow. */
const AUTH_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

/** Milliseconds before a token-exchange or refresh fetch is aborted. */
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Token data returned by Google and persisted in plugin settings. */
export interface TokenData {
  /** Short-lived OAuth 2.0 access token. */
  access_token: string;
  /** Long-lived refresh token used to obtain new access tokens. */
  refresh_token: string;
  /**
   * Unix timestamp (ms) at which the access token expires.
   * The plugin refreshes proactively 60 s before this time.
   */
  expiry_date: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe insertion into an HTML context.
 * Prevents XSS when reflecting untrusted data (e.g. OAuth error messages)
 * back to the browser.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Perform a fetch with an automatic abort after `timeoutMs` milliseconds.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// GoogleAuth
// ---------------------------------------------------------------------------

/**
 * Handles the complete Google OAuth 2.0 authorization lifecycle.
 */
export class GoogleAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private state = "";
  private redirectPort = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Run the full OAuth 2.0 "installed app" flow and return tokens.
   */
  authorize(): Promise<TokenData> {
    return new Promise((resolve, reject) => {
      this.state = crypto.randomUUID();

      const server = http.createServer(async (req, res) => {
        if (!req.url) { res.end(); return; }

        if (req.method !== "GET") {
          res.writeHead(405, { Allow: "GET" });
          res.end();
          return;
        }

        const origin = req.headers["origin"];
        if (origin !== undefined) {
          try {
            const originUrl = new URL(origin);
            const isLocalhost =
              originUrl.hostname === "127.0.0.1" ||
              originUrl.hostname === "localhost" ||
              originUrl.hostname === "[::1]";
            if (!isLocalhost) {
              res.writeHead(403, { "Content-Type": "text/plain" });
              res.end("Forbidden");
              return;
            }
          } catch {
            res.writeHead(403, { "Content-Type": "text/plain" });
            res.end("Forbidden");
            return;
          }
        }

        const url = new URL(req.url, `http://127.0.0.1:${this.redirectPort}`);
        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");

        if (returnedState !== this.state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(this.htmlPage("Authorization Failed",
            "<p>State token mismatch. Please try again from Obsidian.</p>"));
          server.close();
          reject(new Error("OAuth state mismatch — possible CSRF attempt."));
          return;
        }

        if (error) {
          const safeError = escapeHtml(String(error));
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(this.htmlPage("Authorization Denied",
            `<p>Authorization was denied: <strong>${safeError}</strong>.</p><p>You may close this tab and return to Obsidian.</p>`));
          server.close();
          reject(new Error(`Authorization denied: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(this.htmlPage("Authorization Successful",
            "<p>Authorization successful! You may close this tab and return to Obsidian.</p>"));
          server.close();
          try {
            const tokens = await this.exchangeCode(code);
            resolve(tokens);
          } catch (e) {
            reject(e);
          }
          return;
        }

        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(this.htmlPage("Unexpected Response",
          "<p>The redirect contained neither a code nor an error. Please try again.</p>"));
      });

      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as net.AddressInfo;
        this.redirectPort = addr.port;
        shell.openExternal(this.buildAuthUrl());
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        reject(new Error(`Failed to start local auth server: ${err.message}`));
      });

      setTimeout(() => {
        server.close();
        reject(new Error("Authorization timed out after 5 minutes."));
      }, AUTH_TIMEOUT_MS);
    });
  }

  /**
   * Exchange a refresh token for a new access token.
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenData> {
    const response = await fetchWithTimeout(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(
        typeof data.error_description === "string"
          ? data.error_description
          : String(data.error)
      );
    }
    return this.parseTokenResponse(data, refreshToken);
  }

  /**
   * Revoke a token at Google's revocation endpoint.
   * Failure is non-fatal — local credentials are cleared regardless.
   */
  async revokeToken(token: string): Promise<void> {
    try {
      await fetchWithTimeout(
        `${GOOGLE_REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`,
        { method: "POST" }
      );
    } catch {
      // intentionally swallowed
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: `http://127.0.0.1:${this.redirectPort}`,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state: this.state,
    });
    return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
  }

  private async exchangeCode(code: string): Promise<TokenData> {
    const response = await fetchWithTimeout(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: `http://127.0.0.1:${this.redirectPort}`,
        grant_type: "authorization_code",
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(
        typeof data.error_description === "string"
          ? data.error_description
          : String(data.error)
      );
    }
    return this.parseTokenResponse(data, "");
  }

  private parseTokenResponse(
    data: Record<string, unknown>,
    fallbackRefresh: string
  ): TokenData {
    const accessToken = typeof data.access_token === "string" ? data.access_token : "";
    // Google only returns a new refresh_token on the initial authorization
    // exchange (not on subsequent refreshes). Reusing the existing token
    // is correct and expected behaviour — not a security defect.
    const refreshToken =
      typeof data.refresh_token === "string" && data.refresh_token
        ? data.refresh_token
        : fallbackRefresh;
    const expiresIn = Number(data.expires_in) > 0 ? Number(data.expires_in) : 3600;

    if (!accessToken) {
      throw new Error("Google token response did not include an access_token.");
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: Date.now() + expiresIn * 1_000,
    };
  }

  private htmlPage(title: string, body: string): string {
    const safeTitle = escapeHtml(title);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: #fff; padding: 2rem 3rem; border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center; max-width: 420px; }
    h1 { color: #333; font-size: 1.4rem; margin-bottom: 0.75rem; }
    p  { color: #555; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${safeTitle}</h1>
    ${body}
  </div>
</body>
</html>`;
  }
}
