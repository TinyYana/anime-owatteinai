// Shared widget logic injected by both content scripts.
// Exposes: window.__aonWidget(info, source)
// `info` = { title: string, episode: number }

window.__aonWidget = function (info, source) {
  const key = `${info.title}::${info.episode}`;
  const existing = document.getElementById("aon-widget");
  if (existing?.dataset.key === key) return;
  existing?.remove();

  const style = document.createElement("style");
  style.textContent = `
    #aon-widget {
      position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
      background: #0d0b14ee; border: 1px solid #e8699a40; border-radius: 12px;
      padding: 14px 16px; color: #f0ebf5;
      font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif;
      font-size: 15px; line-height: 1.55; min-width: 280px; max-width: 380px;
      box-shadow: 0 8px 32px #00000080; backdrop-filter: blur(8px);
    }
    #aon-widget.aon-large { font-size: 16px; min-width: 300px; max-width: 420px; }
    #aon-widget .aon-hd { font-size: 11px; color: #e8699a; letter-spacing:.08em; margin-bottom:6px; text-transform: uppercase; }
    #aon-widget .aon-title { font-weight:600; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    #aon-widget .aon-ep { color:#70cbb8; font-size:13px; margin-bottom:10px; }
    #aon-widget .aon-hint { font-size:14px; color:#c9bed6; margin-bottom:8px; line-height:1.6; }
    #aon-widget .aon-match { margin:8px 0; padding:8px; border:1px solid #e8699a30; border-radius:8px; background:#ffffff08; }
    #aon-widget .aon-match-title { font-weight:600; color:#f0ebf5; }
    #aon-widget .aon-meta { margin-top:3px; color:#9d8faf; font-size:12px; }
    #aon-widget .aon-source { color:#70cbb8; font-weight:600; }
    #aon-widget .aon-btn {
      display:block; width:100%; border:none; border-radius:8px;
      padding:8px 12px; font-size:14px; font-weight:500; cursor:pointer; transition:background .15s;
    }
    #aon-widget .aon-input {
      width:100%; margin-top:8px; margin-bottom:6px; border-radius:8px;
      border:1px solid #e8699a30; background:#161224; color:#f0ebf5;
      padding:8px 10px; font-size:14px; outline:none;
    }
    #aon-widget .aon-input:focus { border-color:#e8699a80; }
    #aon-widget .aon-btn-primary { background:#e8699a; color:#fff; }
    #aon-widget .aon-btn-primary:hover { background:#d45588; }
    #aon-widget .aon-btn-primary:disabled { background:#e8699a50; cursor:not-allowed; }
    #aon-widget .aon-btn-ghost {
      background:transparent; border:1px solid #e8699a30; color:#9d8faf;
      margin-top:6px;
    }
    #aon-widget .aon-btn-ghost:hover { border-color:#e8699a60; color:#e8699a; }
    #aon-widget .aon-msg { font-size:12px; color:#9d8faf; margin-top:6px; }
    #aon-widget .aon-close {
      position:absolute; top:8px; right:10px; background:none; border:none;
      color:#9d8faf; cursor:pointer; font-size:14px; line-height:1;
    }
    #aon-widget .aon-close:hover { color:#f0ebf5; }
  `;
  document.head.appendChild(style);

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }

  function displayTitle(anime) {
    return anime.titleZh || anime.title || anime.titleNative || anime.titleEnglish || anime.titleRomaji || "未命名動畫";
  }

  function altNames(anime) {
    return [
      anime.titleNative,
      anime.titleEnglish,
      anime.titleRomaji,
      ...(anime.synonyms ?? []),
    ].filter(Boolean).filter((name, index, list) => list.indexOf(name) === index).slice(0, 4);
  }

  function sourceLabel(candidate) {
    return ({ anilist: "AniList", bangumi: "Bangumi", jikan: "Jikan" })[candidate?.source] ?? "外部資料";
  }

  function renderCandidate(candidate, uncertain) {
    const names = altNames(candidate);
    return `
      <div class="aon-match">
        <div class="aon-match-title">${esc(displayTitle(candidate))}</div>
        <div class="aon-meta">
          <span class="aon-source">${esc(sourceLabel(candidate))}</span>
          ${candidate.seasonYear ? ` · ${esc(candidate.seasonYear)}` : ""}
          ${candidate.episodes ? ` · ${esc(candidate.episodes)} 集` : ""}
        </div>
        ${names.length ? `<div class="aon-meta">別名：${esc(names.join(" / "))}</div>` : ""}
        ${uncertain ? `<div class="aon-meta">名稱不完全一致，請確認是不是這部。</div>` : ""}
      </div>
    `;
  }

  const w = document.createElement("div");
  w.id = "aon-widget";
  w.dataset.key = key;
  w.innerHTML = `
    <button class="aon-close" title="關閉">×</button>
    <div class="aon-hd">追番進行式</div>
    <div class="aon-title">${esc(info.title)}</div>
    <div class="aon-ep">EP ${esc(info.episode)} · ${esc(source)}</div>
    <div class="aon-hint" id="aon-hint">正在辨識這部動畫...</div>
    <div id="aon-manual" style="display:none">
      <input class="aon-input" id="aon-manual-title" type="text" placeholder="輸入正確番名" />
      <button class="aon-btn aon-btn-ghost" id="aon-search-btn">重新辨識</button>
    </div>
    <button class="aon-btn aon-btn-primary" id="aon-main-btn" disabled style="display:none"></button>
    <button class="aon-btn aon-btn-ghost" id="aon-skip-btn" style="display:none">不是這部</button>
    <div class="aon-msg" id="aon-msg"></div>
  `;
  document.body.appendChild(w);
  chrome.storage.sync.get({ widgetSize: "normal" }, ({ widgetSize }) => {
    if (widgetSize === "large") w.classList.add("aon-large");
  });
  w.querySelector(".aon-close").addEventListener("click", () => w.remove());

  const hint = document.getElementById("aon-hint");
  const mainBtn = document.getElementById("aon-main-btn");
  const skipBtn = document.getElementById("aon-skip-btn");
  const manual = document.getElementById("aon-manual");
  const manualTitle = document.getElementById("aon-manual-title");
  const searchBtn = document.getElementById("aon-search-btn");
  const msg = document.getElementById("aon-msg");

  let resolvedAnimeId = null;
  let pendingCandidate = null;

  function resolve(title) {
    hint.textContent = "正在辨識這部動畫...";
    msg.textContent = "";
    mainBtn.style.display = "none";
    skipBtn.style.display = "none";
    manual.style.display = "none";
    resolvedAnimeId = null;
    pendingCandidate = null;

    chrome.runtime.sendMessage({ type: "RESOLVE_ANIME", title }, (res) => {
      if (!res) {
        hint.textContent = "暫時無法連線到追番服務。";
        return;
      }

      switch (res.status) {
        case "found":
          resolvedAnimeId = res.anime.id;
          hint.innerHTML = `已辨識：<strong>${esc(displayTitle(res.anime))}</strong>`;
          mainBtn.textContent = `記錄 EP ${info.episode}`;
          mainBtn.style.display = "block";
          mainBtn.disabled = false;
          break;

        case "candidate":
          pendingCandidate = res.candidate;
          hint.innerHTML = `看起來可能是：${renderCandidate(res.candidate, res.uncertain)}`;
          mainBtn.textContent = `加入並記錄 EP ${info.episode}`;
          mainBtn.style.display = "block";
          mainBtn.disabled = false;
          skipBtn.style.display = "block";
          break;

        case "not_found":
          hint.textContent = "還無法自動辨識這部動畫。";
          manual.style.display = "block";
          manualTitle.value = title;
          msg.textContent = "換個名稱再試一次，或到網站手動新增。";
          break;
      }
    });
  }

  resolve(info.title);

  mainBtn.addEventListener("click", () => {
    mainBtn.disabled = true;

    if (resolvedAnimeId) {
      mainBtn.textContent = "記錄中...";
      chrome.runtime.sendMessage({
        type: "RECORD_WATCHED",
        animeId: resolvedAnimeId,
        episode: info.episode,
        sourceUrl: location.href,
        sourceLabel: source,
      }, (res) => {
        if (res?.ok) {
          mainBtn.textContent = "已記錄";
          hint.textContent = "";
          msg.textContent = "追番進度已更新。";
          skipBtn.style.display = "none";
        } else {
          mainBtn.disabled = false;
          mainBtn.textContent = `記錄 EP ${info.episode}`;
          msg.textContent = `失敗：${res?.error ?? "未知錯誤"}`;
        }
      });
    } else if (pendingCandidate) {
      mainBtn.textContent = "加入中...";
      chrome.runtime.sendMessage(
        {
          type: "IMPORT_AND_RECORD",
          candidate: pendingCandidate,
          episode: info.episode,
          observedTitle: info.title,
          sourceUrl: location.href,
          sourceLabel: source,
        },
        (res) => {
          if (res?.ok) {
            resolvedAnimeId = res.anime.id;
            mainBtn.textContent = "已加入並記錄";
            hint.textContent = `之後看到「${info.title}」會直接辨識成這部。`;
            msg.textContent = "追番進度已更新。";
            skipBtn.style.display = "none";
          } else {
            mainBtn.disabled = false;
            mainBtn.textContent = `加入並記錄 EP ${info.episode}`;
            msg.textContent = `失敗：${res?.error ?? "未知錯誤"}`;
          }
        },
      );
    }
  });

  skipBtn.addEventListener("click", () => {
    mainBtn.style.display = "none";
    skipBtn.style.display = "none";
    manual.style.display = "block";
    manualTitle.value = info.title;
    manualTitle.focus();
    hint.textContent = "那請輸入正確番名：";
    msg.textContent = "";
  });
  searchBtn.addEventListener("click", () => {
    const title = manualTitle.value.trim();
    if (title) resolve(title);
  });
  manualTitle.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchBtn.click();
  });
};
