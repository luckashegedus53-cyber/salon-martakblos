import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

const users = [
  { username: "admin", password: "admin123", name: "Administrador", role: "admin" },
  { username: "marta", password: "marta", name: "Marta", role: "user" },
  { username: "bia", password: "bia", name: "Bia", role: "user" },
  { username: "glei", password: "glei", name: "Glei", role: "user" },
  { username: "janaina", password: "janaina", name: "Janaina", role: "user" },
  { username: "maysa", password: "maysa", name: "Maysa", role: "user" },
  { username: "viviane", password: "viviane", name: "Viviane", role: "user" },
];

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    const openId = `local:${u.username}`;
    await conn.execute(
      `INSERT INTO users (openId, username, passwordHash, name, role, loginMethod, lastSignedIn)
       VALUES (?, ?, ?, ?, ?, 'local', NOW())
       ON DUPLICATE KEY UPDATE
         passwordHash = VALUES(passwordHash),
         name = VALUES(name),
         role = VALUES(role)`,
      [openId, u.username, hash, u.name, u.role]
    );
    console.log(`✓ ${u.username} (${u.role}) cadastrado`);
  }

  await conn.end();
  console.log("\nTodos os usuários foram cadastrados com sucesso!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
