ALTER TABLE founders ADD COLUMN account_id TEXT REFERENCES accounts(id);
