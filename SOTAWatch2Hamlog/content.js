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

	// ボタンのサイズ（Submitと転送ボタンに共通）
	const BTN_WIDTH  = '120px'; 
	const BTN_HEIGHT = '38px';
	
	// RST入力欄の作成
	const createRstBox = (labelTitle, inputId) => {
		const box = document.createElement('div');
		box.style.cssText = 'display: flex; flex-direction: column; align-items: center;';
		const label = document.createElement('span');
		label.innerText = labelTitle;
		label.style.cssText = 'font-size: 14px; color: #666; margin-bottom: 2px; font-weight: bold;';
		const input = document.createElement('input');
		input.id = inputId;
		input.type = 'tel';
		input.inputMode = 'numeric';
		input.autocomplete = 'off';
		input.value = '';
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
		// 全角文字を強制排除
		input.addEventListener('input', (e) => {
			e.target.value = e.target.value.replace(/[^\x20-\x7e]/g, "");
		});
		box.appendChild(label);
		box.appendChild(input);
		return { box, input };
	};

	const hisSet = createRstBox('His', 'hamlog-his');
	const mySet  = createRstBox('My',  'hamlog-my');

	// CQ / 1 / 2 チェックボックスの作成
	const createCheckBox = (labelTitle, inputId) => {
		const box = document.createElement('div');
		box.style.cssText = 'display: flex; flex-direction: column; align-items: center;';
		const label = document.createElement('span');
		label.innerText = labelTitle;
		label.style.cssText = 'font-size: 14px; color: #666; margin-bottom: 2px; font-weight: bold;';
		const input = document.createElement('input');
		input.id = inputId;
		input.type = 'checkbox';
		input.style.cssText = `
			width: 20px;
			height: 20px;
			cursor: pointer;
			margin: 0;
			appearance: none;
			-webkit-appearance: none;
			border: 1px solid #ccc;
			border-radius: 4px;
			background-color: #fff;
			background-repeat: no-repeat;
			background-position: center;
			background-size: 14px;
			transition: background-color 0.15s, border-color 0.15s;
		`;
		const checkedBg   = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23fff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' d='M3 8l3.5 3.5L13 4'/%3E%3C/svg%3E")`;
		const uncheckedBg = '';
		input.addEventListener('change', () => {
			if (input.checked) {
				input.style.backgroundColor = '#0d6efd';
				input.style.borderColor     = '#0d6efd';
				input.style.backgroundImage = checkedBg;
			} else {
				input.style.backgroundColor = '#fff';
				input.style.borderColor     = '#ccc';
				input.style.backgroundImage = uncheckedBg;
			}
		});
		box.appendChild(label);
		box.appendChild(input);
		return { box, input };
	};

	const cqSet = createCheckBox('CQ', 'hamlog-cq');
	const cb1Set = createCheckBox('1',  'hamlog-cb1');
	const cb2Set = createCheckBox('2',  'hamlog-cb2');

	// 時刻更新ボタンを追加
	const dateInput = modal.querySelector('input#date');
	const timeInput = modal.querySelector('input#time');

	if (dateInput && timeInput && !document.getElementById('update-time-btn')) {
		const timeUpdateBtn = document.createElement('button');
		timeUpdateBtn.id = 'update-time-btn';
		timeUpdateBtn.type = 'button';
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
		timeUpdateBtn.onmouseover = () => { timeUpdateBtn.style.backgroundColor = '#e2e6ea'; };
		timeUpdateBtn.onmouseout  = () => { timeUpdateBtn.style.backgroundColor = '#f8f9fa'; };
		timeUpdateBtn.onclick = (e) => {
			e.preventDefault();
			const now = new Date();
			const YY = now.getUTCFullYear();
			const MM = (now.getUTCMonth() + 1).toString().padStart(2, '0');
			const DD = now.getUTCDate().toString().padStart(2, '0');
			const hh = now.getUTCHours().toString().padStart(2, '0');
			const mm = now.getUTCMinutes().toString().padStart(2, '0');
			dateInput.value = `${DD}/${MM}/${YY}`;
			dateInput.dispatchEvent(new Event('input', { bubbles: true }));
			timeInput.value = `${hh}:${mm}`;
			timeInput.dispatchEvent(new Event('input', { bubbles: true }));
		};
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
	btn.disabled = true;
	btn.style.cssText = `
		width: ${BTN_WIDTH};
		height: ${BTN_HEIGHT};
		background-color: #6c757d;
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

	checkBridgeStatus(btn);
	
	// Submitボタンのスタイル変更
	submitBtn.style.setProperty('width',           BTN_WIDTH,  'important');
	submitBtn.style.setProperty('height',          BTN_HEIGHT, 'important');
	submitBtn.style.setProperty('margin',          '0',        'important');
	submitBtn.style.setProperty('display',         'flex',     'important');
	submitBtn.style.setProperty('align-items',     'center',   'important');
	submitBtn.style.setProperty('justify-content', 'center',   'important');

	btn.onclick = (e) => {
		e.preventDefault();
		
		if (!chrome?.storage?.local) {
			alert("拡張機能のストレージにアクセスできません。拡張機能ページでリロードしてください。");
			return;
		}

		chrome.storage.local.get({
			timeMode:         'JST',
			targetLog:        'A',
			timeDeviationThreshold: 3,
			remarks1Format:   '',
			remarks1Overwrite: false,
			remarks2Format:   '',
			remarks2Overwrite: false,
		}, (settings) => {
			const getById = (id) => document.getElementById(id)?.value || "";

			const rawData = {
				call:   getById("otherCallsign"),
				dateStr: getById("date"),   // "DD/MM/YYYY"
				timeStr: getById("time"),   // "HH:MM"
				freq:   (getById("band") || "").match(/[0-9.]+/)?.[0] || "0",
				mode:   getById("mode"),
				summit: getById("ref"),
				rstHis: hisSet.input.value,
				rstMy:  mySet.input.value,
				cbCQ:   cqSet.input.checked,
				cb1:    cb1Set.input.checked,
				cb2:    cb2Set.input.checked,
			};
			
			if (!rawData.dateStr || !rawData.timeStr) {
				alert("日付または時刻が取得できません");
				return;
			}

			const d = rawData.dateStr.split('/');
			const t = rawData.timeStr.split(':');
			
			let dateObj = new Date(Date.UTC(
				parseInt(d[2]), 
				parseInt(d[1]) - 1, 
				parseInt(d[0]), 
				parseInt(t[0]), 
				parseInt(t[1])
			));

			// 現在時刻とのずれをチェック（Log Chaseの日時はUTC基準）
			const threshold = parseInt(settings.timeDeviationThreshold, 10) || 0;
			if (threshold > 0) {
				const diffMinutes = Math.abs(Date.now() - dateObj.getTime()) / 60000;
				if (diffMinutes > threshold) {
					const diffRounded = Math.round(diffMinutes);
					const proceed = confirm(
						`Log Chaseの日時が現在時刻から約${diffRounded}分ずれています（しきい値: ${threshold}分）。\nこのままHAMLOGへ転送しますか？`
					);
					if (!proceed) return;
				}
			}
			
			let finalDate, finalTime;
			if (settings.timeMode === 'JST') {
				dateObj = new Date(dateObj.getTime() + (9 * 60 * 60 * 1000));
				const YY = dateObj.getUTCFullYear().toString().slice(-2);
				const MM = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
				const DD = dateObj.getUTCDate().toString().padStart(2, '0');
				const hh = dateObj.getUTCHours().toString().padStart(2, '0');
				const mm = dateObj.getUTCMinutes().toString().padStart(2, '0');
				finalDate = `${YY}/${MM}/${DD}`;
				finalTime = `${hh}:${mm}J`;
			} else {
				finalDate = `${d[2].slice(-2)}/${d[1]}/${d[0]}`;
				finalTime = `${rawData.timeStr}U`;
			}

			fetch('http://localhost:5000/post_log', {
				method: 'POST', 
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
					...rawData,
					dateStr:          finalDate,
					timeStr:          finalTime,
					targetLog:        settings.targetLog,
					remarks1Format:   settings.remarks1Format,
					remarks1Overwrite: settings.remarks1Overwrite,
					remarks2Format:   settings.remarks2Format,
					remarks2Overwrite: settings.remarks2Overwrite,
				})
			})
			.then(res => res.json())
			.then(json => {
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

	// 閉じるボタンへの警告
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
		}, true);
	});

	// 親要素（footer）自体の余白を消す
	const footer = submitBtn.parentElement;
	if (footer) {
		footer.style.paddingRight = '0';
		footer.style.paddingLeft  = '0';
		footer.style.marginTop    = '0';
	}

	// modal-bodyのpadding-bottomを詰める
	const modalBody = modal.querySelector('.modal-body');
	if (modalBody) {
		modalBody.style.paddingBottom = '8px';
	}

	// modal-footerのpadding-topを詰める
	const modalFooter = modal.querySelector('.modal-footer');
	if (modalFooter) {
		modalFooter.style.paddingTop = '4px';
	}

	// 組み立て
	// mainWrapper を 2列グリッドに変更
	// 左列: チェックボックス行（上）＋ RST入力行（下）
	// 右列: Submitボタン（上）＋ HAMLOG転送ボタン（下）
	mainWrapper.style.cssText = `
		display: grid;
		grid-template-columns: auto ${BTN_WIDTH};
		grid-template-rows: auto auto;
		gap: 6px 10px;
		margin-top: 0px;
		margin-left: auto;
		margin-right: 15px;
		width: fit-content;
		align-items: center;
	`;

	// チェックボックス行（上段左）
	const cbRow = document.createElement('div');
	cbRow.style.cssText = 'display: flex; flex: 1; gap: 10px; align-items: center; justify-content: center; margin-bottom: 16px;';
	cbRow.appendChild(cqSet.box);
	cbRow.appendChild(cb1Set.box);
	cbRow.appendChild(cb2Set.box);

	// mainWrapper は縦積みのflexに戻す
	mainWrapper.style.cssText = `
		display: flex;
		flex-direction: column;
		gap: 0px;
		margin-top: 0;
		margin-left: auto;
		margin-right: 15px;
		width: fit-content;
		align-items: stretch;
	`;

	// insertBefore は submitBtn を upperRow に移す前に実行する
	submitBtn.parentNode.insertBefore(mainWrapper, submitBtn);

	// 上段: チェックボックス行 ＋ Submitボタン（右寄せ）
	const upperRow = document.createElement('div');
	upperRow.style.cssText = `
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 10px;
	`;
	upperRow.appendChild(cbRow);
	upperRow.appendChild(submitBtn);

	// 下段: His/My ＋ HAMLOG転送ボタン（旧subContainerと同一構造）
	const lowerRow = document.createElement('div');
	lowerRow.style.cssText = 'display: flex; gap: 15px; align-items: flex-end; margin-top: -12px;';
	lowerRow.appendChild(hisSet.box);
	lowerRow.appendChild(mySet.box);
	lowerRow.appendChild(btn);

	mainWrapper.appendChild(upperRow);
	mainWrapper.appendChild(lowerRow);
}

function checkBridgeStatus(button) {
	const check = () => {
		fetch('http://localhost:5000/health')
			.then(res => res.json())
			.then(json => {
				if (json.status === "running") {
					button.disabled = false;
					button.innerText = 'HAMLOG転送';
					button.style.backgroundColor = '#0d6efd';
					button.style.cursor = 'pointer';
				}
			})
			.catch(() => {
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
	setTimeout(() => { toast.style.opacity = '1'; }, 10);
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
