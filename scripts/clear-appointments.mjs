import { createConnection } from "mysql2/promise";

const db = await createConnection(process.env.DATABASE_URL);

const [result] = await db.execute("DELETE FROM appointments");
console.log(`✅ Apagados ${result.affectedRows} agendamentos.`);

await db.end();
