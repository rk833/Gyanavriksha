# Gyanavriksha — Mobile app (Expo)

Student-facing React Native app built with **Expo SDK 54**. It talks to the **FastAPI backend** (`backend/`) for auth, assignments, AI tutor, IoT, and submissions.

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** (bundled with Node)
- **Expo Go** on a physical device ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779)), *or* Android Studio / Xcode for emulators and dev builds
- A running **backend** API (see repo root `README.md` or Docker Compose)

## Install

From this folder (`frontend-mobile/`):

```bash
cd frontend-mobile
npm install
```

## Configure API URL

The app reads **`EXPO_PUBLIC_API_BASE_URL`** from a **`.env`** file in `frontend-mobile/` (optional). If it is unset, Expo may infer `http://<dev-machine-ip>:8000` while using Expo Go on the same network, or fall back to `http://localhost:8000`.

Create `frontend-mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000
```

Use a URL your **phone or emulator** can reach:

| Where you run the app | Typical base URL |
|------------------------|------------------|
| Android emulator (backend on same PC) | `http://10.0.2.2:8000` |
| iOS simulator (backend on same Mac) | `http://localhost:8000` |
| Physical device + Expo Go (backend on PC) | `http://<your-LAN-IP>:8000` (same Wi‑Fi) |

Do not add a trailing slash. Restart the dev server after changing `.env`.

## Biometric sign-in (Face ID / Fingerprint)

1. Sign in with **email and password** (and 2FA if required).
2. Open **Profile → Security & device** and turn on **quick sign-in**.
3. Confirm with your device biometric or passcode when prompted.

On the sign-in screen, use **Sign in with Face ID / Touch ID** (label varies by device) to unlock a **saved session**; your password is not stored on the device. When the session fully expires, sign in with email again.

For custom native builds, run `npx expo prebuild` so the `expo-local-authentication` config (e.g. Face ID usage text on iOS) is applied.

## Run

Start the Metro bundler and QR menu:

```bash
npm start
```

### Run on a physical Android device (recommended for microphone features)

For native modules like speech recognition / microphone input, use a **development build** (not Expo Go):

```bash
# from frontend-mobile/
npx expo run:android --device
```

If your phone is connected over USB and the app cannot reach Metro, set your machine LAN IP before running:

```bash
# Git Bash
export REACT_NATIVE_PACKAGER_HOSTNAME=192.168.110.123
npx expo run:android --device
```

```powershell
# PowerShell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.110.123"
npx expo run:android --device
```

> Replace `192.168.110.123` with your computer's current LAN IP.
> Keep `.env` aligned with the same host for API calls:
>
> `EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:8000`

Useful variants:

```bash
npx expo start --clear
```

Platform shortcuts (with Metro already running, or in a new terminal from `frontend-mobile/`):

```bash
npm run android
npm run ios
npm run web
```

- **Expo Go**: Scan the QR code from the terminal or Dev Tools (USB debugging on Android; Camera app on iOS).
- **Native run** (`expo run:android` / `expo run:ios`): Requires local Android/iOS toolchain and generates a dev build.

### Microphone / speech input note

- **Works in development build** (`npx expo run:android --device`)
- **Not available in Expo Go** for this project, because it uses native speech plugins not bundled in the store client.

## Project scripts

| Command | Description |
|--------|-------------|
| `npm start` | `expo start` — dev server and QR |
| `npm run android` | `expo run:android` |
| `npm run ios` | `expo run:ios` |
| `npm run web` | `expo start --web` |

## Troubleshooting

- **Cannot reach API / network errors**: Fix `EXPO_PUBLIC_API_BASE_URL`; avoid `localhost` on a real phone unless you use a tunnel or the correct host IP.
- **Stale bundle**: `npx expo start --clear`.
- **401 / login loops**: Ensure backend is up, CORS is not blocking your origin for web, and device clock is correct.

### Android `expo run:android` on Windows: “Filename longer than 260 characters” / `CMAKE_OBJECT_PATH_MAX`

CMake/Ninja places C++ outputs under paths like:

`...\android\app\.cxx\Debug\...\react-native-safe-area-context\node_modules\...`

Deep folders plus a long workspace path (e.g. `D:\Level 5 Sem 2\System Development Project\...\frontend-mobile`) often exceed Windows’ legacy **260 character** limit, so `:app:buildCMakeDebug` fails with `ninja: error: Stat(...): Filename longer than 260 characters`.

Pick **one** of these fixes (recommended order):

1. **Use a shorter project path (most reliable)**  
   Clone or copy **`frontend-mobile`** (or the whole repo) to something brief, then rebuild from there, for example:

   - `D:\gv\frontend-mobile`
   - `C:\work\gv-mobile`

   Then inside that folder:

   ```bash
   cd android && .\gradlew clean && cd ..
   npx expo run:android --device
   ```

2. **Enable Windows long paths (Windows 10+)**  
   Run **PowerShell as Administrator**:

   ```powershell
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
   ```

   Restart the PC, open a **new** terminal, and build again.

3. **Map a drive letter for a shorter path**  
   In `cmd`:

   ```bat
   subst G: "D:\Level 5 Sem 2\System Development Project\Gyanavriksha\frontend-mobile"
   ```

   Run `cd /d G:\` and execute `npx expo run:android --device` from `G:`.

The `[CXX5304] SDK XML versions` CMake lines are a separate toolchain mismatch warning and are not the crash; the decisive error is **`Filename longer than 260 characters`** / object path warnings.

For full-stack setup (Postgres, Redis, MQTT, AI service), use the **repository root** `README.md` and Docker Compose.
