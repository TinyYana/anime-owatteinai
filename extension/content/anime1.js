// Content script for anime1.me

(function () {
  function detectInfo() {
    const titleEl =
      document.querySelector(".entry-title") ||
      document.querySelector("h1.title") ||
      document.querySelector("h2.entry-title");

    const rawTitle = titleEl?.textContent?.trim() || document.title;

    const m0 = rawTitle.match(/^(.+?)\s*\[(\d+)\]/);
    if (m0) return { title: m0[1].trim(), episode: parseInt(m0[2], 10) };

    // "幸運★星 第01話" → title="幸運★星", episode=1
    const m = rawTitle.match(/^(.+?)\s+第(\d+)[話集]/);
    if (m) return { title: m[1].trim(), episode: parseInt(m[2], 10) };

    const m2 = rawTitle.match(/^(.+?)\s+(?:EP|ep)\s*(\d+)/);
    if (m2) return { title: m2[1].trim(), episode: parseInt(m2[2], 10) };

    return null;
  }

  let lastKey = "";
  function run() {
    // Only run on episode pages (must have a video player)
    const hasPlayer = !!document.querySelector("video, iframe[src*='player'], .entry-content video");
    if (!hasPlayer) return;

    const info = detectInfo();
    if (!info) return;
    const key = `${info.title}::${info.episode}`;
    if (key === lastKey) return;
    lastKey = key;

    if (typeof window.__aonWidget === "function") {
      window.__aonWidget(info, "anime1");
    }
  }

  run();
  let timer = 0;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(run, 300);
  }).observe(document.body, { childList: true, subtree: true });
})();
