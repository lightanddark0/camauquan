const _printIp = import.meta.env.VITE_PRINT_SERVER_IP
  || localStorage.getItem('printServerIp')
  || '192.168.1.234';

const KITCHEN_URL = `http://${_printIp}:3001/print-kitchen`;

/**
 * In phiếu bếp — mỗi món 1 phiếu, tự cắt giấy.
 * Non-blocking: lỗi chỉ log, không ảnh hưởng đặt món.
 *
 * @param {string} tableLabel  "Bàn 3" | "Mang về #2"
 * @param {Array}  items       [{ name, quantity, note? }]
 */
export async function printKitchenTickets(tableLabel, items) {
  if (!items?.length) return;

  const now = new Date();
  const time = now.toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit',
  });

  try {
    const res = await fetch(KITCHEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        tableLabel,
        time,
        items: items.map(it => ({
          name: it.name || 'Món khác',
          quantity: it.quantity || 1,
          note: it.note || '',
        })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[KitchenPrint] Lỗi server:', err.error);
    }
  } catch {
    console.warn('[KitchenPrint] Không kết nối được print server');
  }
}
