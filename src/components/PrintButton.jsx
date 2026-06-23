// Nút in phiếu — gọi window.print(). CSS @media print (trong index.css)
// sẽ ẩn nav/buttons/toast và chỉ giữ lại nội dung phiếu.
function PrintButton({ label = 'In phiếu' }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded hover:bg-blue-700"
    >
      <span aria-hidden="true">🖨️</span>
      {label}
    </button>
  )
}

export default PrintButton
