// 卡片：機器人回覆的共用格式。LINE 上畫成 Flex Message，模擬器與通知預覽用純文字。
//
// card = {
//   title, subtitle?, accent?,          // 標題列與顏色
//   sections: [{ heading?, text?, rows?: [{ left, sub?, right?, tone?: 'pos' | 'neg', bold? }] }],
//   footer?,
// }

const ACCENT = '#06C755';
const TONE = { pos: '#1DB446', neg: '#E0434C' };

/** 回覆物件：text 給模擬器與通知預覽，card 給 LINE 畫成卡片。 */
export function cardReply(card) {
  return { text: cardToText(card), card };
}

export function cardToText(card) {
  const lines = [card.title];
  if (card.subtitle) lines.push(card.subtitle);
  for (const s of card.sections) {
    lines.push('');
    if (s.heading) lines.push(`【${s.heading}】`);
    if (s.text) lines.push(s.text);
    for (const r of s.rows ?? []) {
      lines.push(r.right != null ? `${r.left}　${r.right}` : r.left);
      if (r.sub) lines.push(`　${r.sub}`);
    }
  }
  if (card.footer) lines.push('', card.footer);
  return lines.join('\n');
}

const text = (t, props = {}) => ({ type: 'text', text: String(t) || ' ', wrap: true, ...props });

function row(r) {
  const left = r.sub
    ? {
        type: 'box',
        layout: 'vertical',
        flex: 5,
        contents: [
          text(r.left, { size: 'sm', color: '#111111', weight: r.bold ? 'bold' : 'regular' }),
          text(r.sub, { size: 'xs', color: '#8C8C8C' }),
        ],
      }
    : text(r.left, { size: 'sm', color: '#111111', flex: 5, weight: r.bold ? 'bold' : 'regular' });
  if (r.right == null) return left;
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'md',
    contents: [
      left,
      text(r.right, {
        size: 'sm',
        flex: 3,
        align: 'end',
        gravity: r.sub ? 'top' : 'center',
        weight: 'bold',
        color: TONE[r.tone] ?? '#111111',
      }),
    ],
  };
}

/** 卡片 → LINE Flex Message 的 bubble。 */
export function toFlex(card) {
  const header = [text(card.title, { weight: 'bold', size: 'lg', color: '#FFFFFF' })];
  if (card.subtitle) header.push(text(card.subtitle, { size: 'xs', color: '#FFFFFFCC' }));

  const body = [];
  card.sections.forEach((s, i) => {
    if (i > 0) body.push({ type: 'separator', margin: 'lg' });
    const part = [];
    if (s.heading) part.push(text(s.heading, { size: 'xs', color: '#8C8C8C', weight: 'bold' }));
    if (s.text) part.push(text(s.text, { size: 'sm', color: '#111111' }));
    for (const r of s.rows ?? []) part.push(row(r));
    body.push({ type: 'box', layout: 'vertical', spacing: 'sm', margin: i > 0 ? 'lg' : 'none', contents: part });
  });
  if (card.footer) {
    body.push({ type: 'separator', margin: 'lg' });
    body.push(text(card.footer, { size: 'xxs', color: '#8C8C8C', margin: 'md' }));
  }

  const bubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: card.accent ?? ACCENT,
      paddingAll: 'lg',
      contents: header,
    },
  };
  // Flex 的 box 不能沒有內容，只有標題時就不放 body。
  if (body.length) bubble.body = { type: 'box', layout: 'vertical', paddingAll: 'lg', contents: body };
  return bubble;
}
