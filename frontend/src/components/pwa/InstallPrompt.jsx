import { useEffect, useMemo, useState } from "react";

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone;
}

function isIOS() {
  const ua = window.navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    const d = localStorage.getItem("pwa_install_dismissed");
    if (d === "1") setDismissed(true);
  }, []);

  useEffect(() => {
    function onBIP(e) {
      e.preventDefault();
      setDeferred(e);
    }
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const canShow = useMemo(() => {
    if (dismissed) return false;
    if (typeof window === "undefined") return false;
    if (isStandalone()) return false;
    if (deferred) return true;
    if (isIOS()) return true;
    return false;
  }, [dismissed, deferred]);

  if (!canShow) return null;

  const onDismiss = () => {
    localStorage.setItem("pwa_install_dismissed", "1");
    setDismissed(true);
  };

  const onInstall = async () => {
    if (deferred) {
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
        // ignore
      }
      setDeferred(null);
      return;
    }
    // iOS: show instructions
    setIosHelp(true);
  };

  return (
    <div className="install-banner" role="dialog" aria-label="Install ForkItt">
      <div className="install-banner__inner">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <img src="/forkit-logo.svg" alt="" style={{ width: 22, height: 22 }} />
          <div>
            <div style={{ fontWeight: 800, lineHeight: 1.1 }}>Save ForkItt</div>
            <div style={{ fontSize: 12, color: "var(--text-light)", lineHeight: 1.2 }}>
              Add to your home screen for a faster checkout.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-primary btn-sm" type="button" onClick={onInstall}>
            Add
          </button>
          <button className="btn btn-outline btn-sm" type="button" onClick={onDismiss}>
            Not now
          </button>
        </div>
      </div>

      {iosHelp && (
        <div className="install-banner__ios">
          <p style={{ margin: 0 }}>
            On iPhone: tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

