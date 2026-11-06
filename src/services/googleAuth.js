const { OAuth2Client } = require("google-auth-library");
const { config } = require("../config");
const { HttpError } = require("../utils/httpError");

const client = new OAuth2Client(config.googleClientId || undefined);

/**
 * Google ID tokenni (credential) tekshiradi va foydalanuvchi ma'lumotlarini qaytaradi
 * @param {string} token
 * @returns {Promise<{googleId: string, email: string, name: string, picture: string, emailVerified: boolean}>}
 */
async function verifyGoogleToken(token) {
  if (!token || typeof token !== "string") {
    throw new HttpError(400, "Google tokeni (credential yoki idToken) kiritilmagan");
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token.trim(),
      audience: config.googleClientId || undefined,
    });
    const payload = ticket.getPayload();

    if (!payload) {
      throw new HttpError(401, "Google token ma'lumotlarini o'qib bo'lmadi");
    }

    if (!payload.email) {
      throw new HttpError(400, "Google hisobida email manzili topilmadi");
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase().trim(),
      name: payload.name || "",
      picture: payload.picture || "",
      emailVerified: Boolean(payload.email_verified),
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, "Google tokeni yaroqsiz yoki muddati o'tgan: " + (err.message || "Tekshiruv xatosi"));
  }
}

module.exports = {
  client,
  verifyGoogleToken,
};
