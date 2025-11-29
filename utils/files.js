const fs = require("fs");
const path = require("path");

function ensureFiles() {
  const requiredFolders = ["./data"];
  const requiredFiles = ["./data/drops.json"];

  requiredFolders.forEach(folder => {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);
  });

  requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) fs.writeFileSync(file, "[]");
  });
}

module.exports = { ensureFiles };
