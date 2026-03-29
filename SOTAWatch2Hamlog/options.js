document.addEventListener('DOMContentLoaded', () => {
  // 保存された設定を読み込む
  chrome.storage.local.get(['targetLog', 'timeMode', 'targetRemarks', 'summitFormat'], (items) => {
    if (items.targetLog) document.getElementById('targetLog').value = items.targetLog;
    if (items.timeMode) document.getElementById('timeMode').value = items.timeMode;
    if (items.targetRemarks) document.getElementById('targetRemarks').value = items.targetRemarks;
    if (items.summitFormat) document.getElementById('summitFormat').value = items.summitFormat;
  });

  // 保存ボタン
  document.getElementById('save').addEventListener('click', () => {
    chrome.storage.local.set({
      targetLog: document.getElementById('targetLog').value,
      timeMode: document.getElementById('timeMode').value,
      targetRemarks: document.getElementById('targetRemarks').value,
      summitFormat: document.getElementById('summitFormat').value
    }, () => {
      alert('設定を保存しました。Ctrl+F5でページを更新すると反映されます。');
    });
  });
});