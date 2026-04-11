#!/usr/bin/env python3
"""
Print server dùng python-escpos
Nhận lệnh in từ React/Vercel app và in trực tiếp qua mạng LAN

Cài thư viện: pip install python-escpos
Chạy:         python scripts/print-server.py
              hoặc: npm run print-server
"""

import json
import socket
from http.server import BaseHTTPRequestHandler, HTTPServer
from datetime import datetime
from escpos.printer import Network

# ── Cấu hình ──────────────────────────────────────────────────────────────────
PRINTER_IP   = "192.168.123.100"
HTTP_PORT    = 3001

# Đặt True nếu máy in không hiển thị được tiếng Việt (in ký tự lỗi)
USE_ASCII_FALLBACK = False

# ── Helper ────────────────────────────────────────────────────────────────────
def to_ascii(text):
    """Bỏ dấu tiếng Việt nếu máy in không hỗ trợ UTF-8"""
    import unicodedata
    text = text.replace("đ", "d").replace("Đ", "D")
    return ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )

def t(text):
    return to_ascii(text) if USE_ASCII_FALLBACK else text

def fmt(n):
    """62000 → '62.000'"""
    try:
        return f"{int(round(float(n or 0))):,}".replace(",", ".")
    except Exception:
        return "0"

LINE_WIDTH = 48

def pad_row(left, right, width=LINE_WIDTH):
    gap = width - len(left) - len(right)
    return left + " " * max(1, gap) + right

# ── Hàm in chính ─────────────────────────────────────────────────────────────
def do_print(data):
    p = Network(PRINTER_IP, timeout=5)

    shop_name  = data.get("shopName", "")
    tagline    = data.get("tagline", "")
    address    = data.get("address", "")
    phone      = data.get("phone", "")
    wifi_name  = data.get("wifiName", "")
    wifi_pass  = data.get("wifiPass", "")
    table_label = data.get("tableLabel", "")
    open_time  = data.get("openTime", "")
    print_time = data.get("printTime", "")
    items      = data.get("items", [])
    total      = data.get("total", 0)

    # ── Header ──
    p.set(align="center", bold=True, double_height=True, double_width=True)
    p.textln(t(shop_name))
    p.set(align="center", bold=False, double_height=False, double_width=False)
    if tagline:
        p.textln(t(tagline))
    if address:
        p.textln(t(address))
    if phone:
        p.textln(t("Tel: " + phone))
    p.ln()

    # ── Tiêu đề hóa đơn ──
    p.set(align="center", bold=True, double_height=True)
    p.textln(t("HÓA ĐƠN THANH TOÁN"))
    p.set(align="left", bold=False, double_height=False)

    # ── Thông tin bàn / giờ ──
    p.textln("-" * LINE_WIDTH)
    p.textln(t(pad_row("Tại bàn:", table_label)))
    p.textln(t(pad_row("Giờ vào: " + open_time, "In: " + print_time)))

    # ── Bảng món ──
    C_NAME  = 22
    C_PRICE =  9
    C_QTY   =  4
    C_TOTAL = LINE_WIDTH - C_NAME - C_PRICE - C_QTY  # 13

    def table_row(name_raw, price_str, qty_str, total_str):
        n = name_raw[:C_NAME].ljust(C_NAME)
        line = (n
                + price_str.rjust(C_PRICE)
                + qty_str.rjust(C_QTY)
                + total_str.rjust(C_TOTAL))
        p.textln(t(line))

    p.textln("-" * LINE_WIDTH)
    table_row("Mặt hàng", "Đ.Giá", "SL", "T.Tiền")
    p.textln("-" * LINE_WIDTH)

    for i, item in enumerate(items):
        name       = f"{i+1}. {item.get('name', 'Món khác')}"
        price      = fmt(item.get("price", 0)) if item.get("price") else "-"
        qty        = str(item.get("quantity", 1))
        item_total = fmt((item.get("price") or 0) * item.get("quantity", 1))
        table_row(name, price, qty, item_total)

    p.textln("-" * LINE_WIDTH)

    # ── Tổng tiền ──
    total_items = sum(item.get("quantity", 0) for item in items)
    p.textln(t(pad_row(f"Tiền hàng ({total_items})", fmt(total))))
    p.textln("=" * LINE_WIDTH)

    p.set(bold=True, double_height=True, double_width=True)
    half = LINE_WIDTH // 2
    p.textln(t("THANH TOAN") + fmt(total).rjust(half - 10) + t("d"))
    p.set(bold=False, double_height=False, double_width=False)

    p.textln(t(pad_row("Tiền mặt", fmt(total))))
    p.textln("-" * LINE_WIDTH)

    # ── Footer ──
    p.set(align="center", bold=True)
    p.textln(t("Cảm ơn quý khách và hẹn gặp lại"))
    p.set(bold=False)
    p.textln(t(f"Wifi: {wifi_name}    Pass: {wifi_pass}"))

    # ── Cắt giấy ──
    p.ln(3)
    p.cut()
    p.close()

# ── HTTP Server ───────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # tắt log mặc định

    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/ping":
            self.send_response(200)
            self.send_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "printer": PRINTER_IP}).encode())

    def do_POST(self):
        if self.path != "/print":
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", 0))
        body   = self.rfile.read(length)

        try:
            data = json.loads(body)
            do_print(data)
            now = datetime.now().strftime("%H:%M:%S")
            print(f"[{now}] ✓ In thành công: {data.get('tableLabel', '')}")
            self.send_response(200)
            self.send_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode())
        except Exception as e:
            now = datetime.now().strftime("%H:%M:%S")
            print(f"[{now}] ✗ Lỗi in: {e}")
            self.send_response(500)
            self.send_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())


def get_local_ips():
    ips = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None):
            ip = info[4][0]
            if ip.startswith(("192.", "10.", "172.")):
                ips.append(ip)
    except Exception:
        pass
    return list(set(ips))


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", HTTP_PORT), Handler)
    local_ips = get_local_ips()

    print("─" * 50)
    print(f"🖨️  Print server đang chạy tại:")
    print(f"   http://localhost:{HTTP_PORT}  (PC này)")
    for ip in local_ips:
        print(f"   http://{ip}:{HTTP_PORT}  (điện thoại trên WiFi)")
    print(f"📍 Máy in: {PRINTER_IP}")
    print(f"📝 Tiếng Việt: {'ASCII' if USE_ASCII_FALLBACK else 'UTF-8'}")
    print("─" * 50)
    print("Đang chờ lệnh in...\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng print server.")
