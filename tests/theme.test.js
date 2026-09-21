const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'theme-tests-only';
// Isolate persistence so these endpoint tests never connect to a real database.
const prisma = { user: { update() { throw new Error('Unexpected database call'); } } };
require.cache[require.resolve('../src/prisma')] = { exports: prisma };
const authenticate = require('../src/middleware/authMiddleware');
const { updateTheme } = require('../src/controllers/userPreferencesController');
let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.patch('/theme', authenticate, updateTheme);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function request(body, role = 'CANDIDATE', id = 7) {
  return fetch(`${baseUrl}/theme`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(role ? { Authorization: `Bearer ${jwt.sign({ id, role }, process.env.JWT_SECRET)}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('requires authentication', async (t) => {
  const update = t.mock.method(prisma.user, 'update', async () => assert.fail('Unexpected DB write'));
  assert.equal((await request({ theme: 'light' }, null)).status, 401);
  assert.equal(update.mock.callCount(), 0);
});

test('rejects missing and unsupported themes without writing', async (t) => {
  const update = t.mock.method(prisma.user, 'update', async () => assert.fail('Unexpected DB write'));
  for (const theme of [undefined, null, 'system', 'LIGHT', '', 1, {}, ['dark']]) {
    assert.equal((await request({ theme })).status, 400);
  }
  assert.equal(update.mock.callCount(), 0);
});

for (const role of ['CANDIDATE', 'EMPLOYER', 'ADMIN']) {
  test(`${role} can save both modes only on their own account`, async (t) => {
    t.mock.method(prisma.user, 'update', async (query) => {
      assert.deepEqual(query.where, { id: 7 });
      assert.deepEqual(query.select, { theme: true });
      assert.deepEqual(Object.keys(query.data), ['theme']);
      return { theme: query.data.theme };
    });
    for (const theme of ['light', 'dark']) {
      const response = await request({ theme, userId: 99, role: 'ADMIN' }, role);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { theme });
    }
  });
}

test('returns 404 for a deleted account', async (t) => {
  t.mock.method(prisma.user, 'update', async () => { throw { code: 'P2025' }; });
  assert.equal((await request({ theme: 'light' })).status, 404);
});

test('reports a failed save without exposing database details', async (t) => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(prisma.user, 'update', async () => { throw new Error('private DB details'); });
  const response = await request({ theme: 'light' });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Unable to save theme preference' });
});
