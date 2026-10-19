import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export function usePwa() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null),
    [installed, setInstalled] = useState(
      () =>
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    );
  const sw = useRegisterSW({ immediate: true });
  useEffect(() => {
    const before = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function install(): Promise<boolean> {
    if (!prompt) return false;
    await prompt.prompt();
    const result = await prompt.userChoice;
    setPrompt(null);
    return result.outcome === "accepted";
  }
  return { ...sw, installed, canInstall: Boolean(prompt), install };
}
