import bcrypt from "bcryptjs";

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12");

export async function hashPassword(password) {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
