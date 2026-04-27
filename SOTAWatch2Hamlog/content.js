/* 
 * content.js : SOTAWatch to HAMLOG ブラウザ拡張
 *
 * SOTAwatch3のLog Chaseウインドウからデータを抽出してデスクトッププログラムに送る
 *
 * Log Chaseウインドウを拡張してRSTレポートを入力できるようにしている
 *
 * (c) 2026 Takeshi Mishima JK1VUZ
 */

// HAMLOGに転送したログのSubmitボタンの押し忘れを防止
let isTransferredNotSubmitted = false;

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
		margin-top: -12px;		// ここでマイナスを指定すると上に食い込みます
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

	// 時刻更新ボタンを追加
	const dateInput = modal.querySelector('input#date');
	const timeInput = modal.querySelector('input#time');

	if (dateInput && timeInput && !document.getElementById('update-time-btn')) {
		const timeUpdateBtn = document.createElement('button');
		timeUpdateBtn.id = 'update-time-btn';
		timeUpdateBtn.type = 'button';

		// 更新ボタンアイコン (SVG)
		timeUpdateBtn.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
			  <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
			  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
			</svg>
		`;
		
		timeUpdateBtn.style.cssText = `
			margin-left: 8px;
			padding: 4px;
			display: flex;
			align-items: center;
			justify-content: center;
			background-color: #f8f9fa;
			color: #666;
			border: 1px solid #ccc;
			border-radius: 4px;
			cursor: pointer;
			transition: background-color 0.2s;
		`;
		
		// ホバー時の効果
		timeUpdateBtn.onmouseover = () => { timeUpdateBtn.style.backgroundColor = '#e2e6ea'; };
		timeUpdateBtn.onmouseout = () => { timeUpdateBtn.style.backgroundColor = '#f8f9fa'; };

		timeUpdateBtn.onclick = (e) => {
			e.preventDefault();
			const now = new Date(); // ブラウザ実行時の現在時刻
			const YY = now.getUTCFullYear();
			const MM = (now.getUTCMonth() + 1).toString().padStart(2, '0');
			const DD = now.getUTCDate().toString().padStart(2, '0');
			const hh = now.getUTCHours().toString().padStart(2, '0');	// 時(UTC)
			const mm = now.getUTCMinutes().toString().padStart(2, '0'); // 分(UTC)

			// 日付 (UTC) の更新: DD/MM/YYYY
			dateInput.value = `${DD}/${MM}/${YY}`;
			dateInput.dispatchEvent(new Event('input', { bubbles: true }));

			// 時刻 (UTC) の更新: HH:MM
			timeInput.value = `${hh}:${mm}`;
			timeInput.dispatchEvent(new Event('input', { bubbles: true }));
		};

		// TIME入力欄の親要素を調整してボタンを配置
		const timeContainer = timeInput.parentNode;
		timeContainer.style.display = 'flex';
		timeContainer.style.alignItems = 'center';
		timeContainer.appendChild(timeUpdateBtn);
	}

	// HAMLOG転送ボタンの作成
	const btn = document.createElement('button');
	btn.id = 'hamlog-btn';
	btn.innerText = 'ブリッジ待機中';
	btn.type = 'button';
	btn.disabled = true; // ブリッジが起動するまで無効化しておく
	btn.style.cssText = `
		width: ${BTN_WIDTH};
		height: ${BTN_HEIGHT};
		background-color: #6c757d; // #0d6efd;
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

	// ブリッジの起動を確認する
	checkBridgeStatus(btn);
	
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
				dateStr: getById("date"),	// "DD/MM/YYYY"
				timeStr: getById("time"),	// "HH:MM"
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
			})
			.then(res => res.json())
			.then(json => {
				// alert(json.message);
				
				showToast(json.message, json.success ? "success" : "error");
				
				if (json.success) {
					isTransferredNotSubmitted = true;
				}
			})
			.catch(() => alert('ブリッジ未起動'));
		});
	};

	// Submitボタンのクリックでフラグを落とす
	submitBtn.addEventListener('click', () => {
		isTransferredNotSubmitted = false;
	});

	// 閉じるボタン（×やCancelなど）への警告
	// Bootstrapのモーダル要素に対して複数の「閉じる」可能性のある要素を監視
	const closeSelectors = '.btn-close, .close, [data-dismiss="modal"], .btn-secondary';
	modal.querySelectorAll(closeSelectors).forEach(el => {
		el.addEventListener('click', (e) => {
			if (isTransferredNotSubmitted) {
				if (!confirm("HAMLOGへ転送済みですが、SOTAwatch3へのSubmitが完了していません。閉じてもよろしいですか？")) {
					e.preventDefault();
					e.stopImmediatePropagation();
				} else {
					isTransferredNotSubmitted = false;
				}
			}
		}, true); // キャプチャフェーズでイベントを捕捉
	});

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

function checkBridgeStatus(button) {
    const check = () => {
        fetch('http://localhost:5000/health')
            .then(res => res.json())
            .then(json => {
                if (json.status === "running") {
                    // 起動確認成功
                    button.disabled = false;
                    button.innerText = 'HAMLOG転送';
                    button.style.backgroundColor = '#0d6efd'; // 青色
                    button.style.cursor = 'pointer';
                    // showToast("ブリッジと接続しました", "success");
                }
            })
            .catch(() => {
                // まだ起動していない場合は2秒後に再試行
                button.innerText = 'ブリッジ待機中';
                setTimeout(check, 2000);
            });
    };
    check();
}

function showToast(message, type) {
	const toast = document.createElement('div');
	toast.innerText = message;
	toast.style.cssText = `
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 10000;
		padding: 12px 24px;
		border-radius: 4px;
		color: white;
		font-weight: bold;
		box-shadow: 0 4px 12px rgba(0,0,0,0.15);
		background-color: ${type === 'success' ? '#28a745' : '#dc3545'};
		opacity: 0;
		transition: opacity 0.3s ease;
	`;
	document.body.appendChild(toast);

	// フェードイン
	setTimeout(() => { toast.style.opacity = '1'; }, 10);

	// 3秒後にフェードアウトして削除
	setTimeout(() => {
		toast.style.opacity = '0';
		setTimeout(() => { toast.remove(); }, 300);
	}, 3000);
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