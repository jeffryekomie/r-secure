const test = require("node:test");
const assert = require("node:assert/strict");
const { createLimiter } = require("../src/middleware/rateLimit");

function clock() {
  let t = 1_000_000;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test("bloque après le maximum de tentatives, puis débloque une fois la fenêtre passée", () => {
  const c = clock();
  const l = createLimiter({ windowMs: 60_000, max: 3, now: c.now });
  for (let i = 0; i < 3; i++) {
    assert.equal(l.status("a").blocked, false);
    l.hit("a");
    c.advance(1000);
  }
  const st = l.status("a");
  assert.equal(st.blocked, true);
  assert.ok(st.retryAfter > 0 && st.retryAfter <= 60);
  c.advance(60_000);
  assert.equal(l.status("a").blocked, false);
});

test("les clés sont indépendantes et reset débloque", () => {
  const c = clock();
  const l = createLimiter({ windowMs: 60_000, max: 1, now: c.now });
  l.hit("a");
  assert.equal(l.status("a").blocked, true);
  assert.equal(l.status("b").blocked, false);
  l.reset("a");
  assert.equal(l.status("a").blocked, false);
});

test("sweep vide les clés expirées", () => {
  const c = clock();
  const l = createLimiter({ windowMs: 1000, max: 5, now: c.now });
  l.hit("a"); l.hit("b");
  assert.equal(l.size(), 2);
  c.advance(2000);
  l.sweep();
  assert.equal(l.size(), 0);
});
