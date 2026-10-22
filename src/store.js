// 資料儲存：Cloudflare D1（SQLite）。每個聊天室（群組、多人聊天或一對一）各自一本帳，以 chatId 區分。
// 資料表定義在 migrations/0001_init.sql。

export class Store {
  /** @param {D1Database} db D1 資料庫，或 test/d1-shim.js 的本機替身 */
  constructor(db) {
    this.db = db;
  }

  async members(chatId) {
    const { results } = await this.db
      .prepare('SELECT name FROM members WHERE chat_id = ? ORDER BY rowid')
      .bind(chatId)
      .all();
    return results.map((r) => r.name);
  }

  /** 新增成員，回傳實際新加入（原本不存在）的名字。 */
  async addMembers(chatId, names) {
    const existing = new Set(await this.members(chatId));
    const added = [...new Set(names)].filter((n) => !existing.has(n));
    if (added.length) {
      const stmt = this.db.prepare('INSERT OR IGNORE INTO members (chat_id, name) VALUES (?, ?)');
      await this.db.batch(added.map((n) => stmt.bind(chatId, n)));
    }
    return added;
  }

  async removeMember(chatId, name) {
    const r = await this.db.prepare('DELETE FROM members WHERE chat_id = ? AND name = ?').bind(chatId, name).run();
    return r.meta.changes > 0;
  }

  async addExpense(chatId, { payer, amount, note, shares, createdBy }) {
    // 用子查詢取下一個編號，一個語句完成，避免兩人同時記帳拿到同一號。
    const row = await this.db
      .prepare(
        `INSERT INTO expenses (chat_id, no, payer, amount, note, shares, created_by, created_at)
         SELECT ?1, COALESCE(MAX(no), 0) + 1, ?2, ?3, ?4, ?5, ?6, ?7 FROM expenses WHERE chat_id = ?1
         RETURNING no`,
      )
      .bind(chatId, payer, amount, note, JSON.stringify(shares), createdBy, new Date().toISOString())
      .first();
    return row.no;
  }

  async expenses(chatId) {
    const { results } = await this.db
      .prepare('SELECT no, payer, amount, note, shares, created_at FROM expenses WHERE chat_id = ? ORDER BY no')
      .bind(chatId)
      .all();
    return results.map((r) => ({ ...r, shares: JSON.parse(r.shares) }));
  }

  async deleteExpense(chatId, no) {
    const r = await this.db.prepare('DELETE FROM expenses WHERE chat_id = ? AND no = ?').bind(chatId, no).run();
    return r.meta.changes > 0;
  }

  /** 清空這個聊天室的帳目（成員保留）。 */
  async clearExpenses(chatId) {
    const r = await this.db.prepare('DELETE FROM expenses WHERE chat_id = ?').bind(chatId).run();
    return r.meta.changes;
  }
}
