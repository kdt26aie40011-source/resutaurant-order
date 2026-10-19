/*
 * 画面の切り替え、かご、注文、会計、入力チェック。
 * データは js/data.js、お店とのやりとりは js/api.js（window.KomeApi）を使う。
 */
'use strict';

(function () {
  const D = window.KOME_DATA;
  const CFG = D.config;
  const Api = window.KomeApi;

  /* ================= 共通の小道具 ================= */

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function yen(n) {
    return `${Number(n).toLocaleString('ja-JP')}円`;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatTime(date) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function newId(prefix) {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
  }

  const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

  const STORAGE = {
    visit: 'kome.visit',
    basket: 'kome.basket',
    allergens: 'kome.allergens',
    lastCallAt: 'kome.lastCallAt',
  };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function store(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 保存できなくても画面はそのまま使えるようにする */
    }
  }

  /* ================= データの準備 ================= */

  // 付け合わせは「つけあわせ」ページでは商品として並べる（データは共通）
  function sideAsProduct(side) {
    return {
      id: side.id, name: side.name, price: side.price, emoji: side.emoji, category: 'side',
      image: side.image || '', needsRice: false, toppingIds: [], standardSideIds: [],
      allergens: side.allergens, recommended: !!side.recommended, placeholder: side.placeholder !== false,
    };
  }

  const ITEMS = D.products.concat(D.sides.map(sideAsProduct));
  const ITEM_MAP = byId(ITEMS);
  const SIDE_MAP = byId(D.sides);
  const TOPPING_MAP = byId(D.toppings);
  const RICE_TYPE_MAP = byId(D.riceTypes);
  const RICE_SIZE_MAP = byId(D.riceSizes);
  const ALLERGEN_MAP = byId(D.allergens);
  const CATEGORY_MAP = byId(D.categories);

  // data.js の書き間違いを開発者ツールに知らせる（画面は止めない）
  function checkData() {
    const problems = [];
    const seen = new Set();
    [].concat(ITEMS, D.toppings, D.riceTypes, D.riceSizes).forEach((x) => {
      if (seen.has(x.id)) problems.push(`id が重複しています: ${x.id}`);
      seen.add(x.id);
    });
    [].concat(ITEMS, D.toppings).forEach((x) => {
      (x.allergens || []).forEach((a) => {
        if (!ALLERGEN_MAP[a]) problems.push(`${x.id}: 不明なアレルギー物質 ${a}`);
      });
    });
    D.products.forEach((p) => {
      if (!CATEGORY_MAP[p.category] || p.category === 'contact' || p.category === 'side') {
        problems.push(`${p.id}: category が正しくありません (${p.category})`);
      }
      p.toppingIds.forEach((t) => { if (!TOPPING_MAP[t]) problems.push(`${p.id}: 不明なトッピング ${t}`); });
      p.standardSideIds.forEach((s) => { if (!SIDE_MAP[s]) problems.push(`${p.id}: 不明な付け合わせ ${s}`); });
    });
    problems.forEach((msg) => console.warn('[data.js]', msg));
  }

  /* ================= 状態 ================= */

  const state = {
    visit: load(STORAGE.visit, null), // { tableNumber, startedAt }
    basket: [],
    allergens: [],
    category: D.categories[0].id,
    lastCallAt: Number(load(STORAGE.lastCallAt, 0)) || 0,
  };

  // 保存されていた内容のうち、今のデータで扱えないものは捨てる
  state.basket = (load(STORAGE.basket, []) || []).filter((it) => {
    if (!it || typeof it !== 'object' || !it.uid) return false;
    if (it.kind === 'oshibori' || it.kind === 'water') return true;
    return it.kind === 'product' && !!ITEM_MAP[it.productId];
  });
  state.allergens = (load(STORAGE.allergens, []) || []).filter((id) => ALLERGEN_MAP[id]);

  function saveBasket() {
    store(STORAGE.basket, state.basket);
  }

  /* ================= アレルギー物質 ================= */

  function sortAllergens(ids) {
    const set = new Set(ids);
    return D.allergens.map((a) => a.id).filter((id) => set.has(id));
  }

  // 商品 + トッピング + 付け合わせを合わせたアレルギー物質
  function combinedAllergens(productId, toppingIds, sides) {
    const ids = [];
    const product = ITEM_MAP[productId];
    if (product) ids.push(...product.allergens);
    (toppingIds || []).forEach((id) => { if (TOPPING_MAP[id]) ids.push(...TOPPING_MAP[id].allergens); });
    (sides || []).forEach((s) => { if (SIDE_MAP[s.sideId]) ids.push(...SIDE_MAP[s.sideId].allergens); });
    return sortAllergens(ids);
  }

  function basketItemAllergens(it) {
    if (it.kind !== 'product') return [];
    return combinedAllergens(it.productId, it.toppingIds, it.sides);
  }

  function hasSelectedAllergen(ids) {
    return ids.some((id) => state.allergens.includes(id));
  }

  function selectedLabels(ids) {
    return ids.filter((id) => state.allergens.includes(id)).map((id) => ALLERGEN_MAP[id].label);
  }

  function tagsHtml(ids) {
    if (!ids.length) return '<span class="tag none">なし</span>';
    return ids
      .map((id) => `<span class="tag${state.allergens.includes(id) ? ' danger' : ''}">${esc(ALLERGEN_MAP[id].label)}</span>`)
      .join('');
  }

  function warnHtml(ids) {
    if (!hasSelectedAllergen(ids)) return '';
    return `<p class="warn-text">⚠ 選択中の「${esc(selectedLabels(ids).join('・'))}」を含みます</p>`;
  }

  function noticeHtml() {
    const names = D.allergens.map((a) => a.label).join('・');
    return `<p class="notice">※ アレルギー物質は特定原材料 8 品目（${esc(names)}）を表示しています。
      同じ厨房で調理しているため、表示のない商品にも微量が混入する可能性があります。ご心配な方は店員にお尋ねください。</p>`;
  }

  /* ================= 商品写真 ================= */

  const NO_IMAGE = 'images/noimage.svg';
  const placeholderCache = {};

  // 写真がまだない商品は、絵文字から仮の写真を描く
  function placeholderSrc(item) {
    if (placeholderCache[item.id]) return placeholderCache[item.id];
    try {
      const w = 320;
      const h = 240;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      let hash = 0;
      for (const ch of item.id) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, `hsl(${hash}, 55%, 90%)`);
      grad.addColorStop(1, `hsl(${(hash + 40) % 360}, 50%, 78%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2 + 6, 98, 80, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '112px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.fillText(item.emoji || '🍚', w / 2, h / 2 + 10);
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(60,45,30,0.55)';
      ctx.fillText('仮の写真', w - 12, h - 16);
      placeholderCache[item.id] = canvas.toDataURL('image/png');
    } catch (e) {
      placeholderCache[item.id] = NO_IMAGE;
    }
    return placeholderCache[item.id];
  }

  function imageSrc(item) {
    return item.placeholder || !item.image ? placeholderSrc(item) : item.image;
  }

  function photoHtml(item, withBadge) {
    const badge = withBadge && item.recommended ? '<span class="rec-badge">おすすめ</span>' : '';
    return `<img src="${esc(imageSrc(item))}" alt="${esc(item.name)}" loading="lazy" onerror="this.onerror=null;this.src='${NO_IMAGE}'">${badge}`;
  }

  function extraAsItem(kind) {
    return { id: `extra-${kind}`, name: D.extras[kind].name, emoji: D.extras[kind].emoji, placeholder: true };
  }

  /* ================= 画面の切り替え ================= */

  function showScreen(id) {
    $$('.screen').forEach((el) => { el.hidden = el.id !== id; });
  }

  function openOverlay(id) {
    $(`#${id}`).hidden = false;
    document.body.classList.add('no-scroll');
  }

  function closeOverlay(id) {
    $(`#${id}`).hidden = true;
    if ($$('.overlay').every((el) => el.hidden)) document.body.classList.remove('no-scroll');
  }

  /* ---------- ダイアログ・お知らせ ---------- */

  function dialog({ title, message, okText, cancelText }) {
    return new Promise((resolve) => {
      const backdrop = $('#dialog');
      const ok = $('#dialog-ok');
      const cancel = $('#dialog-cancel');
      $('#dialog-title').textContent = title;
      $('#dialog-message').textContent = message || '';
      ok.textContent = okText || 'OK';
      cancel.textContent = cancelText || '';
      cancel.hidden = !cancelText;
      backdrop.hidden = false;
      const done = (result) => {
        backdrop.hidden = true;
        ok.onclick = null;
        cancel.onclick = null;
        resolve(result);
      };
      ok.onclick = () => done(true);
      cancel.onclick = () => done(false);
      ok.focus();
    });
  }

  const confirmDialog = (title, message, okText, cancelText) =>
    dialog({ title, message, okText, cancelText: cancelText || 'やめる' });
  const alertDialog = (title, message) => dialog({ title, message, okText: 'OK' });

  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2500);
  }

  /* ================= スタート・テーブル番号 ================= */

  // テーブル番号は tableMin〜tableMax の整数のみ（全角数字も受け付ける）
  function parseTableNumber(value) {
    const text = String(value)
      .trim()
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    if (!/^[0-9]+$/.test(text)) return null;
    const n = Number(text);
    return n >= CFG.tableMin && n <= CFG.tableMax ? n : null;
  }

  function showTableScreen() {
    const input = $('#table-input');
    input.value = state.visit ? String(state.visit.tableNumber) : '';
    $('#table-error').hidden = true;
    showScreen('screen-table');
    input.focus();
  }

  function submitTable(event) {
    event.preventDefault();
    const n = parseTableNumber($('#table-input').value);
    if (n == null) {
      const err = $('#table-error');
      err.textContent = `テーブル番号は ${CFG.tableMin}〜${CFG.tableMax} の数字で入力してください。`;
      err.hidden = false;
      $('#table-input').focus();
      return;
    }
    if (!state.visit || state.visit.tableNumber !== n) {
      // 別の席の番号になったら、前の席のかごを持ち越さない
      if (state.visit) {
        state.basket = [];
        saveBasket();
      }
      state.visit = { tableNumber: n, startedAt: new Date().toISOString() };
      store(STORAGE.visit, state.visit);
    }
    enterMain();
  }

  function enterMain() {
    $('#hdr-table').textContent = `テーブル ${state.visit.tableNumber}`;
    renderCategoryBar();
    renderAllergyBar();
    renderContent();
    updateFooter();
    showScreen('screen-main');
  }

  /* ================= メイン画面 ================= */

  function tick() {
    $('#hdr-clock').textContent = formatTime(new Date());
    updateCallButton();
  }

  function renderCategoryBar() {
    $('#cat-bar').innerHTML = D.categories
      .map((c) => `<button type="button" class="cat-btn${c.id === state.category ? ' active' : ''}" data-cat="${esc(c.id)}">${esc(c.label)}</button>`)
      .join('');
  }

  function setCategory(id) {
    if (!CATEGORY_MAP[id]) return;
    state.category = id;
    $$('.cat-btn').forEach((b) => b.classList.toggle('active', b.dataset.cat === id));
    const active = $(`.cat-btn[data-cat="${id}"]`);
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    renderContent();
    $('#content').scrollTop = 0;
  }

  /* ---------- アレルギー選択欄 ---------- */

  function renderAllergyBar() {
    const btn = $('#btn-allergy');
    const labels = sortAllergens(state.allergens).map((id) => ALLERGEN_MAP[id].label);
    const open = !$('#allergy-panel').hidden;
    btn.innerHTML = labels.length
      ? `<span>⚠ アレルギー：<strong>${esc(labels.join('・'))}</strong> を赤く表示中</span><span class="chev">${open ? '▲' : '▼'}</span>`
      : `<span>アレルギー物質を選ぶと、含む商品を赤く表示します</span><span class="chev">${open ? '▲' : '▼'}</span>`;
    btn.classList.toggle('active', labels.length > 0);
    $('#allergy-panel').innerHTML = `
      <div class="allergy-chips">
        ${D.allergens.map((a) => `
          <label class="chip${state.allergens.includes(a.id) ? ' on' : ''}">
            <input type="checkbox" data-allergen="${esc(a.id)}"${state.allergens.includes(a.id) ? ' checked' : ''}>${esc(a.label)}
          </label>`).join('')}
      </div>
      <button type="button" class="btn text small" data-allergy-clear${state.allergens.length ? '' : ' disabled'}>選択をすべて外す</button>`;
  }

  function setAllergens(ids) {
    state.allergens = sortAllergens(ids);
    store(STORAGE.allergens, state.allergens);
    renderAllergyBar();
    renderContent();
    if (!$('#basket').hidden) renderBasket();
    if (!$('#detail').hidden) renderDetail();
  }

  /* ---------- 商品欄 ---------- */

  function cardHtml(item) {
    const warn = hasSelectedAllergen(item.allergens);
    return `
      <button type="button" class="card${warn ? ' warn' : ''}" data-item="${esc(item.id)}">
        <span class="card-photo">${photoHtml(item, true)}</span>
        <span class="card-body">
          <span class="card-name">${esc(item.name)}</span>
          <span class="card-price">${yen(item.price)}</span>
          <span class="tags">${tagsHtml(item.allergens)}</span>
          ${warn ? '<span class="warn-text">⚠ 選択中の物質を含みます</span>' : ''}
        </span>
      </button>`;
  }

  function renderContent() {
    const el = $('#content');
    const cat = CATEGORY_MAP[state.category];
    if (cat.id === 'contact') {
      el.innerHTML = contactHtml();
      updateCallButton();
      return;
    }
    const items = ITEMS.filter((i) => i.category === cat.id);
    const recs = items.filter((i) => i.recommended);
    el.innerHTML = `
      <h2 class="page-title">${esc(cat.label)}</h2>
      ${recs.length ? `
        <section class="rec-section">
          <h3 class="sec-title"><span class="star">★</span> おすすめ</h3>
          <div class="rec-strip">${recs.map(cardHtml).join('')}</div>
        </section>` : ''}
      <section>
        <h3 class="sec-title">${esc(cat.label)}メニュー <small>${items.length} 品</small></h3>
        <div class="grid">${items.map(cardHtml).join('')}</div>
      </section>
      ${noticeHtml()}`;
  }

  /* ---------- お問い合わせページ ---------- */

  function countOptions() {
    let html = '';
    for (let n = CFG.quantityMin; n <= CFG.quantityMax; n += 1) html += `<option value="${n}">${n} 個</option>`;
    return html;
  }

  function extraPanelHtml(kind, description) {
    const ex = D.extras[kind];
    return `
      <section class="panel">
        <h3 class="panel-title">${esc(ex.emoji)} ${esc(ex.name)}</h3>
        <p class="panel-text">${esc(description)}</p>
        <div class="panel-row">
          <label class="visually-hidden" for="count-${kind}">${esc(ex.name)}の個数</label>
          <select id="count-${kind}" class="select">${countOptions()}</select>
          <button type="button" class="btn primary" data-add-extra="${kind}">かごに入れる</button>
        </div>
      </section>`;
  }

  function contactHtml() {
    return `
      <h2 class="page-title">お問い合わせ</h2>
      ${extraPanelHtml('oshibori', '無料です。個数を選んでかごに入れると、ご注文と一緒にお持ちします。')}
      ${extraPanelHtml('water', '無料です。個数を選んでかごに入れると、ご注文と一緒にお持ちします。')}
      <section class="panel">
        <h3 class="panel-title">🧾 注文履歴</h3>
        <p class="panel-text">このテーブルのご注文と金額を確認し、会計ができます。</p>
        <div class="panel-row"><button type="button" class="btn primary" data-action="history">注文履歴を見る</button></div>
      </section>
      <section class="panel">
        <h3 class="panel-title">🔔 店員呼び出し</h3>
        <p class="panel-text">押すと、すぐに店員がお席に伺います。</p>
        <div class="panel-row"><button type="button" class="btn primary" id="btn-call" data-action="call">店員を呼ぶ</button></div>
        <p class="panel-status" id="call-status" aria-live="polite"></p>
      </section>`;
  }

  function addExtra(kind) {
    const select = $(`#count-${kind}`);
    const count = Number(select.value);
    const name = D.extras[kind].name;
    if (!Number.isInteger(count) || count < CFG.quantityMin || count > CFG.quantityMax) {
      alertDialog('個数を確かめてください', `${name}は ${CFG.quantityMin}〜${CFG.quantityMax} 個で選んでください。`);
      return;
    }
    const existing = state.basket.find((it) => it.kind === kind);
    if (existing) {
      if (existing.quantity + count > CFG.quantityMax) {
        alertDialog('これ以上入れられません',
          `${name}は 1 回のご注文で ${CFG.quantityMax} 個までです（かごに ${existing.quantity} 個入っています）。`);
        return;
      }
      existing.quantity += count;
    } else {
      state.basket.push({
        uid: newId('B'), kind, productId: null, toppingIds: [], sides: [],
        riceTypeId: null, riceSizeId: null, quantity: count, unitPrice: 0,
      });
    }
    saveBasket();
    updateFooter();
    toast(`${name}を ${count} 個かごに入れました`);
  }

  /* ---------- 店員呼び出し ---------- */

  function callRemainingSec() {
    const limit = CFG.callCooldownSec * 1000;
    const elapsed = Date.now() - state.lastCallAt;
    if (elapsed < 0) return CFG.callCooldownSec; // 端末の時計が戻ったとき
    return elapsed >= limit ? 0 : Math.ceil((limit - elapsed) / 1000);
  }

  function updateCallButton() {
    const btn = $('#btn-call');
    if (!btn) return;
    const remaining = callRemainingSec();
    btn.disabled = remaining > 0;
    btn.textContent = remaining > 0 ? `呼び出し済み（あと ${remaining} 秒）` : '店員を呼ぶ';
    $('#call-status').textContent = remaining > 0 ? '店員を呼びました。少々お待ちください。' : '';
  }

  let calling = false;
  async function callStaff() {
    if (calling || callRemainingSec() > 0) return;
    calling = true;
    try {
      const ok = await confirmDialog('店員を呼びますか？', `テーブル ${state.visit.tableNumber} に店員が伺います。`, '呼ぶ');
      if (!ok) return;
      state.lastCallAt = Date.now();
      store(STORAGE.lastCallAt, state.lastCallAt);
      updateCallButton();
      try {
        await Api.sendCall({ callId: newId('C'), tableNumber: state.visit.tableNumber, calledAt: new Date().toISOString() });
        toast('店員を呼びました');
      } catch (e) {
        state.lastCallAt = 0;
        store(STORAGE.lastCallAt, 0);
        updateCallButton();
        alertDialog('呼び出せませんでした', '通信に失敗しました。もう一度お試しいただくか、お近くの店員にお声がけください。');
      }
    } finally {
      calling = false;
    }
  }

  /* ---------- 下部（料金・かごボタン） ---------- */

  function basketTotal() {
    return state.basket.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  }

  function basketCount() {
    return state.basket.reduce((sum, it) => sum + it.quantity, 0);
  }

  function updateFooter() {
    $('#ftr-total').textContent = yen(basketTotal());
    const badge = $('#basket-count');
    const count = basketCount();
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  /* ================= 商品の選択画面 ================= */

  let detail = null;

  function openDetail(id) {
    const product = ITEM_MAP[id];
    if (!product) return;
    const sides = new Map();
    product.standardSideIds.forEach((sideId) => sides.set(sideId, { sideId, price: 0, isStandard: true }));
    detail = {
      product, step: 1, quantity: CFG.quantityMin, error: '',
      toppingIds: new Set(), sides, riceTypeId: null, riceSizeId: null,
    };
    renderDetail();
    openOverlay('detail');
  }

  function closeDetail() {
    closeOverlay('detail');
    detail = null;
  }

  function detailSelection() {
    const p = detail.product;
    const toppingIds = p.toppingIds.filter((t) => detail.toppingIds.has(t));
    const order = p.standardSideIds.concat(D.sides.map((s) => s.id).filter((s) => !p.standardSideIds.includes(s)));
    const sides = order.filter((s) => detail.sides.has(s)).map((s) => Object.assign({}, detail.sides.get(s)));
    return { toppingIds, sides };
  }

  function detailUnitPrice() {
    const { toppingIds, sides } = detailSelection();
    let price = detail.product.price;
    toppingIds.forEach((t) => { price += TOPPING_MAP[t].price; });
    sides.forEach((s) => { price += s.price; });
    if (detail.riceTypeId) price += RICE_TYPE_MAP[detail.riceTypeId].extraPrice;
    if (detail.riceSizeId) price += RICE_SIZE_MAP[detail.riceSizeId].extraPrice;
    return price;
  }

  function detailAllergens() {
    const { toppingIds, sides } = detailSelection();
    return combinedAllergens(detail.product.id, toppingIds, sides);
  }

  const RICE_STEPS = ['トッピング・付け合わせ', '米の種類', '米の量'];

  function stepperHtml() {
    if (!detail.product.needsRice) return '';
    return `<ol class="stepper">${RICE_STEPS.map((label, i) => {
      const n = i + 1;
      const cls = n === detail.step ? 'active' : n < detail.step ? 'done' : '';
      return `<li class="${cls}"><span class="step-no">${n}</span>${esc(label)}</li>`;
    }).join('')}</ol>`;
  }

  function extraPriceText(n) {
    return n > 0 ? `+${yen(n)}` : '追加料金なし';
  }

  function toppingSectionHtml() {
    const p = detail.product;
    if (!p.toppingIds.length) return '';
    return `
      <section class="choice">
        <h4 class="choice-title">トッピング <small>（いくつでも選べます）</small></h4>
        <div class="choice-box">
          ${p.toppingIds.map((id) => {
            const t = TOPPING_MAP[id];
            return `
              <label class="choice-item${hasSelectedAllergen(t.allergens) ? ' warn' : ''}">
                <input type="checkbox" data-topping="${esc(id)}"${detail.toppingIds.has(id) ? ' checked' : ''}>
                <span class="ci-main"><span class="ci-name">${esc(t.name)}</span><span class="tags">${tagsHtml(t.allergens)}</span></span>
                <span class="ci-price">+${yen(t.price)}</span>
              </label>`;
          }).join('')}
        </div>
      </section>`;
  }

  function sideItemHtml(side, isStandard) {
    const price = isStandard ? '料金込み' : `+${yen(CFG.sideSurcharge)}`;
    return `
      <label class="choice-item${hasSelectedAllergen(side.allergens) ? ' warn' : ''}">
        <input type="checkbox" data-side="${esc(side.id)}" data-standard="${isStandard ? '1' : '0'}"${detail.sides.has(side.id) ? ' checked' : ''}>
        <span class="ci-main"><span class="ci-name">${esc(side.name)}</span><span class="tags">${tagsHtml(side.allergens)}</span></span>
        <span class="ci-price">${price}</span>
      </label>`;
  }

  function sideSectionHtml() {
    const p = detail.product;
    if (!p.standardSideIds.length) return '';
    const others = D.sides.filter((s) => !p.standardSideIds.includes(s.id));
    return `
      <section class="choice">
        <h4 class="choice-title">付け合わせ <small>（標準は料金込み。外すこともできます）</small></h4>
        <div class="choice-box">
          <p class="choice-group">この定食の標準</p>
          ${p.standardSideIds.map((id) => sideItemHtml(SIDE_MAP[id], true)).join('')}
          <hr class="choice-divider">
          <p class="choice-group">ほかの付け合わせ（各 +${yen(CFG.sideSurcharge)}）</p>
          ${others.map((s) => sideItemHtml(s, false)).join('')}
        </div>
      </section>`;
  }

  function quantityHtml() {
    return `
      <div class="qty-row">
        <span class="qty-label">数量</span>
        <div class="qty">
          <button type="button" class="qty-btn" data-d="dec" aria-label="1 つ減らす"${detail.quantity <= CFG.quantityMin ? ' disabled' : ''}>−</button>
          <span class="qty-value" id="d-qty">${detail.quantity}</span>
          <button type="button" class="qty-btn" data-d="inc" aria-label="1 つ増やす"${detail.quantity >= CFG.quantityMax ? ' disabled' : ''}>＋</button>
        </div>
      </div>`;
  }

  function radioListHtml(name, list, selectedId, labelOf) {
    return `<div class="choice-box tall" role="radiogroup">${list.map((x) => `
      <label class="choice-item">
        <input type="radio" name="${name}" value="${esc(x.id)}"${x.id === selectedId ? ' checked' : ''}>
        <span class="ci-main"><span class="ci-name">${esc(labelOf(x))}</span></span>
        <span class="ci-price">${extraPriceText(x.extraPrice)}</span>
      </label>`).join('')}</div>`;
  }

  function stepBodyHtml() {
    const p = detail.product;
    if (detail.step === 1) {
      const parts = toppingSectionHtml() + sideSectionHtml();
      return (parts || '<p class="muted">この商品は、トッピングや付け合わせの選択はありません。</p>') + quantityHtml();
    }
    if (detail.step === 2) {
      return `<section class="choice"><h4 class="choice-title">米の種類 <small>（必ず選んでください）</small></h4>
        ${radioListHtml('rice-type', D.riceTypes, detail.riceTypeId, (x) => x.name)}</section>`;
    }
    return `<section class="choice"><h4 class="choice-title">米の量 <small>（必ず選んでください）</small></h4>
      ${radioListHtml('rice-size', D.riceSizes, detail.riceSizeId, (x) => `${x.label}（${x.grams}g）`)}</section>
      <p class="muted">選んだ米：${esc(p.needsRice && detail.riceTypeId ? RICE_TYPE_MAP[detail.riceTypeId].name : '')}</p>`;
  }

  function nextLabel() {
    const p = detail.product;
    if (!p.needsRice || detail.step === 3) return 'かごに入れる';
    return detail.step === 1 ? '次へ：米の種類を選ぶ' : '次へ：米の量を選ぶ';
  }

  function renderDetail() {
    if (!detail) return;
    const p = detail.product;
    const el = $('#detail');
    el.innerHTML = `
      <header class="ov-header">
        <button type="button" class="btn-back" data-d="back">‹ ${detail.step > 1 ? '前へ' : '戻る'}</button>
        <h2 class="ov-title">商品の選択</h2>
        <span class="ov-sub">テーブル ${state.visit.tableNumber}</span>
      </header>
      <div class="ov-body" id="detail-body">
        ${stepperHtml()}
        <div class="detail-top">
          <div class="detail-photo">${photoHtml(p, true)}</div>
          <div class="detail-info">
            <h3 class="detail-name">${esc(p.name)}</h3>
            <p class="detail-price">${yen(p.price)}</p>
            <p class="mini-label">アレルギー物質</p>
            <div class="tags">${tagsHtml(p.allergens)}</div>
          </div>
        </div>
        ${stepBodyHtml()}
        <div class="detail-sum">
          <p class="mini-label">選んだ内容のアレルギー物質</p>
          <div class="tags" id="d-allergens"></div>
          <div id="d-warn"></div>
        </div>
        ${noticeHtml()}
      </div>
      <footer class="ov-footer">
        <div class="ov-total"><span>小計</span><strong id="d-subtotal"></strong></div>
        <p class="error-text" id="d-error" role="alert"${detail.error ? '' : ' hidden'}>${esc(detail.error)}</p>
        <button type="button" class="btn primary" data-d="next">${esc(nextLabel())}</button>
      </footer>`;
    updateDetailSummary();
  }

  // 選択を変えたときは、スクロール位置を保つため一部だけ書き換える
  function updateDetailSummary() {
    const al = detailAllergens();
    $('#d-allergens').innerHTML = tagsHtml(al);
    $('#d-warn').innerHTML = warnHtml(al);
    $('#d-subtotal').textContent = yen(detailUnitPrice() * detail.quantity);
    const qty = $('#d-qty');
    if (qty) {
      qty.textContent = String(detail.quantity);
      $('[data-d="dec"]', $('#detail')).disabled = detail.quantity <= CFG.quantityMin;
      $('[data-d="inc"]', $('#detail')).disabled = detail.quantity >= CFG.quantityMax;
    }
  }

  function setDetailError(message) {
    detail.error = message;
    const el = $('#d-error');
    el.textContent = message;
    el.hidden = !message;
  }

  function onDetailChange(event) {
    if (!detail) return;
    const input = event.target;
    if (input.dataset.topping) {
      if (input.checked) detail.toppingIds.add(input.dataset.topping);
      else detail.toppingIds.delete(input.dataset.topping);
    } else if (input.dataset.side) {
      const isStandard = input.dataset.standard === '1';
      if (input.checked) {
        detail.sides.set(input.dataset.side, { sideId: input.dataset.side, price: isStandard ? 0 : CFG.sideSurcharge, isStandard });
      } else {
        detail.sides.delete(input.dataset.side);
      }
    } else if (input.name === 'rice-type' && RICE_TYPE_MAP[input.value]) {
      detail.riceTypeId = input.value;
      setDetailError('');
    } else if (input.name === 'rice-size' && RICE_SIZE_MAP[input.value]) {
      detail.riceSizeId = input.value;
      setDetailError('');
    }
    updateDetailSummary();
  }

  function goStep(step) {
    detail.step = step;
    detail.error = '';
    renderDetail();
    $('#detail-body').scrollTop = 0;
  }

  function onDetailClick(event) {
    const btn = event.target.closest('[data-d]');
    if (!btn || !detail) return;
    const action = btn.dataset.d;
    if (action === 'back') {
      if (detail.step > 1) goStep(detail.step - 1);
      else closeDetail();
    } else if (action === 'dec' || action === 'inc') {
      const next = detail.quantity + (action === 'inc' ? 1 : -1);
      detail.quantity = Math.min(CFG.quantityMax, Math.max(CFG.quantityMin, next));
      updateDetailSummary();
    } else if (action === 'next') {
      nextDetailStep();
    }
  }

  function nextDetailStep() {
    const p = detail.product;
    if (p.needsRice && detail.step === 1) return goStep(2);
    if (p.needsRice && detail.step === 2) {
      if (!detail.riceTypeId) return setDetailError('米の種類を選んでください。');
      return goStep(3);
    }
    if (p.needsRice && !detail.riceTypeId) {
      goStep(2);
      return setDetailError('米の種類を選んでください。');
    }
    if (p.needsRice && !detail.riceSizeId) return setDetailError('米の量を選んでください。');
    addDetailToBasket();
  }

  function addDetailToBasket() {
    const p = detail.product;
    const q = detail.quantity;
    if (!Number.isInteger(q) || q < CFG.quantityMin || q > CFG.quantityMax) {
      return setDetailError(`数量は ${CFG.quantityMin}〜${CFG.quantityMax} で選んでください。`);
    }
    const { toppingIds, sides } = detailSelection();
    state.basket.push({
      uid: newId('B'),
      kind: 'product',
      productId: p.id,
      toppingIds,
      sides,
      riceTypeId: p.needsRice ? detail.riceTypeId : null,
      riceSizeId: p.needsRice ? detail.riceSizeId : null,
      quantity: q,
      unitPrice: detailUnitPrice(), // 選んだ時点の価格を記録する
    });
    saveBasket();
    updateFooter();
    closeDetail();
    toast(`${p.name} をかごに入れました`);
  }

  /* ================= かご（注文確認画面） ================= */

  function itemName(it) {
    if (it.kind === 'oshibori' || it.kind === 'water') return D.extras[it.kind].name;
    return ITEM_MAP[it.productId] ? ITEM_MAP[it.productId].name : '（取り扱いのない商品）';
  }

  function itemPhotoSource(it) {
    if (it.kind === 'oshibori' || it.kind === 'water') return extraAsItem(it.kind);
    return ITEM_MAP[it.productId] || { id: 'unknown', name: itemName(it), emoji: '🍚', placeholder: true };
  }

  function itemOptionLines(it) {
    const lines = [];
    const nameOf = (map, id, key) => (map[id] ? map[id][key || 'name'] : '（不明）');
    if (it.toppingIds && it.toppingIds.length) {
      lines.push(`トッピング：${it.toppingIds.map((id) => nameOf(TOPPING_MAP, id)).join('、')}`);
    }
    if (it.sides && it.sides.length) {
      lines.push(`付け合わせ：${it.sides.map((s) => {
        const n = nameOf(SIDE_MAP, s.sideId);
        return s.isStandard ? n : `${n}（+${yen(s.price)}）`;
      }).join('、')}`);
    }
    if (it.riceTypeId) {
      const size = RICE_SIZE_MAP[it.riceSizeId];
      lines.push(`ごはん：${nameOf(RICE_TYPE_MAP, it.riceTypeId)}・${size ? `${size.label}（${size.grams}g）` : '（不明）'}`);
    }
    if (it.kind !== 'product') lines.push('無料・ご注文と一緒にお持ちします');
    return lines;
  }

  function renderBasket() {
    $('#basket-table').textContent = `テーブル ${state.visit.tableNumber}`;
    const body = $('#basket-body');
    if (!state.basket.length) {
      body.innerHTML = `<p class="empty">かごは空です。<br>メニューから商品を選んでください。</p>`;
    } else {
      body.innerHTML = `
        <ul class="b-list">
          ${state.basket.map((it) => {
            const al = basketItemAllergens(it);
            const warn = hasSelectedAllergen(al);
            return `
              <li class="b-item${warn ? ' warn' : ''}">
                <div class="b-photo">${photoHtml(itemPhotoSource(it), false)}</div>
                <div class="b-main">
                  <div class="b-head">
                    <span class="b-name">${esc(itemName(it))}</span>
                    <button type="button" class="b-del" data-del="${esc(it.uid)}">削除</button>
                  </div>
                  <ul class="b-opts">${itemOptionLines(it).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
                  ${it.kind === 'product' ? `<div class="tags">${tagsHtml(al)}</div>` : ''}
                  ${warnHtml(al)}
                  <div class="b-foot">
                    <div class="qty">
                      <button type="button" class="qty-btn" data-bq="${esc(it.uid)}" data-delta="-1" aria-label="1 つ減らす"${it.quantity <= CFG.quantityMin ? ' disabled' : ''}>−</button>
                      <span class="qty-value">${it.quantity}</span>
                      <button type="button" class="qty-btn" data-bq="${esc(it.uid)}" data-delta="1" aria-label="1 つ増やす"${it.quantity >= CFG.quantityMax ? ' disabled' : ''}>＋</button>
                    </div>
                    <span class="b-price"><small>${yen(it.unitPrice)} × ${it.quantity}</small>${yen(it.unitPrice * it.quantity)}</span>
                  </div>
                </div>
              </li>`;
          }).join('')}
        </ul>
        ${noticeHtml()}`;
    }
    $('#basket-total').textContent = yen(basketTotal());
    $('#btn-order').disabled = state.basket.length === 0 || ordering;
  }

  function onBasketClick(event) {
    const del = event.target.closest('[data-del]');
    if (del) {
      state.basket = state.basket.filter((it) => it.uid !== del.dataset.del);
      saveBasket();
      updateFooter();
      renderBasket();
      return;
    }
    const q = event.target.closest('[data-bq]');
    if (q) {
      const it = state.basket.find((x) => x.uid === q.dataset.bq);
      if (!it) return;
      const next = it.quantity + Number(q.dataset.delta);
      if (next < CFG.quantityMin || next > CFG.quantityMax) return;
      it.quantity = next;
      saveBasket();
      updateFooter();
      renderBasket();
    }
  }

  let ordering = false;
  async function submitOrder() {
    if (ordering) return;
    if (!state.basket.length) {
      alertDialog('かごが空です', 'メニューから商品を選んでから、注文してください。');
      return;
    }
    const total = basketTotal();
    const ok = await confirmDialog('注文を確定しますか？',
      `${basketCount()} 点　合計 ${yen(total)}\nテーブル ${state.visit.tableNumber} にお持ちします。`, '注文を確定する', '戻る');
    if (!ok) return;

    ordering = true;
    const btn = $('#btn-order');
    btn.disabled = true;
    btn.textContent = '送信中…';
    const order = {
      orderId: newId('O'),
      tableNumber: state.visit.tableNumber,
      items: state.basket.map((it) => JSON.parse(JSON.stringify(it))),
      total,
      orderedAt: new Date().toISOString(),
      paid: false,
    };
    try {
      await Api.sendOrder(order);
      state.basket = [];
      saveBasket();
      updateFooter();
      closeOverlay('basket');
      await alertDialog('ご注文を承りました', '出来上がり次第お持ちします。\n追加のご注文もお気軽にどうぞ。');
    } catch (e) {
      // 失敗したときはかごの中身を残す
      await alertDialog('送信できませんでした', 'かごの中身はそのまま残っています。もう一度お試しいただくか、店員をお呼びください。');
    } finally {
      ordering = false;
      btn.textContent = '注文を確定する';
      renderBasket();
    }
  }

  /* ================= 注文履歴・会計 ================= */

  let historyOrders = [];

  async function openHistory() {
    $('#history-table').textContent = `テーブル ${state.visit.tableNumber}`;
    openOverlay('history');
    await loadHistory();
  }

  async function loadHistory() {
    const body = $('#history-body');
    body.innerHTML = '<p class="empty">読み込み中…</p>';
    $('#btn-checkout').disabled = true;
    try {
      const orders = await Api.fetchOrders(state.visit.tableNumber);
      historyOrders = orders.slice().sort((a, b) => String(b.orderedAt).localeCompare(String(a.orderedAt)));
      renderHistory();
    } catch (e) {
      historyOrders = [];
      $('#history-unpaid').textContent = '—';
      body.innerHTML = `<p class="empty">注文履歴を取得できませんでした。<br>
        <button type="button" class="btn" data-action="history-retry">もう一度読み込む</button></p>`;
    }
  }

  function renderHistory() {
    const body = $('#history-body');
    const all = historyOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const unpaid = historyOrders.filter((o) => !o.paid).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    $('#history-unpaid').textContent = yen(unpaid);
    $('#btn-checkout').disabled = unpaid <= 0;

    if (!historyOrders.length) {
      body.innerHTML = '<p class="empty">まだご注文はありません。</p>';
      return;
    }
    body.innerHTML = `
      <div class="h-summary">
        <div><span>これまでの合計</span><strong>${yen(all)}</strong></div>
        <div class="${unpaid > 0 ? 'unpaid' : ''}"><span>未会計の金額</span><strong>${unpaid > 0 ? yen(unpaid) : '0円（会計済み）'}</strong></div>
      </div>
      ${historyOrders.map((o, idx) => `
        <article class="h-order">
          <header class="h-head">
            <span>${historyOrders.length - idx} 回目のご注文　${esc(formatTime(new Date(o.orderedAt)))}</span>
            <span class="h-status ${o.paid ? 'paid' : 'unpaid'}">${o.paid ? '会計済み' : '未会計'}</span>
          </header>
          <ul class="h-items">
            ${(o.items || []).map((it) => `
              <li>
                <span class="h-name">${esc(itemName(it))} × ${it.quantity}
                  ${(it.kind === 'product' ? itemOptionLines(it) : []).map((l) => `<small>${esc(l)}</small>`).join('')}
                </span>
                <span class="h-price">${yen(it.unitPrice * it.quantity)}</span>
              </li>`).join('')}
          </ul>
          <footer class="h-foot"><span>小計</span><strong>${yen(o.total)}</strong></footer>
        </article>`).join('')}`;
  }

  let checkingOut = false;
  async function checkout() {
    if (checkingOut) return;
    const unpaidOrders = historyOrders.filter((o) => !o.paid);
    const amount = unpaidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    if (!unpaidOrders.length || amount <= 0) return;
    const ok = await confirmDialog('会計しますか？', `未会計の金額は ${yen(amount)} です。\n会計後、店員がお席に伺います。`, '会計する');
    if (!ok) return;
    checkingOut = true;
    $('#btn-checkout').disabled = true;
    try {
      await Api.sendCheckout({
        tableNumber: state.visit.tableNumber,
        orderIds: unpaidOrders.map((o) => o.orderId),
        amount,
        checkedOutAt: new Date().toISOString(),
      });
      await loadHistory();
      await alertDialog('会計を受け付けました', 'ありがとうございました。店員がお席に伺います。');
    } catch (e) {
      $('#btn-checkout').disabled = false;
      await alertDialog('会計を送信できませんでした', 'もう一度お試しいただくか、店員をお呼びください。');
    } finally {
      checkingOut = false;
    }
  }

  /* ================= 初期化 ================= */

  function bindEvents() {
    $('#btn-start').addEventListener('click', showTableScreen);
    $('#btn-table-back').addEventListener('click', () => showScreen('screen-start'));
    $('#table-form').addEventListener('submit', submitTable);
    $('#table-input').addEventListener('input', () => { $('#table-error').hidden = true; });
    $('#hdr-table').addEventListener('click', showTableScreen);

    $('#cat-bar').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (btn) setCategory(btn.dataset.cat);
    });

    $('#btn-allergy').addEventListener('click', () => {
      const panel = $('#allergy-panel');
      panel.hidden = !panel.hidden;
      $('#btn-allergy').setAttribute('aria-expanded', String(!panel.hidden));
      renderAllergyBar();
    });
    $('#allergy-panel').addEventListener('change', (e) => {
      const id = e.target.dataset.allergen;
      if (!id) return;
      const next = state.allergens.filter((a) => a !== id);
      if (e.target.checked) next.push(id);
      setAllergens(next);
    });
    $('#allergy-panel').addEventListener('click', (e) => {
      if (e.target.closest('[data-allergy-clear]')) setAllergens([]);
    });

    $('#content').addEventListener('click', (e) => {
      const card = e.target.closest('[data-item]');
      if (card) return openDetail(card.dataset.item);
      const extra = e.target.closest('[data-add-extra]');
      if (extra) return addExtra(extra.dataset.addExtra);
      const action = e.target.closest('[data-action]');
      if (action && action.dataset.action === 'history') return openHistory();
      if (action && action.dataset.action === 'call') return callStaff();
      return undefined;
    });

    $('#btn-basket').addEventListener('click', () => {
      renderBasket();
      openOverlay('basket');
    });

    $('#detail').addEventListener('change', onDetailChange);
    $('#detail').addEventListener('click', onDetailClick);
    $('#basket-body').addEventListener('click', onBasketClick);
    $('#btn-order').addEventListener('click', submitOrder);
    $('#btn-checkout').addEventListener('click', checkout);
    $('#history-body').addEventListener('click', (e) => {
      if (e.target.closest('[data-action="history-retry"]')) loadHistory();
    });
    $$('[data-close]').forEach((btn) => btn.addEventListener('click', () => closeOverlay(btn.dataset.close)));
  }

  function init() {
    checkData();
    document.title = `${CFG.storeName} ご注文`;
    $('#start-name').textContent = CFG.storeName;
    $$('[data-store-name]').forEach((el) => { el.textContent = CFG.storeName; });
    $('#table-hint').textContent = `お席に表示されている番号（${CFG.tableMin}〜${CFG.tableMax}）`;
    bindEvents();
    tick();
    setInterval(tick, 1000);
    showScreen('screen-start');
    if (Api.isPrototype()) console.info('[api.js] 試作モード：送信内容は localStorage の kome.outbox に記録します');
  }

  init();
})();
