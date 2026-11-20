CREATE TABLE garden_friends (
  id TEXT PRIMARY KEY NOT NULL,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0,
  CHECK(sender <> recipient)
);
--> statement-breakpoint
CREATE UNIQUE INDEX garden_friends_pair ON garden_friends(min(sender, recipient), max(sender, recipient));
--> statement-breakpoint
CREATE INDEX garden_friends_sender ON garden_friends(sender);
--> statement-breakpoint
CREATE INDEX garden_friends_recipient ON garden_friends(recipient);
