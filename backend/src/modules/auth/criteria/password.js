const { Buffer } = require("node:buffer");
const { isCommonPassword } = require("./common-passwords");

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 1024;

function validatePasswordLength(password) {
  const characterLength = Array.from(password).length;
  return characterLength >= MIN_PASSWORD_LENGTH;
}

function validatePasswordSize(password) {
  return Buffer.byteLength(password, "utf8") <= MAX_PASSWORD_BYTES;
}

function validatePasswordNotCommon(password) {
  return !isCommonPassword(password);
}

function validatePasswordNotContextual(password) {
  const normalized = password
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const blockedTerms = [
    "asvsauth",
    "asvs",
    "irisi",
    "projetsecurite",
    "securite",
    "security",
    "administrator",
    "admin",
    "root",
  ];
  return !blockedTerms.some((term) => normalized.includes(term));
}

function validateRegistrationPassword(password) {
  const errors = [];

  if (!validatePasswordLength(password)) {
    errors.push({
      criterion: "V6.2.1",
      message: "Le mot de passe doit contenir au moins 8 caractères.",
    });
  }
  if (!validatePasswordSize(password)) {
    errors.push({
      criterion: "V6.2.9",
      message: "Le mot de passe dépasse la taille maximale acceptée.",
    });
  }
  if (!validatePasswordNotCommon(password)) {
    errors.push({
      criterion: "V6.2.4",
      message: "Choisissez un mot de passe moins courant.",
    });
  }
  if (!validatePasswordNotContextual(password)) {
    errors.push({
      criterion: "V6.2.11",
      message: "Ce mot de passe contient un terme lié au contexte de l’application.",
    });
  }

  return errors;
}

module.exports = {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  validatePasswordLength,
  validatePasswordSize,
  validatePasswordNotCommon,
  validatePasswordNotContextual,
  validateRegistrationPassword,
};
