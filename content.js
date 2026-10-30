// Pre-roll often has no finite duration yet, and the player snaps currentTime
// back every frame. A 200ms poke loses that fight. This runs in the page world
// so the player's own seekTo is reachable, and it rewrites the playhead on
// every frame until the ad class drops. Rate 16 is the fallback when the
// seek itself is rejected.
(function () {
  const SKIP = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-skip-button-slot button",
    'button[aria-label*="Skip"]',
    'button[aria-label*="Пропустить"]',
  ].join(",");

  const CLOSE = [
    ".ytp-ad-overlay-close-button",
    ".ytp-ad-overlay-close-container",
  ].join(",");

  const savedRate = new WeakMap();
  const touched = new Set();

  function deep(selector, root) {
    const out = [];
    const visit = (node) => {
      if (!node || !node.querySelectorAll) return;
      node.querySelectorAll(selector).forEach((el) => out.push(el));
      node.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) visit(el.shadowRoot);
      });
    };
    visit(root || document);
    return out;
  }

  function players() {
    const found = deep(".html5-video-player, #movie_player");
    const byId = document.getElementById("movie_player");
    if (byId && !found.includes(byId)) found.push(byId);
    return found;
  }

  function adPlayers() {
    return players().filter((el) => {
      const c = el.classList;
      if (!c) return false;
      if (c.contains("ad-showing") || c.contains("ad-interrupting")) return true;
      return !!el.querySelector(".ytp-ad-player-overlay, .ytp-ad-preview-container, .ytp-ad-persistent-progress");
    });
  }

  function videosIn(root) {
    return deep("video", root);
  }

  function pushToEnd(video) {
    const len = video.duration;
    try {
      if (Number.isFinite(len) && len > 0.3 && len < 180) {
        if (video.currentTime < len - 0.2) video.currentTime = len - 0.05;
      } else if (!Number.isFinite(len)) {
        video.currentTime = (video.currentTime || 0) + 30;
      }
    } catch (e) {
      // element mid-detach; next frame retries
    }
    if (!savedRate.has(video)) savedRate.set(video, video.playbackRate || 1);
    touched.add(video);
    if (video.playbackRate < 16) video.playbackRate = 16;
  }

  function playerSeek(el) {
    if (typeof el.getDuration !== "function" || typeof el.seekTo !== "function") return;
    const len = el.getDuration();
    if (!Number.isFinite(len) || len <= 0.3 || len >= 180) return;
    const now = typeof el.getCurrentTime === "function" ? el.getCurrentTime() : 0;
    if (now < len - 0.2) el.seekTo(len - 0.05, true);
  }

  function clickAll(selector, root) {
    for (const node of deep(selector, root)) {
      if (node instanceof HTMLElement) node.click();
    }
  }

  function restore() {
    for (const video of touched) {
      const rate = savedRate.get(video);
      if (video.isConnected && typeof rate === "number" && rate > 0) video.playbackRate = rate;
      savedRate.delete(video);
    }
    touched.clear();
  }

  function tick() {
    const ads = adPlayers();
    if (!ads.length) {
      if (touched.size) restore();
      return;
    }
    for (const el of ads) {
      playerSeek(el);
      for (const video of videosIn(el)) pushToEnd(video);
      clickAll(SKIP, el);
      clickAll(CLOSE, el);
    }
  }

  setInterval(tick, 200);

  const loop = () => {
    tick();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
