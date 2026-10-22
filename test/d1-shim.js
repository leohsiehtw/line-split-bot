// 用 Node.js 內建的 node:sqlite 模擬 D1 的 API，讓測試和本機模擬器不需要 Cloudflare。

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

export function createLocalD1(file = ':memory:') {
  const db = new DatabaseSync(file);
  const dir = new URL('../migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(f, dir), 'utf8'));
  }

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
