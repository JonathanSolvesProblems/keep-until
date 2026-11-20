# Android on phones with no on-device model: emulator run, 2026-11-20

What a volunteer sees when the Android app runs on a phone that cannot run Gemini Nano: an old
phone at the app's minimum version, and a current one. Run on the Android Emulator (Windows,
WHPX), with the debug build of `android/` at the commit that adds this file.

Neither emulator has AICore installed (`pm list packages` shows no `com.google.android.aicore`),
so neither can run Gemini Nano. Google publishes no emulator image that can, so this run proves the
fallback, not on-device reading. On-device reading on Android still needs a supported phone
(Pixel 9 or newer, Galaxy S25 or newer).

| Phone | Android | Shift start line | Carton front | Carton top | Read time | Offline (airplane mode) |
|---|---|---|---|---|---|---|
| Pixel 7 profile, Google APIs + Play | 16 (API 36) | "Reading in the cloud: this phone has no on-device model." | Turn it | Keep until 14 FEB 2029 | 3.3 s, then 6.9 s for both reads | not run |
| Pixel profile, Google APIs | 8.0 (API 26, the app's minimum) | same | Turn it | Keep until 14 FEB 2029 | 2.9 s for both reads | shift still starts; a read says "No connection..." |

Both used the built-in sample photos (the same broth carton, front then top), which are never
written to a food bank's log.

## What the run found, and what changed

1. **The item name repeated the brand** ("Campbell's Campbell's Chicken Broth"). The web app had
   been fixed on 2026-11-19 to compare letters and digits only; the Android app still compared raw
   strings, so a curly apostrophe defeated it. `itemName` in `ui/Words.kt` now does the same as the
   web. After the fix, Android 8 shows "Campbell's CHICKEN BROTH".
2. **Offline, the phone gave the wrong advice.** In airplane mode a read failed with "That read did
   not go through. Hold the item steady and press Read item again." The SDK's error named no network,
   so the text match missed it. The app now asks the phone whether it has a connection
   (`ConnectivityManager`, with the `ACCESS_NETWORK_STATE` permission) and says: "No connection. This
   phone reads dates in the cloud, so reading waits for Wi-Fi. Items already read stay in this
   shift's list." Verified on the Android 8 emulator after the fix.

A first offline attempt that switched off Wi-Fi and mobile data was not offline: the emulator kept
its connection and the read went through in 1.5 s. Only airplane mode cut it, which `nc` to the
API host and `dumpsys connectivity` ("Active default network: none") confirmed.

Screenshots: `devpost/gallery/src/emu-*.png`.
