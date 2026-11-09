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

**Por defecto se sube patch.** Solo se sube minor o major cuando el cambio lo amerita.

| Comando | Ejemplo | Cuándo |
|---|---|---|
| `npm run release:patch` | `2.8.0 → 2.8.1 → 2.8.2` | **Cambios pequeños**: correcciones, textos, estilos, botones o pantallas que se ven mal, ajustes a algo que ya existe. |
| `npm run release:minor` | `2.8.2 → 2.9.0` | **Cambio grande**: una función o pantalla nueva, un rol nuevo, un flujo nuevo. |
| `npm run release:major` | `2.9.0 → 3.0.0` | **Cambio mayor**: rediseño completo o algo incompatible (p. ej. exige un backend nuevo y la versión anterior deja de funcionar). |

En duda entre patch y minor → patch. Minor y major reinician los números de la
derecha (`2.8.2 → 2.9.0`, `2.9.3 → 3.0.0`).

**Toda subida a `develop` (staging) o `main` (producción) lleva versión nueva**,
aunque sea un cambio mínimo. No se publica nada sin subir versión.

Subir la versión (aunque sea patch) cambia el fingerprint, así que genera **build
nuevo + envío a App Store Connect / Play Console**, no update OTA. Los usuarios lo
reciben cuando se aprueba en la tienda.

## 3. Update OTA

Como toda subida lleva versión nueva, lo normal es **build + tienda**. El update OTA
sin cambiar versión solo se usa si se pide expresamente para una emergencia (ver
flujo D). Nunca llega a un build incompatible, porque la política `fingerprint`
separa los runtimes.

## 4. Ramas

- `develop` → lo que se prueba (canal **staging**).
- `main` → lo que está en tiendas (canal **production**).
- Cada versión publicada en tienda queda marcada con un tag `vX.Y.Z` en `main`.

## 5. Flujos (automáticos con EAS Workflows)

Los flujos viven en `.eas/workflows/` y corren solos en EAS al hacer push a GitHub.
Ambos calculan el fingerprint; con versión nueva siempre cambia y hacen build:

| Push a | Con versión nueva (lo normal) | Sin cambio de fingerprint (no debe pasar) |
|---|---|---|
| `develop` (`staging.yml`) | Build `staging` (iOS + Android) para testers | Update OTA al canal `staging` |
| `main` (`production.yml`) | Build `production` + envío a App Store Connect / Play Console | Update OTA al canal `production` |

### A. Publicar una versión (siempre así)
```bash
# en develop, con los cambios en commits y anotados en CHANGELOG.md bajo [Sin publicar]
git status                     # debe estar limpio (npm version lo exige)
npm run release:patch          # por defecto; release:minor / release:major solo si aplica (ver §2)
# mover las notas de [Sin publicar] a [X.Y.Z] - fecha en CHANGELOG.md
git add CHANGELOG.md && git commit --amend --no-edit
git tag -f vX.Y.Z
git push origin develop && git push origin vX.Y.Z     # build de staging
gh pr create --base main --head develop --title "Versión X.Y.Z"
gh pr merge <N> --merge --subject "Versión X.Y.Z (#N)"  # build de producción + envío
```
El envío deja el build en App Store Connect / TestFlight; mandarlo a revisión de
Apple sigue siendo un paso manual en App Store Connect.

### B. Con cada versión: textos para la tienda
Aunque el cambio sea mínimo, se preparan las **Novedades** de App Store y las notas
para el tester de TestFlight. Se escriben para el usuario, no con términos técnicos.

### C. Corrección urgente
Igual que el flujo A, con `release:patch`. Si no puede esperar la revisión de Apple,
ver el flujo D.

### D. Manual (si EAS Workflows falla, o un OTA pedido expresamente)
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
- Toda versión lleva sus Novedades para App Store, aunque el cambio sea mínimo.
- Todo lanzamiento a tienda lleva su entrada en `CHANGELOG.md`.
