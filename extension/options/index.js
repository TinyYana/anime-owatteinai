const input = document.getElementById("api-base");
const priority = document.getElementById("default-priority");
const widgetSize = document.getElementById("widget-size");
const result = document.getElementById("result");

// Load saved value
chrome.storage.sync.get({
  apiBase: "http://localhost:8787",
  defaultPriority: "normal",
  widgetSize: "normal",
}, ({ apiBase, defaultPriority, widgetSize: savedWidgetSize }) => {
  input.value = apiBase;
  priority.value = defaultPriority;
  widgetSize.value = savedWidgetSize;
});

document.getElementById("save").addEventListener("click", async () => {
  const val = input.value.trim().replace(/\/$/, "");
  if (!val) return;
  await chrome.storage.sync.set({
    apiBase: val,
    defaultPriority: priority.value,
    widgetSize: widgetSize.value,
  });
  showResult("ok", "已儲存。");
});

document.getElementById("test").addEventListener("click", async () => {
  const val = input.value.trim().replace(/\/$/, "");
  if (!val) return;
  await chrome.storage.sync.set({
    apiBase: val,
    defaultPriority: priority.value,
    widgetSize: widgetSize.value,
  });
  showResult("ok", "連線測試中…");

  chrome.runtime.sendMessage({ type: "VERIFY_CONNECTION" }, (res) => {
    if (res?.ok) {
      showResult("ok", `✓ 連線成功！已登入為 ${res.username}（${res.role}）`);
    } else {
      showResult("err", `✗ 連線失敗：${res?.error ?? "未知錯誤"}。請確認 API 網址，並在網站完成登入。`);
    }
  });
});

function showResult(type, msg) {
  result.textContent = msg;
  result.className = type;
  result.style.display = "block";
}
