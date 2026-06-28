import { Link } from "react-router-dom";

export function TermsPage() {
  return (
    <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">
      <header className="mb-10">
        <Link to="/" className="section-label mb-6 inline-block transition-colors hover:text-text">
          ← 回到首頁
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-text">服務條款與隱私說明</h1>
        <p className="mt-2 text-sm text-muted">最後更新：2026 年 6 月</p>
      </header>

      <div className="space-y-10 text-base leading-relaxed text-muted">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text">這個服務是什麼</h2>
          <p>
            追番進行式（AnimeOwatteiNai）是一個給彼岸花 Discord 社群成員使用的私人追番工具。
            它幫你記住看到哪一集、哪部番暫停了、哪部番接下來要看。
          </p>
          <p>
            這個服務不是影片平台，不代管、不嵌入、不下載任何影片內容。
            「觀看入口」只是連結，點過去之後我們不知道你在那邊做了什麼。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text">誰可以使用</h2>
          <p>
            目前採申請制，只有彼岸花 Discord 伺服器的成員才能申請加入。
            申請不保證通過，管理員保留審核與停權的最終決定權。
          </p>
          <p>
            如果你離開了 Discord 伺服器，系統會在定期稽核時自動撤銷你的存取資格。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text">使用規範</h2>
          <ul className="list-inside list-disc space-y-1.5">
            <li>帳號不可轉讓或共用</li>
            <li>不可嘗試爬取、大量匯出其他成員的資料</li>
            <li>不可用於任何商業目的</li>
            <li>違反規範的帳號可能被停權，不另行通知</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text">我們收集什麼資料</h2>
          <p>
            登入時我們會從 Discord 取得你的 User ID、用戶名稱與顯示名稱，並儲存在資料庫裡。
            你在這裡建立的追番清單、觀看紀錄、申請訊息也會被保存。
          </p>
          <p>
            這些資料只用於讓服務正常運作，不會賣給任何人，也不會用於廣告目的。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text">誰看得到你的資料</h2>
          <p>
            預設情況下，你的追番清單只有你自己看得到。
            管理員可以透過管理介面看到所有成員的帳號資訊與申請紀錄，但不會主動查看個別成員的觀看紀錄。
          </p>
          <p>
            如果你在「我的追番」中把某部番設定為「公開」，其他成員就可能看到這個項目（功能尚在開發中）。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text">資料保存與刪除</h2>
          <p>
            目前沒有自動刪除機制。如果你想刪除帳號或所有資料，請直接在 Discord 聯繫管理員處理。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text">服務的穩定性</h2>
          <p>
            這是個社群小工具，不是商業服務。我們盡力讓它穩定運作，但不保證零停機或永久維運。
            如果哪天服務關閉，會盡量提前在 Discord 公告。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text">開源授權</h2>
          <p>
            本專案以 TinyYana Universal Software License（TYUSL）v1.0 授權發布。
            個人使用、非商業用途與學習目的均可自由使用與修改。
            若有商業授權需求，請聯繫 admin@tinyyana.com。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text">著作權聲明</h2>
          <p>
            本服務所呈現的動漫作品名稱、劇情、圖片等相關內容，其著作權均屬原始權利人所有。
            本工具僅供個人觀看進度管理使用，不涉及任何著作權授權行為。
          </p>
          <p>
            透過「觀看入口」連結至第三方平台時，該平台的內容與合法性由使用者自行判斷，與本服務無關。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text">AI 生成圖像聲明</h2>
          <p>
            本專案使用的 Icon、Logo 與標準字，均由 ChatGPT（OpenAI）生成。
            相關圖像僅作為社群工具的視覺識別，不作商業用途。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text">免責聲明</h2>
          <p>
            本服務以現況（as-is）提供，不提供任何明示或暗示的保證，包括但不限於服務穩定性、資料完整性或特定目的之適用性。
          </p>
          <p>
            使用者因使用本服務而產生的任何直接或間接損失，本服務恕不負責。
            本服務得隨時修改、暫停或終止，無須事先通知。
          </p>
        </section>
      </div>

      <footer className="mt-14 border-t border-border/50 pt-6">
        <p className="section-label">有疑問的話，去 Discord 找管理員比較快</p>
      </footer>
    </div>
  );
}
