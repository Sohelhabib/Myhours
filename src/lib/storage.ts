import type { AppState } from "./model.ts";
import { emptyState } from "./model.ts";

let connection: Promise<IDBDatabase> | null = null;
function database(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(
        new Error(
          "This browser cannot save records. Use a normal Safari or Chrome window.",
        ),
      );
      return;
    }
    const req = indexedDB.open("myhours-private-v1", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("records"))
        req.result.createObjectStore("records");
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => {
        req.result.close();
        connection = null;
      };
      resolve(req.result);
    };
    req.onerror = () => {
      connection = null;
      reject(
        new Error(
          "Your browser blocked saved records. Check its storage settings.",
        ),
      );
    };
    req.onblocked = () => {
      connection = null;
      reject(new Error("Close other MyHours tabs, then reload."));
    };
  });
  return connection;
}
export async function readState(): Promise<AppState> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readonly"),
      req = tx.objectStore("records").get("main");
    req.onsuccess = () => {
      const result = req.result;
      if (result && result.schemaVersion !== 1)
        reject(
          new Error(
            "These records use a newer version of MyHours. Update the app before continuing.",
          ),
        );
      else resolve(result || emptyState());
    };
    req.onerror = () =>
      reject(
        new Error("Your saved records could not be opened. Please reload."),
      );
  });
}
export async function writeState(
  state: AppState,
  expectedRevision: number,
): Promise<AppState> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite"),
      store = tx.objectStore("records");
    const req = store.get("main");
    let result: AppState;
    let conflict = false;
    req.onsuccess = () => {
      const revision = req.result?.revision || 0;
      if (revision !== expectedRevision) {
        conflict = true;
        tx.abort();
        return;
      }
      result = { ...state, revision: revision + 1 };
      store.put(result, "main");
    };
    tx.oncomplete = () => {
      try {
        localStorage.setItem(
          "myhours-updated",
          String(result.revision) + ":" + Date.now(),
        );
      } catch {
        /* Storage events are an optional cross-tab signal. */
      }
      resolve(result);
    };
    tx.onabort = () =>
      reject(
        new Error(
          conflict
            ? "Your records changed in another tab. We have refreshed them; please try again."
            : "This change could not be saved. Your previous records are safe.",
        ),
      );
    tx.onerror = () =>
      reject(
        new Error(
          "This device could not save the change. Free some storage or export a backup.",
        ),
      );
  });
}
