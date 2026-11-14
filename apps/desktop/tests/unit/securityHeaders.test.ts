import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, installSecurityHeaders } from "../../src/main/app/securityHeaders";

type HeadersListener = (
  details: { responseHeaders?: Record<string, string[]> },
  respond: (response: { responseHeaders: Record<string, string[]> }) => void,
) => void;

/** A fake session that hands back the listener the app registered. */
function buildFakeSession() {
  const registered: { listener?: HeadersListener } = {};
  const session = {
    webRequest: {
      onHeadersReceived: (listener: HeadersListener) => {
        registered.listener = listener;
      },
    },
  } as unknown as Parameters<typeof installSecurityHeaders>[0];
  return { session, registered };
}

describe("content security policy", () => {
  it("forbids network connections, plugins and form posts in a packaged app", () => {
    const policy = contentSecurityPolicy(false);
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("connect-src 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("form-action 'none'");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("only loosens the policy for the local dev server", () => {
    const policy = contentSecurityPolicy(true);
    expect(policy).toContain("ws://localhost:*");
    expect(policy).toContain("'unsafe-eval'");
  });
});

describe("installSecurityHeaders", () => {
  it("adds the policy to every response and keeps the other headers", () => {
    const { session, registered } = buildFakeSession();
    installSecurityHeaders(session, false);
    let responded: Record<string, string[]> | undefined;
    registered.listener?.({ responseHeaders: { "Content-Type": ["text/html"] } }, (response) => {
      responded = response.responseHeaders;
    });
    expect(responded).toEqual({
      "Content-Type": ["text/html"],
      "Content-Security-Policy": [contentSecurityPolicy(false)],
    });
  });

  it("replaces a policy the response already carried", () => {
    const { session, registered } = buildFakeSession();
    installSecurityHeaders(session, false);
    let responded: Record<string, string[]> | undefined;
    registered.listener?.(
      { responseHeaders: { "Content-Security-Policy": ["default-src *"] } },
      (response) => {
        responded = response.responseHeaders;
      },
    );
    expect(responded?.["Content-Security-Policy"]).toEqual([contentSecurityPolicy(false)]);
  });

  it("copes with a response that has no headers", () => {
    const { session, registered } = buildFakeSession();
    installSecurityHeaders(session, true);
    let responded: Record<string, string[]> | undefined;
    registered.listener?.({}, (response) => {
      responded = response.responseHeaders;
    });
    expect(responded).toEqual({ "Content-Security-Policy": [contentSecurityPolicy(true)] });
  });
});
