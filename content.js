// Is It Greg? — highlight Hacker News content by Greg
// (links to greg.technology, or anything posted by gregsadetsky).

const GREG_HOST = "greg.technology";
const GREG_USER = "gregsadetsky";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Every badge we drop on the page, in document order, so the count can walk them.
const sightings = [];
let cursor = -1;
let flashTimer = 0;

function faceURL(dancing) {
  // A looping GIF can't be paused, so reduced motion always gets the still portrait.
  return chrome.runtime.getURL(dancing && !REDUCED_MOTION ? "images/greg-dance.gif" : "images/greg.png");
}

function isGreg(href) {
  try {
    const host = new URL(href, location.href).hostname.toLowerCase();
    return host === GREG_HOST || host.endsWith("." + GREG_HOST);
  } catch {
    return false;
  }
}

function isGregUser(userLink) {
  return !!userLink && userLink.textContent.trim() === GREG_USER;
}

function addBadge(after, reason) {
  const badge = document.createElement("span");
  badge.className = "is-greg-badge";
  const face = document.createElement("img");
  face.className = "is-greg-face";
  face.src = faceURL(false);
  face.alt = "";
  badge.append(face, "Greg");
  // No `title`: the reason rides in our own tooltip, and a native one would double up.
  badge.dataset.gregReason = reason;
  badge.setAttribute("role", "img");
  badge.setAttribute("aria-label", "Greg — " + reason);
  after.insertAdjacentElement("afterend", badge);
  sightings.push(badge);
}

/* ---- Hover tooltip: the reason, with Greg dancing next to it ---------------- */

let tip = null;
let hovered = null;

function ensureTip() {
  if (tip) return tip;
  tip = document.createElement("div");
  tip.className = "is-greg-tip";
  tip.setAttribute("role", "tooltip");
  const face = document.createElement("img");
  face.className = "is-greg-tip-face";
  face.src = faceURL(true);
  face.alt = "";
  const text = document.createElement("span");
  text.className = "is-greg-tip-text";
  tip.append(face, text);
  document.body.append(tip);
  return tip;
}

function showTip(badge) {
  const el = ensureTip();
  el.querySelector(".is-greg-tip-text").textContent = badge.dataset.gregReason;
  el.classList.add("is-greg-tip-visible");
  // Measured while only `visibility: hidden`, so the box already has its real size.
  const rect = badge.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const left = Math.max(8, Math.min(centerX - box.width / 2, window.innerWidth - box.width - 8));
  let top = rect.top - box.height - 10;
  const below = top < 8;
  if (below) top = rect.bottom + 10;
  el.classList.toggle("is-greg-tip-below", below);
  el.style.left = Math.round(left) + "px";
  el.style.top = Math.round(top) + "px";
  el.style.setProperty("--is-greg-arrow-x", Math.round(centerX - left) + "px");
}

function hideTip() {
  hovered = null;
  if (tip) tip.classList.remove("is-greg-tip-visible");
}

document.addEventListener("mouseover", (event) => {
  const badge = event.target.closest?.(".is-greg-badge");
  if (badge && badge !== hovered) {
    hovered = badge;
    showTip(badge);
  }
});

document.addEventListener("mouseout", (event) => {
  const badge = event.target.closest?.(".is-greg-badge");
  if (!badge || badge !== hovered) return;
  if (event.relatedTarget && badge.contains(event.relatedTarget)) return; // still inside
  hideTip();
});

// A tooltip pinned to a stale position is worse than no tooltip.
window.addEventListener("scroll", hideTip, { passive: true });
window.addEventListener("resize", hideTip);

/* ---- The dancer, and the Gregs he throws ----------------------------------- */

const BURST_SIZE = 18;
const PARTICLE_CAP = 120;
const GRAVITY = 0.34;
const particles = new Set();
let burstLayer = null;
let stillCount = 0;
let frame = 0;
let lastFrameTime = 0;

function ensureBurstLayer() {
  if (!burstLayer) {
    burstLayer = document.createElement("div");
    burstLayer.className = "is-greg-burst-layer";
    burstLayer.setAttribute("aria-hidden", "true");
    document.body.append(burstLayer);
  }
  return burstLayer;
}

function makeConfetto(size) {
  const el = document.createElement("img");
  el.className = "is-greg-confetto";
  el.src = faceURL(false);
  el.alt = "";
  el.style.width = size + "px";
  el.style.height = size + "px";
  return el;
}

function burst(originX, originY) {
  const layer = ensureBurstLayer();
  if (REDUCED_MOTION) return stillBurst(layer, originX, originY);

  const room = Math.max(0, PARTICLE_CAP - particles.size);
  for (let i = 0; i < Math.min(BURST_SIZE, room); i++) {
    // Up and to the left, away from the corner he lives in.
    const angle = -Math.PI / 2 - 0.4 + (Math.random() - 0.5) * 1.9;
    const speed = 6 + Math.random() * 8;
    const size = 22 + Math.random() * 22;
    const el = makeConfetto(size);
    layer.append(el);
    particles.add({
      el,
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * 360,
      spin: (Math.random() - 0.5) * 18,
      life: 150 + Math.random() * 40,
    });
  }
  if (!frame) {
    lastFrameTime = performance.now();
    frame = requestAnimationFrame(step);
  }
}

