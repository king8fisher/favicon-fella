# Favicon Fella

A CLI tool that generates all the favicon and app icon variants you need for modern web apps from a single source PNG image.

> [!TIP] This is a combination of a `bun` script and Swift CLI app that uses `sharp` for image processing.

> [!INFO] Why Swift? Well, it's a Swift 6+ learning project for me, and I wanted to explore building CLI tools with it. 

## Features

- Generates all standard favicon sizes (16x16, 32x32, 48x48)
- Creates `favicon.ico` with multiple bundled sizes
- Generates Apple Touch Icon (180x180)
- Creates Android Chrome icons (192x192, 512x512) for PWAs
- Smart background color detection for icons requiring solid backgrounds
- Generates `site.webmanifest` with proper icon declarations

## Prerequisites

- [Swift](https://swift.org/download/) 6.0+
- [Bun](https://bun.sh/) runtime
- [mise](https://mise.jdx.dev/) (optional, for task running)

## Setup

```bash
# Install dependencies
cd scripts
bun install

# Build the Swift app
cd ../app
swift build
```

Or with mise:

```bash
mise run setup
```

## Usage

1. Create an `img` folder inside the `app` directory
2. Place your source PNG image(s) in `app/img/`
3. Run the tool

```bash
cd app
swift run
```

Or with mise:

```bash
mise run run
```

### Output

For each source image (e.g., `my-icon.png`), a folder is created with the same name containing:

| File                               | Size     | Purpose                            |
| ---------------------------------- | -------- | ---------------------------------- |
| `favicon-16x16.png`                | 16x16    | Browser tabs                       |
| `favicon-32x32.png`                | 32x32    | Browser tabs (high DPI)            |
| `favicon-48x48.png`                | 48x48    | Windows site icons                 |
| `favicon.ico`                      | 16/32/48 | Legacy browser support             |
| `apple-touch-icon.png`             | 180x180  | iOS home screen (solid background) |
| `android-chrome-192x192.png`       | 192x192  | Android home screen (maskable)     |
| `android-chrome-512x512.png`       | 512x512  | PWA splash screen (maskable)       |
| `alpha-android-chrome-512x512.png` | 512x512  | PWA icon with transparency         |
| `site.webmanifest`                 | -        | PWA manifest file                  |

If a folder with the same name already exists, the tool creates `my-icon-0`, `my-icon-1`, etc.

## Background Color Detection

For icons requiring solid backgrounds (Apple Touch Icon, maskable Android icons), the tool:

1. Blurs the source image
2. Calculates the average color
3. Adjusts brightness based on luminance:
   - Dark images get a slightly lighter background
   - Light images get a slightly darker background

## HTML Integration

Add these to your HTML `<head>`:

```html
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

## Project Structure

```
favicon-fella/
├── app/
│   ├── Sources/FaviconFella/
│   │   └── FaviconFella.swift    # Main CLI application
│   ├── Package.swift
│   └── img/                       # Place source PNGs here
├── scripts/
│   ├── generate-icons.ts          # Image processing (Sharp)
│   └── package.json
└── mise.toml                      # Task runner config
```

## Hints

`winget` hint for faster downloads on Windows:

```bash
winget settings
```

Add to settings:

```json
"network": {
  "downloader": "wininet"
}
```

## TODO

- [ ] Accept app name via command line argument
- [ ] Accept theme/background colors via command line arguments
- [ ] Optional config file support (e.g., `favicon.config.json`)
- [ ] Compile Swift tool to a single executable for easier distribution
  - [ ] It's currently invoking `bun` script, so this might be hard to achieve.
- [ ] Turn this tool into a web service

## License

MIT