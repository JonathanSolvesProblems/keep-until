// The food bank's own stock sheet. The coordinator connects once with Google; the app creates
// a "Keep Until stock" spreadsheet in their Drive and appends one row per logged item.
// Scope is drive.file: the app can open only files it created, nothing else in their Drive.
// Rows that cannot be sent yet (warehouse offline, sign-in timed out) wait in a local queue
// and go out with the next successful append, in order.

import { GoogleAuthProvider, linkWithPopup, signInWithPopup, type UserCredential } from "firebase/auth";
import { auth } from "./firebase";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const TAB = "Sort log";
const HEADER = [
  "Logged at", "Product", "Brand", "Chart row", "Date on package", "Date kind",
  "Decision", "Keep until", "Reason", "Chart page", "Read by", "Item id",
];

let token: { value: string; expires: number } | null = null;

function store(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem("keepuntil." + key, value);
    return localStorage.getItem("keepuntil." + key);
  } catch {
    return null;
  }
}

export function sheetUrl(): string | null {
  const id = store("sheetId");
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
}

function queue(): string[][] {
  try {
    return JSON.parse(store("sheetQueue") ?? "[]");
  } catch {
    return [];
  }
}

function setQueue(rows: string[][]): void {
  store("sheetQueue", JSON.stringify(rows));
}

export function pendingRows(): number {
  return queue().length;
}

async function sheets(path: string, init: RequestInit): Promise<Response> {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token!.value}`, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`Sheets ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

/** Signs the coordinator in with Google and creates the stock sheet the first time. */
export async function connectSheet(foodBankName: string): Promise<{ url: string; uid: string }> {
  const provider = new GoogleAuthProvider();
  provider.addScope(SCOPE);
  let result: UserCredential;
  const user = auth.currentUser;
  try {
    // Linking keeps the same user id, so items already logged this shift stay this user's.
    result = user?.isAnonymous ? await linkWithPopup(user, provider) : await signInWithPopup(auth, provider);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/credential-already-in-use") throw e;
    result = await signInWithPopup(auth, provider);
  }
  const cred = GoogleAuthProvider.credentialFromResult(result);
  if (!cred?.accessToken) throw new Error("Google did not return an access token");
  // Google access tokens last an hour; refresh a little early.
  token = { value: cred.accessToken, expires: Date.now() + 55 * 60 * 1000 };

  if (!store("sheetId")) {
    const created = await (
      await sheets("", {
        method: "POST",
        body: JSON.stringify({
          properties: { title: `Keep Until stock: ${foodBankName}` },
          sheets: [{ properties: { title: TAB, gridProperties: { frozenRowCount: 1 } } }],
        }),
      })
    ).json();
    store("sheetId", created.spreadsheetId);
    await sheets(`/${created.spreadsheetId}/values/${encodeURIComponent(`'${TAB}'!A1`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [HEADER] }),
    });
  }
  await flush();
  return { url: sheetUrl()!, uid: result.user.uid };
}

export function sheetConnected(): boolean {
  return Boolean(token && token.expires > Date.now() && store("sheetId"));
}

/** Queues a row and sends everything queued, oldest first. Returns rows still waiting. */
export async function appendRow(row: string[]): Promise<number> {
  setQueue([...queue(), row]);
  return flush();
}

export async function flush(): Promise<number> {
  const id = store("sheetId");
  const rows = queue();
  if (!rows.length || !id || !token || token.expires <= Date.now() || !navigator.onLine) return rows.length;
  try {
    await sheets(`/${id}/values/${encodeURIComponent(`'${TAB}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: rows }),
    });
    setQueue([]);
    return 0;
  } catch {
    return rows.length;
  }
}

if (typeof window !== "undefined") window.addEventListener("online", () => void flush());
