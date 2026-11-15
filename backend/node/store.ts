import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS documents(kind TEXT NOT NULL,id TEXT NOT NULL,crew TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,id));`,
    );
  }
  get(kind: string, id: string): any {
    const row = this.db
      .prepare("SELECT payload FROM documents WHERE kind=? AND id=?")
      .get(kind, id);
    return row ? JSON.parse(row.payload as string) : null;
  }
  list(kind: string, crew?: string): any[] {
    const rows = crew
      ? this.db
          .prepare(
            "SELECT payload FROM documents WHERE kind=? AND crew=? ORDER BY id",
          )
          .all(kind, crew)
      : this.db
          .prepare("SELECT payload FROM documents WHERE kind=? ORDER BY id")
          .all(kind);
    return rows.map((r) => JSON.parse(r.payload as string));
  }
  put(kind: string, id: string, crew: string, value: unknown) {
    this.db
      .prepare(
        "INSERT INTO documents(kind,id,crew,payload) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET crew=excluded.crew,payload=excluded.payload",
      )
      .run(kind, id, crew, JSON.stringify(value));
    return value;
  }
  close() {
    this.db.close();
  }
}
