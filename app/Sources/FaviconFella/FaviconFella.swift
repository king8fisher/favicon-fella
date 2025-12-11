import Foundation

// MARK: - Configuration

let DEFAULT_APP_NAME = "AppName"
let DEFAULT_THEME_COLOR = "#000000"
let DEFAULT_BACKGROUND_COLOR = "#000000"

// MARK: - Main

@main
struct FaviconFella {
    static func main() throws {
        let fileManager = FileManager.default

        // Get the app directory (where this executable lives or current working dir)
        let currentDir = fileManager.currentDirectoryPath
        let appDir = URL(fileURLWithPath: currentDir)

        // Define paths
        let imgDir = appDir.appendingPathComponent("img")
        let scriptsDir = appDir.deletingLastPathComponent().appendingPathComponent("scripts")
        let scriptPath = scriptsDir.appendingPathComponent("generate-icons.ts")

        print("Favicon Fella - Icon Generator")
        print("===============================")
        print("App directory: \(appDir.path)")
        print("Image source: \(imgDir.path)")
        print("Scripts: \(scriptsDir.path)")
        print("")

        // Check if img directory exists
        guard fileManager.fileExists(atPath: imgDir.path) else {
            print("Error: 'img' directory not found at \(imgDir.path)")
            print("Please create an 'img' folder and add PNG images to process.")
            return
        }

        // Find all PNG files in img directory
        let contents = try fileManager.contentsOfDirectory(
            at: imgDir,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )

        let pngFiles = contents.filter { $0.pathExtension.lowercased() == "png" }

        guard !pngFiles.isEmpty else {
            print("No PNG files found in \(imgDir.path)")
            return
        }

        print("Found \(pngFiles.count) PNG file(s) to process:")
        for file in pngFiles {
            print("  - \(file.lastPathComponent)")
        }
        print("")

        // Process each PNG file
        for pngFile in pngFiles {
            try processImage(
                pngFile,
                in: imgDir,
                scriptsDir: scriptsDir,
                scriptPath: scriptPath,
                fileManager: fileManager
            )
        }

        print("")
        print("All done!")
    }

    static func processImage(
        _ pngFile: URL,
        in imgDir: URL,
        scriptsDir: URL,
        scriptPath: URL,
        fileManager: FileManager
    ) throws {
        let baseName = pngFile.deletingPathExtension().lastPathComponent

        // Determine unique output folder name
        let outputDir = findUniqueFolder(baseName: baseName, in: imgDir, fileManager: fileManager)

        print("Processing: \(pngFile.lastPathComponent) -> \(outputDir.lastPathComponent)/")

        // Create output directory
        try fileManager.createDirectory(at: outputDir, withIntermediateDirectories: true)

        // Run the Bun script to generate icons
        let success = runBunScript(
            scriptPath: scriptPath,
            inputImage: pngFile,
            outputDir: outputDir,
            scriptsDir: scriptsDir
        )

        guard success else {
            print("  Error: Icon generation failed")
            return
        }

        // Generate site.webmanifest
        try generateWebManifest(in: outputDir)

        print("  Generated icons and site.webmanifest")
    }

    static func findUniqueFolder(baseName: String, in parentDir: URL, fileManager: FileManager)
        -> URL
    {
        var candidate = parentDir.appendingPathComponent(baseName)

        if !fileManager.fileExists(atPath: candidate.path) {
            return candidate
        }

        // Folder exists, find next available name with suffix
        var index = 0
        repeat {
            candidate = parentDir.appendingPathComponent("\(baseName)-\(index)")
            index += 1
        } while fileManager.fileExists(atPath: candidate.path)

        return candidate
    }

    static func findExecutable(_ name: String) -> URL? {
        let fileManager = FileManager.default

        // Case-insensitive PATH lookup (Windows uses "Path", Unix uses "PATH")
        let pathKey = ProcessInfo.processInfo.environment.keys.first { $0.uppercased() == "PATH" }
        guard let key = pathKey, let pathEnv = ProcessInfo.processInfo.environment[key] else {
            return nil
        }

        #if os(Windows)
            let separator: Character = ";"
            let extensions = ["", ".exe", ".cmd", ".bat"]
        #else
            let separator: Character = ":"
            let extensions = [""]
        #endif

        for dir in pathEnv.split(separator: separator) {
            for ext in extensions {
                let fullPath = URL(fileURLWithPath: String(dir)).appendingPathComponent(name + ext)
                if fileManager.fileExists(atPath: fullPath.path) {
                    return fullPath
                }
            }
        }
        return nil
    }

    static func runBunScript(
        scriptPath: URL,
        inputImage: URL,
        outputDir: URL,
        scriptsDir: URL
    ) -> Bool {
        guard let bunPath = findExecutable("bun") else {
            print("  Error: 'bun' not found in PATH")
            return false
        }

        let process = Process()
        process.executableURL = bunPath
        process.arguments = [
            scriptPath.path,
            inputImage.path,
            outputDir.path,
        ]
        process.currentDirectoryURL = scriptsDir

        // Capture output
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        do {
            try process.run()
            process.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            if let output = String(data: data, encoding: .utf8), !output.isEmpty {
                // Indent the output
                let indented = output.split(separator: "\n").map { "  \($0)" }.joined(
                    separator: "\n")
                print(indented)
            }

            return process.terminationStatus == 0
        } catch {
            print("  Failed to run bun: \(error)")
            return false
        }
    }

    static func generateWebManifest(in outputDir: URL) throws {
        let manifest = WebManifest(
            name: DEFAULT_APP_NAME,
            shortName: DEFAULT_APP_NAME,
            icons: [
                WebManifestIcon(
                    src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png",
                    purpose: "maskable"),
                WebManifestIcon(
                    src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png",
                    purpose: "maskable"),
                WebManifestIcon(
                    src: "/alpha-android-chrome-512x512.png", sizes: "512x512", type: "image/png",
                    purpose: "any"),
            ],
            themeColor: DEFAULT_THEME_COLOR,
            backgroundColor: DEFAULT_BACKGROUND_COLOR,
            display: "standalone"
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]

        let data = try encoder.encode(manifest)
        let manifestPath = outputDir.appendingPathComponent("site.webmanifest")
        try data.write(to: manifestPath)
    }
}

struct WebManifest: Codable {
    let name: String
    let shortName: String
    let icons: [WebManifestIcon]
    let themeColor: String
    let backgroundColor: String
    let display: String

    enum CodingKeys: String, CodingKey {
        case name
        case shortName = "short_name"
        case icons
        case themeColor = "theme_color"
        case backgroundColor = "background_color"
        case display
    }
}

struct WebManifestIcon: Codable {
    let src: String
    let sizes: String
    let type: String
    let purpose: String?
}
