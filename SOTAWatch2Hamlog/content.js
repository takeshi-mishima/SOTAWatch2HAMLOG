/* 
 * content.js : SOTA Watch to HAMLOG ブラウザ拡張
 *
 * SOTA WATCH3のLog Chaseウインドウからデータを抽出してデスクトッププログラムに送る
 *
 * Log Chaseウインドウを拡張してRSTレポートを入力できるようにしている
 *
 * (c) 2026 Takeshi Mishima JK1VUZ
 */

function injectButton() {
    // すでにボタンがある場合は何もしない
    if (document.getElementById('hamlog-btn')) return;
    
    // ポップアップ（モーダル）を探す
    const modal = document.querySelector('.modal-content');
    if (!modal) return;
    
    // ポップアップのタイトル部分に "Log Chase" が含まれているかどうか確認
    const modalTitle = modal.querySelector('.modal-title');
    if (!modalTitle?.innerText.includes('Log Chase')) return;
    
    // Submitボタンを探す
    const submitBtn = modal.querySelector('.modal-footer button[type="submit"]');
    if (!submitBtn) return;

    // 追加要素を格納するメインコンテナを作成
    const mainWrapper = document.createElement('div');
    mainWrapper.id = 'hamlog-main-wrapper';
    mainWrapper.style.cssText = `
        display: flex; 
        flex-direction: column; 
        gap: 0px; 
        margin-top: 15px; 
        margin-left: auto;
        margin-right: 15px;
        width: fit-content;
        align-items: flex-end;
    `;

    // ボタンのサイズ（Submitと転送ボタンに共通）
    const BTN_WIDTH = '120px'; 
    const BTN_HEIGHT = '38px';
    
    // RST入力欄と転送ボタンを格納するサブコンテナを作成
    const subContainer = document.createElement('div');
    subContainer.style.cssText = `
        display: flex; 
        gap: 15px; 
        align-items: flex-end; 
        margin-top: -12px;      // ここでマイナスを指定すると上に食い込みます
    `;
    
    // RST入力欄の作成
    const createRstBox = (labelTitle, inputId) => {
        const box = document.createElement('div');
        box.style.cssText = 'display: flex; flex-direction: column; align-items: center;';
        const label = document.createElement('span');
        label.innerText = labelTitle;
        label.style.cssText = 'font-size: 14px; color: #666; margin-bottom: 2px; font-weight: bold;';
        const input = document.createElement('input');
        input.id = inputId;
        input.type = 'tel'; // type="text" から "tel" に変更（数値と英数字を優先させる）
        input.inputMode = 'numeric'; // モバイル端末で数字キーボードを強制
        input.autocomplete = 'off';
        input.value = ''; // 入力欄の初期値（ここを'59'とすると初期値として59が入力された状態になる）
        
        // CSSでIMEを無効化（一部のブラウザで有効）
        input.style.cssText = `
            width: 60px; 
            padding: 6px; 
            border: 1px solid #ccc; 
            border-radius: 4px; 
            text-align: center; 
            font-size: 14px; 
            height: ${BTN_HEIGHT}; 
            box-sizing: border-box;
            ime-mode: disabled; 
        `;
        
        // 全角文字を強制排除する処理
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^\x20-\x7e]/g, "");
        });
        
        box.appendChild(label); // 入力欄のラベル
        box.appendChild(input); // 入力欄
        return { box, input };
    };

    const hisSet = createRstBox('His', 'hamlog-his');
    const mySet = createRstBox('My', 'hamlog-my');

    // HAMLOG転送ボタンの作成
    const btn = document.createElement('button');
    btn.id = 'hamlog-btn';
    btn.innerText = 'HAMLOG転送';
    btn.type = 'button';
    btn.style.cssText = `
        width: ${BTN_WIDTH};
        height: ${BTN_HEIGHT};
        background-color: #0d6efd;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 400;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Submitボタンのスタイル変更（転送ボタンにそろえる）
    submitBtn.style.setProperty('width', BTN_WIDTH, 'important');
    submitBtn.style.setProperty('height', BTN_HEIGHT, 'important');
    submitBtn.style.setProperty('margin', '0', 'important');
    submitBtn.style.setProperty('display', 'flex', 'important');
    submitBtn.style.setProperty('align-items', 'center', 'important');
    submitBtn.style.setProperty('justify-content', 'center', 'important');

    btn.onclick = (e) => {
        e.preventDefault();
        
        // chrome.storage が undefined の場合のエラー回避
        if (!chrome?.storage?.local) {
            alert("拡張機能のストレージにアクセスできません。拡張機能ページでリロードしてください。");
            return;
        }

        chrome.storage.local.get({
            timeMode: 'JST',
            targetLog: 'A', 
            targetRemarks: 'Remarks2', 
            summitFormat: '{summit}'
        }, (settings) => {
            const getById = (id) => document.getElementById(id)?.value || "";

            const rawData = {
                call: getById("otherCallsign"),
                dateStr: getById("date"),   // "DD/MM/YYYY"
                timeStr: getById("time"),   // "HH:MM"
                freq: (getById("band") || "").match(/[0-9.]+/)?.[0] || "0",
                mode: getById("mode"),
                summit: getById("ref"),
                rstHis: hisSet.input.value,
                rstMy: mySet.input.value
            };
            
            // 日付と時刻が取得できない場合は中断
            if (!rawData.dateStr || !rawData.timeStr) {
                alert("日付または時刻が取得できません");
                return;
            }

            const d = rawData.dateStr.split('/');
            const t = rawData.timeStr.split(':');
            
            // UTCとして一度Dateオブジェクトを作成 (月は0始まりなので -1)
            let dateObj = new Date(Date.UTC(
                parseInt(d[2]), 
                parseInt(d[1]) - 1, 
                parseInt(d[0]), 
                parseInt(t[0]), 
                parseInt(t[1])
            ));
            
            let finalDate, finalTime;

            if (settings.timeMode === 'JST') {
                // JSTの場合は9時間加算
                dateObj = new Date(dateObj.getTime() + (9 * 60 * 60 * 1000));
                
                const YY = dateObj.getUTCFullYear().toString().slice(-2);
                const MM = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
                const DD = dateObj.getUTCDate().toString().padStart(2, '0');
                const hh = dateObj.getUTCHours().toString().padStart(2, '0');
                const mm = dateObj.getUTCMinutes().toString().padStart(2, '0');
                
                finalDate = `${YY}/${MM}/${DD}`;
                finalTime = `${hh}:${mm}J`;
            } else {
                // UTCの場合はそのまま整形
                finalDate = `${d[2].slice(-2)}/${d[1]}/${d[0]}`;
                finalTime = `${rawData.timeStr}U`;
            }

            fetch('http://localhost:5000/post_log', {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    ...rawData,
                    dateStr: finalDate,
                    timeStr: finalTime,
                    targetLog: settings.targetLog,
                    targetRemarks: settings.targetRemarks,
                    summitFormat: settings.summitFormat
                })
            }).then(res => res.json()).then(json => alert(json.message)).catch(() => alert('Pythonブリッジ未起動'));
        });
    };

    // 親要素（footer）自体の余白を消す
    const footer = submitBtn.parentElement;
    if (footer) {
        footer.style.paddingRight = '0';
        footer.style.paddingLeft = '0';
    }

    // 組み立て
    submitBtn.parentNode.insertBefore(mainWrapper, submitBtn);
    mainWrapper.appendChild(submitBtn); 
    subContainer.appendChild(hisSet.box);
    subContainer.appendChild(mySet.box);
    subContainer.appendChild(btn);
    mainWrapper.appendChild(subContainer);
}

// 監視処理
let observerTimer = null;
const observer = new MutationObserver(() => {
    if (observerTimer) return;
    observerTimer = setTimeout(() => {
        injectButton();
        observerTimer = null;
    }, 500);
});

observer.observe(document.body, { childList: true, subtree: true });