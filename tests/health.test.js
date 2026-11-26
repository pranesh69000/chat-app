import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

test('GET /health returns status ok', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'GET',
    url: '/health'
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.payload);
  assert.equal(body.status, 'ok');
  assert.ok(body.timestamp);
});
