-- 植迹自托管 · SQLite 表结构
--
-- 严格对应 drizzle/0000_garden_friends.sql（Cloudflare D1 版）。自托管时由
-- deploy/node-storage.mjs 在启动时执行一次；全部是 IF NOT EXISTS，重复启动幂等。
--
-- 说明：
--   · 业务代码（server/friends.mjs）用 `?` 占位符 + `ON CONFLICT DO NOTHING`，
--     需要 SQLite 3.24+；Node 24 内置的 SQLite 远高于这个版本。
--   · 唯一约束用 min(sender,recipient) / max(sender,recipient) 表达式索引表达
--     「同一对好友不分谁先加谁」，Node 内置 SQLite 支持表达式索引（3.9+）。
--   · id 是 TEXT 主键，表仍是 rowid 表，friends.mjs 的 `ORDER BY rowid DESC` 可用。

CREATE TABLE IF NOT EXISTS garden_friends (
  id TEXT PRIMARY KEY NOT NULL,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0,
  CHECK(sender <> recipient)
);

CREATE UNIQUE INDEX IF NOT EXISTS garden_friends_pair ON garden_friends(min(sender, recipient), max(sender, recipient));
CREATE INDEX IF NOT EXISTS garden_friends_sender ON garden_friends(sender);
CREATE INDEX IF NOT EXISTS garden_friends_recipient ON garden_friends(recipient);
