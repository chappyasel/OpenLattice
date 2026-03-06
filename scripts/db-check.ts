import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

const sql = postgres(process.env.DATABASE_URL as string);
const tables = ["topics", "contributors", "submissions", "resources", "bounties", "activity", "edges"];

for (const t of tables) {
  const res = await sql.unsafe(`SELECT count(*) FROM ${t}`);
  console.log(`${t}: ${res[0].count}`);
}

await sql.end();
