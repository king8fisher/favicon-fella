import sharp from "sharp";
import { join } from "path";

interface IconConfig {
  name: string;
  size: number;
  needsSolidBackground: boolean;
}

const ICON_CONFIGS: IconConfig[] = [
  { name: "favicon-16x16.png", size: 16, needsSolidBackground: false },
  { name: "favicon-32x32.png", size: 32, needsSolidBackground: false },
  { name: "favicon-48x48.png", size: 48, needsSolidBackground: false },
  { name: "apple-touch-icon.png", size: 180, needsSolidBackground: true },
  { name: "android-chrome-192x192.png", size: 192, needsSolidBackground: true },
  { name: "android-chrome-512x512.png", size: 512, needsSolidBackground: true },
  { name: "alpha-android-chrome-512x512.png", size: 512, needsSolidBackground: false },
];

async function getAverageColor(
  imagePath: string
): Promise<{ r: number; g: number; b: number }> {
  // Resize to 1x1 with blur to get average color
  const { data, info } = await sharp(imagePath)
    .blur(50)
    .resize(1, 1)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    r: data[0],
    g: data[1],
    b: data[2],
  };
}

function getLuminance(r: number, g: number, b: number): number {
  // Relative luminance formula
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function adjustColorForBackground(
  r: number,
  g: number,
  b: number
): { r: number; g: number; b: number } {
  const luminance = getLuminance(r, g, b);
  const factor = luminance < 0.5 ? 1.3 : 0.7; // Lighten dark, darken light

  return {
    r: Math.min(255, Math.max(0, Math.round(r * factor))),
    g: Math.min(255, Math.max(0, Math.round(g * factor))),
    b: Math.min(255, Math.max(0, Math.round(b * factor))),
  };
}

async function hasTransparency(imagePath: string): Promise<boolean> {
  const metadata = await sharp(imagePath).metadata();
  return metadata.hasAlpha ?? false;
}

async function generateIcon(
  inputPath: string,
  outputDir: string,
  config: IconConfig,
  bgColor: { r: number; g: number; b: number }
): Promise<void> {
  const outputPath = join(outputDir, config.name);

  let pipeline = sharp(inputPath).resize(config.size, config.size, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  if (config.needsSolidBackground) {
    // Flatten with background color (removes transparency)
    pipeline = pipeline.flatten({
      background: bgColor,
    });
  }

  await pipeline.png().toFile(outputPath);
  console.log(`Generated: ${config.name}`);
}

async function generateFaviconIco(
  inputPath: string,
  outputDir: string
): Promise<void> {
  const sizes = [16, 32, 48];
  const outputPath = join(outputDir, "favicon.ico");

  // Generate PNG buffers for each size (PNG-embedded ICO is more compatible)
  // Ensure RGBA format - convert to raw RGBA then back to PNG to guarantee alpha channel
  const pngBuffers = await Promise.all(
    sizes.map(async (size) => {
      // First get raw RGBA data
      const { data, info } = await sharp(inputPath)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Then create PNG from raw RGBA - this guarantees RGBA output
      return sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4,
        },
      })
        .png()
        .toBuffer();
    })
  );

  // Build ICO file with embedded PNGs (modern format, better compatibility)
  const images: { size: number; buffer: Buffer }[] = sizes.map((size, i) => ({
    size,
    buffer: pngBuffers[i],
  }));

  // ICONDIR: 6 bytes
  // ICONDIRENTRY: 16 bytes each
  const headerSize = 6 + 16 * images.length;
  let dataOffset = headerSize;

  // Calculate total size
  let totalSize = headerSize;
  for (const img of images) {
    totalSize += img.buffer.length;
  }

  const ico = Buffer.alloc(totalSize);

  // ICONDIR header
  ico.writeUInt16LE(0, 0); // Reserved
  ico.writeUInt16LE(1, 2); // Type: 1 = ICO
  ico.writeUInt16LE(images.length, 4); // Number of images

  // ICONDIRENTRY for each image
  let entryOffset = 6;
  for (const img of images) {
    const size = img.size === 256 ? 0 : img.size;
    ico.writeUInt8(size, entryOffset); // Width
    ico.writeUInt8(size, entryOffset + 1); // Height
    ico.writeUInt8(0, entryOffset + 2); // Color palette
    ico.writeUInt8(0, entryOffset + 3); // Reserved
    ico.writeUInt16LE(1, entryOffset + 4); // Color planes
    ico.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    ico.writeUInt32LE(img.buffer.length, entryOffset + 8); // Size of image data
    ico.writeUInt32LE(dataOffset, entryOffset + 12); // Offset to image data

    entryOffset += 16;
    dataOffset += img.buffer.length;
  }

  // Image data (PNG buffers directly)
  let currentOffset = headerSize;
  for (const img of images) {
    img.buffer.copy(ico, currentOffset);
    currentOffset += img.buffer.length;
  }

  await Bun.write(outputPath, ico);
  console.log("Generated: favicon.ico");
}

