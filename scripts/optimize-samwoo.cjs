const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC = path.join(__dirname, "..", "public", "asset", "samwoo_original");
const DST = path.join(__dirname, "..", "public", "asset", "samwoo");

const exts = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source folder not found: ${SRC}`);
    process.exit(1);
  }

  fs.mkdirSync(DST, { recursive: true });

  for (const file of fs.readdirSync(DST)) {
    if (file.toLowerCase().endsWith(".webp")) {
      fs.unlinkSync(path.join(DST, file));
    }
  }

  const files = fs.readdirSync(SRC).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return exts.has(ext);
  });

  if (files.length === 0) {
    console.log("No image files found in samwoo_original.");
    return;
  }

  for (const file of files) {
    const inputPath = path.join(SRC, file);
    const outputName = path.parse(file).name + ".webp";
    const outputPath = path.join(DST, outputName);

    await sharp(inputPath)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(outputPath);

    console.log(`Converted: ${file} -> ${outputName}`);
  }

  console.log("Done optimizing samwoo images.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
