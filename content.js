// YouTube swaps the same <video> onto the ad. Duration on that element is the
// ad length, not the movie. Seeking to it is the same move as dragging the
// scrubber onto the right edge. The player rewinds the seek while the ad is
// locked, so this has to keep writing currentTime until the ad element gives up.
(function () {
  const SKIP = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-skip-button-slot button",
  ];
  const CLOSE = [
    ".ytp-ad-overlay-close-button",
    ".ytp-ad-overlay-close-container",
  ];

  function player() {
    return document.getElementById("movie_player");
  }

  function adOn() {
    const root = player();
    if (!root) return false;
    if (root.classList.contains("ad-showing")) return true;
    if (root.classList.contains("ad-interrupting")) return true;
    return !!root.querySelector(".ytp-ad-player-overlay, .ytp-ad-preview-container");
  }

  function videos() {
    const root = player();
    if (!root) return [];
    return Array.from(root.querySelectorAll("video.html5-main-video, video"));
  }

  function pushToEnd(video) {
    const len = video.duration;
    if (!Number.isFinite(len) || len <= 0.3) return;
    const end = len - 0.05;
    if (video.currentTime >= end - 0.15) return;
    try {
      video.currentTime = end;
    } catch (e) {
      // seek rejected while the element is detached; next tick retries
    }
  }

  function clickAll(selectors) {
    const root = player() || document;
    for (const sel of selectors) {
      const nodes = root.querySelectorAll(sel);
      for (const node of nodes) {
        if (node instanceof HTMLElement) node.click();
      }
    }
  }

  function tick() {
    if (!adOn()) return;
    for (const video of videos()) pushToEnd(video);
    clickAll(SKIP);
    clickAll(CLOSE);
  }

  setInterval(tick, 200);

  const boot = new MutationObserver(tick);
  const arm = () => {
    const root = document.documentElement;
    if (!root) return;
    boot.observe(root, { subtree: true, attributes: true, attributeFilter: ["class"] });
  };
  if (document.documentElement) arm();
  else document.addEventListener("DOMContentLoaded", arm, { once: true });
})();
