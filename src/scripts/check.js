const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function checkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") checkDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      execSync(`node --check "${fullPath}"`, { stdio: "inherit" });
    }
  }
}

try {
  checkDir(path.join(__dirname, ".."));
  console.log("Barcha JS fayllar sintaksisi to'g'ri (OK).");
} catch (err) {
  process.exit(1);
}