function step(now) {
  const dt = Math.min(32, Math.max(0, now - lastFrameTime)) / 16.67; // never step backwards
  lastFrameTime = now;
  for (const p of particles) {
    p.vy += GRAVITY * dt;
    p.vx *= 0.995;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    p.life -= dt;
    if (p.life <= 0 || p.y > window.innerHeight + 120) {
      p.el.remove();
      particles.delete(p);
      continue;
    }
    if (p.life < 30) p.el.style.opacity = String(p.life / 30);
    p.el.style.transform =
      "translate(" + p.x + "px, " + p.y + "px) translate(-50%, -50%) rotate(" + p.rot + "deg)";
  }
  frame = particles.size ? requestAnimationFrame(step) : 0;
}

// Reduced motion: the same handful of Gregs, but they appear and fade instead of flying.
function stillBurst(layer, originX, originY) {
  const count = Math.min(10, Math.max(0, PARTICLE_CAP - stillCount));
  const radius = 120;
  const offset = Math.random() * 0.6; // so repeat clicks don't stack Gregs exactly
  stillCount += count;
  for (let i = 0; i < count; i++) {
    const angle = Math.PI + offset + (i / (count - 1)) * Math.PI * 0.9;
    const size = 30;
    const el = makeConfetto(size);
    el.classList.add("is-greg-confetto-still");
    el.style.left = Math.round(originX + Math.cos(angle) * radius) + "px";
    el.style.top = Math.round(originY + Math.sin(angle) * radius) + "px";
    layer.append(el);
    setTimeout(() => {
      el.remove();
      stillCount--;
    }, 1400);
  }
}

function showDancer(count) {
  let dancer = document.querySelector(".is-greg-dancer");
  if (!dancer) {
    dancer = document.createElement("div");
    dancer.className = "is-greg-dancer";

    const faceButton = document.createElement("button");
    faceButton.type = "button";
    faceButton.className = "is-greg-dancer-button";
    faceButton.title = "More Greg";
    faceButton.setAttribute("aria-label", "More Greg");
    const face = document.createElement("img");
    face.className = "is-greg-dancer-face";
    face.src = faceURL(true);
    face.alt = "";
    faceButton.append(face);
    faceButton.addEventListener("click", () => {
      const rect = face.getBoundingClientRect();
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    const countButton = document.createElement("button");
    countButton.type = "button";
    countButton.className = "is-greg-dancer-count";
    countButton.addEventListener("click", jumpToNextSighting);

    dancer.append(faceButton, countButton);
    document.body.append(dancer);
    // Next frame, so the slide-in transition actually has a starting state.
    requestAnimationFrame(() => dancer.classList.add("is-greg-dancer-visible"));
  }
  const countButton = dancer.querySelector(".is-greg-dancer-count");
  countButton.textContent = count;
  const label = count === 1 ? "1 Greg on this page" : count + " Gregs on this page";
  countButton.title = label + " — click to jump to " + (count === 1 ? "it" : "them");
  countButton.setAttribute("aria-label", countButton.title);
}

function jumpToNextSighting() {
  if (!sightings.length) return;
  cursor = (cursor + 1) % sightings.length;
  const badge = sightings[cursor];
  for (const seen of sightings) seen.classList.remove("is-greg-found");
  badge.scrollIntoView({ block: "center", behavior: REDUCED_MOTION ? "auto" : "smooth" });
  void badge.offsetWidth; // restart the pulse if it's the same badge twice
  badge.classList.add("is-greg-found");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => badge.classList.remove("is-greg-found"), 1500);
}

function scan() {
  // Story rows (front page, /newest, /show, /item header, ...).
  const stories = document.querySelectorAll("tr.athing:not(.comtr):not([data-is-greg-checked])");
  for (const row of stories) {
    row.dataset.isGregChecked = "1";
    const link = row.querySelector(".titleline > a");
    if (!link) continue;
    // The row right after `tr.athing` holds the "N points by user" subtext.
    const author = row.nextElementSibling?.querySelector(".hnuser");
    if (isGreg(link.href)) {
      addBadge(link, "This link points to greg.technology");
    } else if (isGregUser(author)) {
      addBadge(link, "Posted by " + GREG_USER);
    }
  }

  // Comment headers (/item, /threads, /newcomments, ...).
  const commenters = document.querySelectorAll(".comhead > .hnuser:not([data-is-greg-checked])");
  for (const user of commenters) {
    user.dataset.isGregChecked = "1";
    if (isGregUser(user)) addBadge(user, "Comment by " + GREG_USER);
  }

  if (sightings.length) showDancer(sightings.length);
}

scan();
