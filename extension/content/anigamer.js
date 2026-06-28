// Content script for 動畫瘋 (ani.gamer.com.tw/animeVideo.php)

(function () {
  function cleanTitle(title) {
    return title
      .replace(/\s*[\[【(（]\s*(?:ep(?:isode)?\s*)?\d+\s*[\]】)）]\s*$/i, "")
      .replace(/\s*(?:第\s*)?\d+\s*(?:話|集|回)\s*$/u, "")
      .trim();
  }

  function detectInfo() {
    let title =
      document.querySelector(".anime_name h1")?.textContent?.trim() ||
      document.querySelector(".anime-title")?.textContent?.trim() ||
      document.querySelector("h1.anime_name")?.textContent?.trim();

    let episodeText =
      document.querySelector(".episode .num")?.textContent?.trim() ||
      document.querySelector("[class*='episode'][class*='active'] span")?.textContent?.trim() ||
      document.querySelector(".ep_btn.playing")?.textContent?.trim();

    // Fallback: parse from document.title, e.g. "幸運星[01]｜動畫瘋"
    if (!title || !episodeText) {
      const m = document.title.match(/^(.+?)\[(\d+)\]/);
      if (m) {
        title = title || m[1].trim();
        episodeText = episodeText || m[2];
      }
    }

    if (title) title = cleanTitle(title);
    const episode = episodeText ? parseInt(episodeText, 10) : null;
    return title && episode != null && !isNaN(episode) ? { title, episode } : null;
  }

  let lastKey = "";
  function run() {
    const info = detectInfo();
    if (!info) return;
    const key = `${info.title}::${info.episode}`;
    if (key === lastKey) return;
    lastKey = key;

    // Widget is injected by widget.js (loaded before this script via manifest)
    if (typeof window.__aonWidget === "function") {
      window.__aonWidget(info, "動畫瘋");
    }
  }

  run();
  let timer = 0;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(run, 300);
  }).observe(document.body, { childList: true, subtree: true });
})();
