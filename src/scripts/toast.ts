// Tiny toast: one at a time, bottom-center.
// Self-contained (injects its own CSS) so it works from any page, including
// when triggered from the command palette. Uses the Popover API when present
// so it renders above an open <dialog>.
// Screen readers get the message from a separate, always-rendered polite live
// region. The visual host is display:none between toasts, and a region that
// only just appeared is often not announced (VoiceOver in particular).

export interface ToastOptions {
  message: string;
  /** Inline SVG markup for the leading icon (decorative). */
  icon?: string;
  /** Auto-dismiss delay in ms. */
  duration?: number;
}

const STYLE_ID = 'toast-styles';
const EXIT_MS = 160;

const css = /* css */ `
.toast-host{
  position:fixed;inset:auto 0 0 0;z-index:1000;
  justify-content:center;
  width:auto;height:auto;margin:0;border:0;padding:0 16px;
  padding-bottom:max(24px, calc(env(safe-area-inset-bottom) + 16px));
  background:transparent;color:inherit;overflow:visible;
  pointer-events:none;
}
.toast-live{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.toast-host:not([popover]){display:flex}
.toast-host[popover]{display:none}
.toast-host:popover-open{display:flex}
.toast{
  pointer-events:auto;
  display:flex;align-items:center;gap:10px;
  max-width:min(460px, 100%);
  padding:9px 16px 9px 10px;
  border-radius:14px;
  background:var(--surface);color:var(--text);
  box-shadow:var(--shadow-float);
  font:450 0.875rem/1.45 var(--font-sans);
  font-feature-settings:'cv01','ss03';
  text-wrap:pretty;
  transform-origin:50% 100%;
  animation:toast-in var(--dur-snappy) var(--spring-snappy) both;
}
.toast.is-leaving{animation:toast-out ${EXIT_MS}ms var(--ease-exit) both}
@keyframes toast-in{from{opacity:0;translate:0 14px;scale:.94;filter:blur(3px)}}
@keyframes toast-out{to{opacity:0;translate:0 6px;scale:.98}}
.toast__icon{flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:var(--surface-2);color:var(--text-2)}
.toast__icon svg{width:20px;height:20px;overflow:visible}
@media print{.toast-host{display:none!important}}
`;

let host: HTMLDivElement | null = null;
let live: HTMLDivElement | null = null;
let liveTimer: number | undefined;
let current: HTMLDivElement | null = null;
let timer: number | undefined;
let remaining = 0;
let startedAt = 0;

const supportsPopover = () =>
  typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.append(style);
}

function ensureLive(): HTMLDivElement {
  if (live && live.isConnected) return live;
  ensureStyles();
  live = document.createElement('div');
  live.className = 'toast-live';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  document.body.append(live);
  return live;
}

function ensureHost(): HTMLDivElement {
  ensureStyles();
  if (host && host.isConnected) return host;
  host = document.createElement('div');
  host.className = 'toast-host';
  host.setAttribute('aria-hidden', 'true');
  if (supportsPopover()) host.setAttribute('popover', 'manual');
  document.body.append(host);
  return host;
}

/** Announce politely. Clearing first lets a repeated line be read again. */
function announce(message: string) {
  const region = ensureLive();
  window.clearTimeout(liveTimer);
  region.textContent = '';
  liveTimer = window.setTimeout(() => {
    region.textContent = message;
  }, 120);
}

// Create the live region up front so it is already in the accessibility tree
// by the time the first toast fires.
if (typeof document !== 'undefined') {
  if (document.body) ensureLive();
  else document.addEventListener('DOMContentLoaded', () => ensureLive(), { once: true });
}

/** Re-enter the top layer so the toast sits above any dialog opened since. */
function raise(el: HTMLDivElement) {
  if (!el.hasAttribute('popover')) return;
  try {
    if (el.matches(':popover-open')) el.hidePopover();
    el.showPopover();
  } catch {
    /* not fatal: falls back to z-index */
  }
}

function clearTimer() {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
}

function schedule(ms: number) {
  clearTimer();
  remaining = ms;
  startedAt = performance.now();
  timer = window.setTimeout(dismissToast, ms);
}

export function dismissToast(): void {
  clearTimer();
  const el = current;
  if (!el) return;
  current = null;
  el.classList.add('is-leaving');
  window.setTimeout(() => {
    el.remove();
    if (!current && host?.hasAttribute('popover')) {
      try {
        host.hidePopover();
      } catch {}
    }
  }, EXIT_MS);
}

export function showToast({ message, icon, duration = 3200 }: ToastOptions): void {
  const region = ensureHost();
  raise(region);

  // Replace any toast still on screen instantly; the new one springs in.
  if (current) {
    current.remove();
    current = null;
  }

  const el = document.createElement('div');
  el.className = 'toast';
  if (icon) {
    const i = document.createElement('span');
    i.className = 'toast__icon';
    i.setAttribute('aria-hidden', 'true');
    i.innerHTML = icon;
    el.append(i);
  }
  const text = document.createElement('span');
  text.className = 'toast__text';
  text.textContent = message;
  el.append(text);

  // Hovering pauses the countdown.
  const pause = () => {
    if (timer === undefined) return;
    clearTimer();
    remaining -= performance.now() - startedAt;
  };
  const resume = () => {
    if (current === el && timer === undefined) schedule(Math.max(remaining, 1200));
  };
  el.addEventListener('pointerenter', pause);
  el.addEventListener('pointerleave', resume);

  current = el;
  region.append(el);
  schedule(duration);
  announce(message);
}
