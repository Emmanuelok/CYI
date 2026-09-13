"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronRight, CircleCheck, Globe2, Menu, Monitor, RefreshCw, Share, ShieldCheck, Smartphone, Sparkles, WifiOff, X } from "lucide-react";
import Link from "./navigation";
import { siteUrl } from "@/lib/site-metadata";

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Platform = "ios" | "android" | "mac" | "desktop";
type PWAState = {
  installed: boolean; canInstall: boolean; online: boolean; platform: Platform;
  offlineReady: boolean; cachedPages: number; serviceWorkerError: boolean;
  openInstall: () => void; install: () => Promise<void>;
};
const PWAContext = createContext<PWAState | null>(null);
const DISMISS_KEY = "cyi-install-dismissed-v1";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function usePWA() {
  const value = useContext(PWAContext);
  if (!value) throw new Error("InstallExperience requires PWAProvider");
  return value;
}

function devicePlatform(): Platform {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(agent)) return "android";
  if (/Macintosh/.test(agent)) return "mac";
  return "desktop";
}

export function PWAProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(true);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [canInstall, setCanInstall] = useState(false);
  const [offerVisible, setOfferVisible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [cachedPages, setCachedPages] = useState(0);
  const [serviceWorkerError, setServiceWorkerError] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateApplied, setUpdateApplied] = useState(false);
  const [updateHidden, setUpdateHidden] = useState(false);
  const [applying, setApplying] = useState(false);
  const [installMessage, setInstallMessage] = useState("");
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const deferredPrompt = useRef<InstallEvent | null>(null);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const cacheTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const fullscreen = window.matchMedia("(display-mode: fullscreen)");
    const minimal = window.matchMedia("(display-mode: minimal-ui)");
    const isInstalled = () => standalone.matches || fullscreen.matches || minimal.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone;
    const syncInstalled = () => { setInstalled(isInstalled()); if (isInstalled()) setOfferVisible(false); };
    const platform = devicePlatform();
    // Read browser capabilities after the first paint; server markup stays hydration-safe.
    const capabilityFrame = window.requestAnimationFrame(() => {
      setPlatform(platform);
      setInAppBrowser(/FBAN|FBAV|Instagram|Line\/|; wv\)/i.test(navigator.userAgent));
      syncInstalled();
      setOnline(navigator.onLine);
      if (!window.isSecureContext || !("serviceWorker" in navigator)) setServiceWorkerError(true);
    });
    const onOnline = () => { setOnline(true); registration.current?.update().catch(() => {}); };
    const onOffline = () => setOnline(false);
    const beforeInstall = (event: Event) => { event.preventDefault(); deferredPrompt.current = event as InstallEvent; setCanInstall(true); };
    const appInstalled = () => { setInstalled(true); setOfferVisible(false); setCanInstall(false); deferredPrompt.current = null; setGuideOpen(false); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    [standalone, fullscreen, minimal].forEach(query => query.addEventListener("change", syncInstalled));
    const timer = window.setTimeout(() => {
      let dismissed = false;
      try { dismissed = Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < WEEK; } catch { /* Browser storage may be restricted. */ }
      if (!dismissed && !isInstalled() && (platform === "ios" || deferredPrompt.current)) setOfferVisible(true);
    }, 14000);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(capabilityFrame);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
      [standalone, fullscreen, minimal].forEach(query => query.removeEventListener("change", syncInstalled));
    };
  }, []);

  useEffect(() => {
    if (!window.isSecureContext || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    let active = true;
    let hadController = !!navigator.serviceWorker.controller;
    let installing: ServiceWorker | null = null;
    let lastUpdateCheck = 0;
    const readStatus = () => {
      const worker = navigator.serviceWorker.controller || registration.current?.active;
      if (!worker) return;
      const channel = new MessageChannel();
      const timer = window.setTimeout(() => channel.port1.close(), 5000);
      channel.port1.onmessage = event => {
        if (active && event.data?.type === "OFFLINE_STATUS") { setOfflineReady(!!event.data.ready); setCachedPages(event.data.pages?.length || 0); }
        window.clearTimeout(timer);
        channel.port1.close();
      };
      worker.postMessage({ type: "GET_OFFLINE_STATUS" }, [channel.port2]);
    };
    const cacheCurrentPage = () => {
      if (cacheTimer.current) clearTimeout(cacheTimer.current);
      cacheTimer.current = setTimeout(() => {
        if (navigator.onLine) navigator.serviceWorker.controller?.postMessage({ type: "CACHE_PUBLIC_PAGE", path: window.location.pathname });
        readStatus();
      }, 1800);
    };
    const onStateChange = () => {
      if (installing?.state === "installed" && registration.current?.waiting && navigator.serviceWorker.controller && active) {
        setUpdateReady(true); setUpdateHidden(false);
      }
    };
    const onUpdateFound = () => {
      installing?.removeEventListener("statechange", onStateChange);
      installing = registration.current?.installing || null;
      installing?.addEventListener("statechange", onStateChange);
    };
    const onControllerChange = () => {
      if (hadController && active) { setUpdateApplied(true); setUpdateReady(false); setApplying(false); setUpdateHidden(false); }
      hadController = true;
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
      readStatus();
      cacheCurrentPage();
      // Never reload here: other tabs may be editing a reflection or form.
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      readStatus();
      if (navigator.onLine && Date.now() - lastUpdateCheck > 60 * 60 * 1000) {
        lastUpdateCheck = Date.now(); registration.current?.update().catch(() => {});
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    window.addEventListener("cyi:navigate", cacheCurrentPage);
    window.addEventListener("popstate", cacheCurrentPage);
    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_VERSION || "cyi-pwa-20260913-1")}`, { scope: "/", updateViaCache: "none" }).then(reg => {
      if (!active) return;
      registration.current = reg;
      reg.addEventListener("updatefound", onUpdateFound);
      onUpdateFound();
      if (reg.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
      navigator.serviceWorker.ready.then(() => { if (active) { readStatus(); cacheCurrentPage(); } });
    }).catch(() => { if (active) setServiceWorkerError(true); });
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      registration.current?.removeEventListener("updatefound", onUpdateFound);
      installing?.removeEventListener("statechange", onStateChange);
      window.removeEventListener("cyi:navigate", cacheCurrentPage);
      window.removeEventListener("popstate", cacheCurrentPage);
      document.removeEventListener("visibilitychange", onVisibility);
      if (cacheTimer.current) clearTimeout(cacheTimer.current);
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (guideOpen) {
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      trigger.current?.focus({ preventScroll: true });
    }
  }, [guideOpen]);

  function dismissOffer() {
    setOfferVisible(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* Dismiss still works for this visit. */ }
  }

  async function install() {
    const prompt = deferredPrompt.current;
    if (!prompt) { setGuideOpen(true); return; }
    deferredPrompt.current = null;
    setCanInstall(false);
    setGuideOpen(false);
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === "accepted") { setOfferVisible(false); setInstallMessage("Installation requested. Look for CYI on your home screen or in your apps."); }
      else dismissOffer();
    } catch { setInstallMessage("Your browser could not open installation. Follow the steps for your device below."); setGuideOpen(true); }
  }

  function applyUpdate() {
    const worker = registration.current?.waiting;
    if (!worker) { setUpdateReady(false); registration.current?.update().catch(() => {}); return; }
    setApplying(true);
    worker.postMessage({ type: "APPLY_UPDATE" });
    updateTimeout.current = setTimeout(() => { setApplying(false); }, 15000);
  }

  return <PWAContext.Provider value={{ installed, canInstall, online, platform, offlineReady, cachedPages, serviceWorkerError, openInstall: () => setGuideOpen(true), install }}>
    {children}
    {!online && <div className="pwa-connection" role="status"><WifiOff size={16} /><span>You’re offline. Public reading is available; saving, videos and live services need a connection.</span><a href="/offline.html">Open reading room <ArrowRight size={15} /></a></div>}
    {offerVisible && !installed && <aside className="pwa-offer" aria-label="Install CYI"><Image unoptimized src="/icons/icon-192.png" alt="" width={48} height={48} /><button className="pwa-offer-action" onClick={() => setGuideOpen(true)}><strong>Keep CYI close.</strong><span>Add to your {platform === "ios" || platform === "android" ? "home screen" : "apps"} <ArrowRight size={13} /></span></button><button className="pwa-icon-button" aria-label="Dismiss installation suggestion for seven days" onClick={dismissOffer}><X size={19} /></button></aside>}
    {(updateReady || updateApplied) && !updateHidden && <aside className="pwa-update" aria-label="CYI app update"><RefreshCw size={21} /><div><strong>{updateApplied ? "Your update is ready." : "A fresh CYI is available."}</strong><p>{updateApplied ? "Finish any reflection or form before reloading." : "Apply the update now. You choose when to reload."}</p><button onClick={updateApplied ? () => { if (window.confirm("Reload CYI now? Any unfinished reflection or form on this page will be cleared. Save or copy your work first.")) window.location.reload(); } : applyUpdate} disabled={applying}>{applying ? "Applying…" : updateApplied ? "Reload when ready" : "Apply update"}<ArrowRight size={14} /></button></div><button className="pwa-icon-button" aria-label="Dismiss update notice for this visit" onClick={() => setUpdateHidden(true)}><X size={18} /></button></aside>}
    {installMessage && <div className="pwa-install-message" role="status"><span>{installMessage}</span><button className="pwa-icon-button" onClick={() => setInstallMessage("")} aria-label="Dismiss installation message"><X size={16} /></button></div>}
    <dialog ref={dialog} className="pwa-modal" aria-labelledby="pwa-dialog-title" aria-describedby="pwa-dialog-description" onClose={() => setGuideOpen(false)} onClick={event => { if (event.target === event.currentTarget) setGuideOpen(false); }}>
      <div className="pwa-modal-body"><button className="pwa-icon-button pwa-modal-close" aria-label="Close installation guide" onClick={() => setGuideOpen(false)}><X size={23} /></button><div className="pwa-app-badge"><Image unoptimized src="/icons/icon-192.png" alt="CYI" width={72} height={72} /><span>CHRIST FOR YOUTH<br /><b>INTERNATIONAL</b></span></div><p className="pwa-kicker">YOUR FAMILY. ONE TAP AWAY.</p><h2 id="pwa-dialog-title">A little closer.<br /><em>Every day.</em></h2><p id="pwa-dialog-description">Give CYI a place on your home screen. Open your community, experiences and encouragement in a space of their own.</p>
        {installed ? <p className="pwa-success"><CircleCheck /> You’re already using the CYI app.</p> : <><button className="pwa-primary" onClick={install} disabled={!canInstall}>{canInstall ? "Install CYI" : "Follow the steps below"}<ArrowDownToLine size={19} /></button><InstallInstructions platform={platform} inAppBrowser={inAppBrowser} /></>}
        <Link href="/install" className="pwa-text-link" onClick={() => setGuideOpen(false)}>Full installation guide & offline features <ArrowRight size={16} /></Link><p className="pwa-small-note">Free to install. No app store download.</p>
      </div>
    </dialog>
  </PWAContext.Provider>;
}

function InstallInstructions({ platform, inAppBrowser = false }: { platform: Platform; inAppBrowser?: boolean }) {
  const content: Record<Platform, { label: string; steps: ReactNode[]; note: string }> = {
    ios: { label: "On iPhone & iPad", steps: [<>Open this website in <strong>Safari</strong>.</>, <>Tap <strong>Share</strong> <Share size={17} aria-label="Share icon" /> in the browser toolbar. It may be inside the More menu.</>, <>Choose <strong>Add to Home Screen</strong>. Scroll down in the share sheet if needed.</>, <>Keep <strong>Open as Web App</strong> on, if shown. Tap <strong>Add</strong>, then open CYI from your home screen.</>], note: "If Add to Home Screen is missing, scroll to Edit Actions in the share sheet and add it. Your browser may use slightly different labels." },
    android: { label: "On Android", steps: [<>Open this website in <strong>Chrome</strong> or <strong>Samsung Internet</strong>.</>, <>Tap <strong>Install CYI</strong> above when available, or open your browser’s <strong>menu</strong> <Menu size={17} />.</>, <>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>, then confirm.</>], note: "Open CYI from your home screen or app drawer. The installation option depends on your browser and device." },
    mac: { label: "On Mac", steps: [<>In <strong>Safari</strong>, choose <strong>File → Add to Dock</strong> on supported macOS versions.</>, <>In <strong>Chrome or Edge</strong>, use <strong>Install CYI</strong> above or the install icon beside the address bar.</>, <>Confirm <strong>Add</strong> or <strong>Install</strong>. Open CYI from your Dock or apps.</>], note: "Safari’s Add to Dock needs macOS Sonoma or later. If unavailable, use an up-to-date Chrome or Edge browser." },
    desktop: { label: "On Windows, Chromebook & Linux", steps: [<>Open this website in <strong>Chrome</strong> or <strong>Microsoft Edge</strong>.</>, <>Select <strong>Install CYI</strong> above or the install icon at the right of the address bar.</>, <>Confirm <strong>Install</strong>. Pin CYI to your taskbar or launcher for a quicker return.</>], note: "If your browser does not offer installation, open this page in Chrome or Edge. You can always use CYI in a browser." },
  };
  const guide = content[platform];
  return <div className="pwa-instructions">{inAppBrowser && <p className="pwa-browser-note">You appear to be inside another app. Open its menu and choose “Open in browser” first.</p>}<h3>{guide.label}</h3><ol>{guide.steps.map((step, index) => <li key={index}><span className="pwa-step-number">{index + 1}</span><div>{step}</div></li>)}</ol><p className="pwa-small-note">{guide.note}</p></div>;
}

export function InstallExperience() {
  const pwa = usePWA();
  const [guide, setGuide] = useState<Platform | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const selectedGuide = guide || pwa.platform;
  return <div className="pwa-page">
    <section className="pwa-install-hero"><div className="wrap pwa-install-grid"><div className="pwa-install-copy"><p className="pwa-kicker"><span /> YOUR FAMILY, WHEREVER YOU GO</p><h1>TAKE THE<br /><em>purpose</em><br />WITH YOU.</h1><p>A familiar place on your home screen. Your community, your next experience, your daily moment of encouragement. All one tap away.</p><div className="pwa-install-actions"><button className="pwa-primary" onClick={pwa.canInstall ? pwa.install : pwa.openInstall}>{pwa.installed ? "CYI is installed" : pwa.canInstall ? "Install CYI" : "Add CYI to your device"}{pwa.installed ? <Check size={20} /> : <ArrowDownToLine size={20} />}</button><a href="#installation-guide">See how it works <ArrowRight size={16} /></a></div><div className="pwa-install-proof"><span><Check size={15} /> Free to install</span><span><Check size={15} /> No app store</span><span><Check size={15} /> Made for your device</span></div><div className="pwa-qr-block"><Image src="/icons/install-qr.svg" width={90} height={90} alt="Scan to open CYI installation on your phone" unoptimized /><div><strong>Open CYI on your phone.</strong><p>Point your camera at the code.</p><a href={`${siteUrl}/install`}>cyi-gilt.vercel.app/install</a><button onClick={async () => { try { await navigator.clipboard.writeText(`${siteUrl}/install`); setLinkCopied(true); } catch { setLinkCopied(false); } }}>{linkCopied ? "Link copied ✓" : "Copy installation link"}</button></div></div></div>
      <div className="pwa-phone-scene" aria-label="Preview of CYI on your home screen"><div className="pwa-phone-orbit" /><div className="pwa-phone"><div className="pwa-phone-camera" /><div className="pwa-phone-top"><span>9:41</span><span>●●● ▰</span></div><div className="pwa-phone-wallpaper"><div className="pwa-phone-wordmark">LIVE<br />WITH<br /><em>PURPOSE.</em></div><div className="pwa-home-icon"><Image unoptimized src="/icons/icon-192.png" alt="CYI home screen icon" width={76} height={76} /><span>CYI</span></div><div className="pwa-phone-dock"><BookOpen /><Globe2 /><Sparkles /></div></div><div className="pwa-phone-home" /></div><div className="pwa-floating-note"><span><CircleCheck size={20} /></span><div>YOUR NEXT STEP.<br /><strong>Just one tap.</strong></div></div><div className="pwa-scene-star" aria-hidden="true">✳</div></div>
    </div><div className="wrap pwa-device-strip"><span><Smartphone size={18} /> iPhone & iPad</span><span><Smartphone size={18} /> Android</span><span><Monitor size={18} /> Mac & Windows</span><span><Globe2 size={18} /> Chromebook & Linux</span></div></section>
    <section className="wrap pwa-features"><article><span className="pwa-feature-icon"><ArrowDownToLine /></span><p className="pwa-kicker">01 / ALWAYS CLOSE</p><h2>Your own space.</h2><p>Launch CYI from your home screen, Dock or taskbar. Enjoy a focused app window and a layout that feels at home on phones, tablets and computers.</p></article><article><span className="pwa-feature-icon"><BookOpen /></span><p className="pwa-kicker">02 / ROOM TO REFLECT</p><h2>Keep reading offline.</h2><p>A pocket reading room with 21 CYI devotionals, the ministry’s story and contact details. Public pages are kept as you explore, subject to available device storage.</p></article><article><span className="pwa-feature-icon"><ShieldCheck /></span><p className="pwa-kicker">03 / ON YOUR TERMS</p><h2>Updates, with care.</h2><p>New versions announce themselves quietly. Finish your reflection or form, then reload when you’re ready. Your private collection is never put into the offline page cache.</p></article></section>
    <section className="pwa-guide-section" id="installation-guide"><div className="wrap pwa-guide-grid"><div><p className="pwa-kicker">A MINUTE NOW. ONE TAP NEXT TIME.</p><h2>Make room<br />for <em>CYI.</em></h2><p>Choose your device for a few simple steps. Your browser handles installation securely.</p><div className="pwa-device-picker" role="group" aria-label="Choose installation instructions">{([["ios", "iPhone / iPad"], ["android", "Android"], ["mac", "Mac"], ["desktop", "Windows / others"]] as [Platform, string][]).map(([platform, label]) => <button key={platform} aria-pressed={selectedGuide === platform} onClick={() => setGuide(platform)}>{label}{selectedGuide === platform ? <Check size={16} /> : <ChevronRight size={16} />}</button>)}</div></div><div className="pwa-guide-card"><InstallInstructions platform={selectedGuide} />{pwa.canInstall && !pwa.installed && <button className="pwa-primary" onClick={pwa.install}>Install CYI now <ArrowDownToLine size={19} /></button>}{pwa.installed && <p className="pwa-success"><CircleCheck size={20} /> You’re using the installed CYI app.</p>}</div></div></section>
    <section className="wrap pwa-offline-section"><div className="pwa-offline-card"><div><p className="pwa-kicker">LESS SIGNAL. STILL CONNECTED TO PURPOSE.</p><h2>Your pocket<br /><em>reading room.</em></h2><p>Make space for a quiet moment, wherever you are. Read the complete offline devotional collection without a connection once it has been prepared on this device.</p><a href="/offline.html" className="pwa-primary">Open the reading room <BookOpen size={19} /></a></div><div className="pwa-offline-details"><p className={"pwa-cache-status" + (pwa.offlineReady ? " ready" : "")} role="status">{pwa.offlineReady ? <CircleCheck size={19} /> : <RefreshCw size={19} />}{pwa.offlineReady ? "Offline reading is ready on this device" : pwa.serviceWorkerError ? "Offline setup is unavailable in this browser" : "Preparing offline reading while you’re online"}</p><dl><div><dt>Ready to read</dt><dd>21 complete devotionals, our purpose and contact details</dd></div><div><dt>Public pages kept here</dt><dd>{pwa.cachedPages > 0 ? `${pwa.cachedPages} pages available on this device` : "Core pages prepare in the background"}</dd></div><div><dt>Needs a connection</dt><dd>Saving My CYI, videos, audio streams, external forms, maps and giving</dd></div><div><dt>Your device, your choice</dt><dd>Offline content uses browser storage. Your browser may clear it; removing site data removes these copies.</dd></div></dl></div></div></section>
    <section className="wrap pwa-faq"><p className="pwa-kicker">A FEW GOOD QUESTIONS</p><h2>Before you go.</h2><details><summary>Will My CYI move to the installed app? <span>+</span></summary><p>Your collection is linked to this browser’s session, with no cross-device sign-in yet. Some devices create a separate session for an installed app. Export your collection from <Link href="/my-cyi">My CYI</Link> before changing browsers, reinstalling or clearing site data.</p></details><details><summary>Why don’t I see an Install button? <span>+</span></summary><p>Browsers decide when native installation is available. On iPhone or iPad, use Safari’s Share menu and Add to Home Screen. On a computer, try Chrome or Edge, or Safari’s Add to Dock on a supported Mac. The steps above cover each device.</p></details><details><summary>Does this send notifications or use my location? <span>+</span></summary><p>No. Installing CYI does not request notification or location access. Explore branches using the directory and its filters.</p></details><details><summary>How do I remove the app? <span>+</span></summary><p>Remove CYI as you would any app on your device. Clear CYI’s site data in your browser to remove offline copies too. Export any collection you want to keep first.</p></details></section>
    <section className="pwa-install-end"><div className="wrap"><p className="pwa-kicker">FAITH. FRIENDSHIP. PURPOSE.</p><h2>A PLACE FOR YOU.<br /><em>Always close.</em></h2><Link href="/explore">Explore your CYI family <ArrowRight size={20} /></Link></div></section>
  </div>;
}
