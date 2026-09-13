-- Private schema: the browser communicates only with /api/collection.
CREATE SCHEMA IF NOT EXISTS cyi;
REVOKE ALL ON SCHEMA cyi FROM PUBLIC;
CREATE TABLE IF NOT EXISTS cyi.bookmarks (
  session_key text NOT NULL CHECK (session_key ~ '^[a-f0-9]{64}$'),
  item_key text NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY (session_key, item_key)
);
CREATE TABLE IF NOT EXISTS cyi.reflections (
  session_key text PRIMARY KEY CHECK (session_key ~ '^[a-f0-9]{64}$'),
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 20000),
  updated_at bigint NOT NULL
);
REVOKE ALL ON ALL TABLES IN SCHEMA cyi FROM PUBLIC;