async function createBmpFromRgba(
  rgba: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  // ICO uses BMP format without file header (DIB)
  // BITMAPINFOHEADER: 40 bytes
  const rowSize = width * 4; // BGRA, 4 bytes per pixel
  const pixelDataSize = rowSize * height;
  const maskRowSize = Math.ceil(width / 8);
  const maskPadding = (4 - (maskRowSize % 4)) % 4;
  const maskSize = (maskRowSize + maskPadding) * height;

  const headerSize = 40;
  const totalSize = headerSize + pixelDataSize + maskSize;
  const bmp = Buffer.alloc(totalSize);

  // BITMAPINFOHEADER
  bmp.writeUInt32LE(40, 0); // Header size
  bmp.writeInt32LE(width, 4); // Width
  bmp.writeInt32LE(height * 2, 8); // Height (doubled for ICO format with mask)
  bmp.writeUInt16LE(1, 12); // Planes
  bmp.writeUInt16LE(32, 14); // Bits per pixel
  bmp.writeUInt32LE(0, 16); // Compression (none)
  bmp.writeUInt32LE(pixelDataSize + maskSize, 20); // Image size
  bmp.writeInt32LE(0, 24); // X pixels per meter
  bmp.writeInt32LE(0, 28); // Y pixels per meter
  bmp.writeUInt32LE(0, 32); // Colors used
  bmp.writeUInt32LE(0, 36); // Important colors

  // Pixel data (BGRA, bottom-to-top)
  let pixelOffset = headerSize;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      bmp.writeUInt8(rgba[srcIdx + 2], pixelOffset); // B
      bmp.writeUInt8(rgba[srcIdx + 1], pixelOffset + 1); // G
      bmp.writeUInt8(rgba[srcIdx + 0], pixelOffset + 2); // R
      bmp.writeUInt8(rgba[srcIdx + 3], pixelOffset + 3); // A
      pixelOffset += 4;
    }
  }

  // AND mask (transparency mask, all zeros since we use 32-bit with alpha)
  // Just fill with zeros
  for (let i = pixelOffset; i < totalSize; i++) {
    bmp.writeUInt8(0, i);
  }

  return bmp;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: bun generate-icons.ts <input-image> <output-dir>");
    process.exit(1);
  }

  const [inputPath, outputDir] = args;

  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputDir}`);

  // Get average color for background
  const avgColor = await getAverageColor(inputPath);
  const bgColor = adjustColorForBackground(avgColor.r, avgColor.g, avgColor.b);
  console.log(
    `Average color: rgb(${avgColor.r}, ${avgColor.g}, ${avgColor.b})`
  );
  console.log(`Background color: rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`);

  // Generate all icon sizes
  for (const config of ICON_CONFIGS) {
    await generateIcon(inputPath, outputDir, config, bgColor);
  }

  // Generate favicon.ico
  await generateFaviconIco(inputPath, outputDir);

  console.log("Done!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});