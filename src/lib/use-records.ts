import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyState,
  reduceAction,
  type Action,
  type AppState,
} from "./model.ts";
import { readState, writeState } from "./storage.ts";
export function useRecords() {
  const [data, setData] = useState<AppState>(emptyState),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const current = useRef(data),
    saving = useRef(false);
  const accept = useCallback((next: AppState) => {
    current.current = next;
    setData(next);
  }, []);
  const refresh = useCallback(async () => {
    const next = await readState();
    accept(next);
    setError("");
  }, [accept]);
  useEffect(() => {
    let alive = true;
    readState()
      .then((next) => {
        if (alive) {
          accept(next);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [accept]);
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "myhours-updated" && !saving.current)
        void refresh().catch((e) => setError(e.message));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);
  const dispatch = useCallback(
    async (action: Action) => {
      if (saving.current)
        throw new Error(
          "A change is being saved. Please try again in a moment.",
        );
      if (error)
        throw new Error(
          "Saving is unavailable. Check the storage message or reload first.",
        );
      saving.current = true;
      try {
        const before = current.current;
        const next = reduceAction(before, action);
        const saved = await writeState(next, before.revision);
        accept(saved);
      } catch (e) {
        if (e instanceof Error && e.message.includes("another tab"))
          await refresh();
        throw e;
      } finally {
        saving.current = false;
      }
    },
    [accept, error, refresh],
  );
  return { data, loading, error, dispatch, refresh };
}
