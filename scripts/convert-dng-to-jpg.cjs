const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC = path.join(__dirname, "..", "public", "asset", "samwoo_original");

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source folder not found: ${SRC}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SRC).filter((file) =>
    path.extname(file).toLowerCase() === ".dng"
  );

  if (files.length === 0) {
    console.log("No DNG files found.");
    return;
  }

  for (const file of files) {
    const inputPath = path.join(SRC, file);
    const outputName = path.parse(file).name + ".jpg";
    const outputPath = path.join(SRC, outputName);

    try {
      await sharp(inputPath)
        .rotate()
        .jpeg({ quality: 90 })
        .toFile(outputPath);

      console.log(`Converted: ${file} -> ${outputName}`);
    } catch (err) {
      console.error(`Failed: ${file}`);
      console.error(err.message);
    }
  }

  console.log("Done converting DNG to JPG.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});