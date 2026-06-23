// Xuất dữ liệu ra file CSV (thuần JS, không thư viện ngoài).
//
// filename: tên file tải về (kèm .csv)
// headers:  mảng tên cột, vd ['Sản phẩm', 'SKU']
// rows:     mảng các mảng dữ liệu, vd [['Thịt bò', 'NVL-001'], ...]

// Bọc 1 giá trị theo chuẩn CSV: escape dấu " và bọc trong "..." nếu cần.
function escapeCell(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function exportToCsv(filename, headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','))
  // BOM UTF-8 (﻿) để Excel đọc đúng tiếng Việt
  const content = '﻿' + lines.join('\r\n')

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
