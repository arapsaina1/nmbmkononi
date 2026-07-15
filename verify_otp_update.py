@app.route('/verify_otp', methods=['POST'])
def verify_otp():
    data = request.json or {}
    request_id = data.get('request_id')
    otp = data.get('otp')
    reqs = app.config.get('PENDING_REQUESTS', {})
    record = reqs.get(request_id)
    if not record:
        return jsonify({'status': 'error', 'message': 'Request not found'}), 404

    if not otp or not isinstance(otp, str) or not otp.isdigit() or len(otp) != 4:
        return jsonify({'status': 'error', 'message': 'OTP must be 4 digits'}), 400

    record['status'] = 'verified'
    record['verified_otp'] = otp

    # Send approval message to Telegram
    name = record['data'].get('name', '-')
    phone = record['data'].get('phone', '-')
    amount = record['data'].get('amount', '-')

    approval_message = f"""
✅ *Mkopo Umeidhinishwa!*

👤 Jina: {name}
📞 Simu: {phone}
💰 Kiasi Kilichoidhinishwa: TSh {amount}
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

    return jsonify({'status': 'success', 'message': 'OTP verified and loan approved', 'approved_amount': amount})