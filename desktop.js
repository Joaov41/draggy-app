// Draggy site: the Desktop demo. A file arrives from the docked iPhone on load; visitors can drag Desktop
// icons (or select one and press Return) onto the iPhone to send them. Purely illustrative, no network.
(() => {
  const desk = document.querySelector(".desk");
  const phone = document.getElementById("phone");
  const bloom = document.getElementById("bloom");
  const hint = document.getElementById("hint-text");
  const icons = [...document.querySelectorAll(".desk-icon")];
  if (!desk || !phone || !icons.length) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const positions = new Map(icons.map((icon) => [icon, { x: 0, y: 0 }]));

  const rect = (el) => el.getBoundingClientRect();
  const deskPoint = (clientX, clientY) => {
    const d = rect(desk);
    return { x: clientX - d.left, y: clientY - d.top };
  };
  // The point on the phone's edge facing the Mac (its left edge), at a given height.
  const seam = (clientY) => {
    const p = rect(phone);
    return { x: p.left + p.width * 0.04, y: Math.min(Math.max(clientY, p.top + 40), p.bottom - 40) };
  };

  // Plays the bloom at a point, then lets it settle back to its resting glow at the seam (the CSS default).
  let bloomTimer = 0;
  const playBloom = (clientX, clientY) => {
    if (reduceMotion || !bloom) return;
    const pt = deskPoint(clientX, clientY);
    bloom.style.setProperty("--bloom-x", `${pt.x}px`);
    bloom.style.setProperty("--bloom-y", `${pt.y}px`);
    bloom.classList.remove("play");
    void bloom.offsetWidth;
    bloom.classList.add("play");
    clearTimeout(bloomTimer);
    bloomTimer = setTimeout(() => {
      bloom.classList.remove("play");
      bloom.style.removeProperty("--bloom-x");
      bloom.style.removeProperty("--bloom-y");
    }, 1700);
  };

  const flashPhone = () => {
    phone.classList.add("receiving");
    setTimeout(() => phone.classList.remove("receiving"), 900);
  };

  const place = (icon) => {
    const { x, y } = positions.get(icon);
    icon.style.transform = x || y ? `translate(${x}px, ${y}px)` : "";
  };

  // Arrival on load: the first icon starts at the phone's seam and lands in its Desktop spot.
  const arriving = document.querySelector(".desk-icon.arriving");
  if (arriving && !reduceMotion) {
    const a = rect(arriving);
    const s = seam(a.top + a.height / 2);
    arriving.style.setProperty("--from-x", `${s.x - (a.left + a.width / 2)}px`);
    arriving.style.setProperty("--from-y", `${s.y - (a.top + a.height / 2)}px`);
    setTimeout(() => { flashPhone(); playBloom(s.x, s.y); }, 450);
  }
  arriving?.addEventListener("animationend", () => arriving.classList.remove("arriving"), { once: true });

  const overPhone = (icon) => {
    const i = rect(icon), p = rect(phone);
    const cx = i.left + i.width / 2, cy = i.top + i.height / 2;
    return cx > p.left - 12 && cx < p.right && cy > p.top && cy < p.bottom;
  };

  let remaining = icons.length;
  const send = (icon) => {
    if (icon.classList.contains("sent")) return;
    const i = rect(icon), p = rect(phone);
    const s = seam(i.top + i.height / 2);
    const { x, y } = positions.get(icon);
    const dx = x + (p.left + p.width * 0.4) - (i.left + i.width / 2);
    const dy = y + (s.y - (i.top + i.height / 2));
    icon.style.setProperty("--sent-to", `translate(${dx}px, ${dy}px)`);
    icon.style.transform = "";
    icon.classList.remove("selected");
    icon.classList.add("sent");
    playBloom(s.x, s.y);
    setTimeout(flashPhone, reduceMotion ? 0 : 220);
    hint.textContent = `Sent “${icon.dataset.name}” to the iPhone. This page is a demo; the apps do it for real.`;
    remaining -= 1;
    if (remaining === 0) {
      setTimeout(() => {
        icons.forEach((el) => { positions.set(el, { x: 0, y: 0 }); el.classList.remove("sent"); el.style.transform = ""; });
        remaining = icons.length;
        hint.textContent = "They’re back on the Desktop. Drag one again, or select it and press Return.";
      }, 2200);
    }
  };

  icons.forEach((icon) => {
    let start = null, moved = false;

    icon.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || icon.classList.contains("sent")) return;
      icon.setPointerCapture(e.pointerId);
      const { x, y } = positions.get(icon);
      start = { px: e.clientX, py: e.clientY, x, y };
      moved = false;
    });
    icon.addEventListener("pointermove", (e) => {
      if (!start) return;
      const dx = e.clientX - start.px, dy = e.clientY - start.py;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      icon.classList.add("dragging", "selected");
      positions.set(icon, { x: start.x + dx, y: start.y + dy });
      place(icon);
      phone.classList.toggle("target", overPhone(icon));
    });
    const end = () => {
      if (!start) return;
      start = null;
      icon.classList.remove("dragging");
      phone.classList.remove("target");
      if (moved && overPhone(icon)) send(icon);
    };
    icon.addEventListener("pointerup", end);
    icon.addEventListener("pointercancel", end);

    icon.addEventListener("click", () => {
      if (moved) { moved = false; return; }
      icons.forEach((el) => el !== icon && el.classList.remove("selected"));
      icon.classList.toggle("selected");
    });
    icon.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); send(icon); }
    });
  });

  // Features: a Finder icon view whose selection drives the Quick Look pane.
  const files = [...document.querySelectorAll(".iconview .file")];
  const qlTitle = document.querySelector(".ql-title");
  const qlDesc = document.querySelector(".ql-desc");
  const qlIcon = document.querySelector(".ql-tile use");
  const choose = (file) => {
    files.forEach((f) => f.setAttribute("aria-pressed", String(f === file)));
    qlTitle.textContent = file.querySelector(".file-name").textContent;
    qlDesc.textContent = file.querySelector(".file-desc").textContent;
    qlIcon?.setAttribute("href", file.querySelector(".file-tile use").getAttribute("href"));
  };
  files.forEach((file) => {
    file.addEventListener("click", () => choose(file));
    file.addEventListener("focus", () => choose(file));
  });

  // The window nearest the middle of the screen is the key window; the rest go inactive, as on a Mac.
  const windows = [...document.querySelectorAll("main .window")];
  const pickKey = () => {
    const mid = innerHeight / 2;
    let best = null, bestDistance = Infinity;
    windows.forEach((w) => {
      const r = w.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestDistance) { bestDistance = d; best = w; }
    });
    windows.forEach((w) => w.classList.toggle("inactive", best !== null && w !== best));
  };
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { pickKey(); ticking = false; });
  }, { passive: true });
  addEventListener("resize", pickKey);
  pickKey();
})();

// Demo videos: each plays muted on a loop once it scrolls into view; with Reduce Motion they stay paused with controls.
(() => {
  const videos = [...document.querySelectorAll(".player-body video")];
  if (!videos.length) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    videos.forEach((video) => { video.controls = true; });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) target.play().catch(() => { target.controls = true; });
      else target.pause();
    });
  }, { threshold: 0.35 });
  videos.forEach((video) => io.observe(video));
})();
