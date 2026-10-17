const { dictionary } = require("@zxcvbn-ts/language-common");

const COMMON_PASSWORDS = new Set(
  dictionary["passwords-common"]
    .filter((password) => Array.from(password).length >= 8)
    .map((password) => password.toLowerCase()),
);

function isCommonPassword(password) {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

module.exports = {
  COMMON_PASSWORD_COUNT: COMMON_PASSWORDS.size,
  isCommonPassword,
};
