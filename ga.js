/**
 * Google Analytics bootstrap, self-hosted on purpose.
 *
 * The snippet Google gives you is an INLINE <script>, and allowing inline script on this origin would mean putting
 * 'unsafe-inline' into script-src. That is a far bigger hole than analytics: this origin derives and holds passkey
 * private keys, and 'unsafe-inline' would let any injected inline script run — an `<img onerror=…>` in a name or a
 * chain-supplied SVG becomes code execution next to the key. Serving these four lines from our own origin keeps
 * script-src at "'self' + googletagmanager.com", which is the narrowest policy that still lets GA work.
 *
 * Known and accepted trade-off (operator's call, 2026-09-22): googletagmanager.com can now execute script here, so
 * Google — and anyone who ever compromises that script — is inside the same realm as the passkey code. The custody
 * audit's line that this origin carries "no analytics, error reporter or third-party script" is no longer true, and
 * nothing in the product may claim otherwise.
 */
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-4QWLXTDH20');
