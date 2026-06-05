document.addEventListener('DOMContentLoaded', () => {
  // 保存された設定を読み込む
  chrome.storage.local.get([
    'targetLog', 'timeMode',
    'remarks1Format', 'remarks1Overwrite',
    'remarks2Format', 'remarks2Overwrite'
  ], (items) => {
    if (items.targetLog) document.getElementById('targetLog').value = items.targetLog;
    if (items.timeMode)  document.getElementById('timeMode').value  = items.timeMode;

    // Remarks1
    if (items.remarks1Format !== undefined)
      document.getElementById('remarks1Format').value = items.remarks1Format;
    document.getElementById('remarks1Overwrite').checked = !!items.remarks1Overwrite;

    // Remarks2
    if (items.remarks2Format !== undefined)
      document.getElementById('remarks2Format').value = items.remarks2Format;
    document.getElementById('remarks2Overwrite').checked = !!items.remarks2Overwrite;
  });

  // 保存ボタン
  document.getElementById('save').addEventListener('click', () => {
    chrome.storage.local.set({
      targetLog:        document.getElementById('targetLog').value,
      timeMode:         document.getElementById('timeMode').value,
      remarks1Format:   document.getElementById('remarks1Format').value,
      remarks1Overwrite: document.getElementById('remarks1Overwrite').checked,
      remarks2Format:   document.getElementById('remarks2Format').value,
      remarks2Overwrite: document.getElementById('remarks2Overwrite').checked,
    }, () => {
      alert('設定を保存しました。Ctrl+F5でページを更新すると反映されます。');
    });
  });
});
