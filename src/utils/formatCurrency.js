// Định dạng tiền tệ Euro (€) theo chuẩn de-DE.
// Ví dụ: 1234.5 -> "1.234,50 €"
export const formatCurrency = (amount) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount || 0)
