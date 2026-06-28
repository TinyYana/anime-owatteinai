async function getApiBase() {
  const result = await chrome.storage.sync.get({ apiBase: "http://localhost:8787" });
  return result.apiBase.replace(/\/$/, "");
}

const dot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const userName = document.getElementById("user-name");
const actions = document.getElementById("actions");

chrome.runtime.sendMessage({ type: "VERIFY_CONNECTION" }, async (res) => {
  const base = await getApiBase();
  if (res?.ok) {
    dot.classList.remove("err");
    statusText.textContent = "已連線";
    userName.textContent = res.username;
    actions.style.display = "flex";
    document.getElementById("open-app").href = base + "/app";
    document.getElementById("open-my-anime").href = base + "/app/my-anime";
    document.getElementById("open-dashboard").href = base + "/app";
    [document.getElementById("open-app"), document.getElementById("open-my-anime"), document.getElementById("open-dashboard")].forEach((a) => {
      a.addEventListener("click", (e) => { e.preventDefault(); chrome.tabs.create({ url: a.href }); });
    });
  } else {
    dot.classList.add("err");
    statusText.textContent = "未連線 — 請先在網站登入";
    userName.textContent = "";
  }
});

document.getElementById("options-link").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
