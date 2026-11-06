const jwt = require("jsonwebtoken");
const { config } = require("../config");

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpires,
    algorithm: "HS256",
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
}

module.exports = { signAccessToken, verifyAccessToken };
