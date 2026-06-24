import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

// Capture một element theo id thành canvas (scale 2 cho nét).
async function captureCanvas(elementId) {
  const el = document.getElementById(elementId)
  if (!el) throw new Error(`Không tìm thấy element #${elementId} để xuất.`)
  return html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
  })
}

function triggerDownload(href, filename) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Xuất element ra ảnh PNG.
export async function exportAsImage(elementId, filename) {
  const canvas = await captureCanvas(elementId)
  triggerDownload(canvas.toDataURL('image/png'), filename)
}

// Xuất element ra PDF (A4 dọc, ảnh canvas fit theo chiều rộng trang).
export async function exportAsPDF(elementId, filename) {
  const canvas = await captureCanvas(elementId)
  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const usableWidth = pageWidth - margin * 2

  const imgWidth = usableWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  // Nếu cao hơn 1 trang: chia nhiều trang
  let heightLeft = imgHeight
  let position = margin
  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
  heightLeft -= pageHeight - margin * 2

  while (heightLeft > 0) {
    pdf.addPage()
    position = margin - (imgHeight - heightLeft)
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
    heightLeft -= pageHeight - margin * 2
  }

  pdf.save(filename)
}
