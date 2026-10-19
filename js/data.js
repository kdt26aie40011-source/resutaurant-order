/*
 * 店の設定とメニューのデータ。
 * 商品を追加・変更するときは、このファイルだけを書き換える（ルールは CLAUDE.md を参照）。
 */
'use strict';

window.KOME_DATA = (function () {
  /* ---------- 店の設定 ---------- */
  const config = {
    storeName: '米至上主義',
    tableMin: 1,
    tableMax: 20,
    quantityMin: 1,
    quantityMax: 10,
    sideSurcharge: 50, // 定食で標準以外の付け合わせを選んだときの割増（一律）
    callCooldownSec: 30, // 店員呼び出しを押せない秒数
  };

  /* ---------- アレルギー物質（特定原材料 8 品目） ---------- */
  const allergens = [
    { id: 'egg', label: '卵' },
    { id: 'milk', label: '乳' },
    { id: 'wheat', label: '小麦' },
    { id: 'shrimp', label: 'えび' },
    { id: 'crab', label: 'かに' },
    { id: 'walnut', label: 'くるみ' },
    { id: 'buckwheat', label: 'そば' },
    { id: 'peanut', label: '落花生' },
  ];

  /* ---------- カテゴリ（表示順） ---------- */
  const categories = [
    { id: 'teishoku', label: '定食' },
    { id: 'ippin', label: '一品物' },
    { id: 'side', label: 'つけあわせ' },
    { id: 'drink', label: 'ドリンク' },
    { id: 'dessert', label: 'デザート' },
    { id: 'contact', label: 'お問い合わせ' },
  ];

  /* ---------- 米の種類・量（定食で必ず選ぶ） ---------- */
  const riceTypes = [
    { id: 'rice-koshihikari', name: '白米（コシヒカリ）', extraPrice: 0 },
    { id: 'rice-yumepirika', name: '白米（ゆめぴりか）', extraPrice: 100 },
    { id: 'rice-uonuma', name: '魚沼産コシヒカリ', extraPrice: 200 },
    { id: 'rice-genmai', name: '玄米', extraPrice: 50 },
    { id: 'rice-mugi', name: '麦ごはん', extraPrice: 50 },
    { id: 'rice-zakkoku', name: '十六穀米', extraPrice: 80 },
  ];

  const riceSizes = [
    { id: 'size-s', label: '小盛', grams: 150, extraPrice: 0 },
    { id: 'size-m', label: '並盛', grams: 200, extraPrice: 0 },
    { id: 'size-l', label: '大盛', grams: 300, extraPrice: 50 },
    { id: 'size-xl', label: '特盛', grams: 400, extraPrice: 100 },
    { id: 'size-max', label: '米至上盛', grams: 600, extraPrice: 200 },
  ];

  /* ---------- トッピング ---------- */
  const toppings = [
    { id: 'top-onsen', name: '温泉卵', price: 80, allergens: ['egg'] },
    { id: 'top-cheese', name: 'チーズ', price: 100, allergens: ['milk'] },
    { id: 'top-mentai', name: '明太子', price: 120, allergens: [] },
    { id: 'top-negi', name: '刻みねぎ', price: 30, allergens: [] },
    { id: 'top-oroshi', name: '大根おろし', price: 50, allergens: [] },
    { id: 'top-mayo', name: 'マヨネーズ', price: 30, allergens: ['egg'] },
    { id: 'top-tartar', name: 'タルタルソース', price: 80, allergens: ['egg'] },
    { id: 'top-nori', name: '刻み海苔', price: 30, allergens: [] },
    { id: 'top-tenkasu', name: '天かす', price: 30, allergens: ['wheat'] },
    { id: 'top-sakuraebi', name: '桜えび', price: 80, allergens: ['shrimp'] },
    { id: 'top-walnutmiso', name: 'くるみ味噌', price: 100, allergens: ['walnut'] },
    { id: 'top-peanut', name: 'ピーナッツだれ', price: 80, allergens: ['peanut'] },
    { id: 'top-kimchi', name: 'キムチ', price: 100, allergens: ['shrimp'] },
    { id: 'top-natto', name: '納豆', price: 80, allergens: [] },
    { id: 'top-goma', name: 'すりごま', price: 30, allergens: [] },
  ];

  /* ---------- 付け合わせ（つけあわせページと定食で共通） ---------- */
  const sides = [
    { id: 'side-miso', name: '味噌汁', price: 150, emoji: '🥣', allergens: [], recommended: true, placeholder: true },
    { id: 'side-tonjiru', name: '豚汁', price: 250, emoji: '🍲', allergens: [], recommended: false, placeholder: true },
    { id: 'side-tsukemono', name: '漬物', price: 120, emoji: '🥒', allergens: [], recommended: false, placeholder: true },
    { id: 'side-hijiki', name: 'ひじき煮', price: 150, emoji: '🥢', allergens: ['wheat'], recommended: false, placeholder: true },
    { id: 'side-hiyayakko', name: '冷奴', price: 180, emoji: '🧊', allergens: [], recommended: false, placeholder: true },
    { id: 'side-salad', name: 'キャベツサラダ', price: 150, emoji: '🥗', allergens: [], recommended: false, placeholder: true },
    { id: 'side-potesala', name: 'ポテトサラダ', price: 200, emoji: '🥔', allergens: ['egg'], recommended: true, placeholder: true },
    { id: 'side-chawanmushi', name: '茶碗蒸し', price: 250, emoji: '🍮', allergens: ['egg', 'shrimp'], recommended: false, placeholder: true },
    { id: 'side-kinpira', name: 'きんぴらごぼう', price: 150, emoji: '🥕', allergens: ['wheat'], recommended: false, placeholder: true },
    { id: 'side-gomaae', name: 'ほうれん草のごま和え', price: 180, emoji: '🥬', allergens: [], recommended: false, placeholder: true },
    { id: 'side-minisoba', name: 'ミニそば', price: 300, emoji: '🍜', allergens: ['buckwheat', 'wheat'], recommended: false, placeholder: true },
    { id: 'side-dashimaki', name: 'ミニだし巻き卵', price: 200, emoji: '🍳', allergens: ['egg'], recommended: false, placeholder: true },
  ];

  /* ---------- おしぼり・お水（お問い合わせページから、0 円でかごに入れる） ---------- */
  const extras = {
    oshibori: { name: 'おしぼり', emoji: '🧻' },
    water: { name: 'お水', emoji: '💧' },
  };

  /* ---------- 商品 ---------- */
  // 定食でよく使うトッピングの組み合わせ
  const T_BASIC = ['top-onsen', 'top-negi', 'top-oroshi', 'top-nori', 'top-goma', 'top-natto'];
  const T_FRY = ['top-mayo', 'top-tartar', 'top-oroshi', 'top-negi', 'top-cheese', 'top-onsen'];
  const T_FISH = ['top-oroshi', 'top-mentai', 'top-negi', 'top-nori', 'top-sakuraebi', 'top-onsen'];
  const T_MEAT = ['top-onsen', 'top-cheese', 'top-negi', 'top-kimchi', 'top-mayo', 'top-walnutmiso', 'top-peanut'];

  function teishoku(id, name, price, emoji, allergens, toppingIds, standardSideIds, recommended) {
    return {
      id, name, price, emoji, category: 'teishoku', image: '', needsRice: true,
      toppingIds, standardSideIds, allergens, recommended: !!recommended, placeholder: true,
    };
  }

  function item(id, category, name, price, emoji, allergens, toppingIds, recommended) {
    return {
      id, name, price, emoji, category, image: '', needsRice: false,
      toppingIds: toppingIds || [], standardSideIds: [], allergens, recommended: !!recommended, placeholder: true,
    };
  }

  const products = [
    // 定食（米至上主義の主力。10 行以上 = 20 品以上）
    teishoku('tei-salmon', '鮭の塩焼き定食', 980, '🐟', [], T_FISH, ['side-miso', 'side-tsukemono', 'side-hijiki'], true),
    teishoku('tei-karaage', '鶏の唐揚げ定食', 950, '🍗', ['wheat'], T_FRY, ['side-miso', 'side-salad', 'side-tsukemono'], true),
    teishoku('tei-shogayaki', '豚の生姜焼き定食', 920, '🐖', ['wheat'], T_MEAT, ['side-miso', 'side-salad', 'side-tsukemono']),
    teishoku('tei-tonkatsu', 'ロースとんかつ定食', 1100, '🐷', ['egg', 'wheat'], T_FRY, ['side-tonjiru', 'side-salad', 'side-tsukemono']),
    teishoku('tei-sabamiso', 'さばの味噌煮定食', 950, '🐟', ['wheat'], T_FISH, ['side-miso', 'side-tsukemono', 'side-kinpira']),
    teishoku('tei-hamburg', '和風ハンバーグ定食', 1050, '🍖', ['egg', 'milk', 'wheat'], T_MEAT, ['side-miso', 'side-salad', 'side-potesala'], true),
    teishoku('tei-ebifry', '海老フライ定食', 1250, '🍤', ['shrimp', 'egg', 'wheat'], T_FRY, ['side-miso', 'side-salad', 'side-tsukemono']),
    teishoku('tei-dashimaki', 'だし巻き卵定食', 850, '🍳', ['egg'], T_BASIC, ['side-miso', 'side-tsukemono', 'side-hiyayakko']),
    teishoku('tei-mabo', '麻婆豆腐定食', 900, '🌶️', ['wheat'], T_MEAT, ['side-miso', 'side-gomaae', 'side-tsukemono']),
    teishoku('tei-nikujaga', '肉じゃが定食', 880, '🥔', ['wheat'], T_BASIC, ['side-miso', 'side-tsukemono', 'side-hijiki']),
    teishoku('tei-buri', 'ぶりの照り焼き定食', 1080, '🐟', ['wheat'], T_FISH, ['side-miso', 'side-tsukemono', 'side-gomaae']),
    teishoku('tei-karubi', '牛カルビ焼肉定食', 1280, '🥩', ['wheat'], T_MEAT, ['side-miso', 'side-salad', 'side-tsukemono'], true),
    teishoku('tei-nanban', 'チキン南蛮定食', 1050, '🐔', ['egg', 'wheat'], T_FRY, ['side-miso', 'side-salad', 'side-tsukemono']),
    teishoku('tei-kanicream', 'カニクリームコロッケ定食', 1150, '🦀', ['crab', 'milk', 'wheat', 'egg'], T_FRY, ['side-miso', 'side-salad', 'side-potesala']),
    teishoku('tei-tempura', '天ぷら定食', 1300, '🍤', ['shrimp', 'egg', 'wheat'], T_FISH, ['side-miso', 'side-tsukemono', 'side-chawanmushi']),
    teishoku('tei-hokke', 'ほっけの開き定食', 1000, '🐟', [], T_FISH, ['side-miso', 'side-tsukemono', 'side-hiyayakko']),
    teishoku('tei-kakuni', '豚の角煮定食', 1180, '🐖', ['wheat'], T_MEAT, ['side-miso', 'side-tsukemono', 'side-gomaae']),
    teishoku('tei-sashimi', '刺身盛り合わせ定食', 1480, '🍣', [], T_FISH, ['side-miso', 'side-tsukemono', 'side-chawanmushi'], true),
    teishoku('tei-yasai', '野菜炒め定食', 850, '🥬', ['wheat'], T_BASIC, ['side-miso', 'side-tsukemono', 'side-hiyayakko']),
    teishoku('tei-gyoza', '焼き餃子定食', 880, '🥟', ['wheat'], T_MEAT, ['side-miso', 'side-salad', 'side-tsukemono']),
    teishoku('tei-teriyaki', '鶏の照り焼き定食', 950, '🍗', ['wheat'], T_MEAT, ['side-miso', 'side-salad', 'side-kinpira']),
    teishoku('tei-healthy', '焼き魚と豆腐のヘルシー定食', 900, '🥗', [], T_BASIC, ['side-miso', 'side-hiyayakko', 'side-gomaae']),

    // 一品物
    item('ipp-edamame', 'ippin', '枝豆', 300, '🫛', []),
    item('ipp-yakitori', 'ippin', '焼き鳥盛り合わせ', 600, '🍢', ['wheat'], ['top-negi', 'top-goma'], true),
    item('ipp-agedashi', 'ippin', '揚げ出し豆腐', 450, '🧈', ['wheat'], ['top-oroshi', 'top-negi', 'top-tenkasu']),
    item('ipp-takowasa', 'ippin', 'たこわさ', 400, '🐙', []),
    item('ipp-dashimaki', 'ippin', '出汁巻き卵', 500, '🍳', ['egg'], ['top-oroshi', 'top-mentai', 'top-cheese']),
    item('ipp-karaage', 'ippin', '鶏の唐揚げ（単品）', 550, '🍗', ['wheat'], ['top-mayo', 'top-tartar', 'top-oroshi'], true),
    item('ipp-ebiten', 'ippin', '海老の天ぷら', 650, '🍤', ['shrimp', 'egg', 'wheat'], ['top-oroshi']),
    item('ipp-potato', 'ippin', 'ポテトフライ', 400, '🍟', [], ['top-mayo', 'top-cheese']),
    item('ipp-gyusuji', 'ippin', '牛すじ煮込み', 600, '🍲', ['wheat'], ['top-negi', 'top-onsen']),
    item('ipp-kanimiso', 'ippin', 'かに味噌の甲羅焼き', 800, '🦀', ['crab']),
    item('ipp-tomato', 'ippin', '冷やしトマト', 350, '🍅', []),

    // ドリンク
    item('drk-ryokucha', 'drink', '緑茶', 200, '🍵', []),
    item('drk-hojicha', 'drink', 'ほうじ茶', 200, '🍵', []),
    item('drk-oolong', 'drink', '烏龍茶', 250, '🥤', []),
    item('drk-amazake', 'drink', '米麹の甘酒', 350, '🍶', [], [], true),
    item('drk-orange', 'drink', 'オレンジジュース', 300, '🍊', []),
    item('drk-cola', 'drink', 'コーラ', 300, '🥤', []),
    item('drk-ginger', 'drink', 'ジンジャーエール', 300, '🫚', []),
    item('drk-milk', 'drink', '牛乳', 250, '🥛', ['milk']),
    item('drk-matchalatte', 'drink', '抹茶ラテ', 400, '🍵', ['milk']),
    item('drk-calpis', 'drink', '乳酸菌ドリンク', 300, '🥛', ['milk']),

    // デザート
    item('dst-ohagi', 'dessert', 'おはぎ', 300, '🍡', [], [], true),
    item('dst-mitarashi', 'dessert', 'みたらし団子', 300, '🍡', ['wheat']),
    item('dst-matchaice', 'dessert', '抹茶アイス', 350, '🍨', ['milk']),
    item('dst-rollcake', 'dessert', '米粉のロールケーキ', 400, '🍰', ['egg', 'milk'], [], true),
    item('dst-ricepudding', 'dessert', 'ライスプディング', 380, '🍮', ['milk']),
    item('dst-zenzai', 'dessert', '白玉ぜんざい', 400, '🫘', []),
    item('dst-kurumimochi', 'dessert', 'くるみ餅', 380, '🌰', ['walnut']),
    item('dst-peanutmochi', 'dessert', '落花生もち', 350, '🥜', ['peanut']),
    item('dst-pudding', 'dessert', '焼きプリン', 350, '🍮', ['egg', 'milk']),
    item('dst-sobaboro', 'dessert', 'そばぼうろ', 300, '🍪', ['buckwheat', 'wheat', 'egg']),
  ];

  return { config, allergens, categories, riceTypes, riceSizes, toppings, sides, extras, products };
})();
