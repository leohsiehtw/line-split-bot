// 金額一律以「分」（1/100 元）的整數儲存，避免浮點誤差。

const AMOUNT_RE = /^[$＄]?(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?元?$/;

/** 把「1,200」「$300」「45.5」「300元」轉成分；不合法回傳 null。 */
export function parseAmount(text) {
  const t = String(text).trim();
  if (!AMOUNT_RE.test(t)) return null;
  const num = t.replace(/[$＄,元]/g, '');
  const [whole, frac = ''] = num.split('.');
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** 分 → 顯示字串：整數元不顯示小數，否則顯示兩位小數，加千分位。 */
export function formatAmount(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const frac = abs % 100;
  return frac === 0 ? `${sign}${whole}` : `${sign}${whole}.${String(frac).padStart(2, '0')}`;
}
