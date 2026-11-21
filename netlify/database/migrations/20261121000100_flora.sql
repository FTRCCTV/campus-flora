CREATE TABLE flora_documents (
  key text PRIMARY KEY,
  value text NOT NULL,
  version text NOT NULL
);
CREATE TABLE garden_friends (
  rowid bigint GENERATED ALWAYS AS IDENTITY,
  id text PRIMARY KEY,
  sender text NOT NULL,
  recipient text NOT NULL,
  sender_name text NOT NULL,
  recipient_name text NOT NULL,
  accepted integer NOT NULL DEFAULT 0,
  CHECK (sender <> recipient)
);
CREATE UNIQUE INDEX garden_friends_pair ON garden_friends (least(sender,recipient), greatest(sender,recipient));
CREATE INDEX garden_friends_sender ON garden_friends(sender);
CREATE INDEX garden_friends_recipient ON garden_friends(recipient);
CREATE TABLE flora_upload_parts (
  owner text NOT NULL,
  part integer NOT NULL CHECK(part BETWEEN 0 AND 7),
  transfer uuid NOT NULL,
  content bytea NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(owner,part)
);
CREATE INDEX flora_upload_expiry ON flora_upload_parts(expires_at);
