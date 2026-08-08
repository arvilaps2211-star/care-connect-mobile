#!/usr/bin/env node
/**
 * Cross-platform Capacitor helper for the two CareConnect apps.
 *
 * Capacitor 5 CLI has NO `--config` flag, so we swap capacitor.config.ts
 * from the variant file, then add/sync/open the native project.
 *
 *   node scripts/cap.mjs user            build + sync
 *   node scripts/cap.mjs user open       build + sync + open Android Studio
 *   node scripts/cap.mjs ambulance open
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const variant = (process.argv[2] || "user").toLowerCase();
const shouldOpen = process.argv.includes("open");
if (!["user", "ambulance"].includes(variant)) {
  console.error("Usage: node scripts/cap.mjs <user|ambulance> [open]");
  process.exit(1);
}

const root = process.cwd();
const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root, shell: true });
};

// 1. Activate the variant config as the single capacitor.config.ts
const variantConfig = path.join(root, `capacitor.${variant}.config.ts`);
if (!fs.existsSync(variantConfig)) {
  console.error(`Missing ${variantConfig}`);
  process.exit(1);
}
fs.copyFileSync(variantConfig, path.join(root, "capacitor.config.ts"));
console.log(`Activated capacitor.${variant}.config.ts`);

// Native project path is declared in the variant config (android.path)
const nativeDir = path.join(root, "native", `android-${variant}`);

// 2. Add the Android platform if missing
if (!fs.existsSync(path.join(nativeDir, "app"))) {
  fs.mkdirSync(path.dirname(nativeDir), { recursive: true });
  run("npx cap add android");
}

// 3. Sync web build + plugins
run("npx cap sync android");

// 4. Copy shared + variant-specific native files over the generated project
const copyDir = (src, dest) => {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
};

const mainDir = path.join(nativeDir, "app", "src", "main");
copyDir(path.join(root, "android-native-files", "res"), path.join(mainDir, "res"));
copyDir(path.join(root, `android-${variant}`, "app", "src", "main"), mainDir);
console.log("Copied native res/manifest/java overrides");

// 5. Force Java 17 + SDK 34 in app/build.gradle
const gradleFile = path.join(nativeDir, "app", "build.gradle");
if (fs.existsSync(gradleFile)) {
  let gradle = fs.readFileSync(gradleFile, "utf8");
  gradle = gradle
    .replace(/compileSdk\s+\w+/, "compileSdk 34")
    .replace(/targetSdkVersion\s+[\w.]+/, "targetSdkVersion 34")
    .replace(/JavaVersion\.VERSION_\d+/g, "JavaVersion.VERSION_17");
  fs.writeFileSync(gradleFile, gradle);
  console.log("Patched build.gradle (SDK 34 / Java 17)");
}

if (shouldOpen) run("npx cap open android");

console.log(`\n✅ ${variant} app ready at native/android-${variant}`);
