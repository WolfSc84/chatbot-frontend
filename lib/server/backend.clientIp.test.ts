/**
 * The BFF tells ca-ai-core who the browser is, so per-IP rate limits are per user
 * rather than one bucket shared by everyone behind this server.
 */
import { describe, expect, it } from 'vitest';

import { authHeaders, CLIENT_IP_HEADER, clientIp } from './backend';

const req = (headers: Record<string, string>) =>
  new Request('http://bff.local/api/chat/stream', { headers });

describe('clientIp', () => {
  it('takes the rightmost X-Forwarded-For hop, which the proxy in front appended', () => {
    // The left entries are whatever the client sent; only the last one is trusted.
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('falls back to X-Real-IP, then to nothing', () => {
    expect(clientIp(req({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
    expect(clientIp(req({}))).toBeNull();
  });
});

describe('authHeaders', () => {
  it('sends the client IP on every backend call', () => {
    const headers = authHeaders(undefined, null, req({ 'x-forwarded-for': '203.0.113.7' }));
    expect(headers[CLIENT_IP_HEADER]).toBe('203.0.113.7');
  });

  it('never forwards a client-supplied x-client-ip', () => {
    const headers = authHeaders(
      { [CLIENT_IP_HEADER]: '6.6.6.6' },
      null,
      req({ 'x-client-ip': '6.6.6.6', 'x-forwarded-for': '203.0.113.7' }),
    );
    expect(headers[CLIENT_IP_HEADER]).toBe('203.0.113.7');
  });

  it('adds nothing when it cannot tell', () => {
    expect(authHeaders(undefined, null, req({}))[CLIENT_IP_HEADER]).toBeUndefined();
  });
});
