from escpos.printer import Network

p = Network("192.168.123.100", timeout=5)  # IP của máy in LAN
# p = Usb(0x0416, 0x5011)           # nếu muốn in qua USB (thay VID/PID nếu cần)

p.text("Hello! In tu dong tu code\n")
p.text("Ngày: " + "11/04/2026\n")
p.cut()          # Cắt giấy
p.close()