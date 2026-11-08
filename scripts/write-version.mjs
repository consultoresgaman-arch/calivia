// Genera public/version.json a partir de android/app/build.gradle, para que el
// aviso de actualización siempre anuncie la misma versión que el APK publicado.
// Se ejecuta en cada build, también en Vercel.
import { readFileSync, writeFileSync } from 'node:fs';

const gradle = readFileSync('android/app/build.gradle', 'utf8');
const code = gradle.match(/versionCode\s+(\d+)/)?.[1];
const name = gradle.match(/versionName\s+"([^"]+)"/)?.[1];

if (!code || !name) {
  console.error('[write-version] No se encontró versionCode o versionName en android/app/build.gradle');
  process.exit(1);
}

const version = { versionCode: Number(code), versionName: name };
writeFileSync('public/version.json', `${JSON.stringify(version, null, 2)}\n`);
console.log(`[write-version] public/version.json -> ${name} (${code})`);
