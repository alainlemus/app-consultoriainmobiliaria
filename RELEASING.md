# Cómo se despliega la app

Guía única de versiones y despliegues. Punto de partida: **v2.2.1**.

## 1. Las tres "versiones" que existen (y quién las mueve)

| Qué | Dónde vive | Quién lo cambia |
|---|---|---|
| **Versión** (`2.2.1`) — la que ve el usuario en la tienda | `package.json` → la lee `app.config.ts` | Tú, **solo** con `npm run release:*` |
| **Número de build** (iOS `buildNumber` / Android `versionCode`) | Remoto en EAS (`appVersionSource: "remote"`) | EAS, solo (`autoIncrement` en `staging` y `production`) |
| **Runtime** (qué updates OTA acepta cada build) | Calculado (`runtimeVersion: fingerprint`) | Nadie — cambia solo cuando cambia algo nativo |

**Nunca** edites la versión a mano en `app.config.ts`, `eas.json` ni `package.json`.

## 2. Qué número subir (SemVer)

- **patch** `2.2.1 → 2.2.2` — correcciones de errores.
- **minor** `2.2.1 → 2.3.0` — funciones nuevas que no rompen nada.
- **major** `2.2.1 → 3.0.0` — cambios grandes / incompatibles (p. ej. requiere backend nuevo).

## 3. ¿Update OTA o build nuevo?

**Update OTA (sin reinstalar, sin tienda, SIN cambiar versión)** si solo cambió:
- Pantallas, lógica, textos, estilos, imágenes (`app/`, `src/`, `assets/`).

**Build nuevo (y versión nueva si va a tienda)** si cambió cualquier cosa nativa:
- Se agregó/actualizó una librería con código nativo (`npx expo install …`).
- `app.config.ts`: permisos, `infoPlist`, `plugins`, íconos, splash, bundle id.
- Se actualizó el SDK de Expo.

En duda → build. Con la política `fingerprint`, un update nunca llega a un
build incompatible, así que equivocarse hacia "build" no rompe nada.

## 4. Ramas

- `develop` → lo que se prueba (canal **staging**).
- `main` → lo que está en tiendas (canal **production**).
- Cada versión publicada en tienda queda marcada con un tag `vX.Y.Z` en `main`.

## 5. Flujos (automáticos con EAS Workflows)

Los flujos viven en `.eas/workflows/` y corren solos en EAS al hacer push a GitHub.
Ambos calculan el fingerprint y deciden entre **update OTA** o **build**:

| Push a | Nada nativo cambió | Cambió algo nativo o la versión |
|---|---|---|
| `develop` (`staging.yml`) | Update OTA al canal `staging` | Build `staging` (iOS + Android) para testers |
| `main` (`production.yml`) | Update OTA al canal `production` (iOS) | Build `production` iOS + envío a App Store Connect |

Los cambios que solo tocan `.md` no disparan nada.

### A. Día a día (testers)
```bash
git push origin develop        # EAS decide solo: update OTA o build nuevo
```

### B. Lanzamiento a App Store
```bash
git checkout main && git merge develop
npm run release:patch          # o release:minor / release:major → commit "chore(release): vX.Y.Z" + tag
# anotar los cambios en CHANGELOG.md (y amend al commit de release)
git push origin main --follow-tags     # la versión nueva cambia el fingerprint → build + envío a App Store
git checkout develop && git merge main && git push origin develop
```
El envío deja el build en App Store Connect / TestFlight; mandarlo a revisión de
Apple sigue siendo un paso manual en App Store Connect.

### C. Corrección urgente de JS en producción
Commit en `main` (sin subir versión) y `git push origin main` → update OTA.
Luego `git checkout develop && git merge main && git push origin develop`.

### D. Manual (si EAS Workflows falla o para probar algo puntual)
```bash
npm run update:staging -- --message "..."    # / update:production
npm run build:staging                         # / build:production
npm run submit:production
```

### Variables de entorno
Viven en EAS (ambientes `preview` = staging y `production`), no en `eas.json`:
`APP_ENV`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
Se consultan con `eas env:list preview` y se cambian con `eas env:set`.
Builds, updates y workflows leen los mismos valores, así el fingerprint siempre cuadra.

## 6. Reglas

- Si publicas a mano, usa los scripts `update:*`, no `eas update` directo: sin
  `--environment` se usaría tu `.env.local`, que apunta el API a tu Mac.
- Un update OTA **no** cambia la versión; se identifica por su mensaje.
- Todo lanzamiento a tienda lleva su entrada en `CHANGELOG.md`.
