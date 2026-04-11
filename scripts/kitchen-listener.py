#!/usr/bin/env python3
"""
Kitchen Auto-Print Listener
============================
Chay tren PC tai quan - lang nghe Firestore, tu dong in phieu bep khi co don moi.
Khong can dien thoai goi den print server.

Cai dat:
  pip install firebase-admin python-escpos

Chay:
  python scripts/kitchen-listener.py

Can file serviceAccountKey.json tu Firebase Console:
  Firebase Console -> Project Settings -> Service accounts -> Generate new private key
  Luu file vao: scripts/serviceAccountKey.json
"""

import json
import time
import threading
from datetime import datetime, timezone
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore
from escpos.printer import Network

# ── Cau hinh ──────────────────────────────────────────────────────────────────
PRINTER_IP          = "192.168.1.234"
SERVICE_ACCOUNT_KEY = Path(__file__).parent / "serviceAccountKey.json"

# Dat True neu may in in ra ky tu loi (khong ho tro UTF-8)
USE_ASCII_FALLBACK = False

LINE_WIDTH = 48

# ── Helper ────────────────────────────────────────────────────────────────────
def log(msg):
    t = datetime.now().strftime("%H:%M:%S")
    print(f"[{t}] {msg}", flush=True)

def to_ascii(text):
    import unicodedata
    text = text.replace("d\u0111", "d").replace("\u0110", "D")
    return ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )

def t(text):
    return to_ascii(str(text)) if USE_ASCII_FALLBACK else str(text)

def fmt_time(ts):
    """Chuyen Firestore timestamp thanh chuoi gio:phut ngay/thang"""
    if ts is None:
        return datetime.now().strftime("%H:%M %d/%m")
    try:
        dt = ts.astimezone()
        return dt.strftime("%H:%M %d/%m")
    except Exception:
        return datetime.now().strftime("%H:%M %d/%m")

# ── In phieu bep ──────────────────────────────────────────────────────────────
def print_kitchen_ticket(table_label, order_time, item_name, quantity, note=""):
    """In 1 phieu cho 1 mon an"""
    try:
        p = Network(PRINTER_IP, timeout=5)

        p.set(align="center", bold=False, double_height=False, double_width=False)
        p.textln("=" * LINE_WIDTH)

        # Thoi gian
        p.set(align="center")
        p.textln(t(order_time))

        # Ten ban - chu to
        p.set(align="center", bold=True, double_height=True, double_width=True)
        p.textln(t(table_label))
        p.set(bold=False, double_height=False, double_width=False)

        p.set(align="left")
        p.textln("-" * LINE_WIDTH)

        # Ten mon - chu cao
        p.set(align="left", bold=True, double_height=True)
        p.textln(t(item_name))
        p.set(bold=False, double_height=False)

        # So luong - chu to, can phai
        p.set(align="right", bold=True, double_height=True, double_width=True)
        p.textln(f"SL: {quantity}")
        p.set(bold=False, double_height=False, double_width=False)

        if note:
            p.set(align="left")
            p.textln("-" * LINE_WIDTH)
            p.textln(t(f"Ghi chu: {note}"))

        p.set(align="left")
        p.textln("=" * LINE_WIDTH)
        p.ln(2)
        p.cut()
        p.close()
        return True
    except Exception as e:
        log(f"  [LOI IN] {e}")
        return False

# ── Lay ten mon tu orderItems cache ───────────────────────────────────────────
_order_items_cache = {}

def load_order_items(db):
    """Tai toan bo orderItems vao cache"""
    global _order_items_cache
    docs = db.collection("orderItems").stream()
    _order_items_cache = {doc.id: doc.to_dict() for doc in docs}
    log(f"Da tai {len(_order_items_cache)} orderItems vao cache")

def get_item_name(order_item_id, db):
    if order_item_id in _order_items_cache:
        return _order_items_cache[order_item_id].get("name", "Mon khac")
    # Thu doc truc tiep neu chua co trong cache
    doc = db.collection("orderItems").document(order_item_id).get()
    if doc.exists:
        data = doc.to_dict()
        _order_items_cache[order_item_id] = data
        return data.get("name", "Mon khac")
    return "Mon khac"

