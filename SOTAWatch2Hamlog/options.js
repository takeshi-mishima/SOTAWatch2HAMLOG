document.addEventListener('DOMContentLoaded', () => {
  // 保存された設定を読み込む
  chrome.storage.local.get([
    'targetLog', 'timeMode', 'timeDeviationThreshold',
    'remarks1Format', 'remarks1Overwrite',
    'remarks2Format', 'remarks2Overwrite'
  ], (items) => {
    if (items.targetLog) document.getElementById('targetLog').value = items.targetLog;
    if (items.timeMode)  document.getElementById('timeMode').value  = items.timeMode;
    document.getElementById('timeDeviationThreshold').value =
      (items.timeDeviationThreshold !== undefined) ? items.timeDeviationThreshold : 3;

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
    let threshold = parseInt(document.getElementById('timeDeviationThreshold').value, 10);
    if (isNaN(threshold) || threshold < 0) threshold = 3;

    chrome.storage.local.set({
      targetLog:        document.getElementById('targetLog').value,
      timeMode:         document.getElementById('timeMode').value,
      timeDeviationThreshold: threshold,
      remarks1Format:   document.getElementById('remarks1Format').value,
      remarks1Overwrite: document.getElementById('remarks1Overwrite').checked,
      remarks2Format:   document.getElementById('remarks2Format').value,
      remarks2Overwrite: document.getElementById('remarks2Overwrite').checked,
    }, () => {
      alert('設定を保存しました。Ctrl+F5でページを更新すると反映されます。');
    });
  });
});
