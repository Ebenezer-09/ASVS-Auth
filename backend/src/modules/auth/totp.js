const {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} = require("node:crypto");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;

function encodeBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(input) {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const character of input.toUpperCase().replace(/=+$/, "")) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Secret TOTP invalide.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotpSecret() {
  return encodeBase32(randomBytes(20));
}

function totpAt(secret, step) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function verifyTotp(secret, code, now = Date.now(), lastUsedStep = -1) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  const currentStep = Math.floor(now / 1000 / TOTP_STEP_SECONDS);
  if (currentStep <= Number(lastUsedStep)) return null;
  return timingSafeEqual(
    Buffer.from(totpAt(secret, currentStep)),
    Buffer.from(code),
  )
    ? currentStep
    : null;
}

function encryptSecret(secret, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64")).join(".");
}

function decryptSecret(encrypted, key) {
  const [iv, tag, ciphertext] = encrypted.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

module.exports = {
  TOTP_STEP_SECONDS,
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  totpAt,
  verifyTotp,
};
