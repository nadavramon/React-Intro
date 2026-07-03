import { describe, it, expect, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.ts';

const server = app.listen(0);
const port = (server.address() as AddressInfo).port;

afterAll(() => {
  server.close();
});

describe('health endpoint', () => {
  it('GET /health returns 200 with { status: "ok" }', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
