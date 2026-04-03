# BoAi Music

This repository now supports two different targets:

- `Web`: keep the current split architecture
  - frontend: `frontend/`
  - backend: `backend/`
- `App`: package frontend UI together with an in-app service layer
  - no external Express dependency inside the mobile package

## Current status

The project has already been refactored for the first step of the App route:

- frontend API calls are no longer hard-bound to the Express backend
- frontend can now switch between:
  - `web` runtime
  - `native` runtime
- the runtime switch happens in:
  - `frontend/src/services/musicApi.js`
- the native bridge contract is documented in:
  - `docs/APP_NATIVE_BRIDGE.md`

## Web target

Start backend:

```powershell
cd backend
npm install
npm run start
```

Start frontend:

```powershell
cd frontend
npm install
npm run dev
```

Build for web deployment:

```powershell
cd frontend
npm run build:web
```

## App target

Build frontend resources for app packaging:

```powershell
cd frontend
npm run build:app
```

The `app` build uses relative asset paths and is suitable as the UI layer for a mobile container.

Important:

- the mobile package must not depend on `http://localhost:3000`
- the App route now targets an in-app runtime service layer
- the runtime contract is described in:
  - `docs/APP_NATIVE_BRIDGE.md`
- the Android cloud build guide is in:
  - `docs/ANDROID_CLOUD_BUILD.md`

## Files you should know

- frontend runtime switch:
  - `frontend/src/services/musicApi.js`
- web adapter:
  - `frontend/src/services/adapters/webMusicApi.js`
- native adapter:
  - `frontend/src/services/adapters/nativeMusicApi.js`
- app runtime service:
  - `frontend/src/services/nativeAppService.js`
- runtime detection:
  - `frontend/src/services/runtime.js`
- Capacitor config:
  - `frontend/capacitor.config.json`
- Android shell:
  - `frontend/android/`
- player store:
  - `frontend/src/stores/player.js`
- web backend:
  - `backend/server.js`
  - `backend/lib/migu-service.js`

## Verified

Both frontend builds are passing:

```powershell
cd frontend
npm run build:web
npm run build:app
```
