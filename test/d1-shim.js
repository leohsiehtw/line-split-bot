// 用 Node.js 內建的 node:sqlite 模擬 D1 的 API，讓測試和本機模擬器不需要 Cloudflare。

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function createLocalD1(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));

  const statement = (sql, params = []) => ({
    bind: (...args) => statement(sql, args),
    async all() {
      return { results: db.prepare(sql).all(...params) };
    },
    async first() {
      return db.prepare(sql).get(...params) ?? null;
    },
    async run() {
      const r = db.prepare(sql).run(...params);
      return { meta: { changes: Number(r.changes) } };
    },
  });

  return {
    prepare: (sql) => statement(sql),
    async batch(stmts) {
      return Promise.all(stmts.map((s) => s.run()));
    },
  };
}
