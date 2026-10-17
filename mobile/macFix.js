const CGI = '/cgi-bin/http.cgi';
const up = (m) => {
  const h = String(m).replace(/[^0-9a-f]/gi, '').toUpperCase();
  return h.length === 12 ? h.match(/.{2}/g).join(':') : String(m);
};
const low = (m) => String(m).toLowerCase();

function mergeRules(datas) {
  const map = new Map();
  for (const r of datas) {
    const mac = up(r.mac);
    const prev = map.get(mac);
    if (!prev) { map.set(mac, { ...r, mac }); continue; }
    if (prev.ippro !== r.ippro) prev.ippro = 'IPV4V6';
    prev.enableRule = !!(prev.enableRule || r.enableRule);
  }
  return Array.from(map.values());
}

function expandRules(text) {
  try {
    const j = JSON.parse(text);
    if (j && j.cmd === 23 && Array.isArray(j.datas)) {
      const out = [];
      for (const r of j.datas) {
        const base = { ...r, mac: low(r.mac) };
        if (r.ippro === 'IPV4V6') out.push({ ...base, ippro: 'IPV4' }, { ...base, ippro: 'IPV6' });
        else out.push(base);
      }
      j.datas = out;
      return JSON.stringify(j);
    }
  } catch (e) {}
  return text;
}

function findDesc(obj, prop) {
  let p = obj;
  while (p) {
    const d = Object.getOwnPropertyDescriptor(p, prop);
    if (d) return d;
    p = Object.getPrototypeOf(p);
  }
  return null;
}

if (!global.__macFix) {
  global.__macFix = true;
  const origFetch = global.fetch;
  if (origFetch) {
    global.fetch = async function (input, init) {
      let isList = false;
      try {
        const url = typeof input === 'string' ? input : input && input.url;
        if (url && url.includes(CGI) && init && typeof init.body === 'string') {
          const b = JSON.parse(init.body);
          if (b.cmd === 23 && b.method === 'POST' && Array.isArray(b.datas)) {
            b.datas = mergeRules(b.datas);
            init = { ...init, body: JSON.stringify(b) };
          } else if (b.cmd === 23 && b.method === 'GET') isList = true;
        }
      } catch (e) {}
      const res = await origFetch.call(this, input, init);
      if (!isList) return res;
      try {
        const txt = await res.clone().text();
        return new Response(expandRules(txt), { status: res.status, statusText: res.statusText, headers: res.headers });
      } catch (e) { return res; }
    };
  }
  const XHR = global.XMLHttpRequest;
  if (XHR) {
    const origSend = XHR.prototype.send;
    XHR.prototype.send = function (body) {
      try {
        if (typeof body === 'string' && body.includes('"cmd"')) {
          const b = JSON.parse(body);
          if (b.cmd === 23 && b.method === 'POST' && Array.isArray(b.datas)) {
            b.datas = mergeRules(b.datas);
            body = JSON.stringify(b);
          } else if (b.cmd === 23 && b.method === 'GET') {
            for (const prop of ['responseText', 'response']) {
              const d = findDesc(this, prop);
              if (d && d.get) {
                const getter = d.get;
                Object.defineProperty(this, prop, {
                  configurable: true,
                  get() { const v = getter.call(this); return typeof v === 'string' ? expandRules(v) : v; },
                });
              }
            }
          }
        }
      } catch (e) {}
      return origSend.call(this, body);
    };
  }
}
