// app/lib/db/seed-admin.ts
// Usage: npx tsx lib/db/seed-admin.ts --username admin --email admin@example.com --password securepass123
import { hashPassword } from "../auth/password";
import { createUser, setUserAdmin, getUserByEmail, getUserByUsername } from "./queries";
import { getDb } from "./connection";

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const username = get("--username");
  const email = get("--email");
  const password = get("--password");

  if (!username || !email || !password) {
    console.error("Usage: npx tsx lib/db/seed-admin.ts --username <u> --email <e> --password <p>");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  if (getUserByEmail(email)) {
    console.error(`Email ${email} already registered.`);
    process.exit(1);
  }

  if (getUserByUsername(username)) {
    console.error(`Username ${username} already taken.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const userId = createUser({
    username,
    email,
    password_hash: passwordHash,
    display_name: username,
    is_approved: 1,
  });

  setUserAdmin(userId, true);

  // Confirm
  const db = getDb();
  const user = db.prepare("SELECT id, username, email, is_admin, is_approved FROM users WHERE id = ?").get(userId);
  console.log("Admin user created:", user);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
