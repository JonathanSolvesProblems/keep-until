# Keep Until

A sort-table app for food banks. A volunteer holds each donated item up to the camera.
On-device Gemini Nano reads the product and the date stamped on it, and Food Banks Canada's
shelf-life chart turns that into a keep-until date. The row then lands in the food bank's own
stock sheet. The cloud model reads what Nano cannot and checks logged stock against new Health
Canada recalls every day.

Built for #BuildHybridAI 2026 with Firebase AI Logic hybrid inference (on-device Gemini Nano
with cloud fallback), on Web (Chrome) and Android.

## Status

In development (started November 14, 2026). Working today: the Food Banks Canada chart gate and
the Canadian date-stamp parser (with tests), and a sort-table page that reads an item through
Firebase AI Logic, on-device in Chrome when Gemini Nano is available and in the cloud when it is
not. Every camera read is logged to Firestore (works offline, append-only), the food bank's
policy and the cloud model come from Remote Config, and every read is a Performance Monitoring
trace tagged on-device or cloud. Coming: the food bank's stock sheet, the recall watch, the
Android app, and a hosted URL.

## How to run it

You need Node.js 20 or newer and desktop Chrome 139 or newer.

```bash
git clone https://github.com/JonathanSolvesProblems/keep-until.git
cd keep-until
npm --prefix web install
npm --prefix web test
cp web/.env.example web/.env.local
npm --prefix web run dev
```

Then open http://localhost:5173 in Chrome, click **Start shift**, and hold an item up to the
camera, or choose saved photos and click **Run batch**.

The tests need nothing else. Reading items needs a Firebase project of your own, filled into
`web/.env.local`:

1. Create a Firebase project and register a web app; copy its config into `web/.env.local`.
2. Run `npx firebase-tools init ailogic` in the repo root to provision Firebase AI Logic
   (Gemini Developer API).
3. Create a reCAPTCHA Enterprise key for `localhost`, register it for the web app under App Check,
   and register a debug token for local use (Firebase AI Logic requires App Check).

To run on-device, turn these on in `chrome://flags` and relaunch Chrome: **Gemma 4 for Built-in
AI**, **Prompt API for Gemini Nano**, and **Prompt API for Gemini Nano with Multimodal Input**.
Without them the app still works and says so: every read is marked CLOUD.

## Sources

Every number the app uses or this page states is traced in [devpost/sources.md](devpost/sources.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
