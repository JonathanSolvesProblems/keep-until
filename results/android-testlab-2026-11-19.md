# Android on real phones: Firebase Test Lab, 2026-11-19

The same 16 pantry photos as the web measurements, through `OnDevicePantryTest` on physical phones from the ML Kit Prompt API device list (Gemini Nano 4). Every line is in `android-testlab-2026-11-19.json`.

## What ran on-device: nothing, and why

On every phone the on-device check did not run. Firebase AI Logic's `checkStatus()` returned `UNAVAILABLE` for all three model categories (STABLE, PREVIEW, PREVIEW_FAST) within a few milliseconds, and the reason is in the AICore package the phones carry: a stub, not the real service.

| run | phone | Android | AICore package on the phone | STABLE / PREVIEW / PREVIEW_FAST |
|---|---|---|---|---|
| run 1, 2026-11-19 10:05 | Google Pixel 10 (frankel) | API 36 | not probed in run 1 | UNAVAILABLE (checkStatus, run 1 had no per-category probe) |
| run 2, 2026-11-19 10:09 | Google Pixel 10 (frankel) | API 36 | 0.stub.stub_aicore_20250905.00_RC00.803343729 (enabled true) | UNAVAILABLE / UNAVAILABLE / UNAVAILABLE |
| run 2, 2026-11-19 10:09 | Google Pixel 11 (cubs) | API 37 | 0.stub.stub_aicore_20260302.01_RC00.877448964 (enabled true) | UNAVAILABLE / UNAVAILABLE / UNAVAILABLE |
| run 2, 2026-11-19 10:09 | samsung SM-S942U1 (m1q) | API 36 | 0.stub.oem.aicore_stub_for_android_B_RC02.728786427 (enabled true) | UNAVAILABLE / UNAVAILABLE / UNAVAILABLE |

On a phone people buy, Google Play replaces that stub with the real AICore and downloads Gemini Nano; Test Lab's freshly wiped phones never get the update, so they cannot give on-device evidence. That needs a physical Nano phone in hand (Pixel 9 or later, Galaxy S25 or later, and the others on the ML Kit list). Jonathan's Galaxy S24 is not on the list.

## What did run: the whole Android loop, cloud path, on four real phones

| run | phone | photos handled as a careful volunteer would | cloud reads |
|---|---|---|---|
| run 1, 2026-11-19 10:05 | Pixel 10 | 14 of 15 | 16 for 16 photos |
| run 2, 2026-11-19 10:09 | Pixel 10 | 14 of 15 | 16 for 16 photos |
| run 2, 2026-11-19 10:09 | Pixel 11 | 14 of 15 | 16 for 16 photos |
| run 2, 2026-11-19 10:09 | SM-S942U1 | 14 of 15 | 16 for 16 photos |

The web app's cloud-only run on the same photos handled 14 of 15 (`pantry-2026-11-15-cloud-only.md`). Each phone's screen said what it does in that case: "Read in the cloud, this phone has no on-device model".

Per photo, run 2 on the Pixel 10:

| photo | expected | decided | route |
|---|---|---|---|
| 20261115_112242.jpg | unverified | turn_it | in_cloud: model asked to see the date |
| 20261115_112247.jpg | turn_it | turn_it | in_cloud: model asked to see the date |
| 20261115_112303.jpg | turn_it | turn_it | in_cloud: model asked to see the date |
| 20261115_112311.jpg | turn_it | turn_it | in_cloud: model asked to see the date |
| 20261115_112323.jpg | turn_it | turn_it | in_cloud: model asked to see the date |
| 20261115_112326.jpg | turn_it | turn_it | in_cloud: model asked to see the date |
| 20261115_112402.jpg | turn_it | turn_it | in_cloud: model asked to see the date |
| 20261115_112406.jpg | log | turn_it | in_cloud: model asked to see the date |
| 20261115_112410.jpg | turn_it | turn_it | in_cloud: model asked to see the date |
| 20261115_112419.jpg | turn_it | turn_it | in_cloud: model asked to see the date |
| 20261115_112421.jpg | turn_it | turn_it | in_cloud: model asked to see the date |
| 20261115_112427.jpg | log | KEEP (date 2027-02-14) | in_cloud: model chose log |
| 20261115_112441.jpg | set_aside | SET_ASIDE | in_cloud: model chose set_aside |
| 20261115_112446.jpg | set_aside | SET_ASIDE | in_cloud: model chose set_aside |
| 20261115_112452.jpg | set_aside | SET_ASIDE | in_cloud: model chose set_aside |
| 20261115_112458.jpg | set_aside | SET_ASIDE | in_cloud: model chose set_aside |

Scoring is the web grader's rule: a logged item counts only when its date matches the hand label; `unverified` photos are reported, not scored.
