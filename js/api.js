/*
 * お店とのやりとり（送信・取得）。お店へのデータの出入りは、すべてこのファイルを通す。
 *
 * STORE_API_URL が空のあいだは「試作モード」で動く。
 *   送信：送るはずのデータを localStorage の kome.outbox に記録し、送信成功として扱う
 *   取得：kome.outbox に記録した注文のうち、同じテーブル番号のものを返す
 * 受け取り先（サーバー）ができたら、STORE_API_URL に URL を入れるだけで実際に送信する。
 */
'use strict';

window.KomeApi = (function () {
  // お店の受け取り先の URL（例: 'https://example.com/api'）。空なら試作モード
  const STORE_API_URL = '';

  const OUTBOX_KEY = 'kome.outbox';
  const TIMEOUT_MS = 10000;
  const PROTOTYPE_DELAY_MS = 300; // 試作モードでも、通信しているように少し待つ

  function isPrototype() {
    return !STORE_API_URL;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* ---------- 試作モード：kome.outbox への記録と読み出し ---------- */
  function readOutbox() {
    try {
      const list = JSON.parse(localStorage.getItem(OUTBOX_KEY));
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  // 保存できなかったときは例外のまま返し、送信失敗として扱わせる
  function record(type, data) {
    const outbox = readOutbox();
    outbox.push({ type, data, sentAt: new Date().toISOString() });
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  }

  /* ---------- 本番：お店のサーバーとの通信 ---------- */
  async function request(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(STORE_API_URL.replace(/\/$/, '') + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function send(type, path, data) {
    if (isPrototype()) {
      await wait(PROTOTYPE_DELAY_MS);
      record(type, data);
      return { ok: true, prototype: true };
    }
    await request('POST', path, data);
    return { ok: true, prototype: false };
  }

  /* ---------- 画面から使う関数 ---------- */

  // 注文（商品・おしぼり・お水をまとめて 1 件）
  function sendOrder(order) {
    return send('order', '/orders', order);
  }

  // 店員呼び出し
  function sendCall(call) {
    return send('call', '/calls', call);
  }

  // 会計（{ tableNumber, orderIds, amount, checkedOutAt }）
  function sendCheckout(checkout) {
    return send('checkout', '/checkouts', checkout);
  }

  // このテーブルの注文一覧
  async function fetchOrders(tableNumber) {
    if (isPrototype()) {
      await wait(PROTOTYPE_DELAY_MS);
      const outbox = readOutbox();
      const paidIds = new Set();
      outbox
        .filter((r) => r.type === 'checkout' && r.data && r.data.tableNumber === tableNumber)
        .forEach((r) => (r.data.orderIds || []).forEach((id) => paidIds.add(id)));
      return outbox
        .filter((r) => r.type === 'order' && r.data && r.data.tableNumber === tableNumber)
        .map((r) => Object.assign({}, r.data, { paid: !!r.data.paid || paidIds.has(r.data.orderId) }));
    }
    const list = await request('GET', `/orders?tableNumber=${encodeURIComponent(tableNumber)}`);
    return Array.isArray(list) ? list : [];
  }

  return { isPrototype, sendOrder, sendCall, sendCheckout, fetchOrders };
})();
