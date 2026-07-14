// Track C — Oʻahu (Waikīkī) Japanese UI-chrome coverage patch.
// Ready-to-merge into data/i18n-ja.js. Keys = exact rendered (entity-decoded,
// whitespace-normalized) English text the DOM-translation sweep looks up.
// No price/money strings, no proper nouns/brand names are translated here.
// Verified with `node --check`. Does NOT touch the English rendering.
window.I18N.ja=Object.assign(window.I18N.ja||{},{
  // --- Bottom nav tab labels ---
  "Beaches":"ビーチ",
  "Trails":"トレイル",
  "Family":"ファミリー",
  "Tours":"ツアー",
  "Town":"タウン",

  // --- Map shore-overlay pills (shore-l spans) ---
  "North":"北",
  "South":"南",
  "East":"東",
  "West":"西",

  // --- Region chips ---
  "Windward":"風上側（ウインドワード）",
  "Leeward":"風下側（リーワード）",

  // --- Filter / subtab labels (SUBTABS) ---
  "Wildlife":"生き物",
  "Scenic":"絶景",
  "Towns":"街・タウン",
  "Cultural":"文化・史跡",
  "Playgrounds":"遊び場",
  "Hazards":"危険・注意",
  "All":"すべて",
  "Swim":"遊泳",
  "Snorkel":"シュノーケル",
  "Walk":"散策",
  "Photo":"写真",
  "Tidepools":"潮だまり",
  "Oceanfront":"オーシャンフロント",
  "Surf":"サーフィン",
  "Hotels":"ホテル",
  "Budget":"お手頃",
  "Luxury":"ラグジュアリー",
  "Food":"フード",
  "Drinks":"ドリンク",
  "Coffee":"コーヒー",
  "Farmers":"ファーマーズ",
  "Crafts":"クラフト",
  "Gas":"ガソリン",
  "Grocery":"食料品",

  // --- Live-Now chip dynamic value words ---
  "Clear":"晴れ",
  "Dry":"乾燥",

  // --- Service-worker update toast (innerHTML, caught by MutationObserver sweep) ---
  "New version available":"新しいバージョンがあります",
  "Reload":"再読み込み"
});
