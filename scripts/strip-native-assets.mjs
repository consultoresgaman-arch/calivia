// Los archivos descargables del sitio (el APK y el zip de iOS, servidos
// como estáticos desde public/) NUNCA deben viajar dentro del propio APK
// nativo. `npx cap sync android` copia dist/ (que incluye todo public/) tal
// cual a android/app/src/main/assets/public — sin este paso, cada build
// empaqueta la versión anterior del APK dentro de la nueva, haciendo que el
// tamaño crezca sin límite en cada release (bug real: pasó de ~46MB a
// ~73MB en solo 7 builds). Correr esto SIEMPRE después de `cap sync`.
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const STRIP = ['Calivia.apk', 'calivia-ios.zip'];
const dir = join('android', 'app', 'src', 'main', 'assets', 'public');

for (const name of STRIP) {
  const p = join(dir, name);
  if (existsSync(p)) {
    rmSync(p);
    console.log(`[strip-native-assets] Removed ${p} (web-only download, not app content).`);
  }
}
