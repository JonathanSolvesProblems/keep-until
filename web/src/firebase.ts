import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAI, GoogleAIBackend } from "firebase/ai";
import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { fetchAndActivate, getRemoteConfig, getValue } from "firebase/remote-config";
import { getPerformance } from "firebase/performance";
import type { Policy } from "./chart/chart";

const env = import.meta.env;

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

// Firebase AI Logic requires App Check. Local development uses a registered debug token
// read from the gitignored .env.local; the hosted site uses reCAPTCHA Enterprise.
if (env.DEV && env.VITE_APPCHECK_DEBUG_TOKEN) {
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN;
}

export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY),
  isTokenAutoRefreshEnabled: true,
});

export const ai = getAI(app, { backend: new GoogleAIBackend() });
export const auth = getAuth(app);

// Warehouses have bad Wi-Fi. The persistent cache keeps every logged item on the laptop and
// syncs it when the connection comes back, so a sort never stops for the network.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const perf = getPerformance(app);

const remoteConfig = getRemoteConfig(app);
remoteConfig.settings.minimumFetchIntervalMillis = env.DEV ? 60_000 : 3_600_000;
// Must match remoteconfig.template.json, so the app behaves the same before the first fetch
// and when it has never been online.
remoteConfig.defaultConfig = {
  cloud_model: "gemini-3.5-flash-lite",
  chart_bound: "min",
  chart_overrides: "{}",
  food_bank_id: "demo",
  food_bank_name: "Demo food bank",
};

export interface Settings {
  cloudModel: string;
  policy: Policy;
  foodBankId: string;
  foodBankName: string;
  /** Where the values came from: "remote" after a successful fetch, "default" otherwise. */
  from: string;
}

export async function loadSettings(): Promise<Settings> {
  let from = "default";
  try {
    await fetchAndActivate(remoteConfig);
    from = getValue(remoteConfig, "cloud_model").getSource();
  } catch {
    // Offline or blocked: the defaults above apply, and the screen says so.
  }
  let overrides: Policy["overrides"] = {};
  try {
    overrides = JSON.parse(getValue(remoteConfig, "chart_overrides").asString() || "{}");
  } catch {
    overrides = {};
  }
  const bound = getValue(remoteConfig, "chart_bound").asString() === "max" ? "max" : "min";
  return {
    cloudModel: getValue(remoteConfig, "cloud_model").asString(),
    policy: { bound, overrides },
    foodBankId: getValue(remoteConfig, "food_bank_id").asString(),
    foodBankName: getValue(remoteConfig, "food_bank_name").asString(),
    from,
  };
}

export async function ensureSignedIn(): Promise<string> {
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser!.uid;
}
