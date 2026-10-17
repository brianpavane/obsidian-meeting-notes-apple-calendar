import test from "node:test";
import assert from "node:assert/strict";
import { GoogleAuth } from "../src/googleAuth";
import { resetElectronTestState } from "./support/electronStub";

test.afterEach(() => {
  resetElectronTestState();
});

test("GoogleAuth buildAuthUrl includes redirect, scope, and state", () => {
  const auth = new GoogleAuth("client-id", "client-secret") as unknown as {
    state: string;
    redirectPort: number;
    buildAuthUrl: () => string;
  };

  auth.state = "state-123";
  auth.redirectPort = 4567;
  const url = new URL(auth.buildAuthUrl());

  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("redirect_uri"), "http://127.0.0.1:4567");
  assert.equal(url.searchParams.get("state"), "state-123");
  assert.equal(
    url.searchParams.get("scope"),
    "https://www.googleapis.com/auth/calendar.readonly"
  );
});

test("GoogleAuth parseTokenResponse reuses fallback refresh token", () => {
  const auth = new GoogleAuth("client-id", "client-secret") as unknown as {
    parseTokenResponse: (
      data: Record<string, unknown>,
      fallbackRefresh: string
    ) => { access_token: string; refresh_token: string; expiry_date: number };
  };

  const tokenData = auth.parseTokenResponse(
    { access_token: "access", expires_in: 120 },
    "refresh-existing"
  );

  assert.equal(tokenData.access_token, "access");
  assert.equal(tokenData.refresh_token, "refresh-existing");
  assert.ok(tokenData.expiry_date > Date.now());
});

test("GoogleAuth refreshAccessToken surfaces Google error descriptions", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    ({
      json: async () => ({
        error: "invalid_grant",
        error_description: "Refresh token expired",
      }),
    }) as Response) as typeof fetch;

  try {
    const auth = new GoogleAuth("client-id", "client-secret");
    await assert.rejects(
      () => auth.refreshAccessToken("refresh-token"),
      /Refresh token expired/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("GoogleAuth htmlPage escapes the title before rendering", () => {
  const auth = new GoogleAuth("client-id", "client-secret") as unknown as {
    htmlPage: (title: string, body: string) => string;
  };

  const html = auth.htmlPage(`<script>alert("xss")</script>`, "<p>Body</p>");

  assert.doesNotMatch(html, /<title><script>/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /<p>Body<\/p>/);
});
