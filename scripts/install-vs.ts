import { exec } from "node:child_process";

const command = `winget install --id Microsoft.VisualStudio.2022.Community --exact --force --custom "--add Microsoft.VisualStudio.Component.Windows11SDK.22621 --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.VC.Tools.ARM64"`;

const proc = exec(command, () => {
  process.exit(0); // Ignore installer error for now
});

proc.stdout?.pipe(process.stdout);
proc.stderr?.pipe(process.stderr);