# ── Xu ly don moi ─────────────────────────────────────────────────────────────
_printed_bills = set()  # Luu cac bill da in de tranh in lai

def handle_new_bill(doc_snapshot, db):
    """Goi khi co bill moi hoac bill duoc cap nhat"""
    bill_id = doc_snapshot.id
    data    = doc_snapshot.to_dict()

    if not data:
        return

    # Chi xu ly don moi tao (khong xu ly cap nhat thanh toan v.v.)
    if bill_id in _printed_bills:
        return

    status = data.get("status", "")
    if status not in ("pending",):
        return

    # Kiem tra bill nay moi tao chua (trong vong 30 giay)
    created_at = data.get("createdAt")
    if created_at:
        try:
            now_utc = datetime.now(timezone.utc)
            bill_time = created_at.astimezone(timezone.utc)
            age_seconds = (now_utc - bill_time).total_seconds()
            if age_seconds > 30:
                # Bill cu (truoc khi script chay) - bo qua
                _printed_bills.add(bill_id)
                return
        except Exception:
            pass

    _printed_bills.add(bill_id)

    # Xac dinh ten ban
    is_takeaway     = data.get("isTakeaway", False)
    takeaway_number = data.get("takeawayNumber")
    table_number    = data.get("tableNumber", "?")
    if is_takeaway and takeaway_number:
        table_label = f"Mang ve #{takeaway_number}"
    else:
        table_label = f"Ban {table_number}"

    order_time = fmt_time(data.get("createdAt"))
    items      = data.get("items", [])

    log(f"Don moi: {table_label} - {len(items)} mon")

    # In tung mon
    success_count = 0
    for item in items:
        order_item_id = item.get("orderItemId")
        quantity      = item.get("quantity", 1)
        note          = item.get("note", "")

        if order_item_id:
            item_name = get_item_name(order_item_id, db)
        else:
            item_name = item.get("customDescription", "Mon khac")

        ok = print_kitchen_ticket(table_label, order_time, item_name, quantity, note)
        if ok:
            success_count += 1
            log(f"  [{success_count}] {item_name} x{quantity} - OK")
        else:
            log(f"  LOI khi in: {item_name} x{quantity}")

    log(f"Xong: {table_label} - {success_count}/{len(items)} phieu in thanh cong")

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    # Kiem tra service account key
    if not SERVICE_ACCOUNT_KEY.exists():
        print(f"""
[LOI] Khong tim thay file: {SERVICE_ACCOUNT_KEY}

Huong dan lay service account key:
  1. Vao Firebase Console: https://console.firebase.google.com
  2. Chon project CaMauQuan
  3. Project Settings (bieu tuong rang cua) -> Service accounts
  4. Nhan "Generate new private key" -> tai file JSON
  5. Doi ten thanh: serviceAccountKey.json
  6. Dat vao thu muc: {SERVICE_ACCOUNT_KEY.parent}
""")
        return

    # Ket noi Firebase
    log("Dang ket noi Firebase...")
    cred = credentials.Certificate(str(SERVICE_ACCOUNT_KEY))
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    log("Ket noi Firebase thanh cong")

    # Tai orderItems cache
    load_order_items(db)

    # Lang nghe bills collection
    log(f"Bat dau lang nghe don hang moi...")
    log(f"May in: {PRINTER_IP}")
    log("=" * 50)

    def on_snapshot(col_snapshot, changes, read_time):
        for change in changes:
            if change.type.name == "ADDED":
                try:
                    handle_new_bill(change.document, db)
                except Exception as e:
                    log(f"Loi xu ly don: {e}")

    # Dang ky listener tren collection bills
    col_ref = db.collection("bills")
    col_ref.on_snapshot(on_snapshot)

    # Giu script chay mai mai
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log("Da dung lang nghe.")

if __name__ == "__main__":
    main()
