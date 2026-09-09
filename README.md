# tripool 接送服務說明網站

把原本散在 Google Docs 的各機場「注意事項 + 常見問題」，集中成一個可以直接發給客人的網頁。
共通條款只寫一次，21 個機場共用；各站點只維護自己不一樣的地方。

- **產出**：一個 `dist/index.html` 靜態檔，掛在 GitHub Pages，免費、免主機、秒開。
- **維護**：同事只改 `content/` 底下的 `.yml` 文案檔，推上 main 後自動重建、自動上線。
- **語言**：繁體中文 / English（要加日文、簡中，改 `content/site.yml` 再補翻譯即可）。

---

## 一、資料夾長什麼樣

```
content/                ← 同事只需要動這裡
  site.yml              品牌、語言、介面文字
  countries.yml         國家清單與排序
  shared.yml            ★ 共用條款庫（5 成重複的內容都放這）
  airports/
    jp-oka.yml          那霸（已完成，可當範本）
    kr-icn.yml          仁川（草稿）
    tw-tpe.yml          桃園（草稿）
    _template.yml       新增機場時複製這個（底線開頭不會被建置）
src/page.html           版型與前端程式（結構要改才動）
build/build.mjs         建置腳本：YAML → 單檔 HTML，順便檢查錯字
.github/workflows/      GitHub Actions 自動部署
dist/index.html         建置產物（不用手改）
```

## 二、共用與差異怎麼分

三層，由上而下覆蓋：

| 層 | 檔案 | 用途 |
|---|---|---|
| 共用文字 | `content/shared.yml` | 「免費等待時間」「取消規則」這類每站都有的題目，**只寫一次** |
| 站點變數 | 機場檔的 `vars:` | 同一句話裡會變的數字：等待 90 分鐘、日元 2000、行前 3 天…… |
| 站點覆寫 | 機場檔的 `faq:` / `notes:` | 引用共用、調整順序、加自己專屬的題目，或整段換掉答案 |

實際寫法：

```yaml
faq:
  - use: free-waiting        # 直接沿用共用條款，數字由 vars 代入
  - use: cancellation

  - use: name-board          # 沿用題目，但這個站點答案不一樣 → 覆寫 a
    a:
      zh-TW: 那霸站點提供免費舉牌服務。
      en: Name-board service is included at Naha.

  - id: oka-exit             # 這個站點專屬的問題
    q: { zh-TW: 司機在哪個出口等？, en: Which exit? }
    a: { zh-TW: …, en: … }
```

`{{freeWaitMinutes}}` 這種標記會在建置時代入 `vars` 的值。
少寫一個變數、引用了不存在的 id，建置會直接失敗並指出是哪個檔案哪一行的問題 —— 錯誤內容不會悄悄上線。

## 三、日常維護

### 同事改文案（不用裝任何東西）

1. 在 GitHub 上打開 `content/airports/xxx.yml`
2. 按鉛筆圖示直接改
3. Commit → 約 1 分鐘後網站自動更新

> 建議把 main 設成需要 Pull Request，這樣改動上線前一定有人看過，且 PR 會先跑建置檢查。

### 新增一個機場

1. 複製 `content/airports/_template.yml`
2. 改名為 `國碼-機場碼.yml`（例：`jp-kix.yml`）
3. 填 `name` / `code` / `vars`，挑要引用哪些共用條款
4. Commit 即可，下拉選單會自動出現

### 本機預覽（選用）

```bash
npm ci
npm run build     # 產生 dist/index.html
npm run dev       # 建置 + 起本機伺服器預覽
```

## 四、部署設定（只做一次）

1. 建立 GitHub repo，把這些檔案推上去
2. Repo → **Settings → Pages → Source** 選 **GitHub Actions**
3. 推到 `main` 就會自動部署到 `https://<帳號>.github.io/<repo>/`
4. 想用自己的網域（例如 `faq.tripool.app`）：Pages 設定填 Custom domain，DNS 加一筆 CNAME

## 五、網址規則

單頁 + 下拉選單，但每個站點都有可以直接貼的網址：

| 網址 | 開啟時 |
|---|---|
| `…/` | 預設站點、依瀏覽器語言自動選中／英 |
| `…/?a=jp-oka` | 直接開那霸 |
| `…/?a=jp-oka&lang=en` | 那霸，英文版 |

把 `?a=jp-oka` 這種連結放進訂單確認信與聊天室，客人一點就到自己那一頁。
頁面上的「複製本頁連結」按鈕會複製當下的完整網址，客服可以直接貼給客人。

## 六、還可以加的東西

- **列印 / PDF**：頁面已做列印樣式，Cmd+P 就是一份乾淨的說明書
- **送機、包車**：同一個機場多方案時，開 `jp-oka-dropoff.yml` 之類的檔案即可
- **草稿標記**：機場檔加 `draft: true`，頁面會顯示「內容待確認」，方便分批上線
- **Google Sheet 當後台**：若同事連 GitHub 網頁編輯都嫌麻煩，可再加一個把 Sheet 轉成 YAML 的步驟
