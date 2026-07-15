const MIN_LOAN = 500000;
const MAX_LOAN = 50000000;
const APR = 0.12;
const loanRange = document.getElementById('loanRange');
const loanAmountInput = document.getElementById('loanAmountInput');
const loanAmountDisplay = document.getElementById('loanAmountDisplay');
const loanTerm = document.getElementById('loanTerm');
const monthlyPayment = document.getElementById('monthlyPayment');
const totalPayment = document.getElementById('totalPayment');

function formatCurrency(value) {
  return 'TSh ' + Number(value).toLocaleString('en-TZ');
}

function calculateLoan() {
  const principal = Math.max(MIN_LOAN, Math.min(MAX_LOAN, Number(loanAmountInput.value) || MIN_LOAN));
  const months = Number(loanTerm.value);
  const monthlyRate = APR / 12;
  const payment = principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
  const total = payment * months;

  monthlyPayment.textContent = formatCurrency(payment.toFixed(0));
  totalPayment.textContent = formatCurrency(total.toFixed(0));
  aprRate.textContent = '12%';
}

function syncInputs(value) {
  loanRange.value = value;
  loanAmountInput.value = value;
  loanAmountDisplay.textContent = formatCurrency(value);
}

loanRange.addEventListener('input', (event) => {
  const value = Number(event.target.value);
  syncInputs(value);
  calculateLoan();
});

loanAmountInput.addEventListener('input', (event) => {
  let value = Number(event.target.value);
  if (value < MIN_LOAN) value = MIN_LOAN;
  if (value > MAX_LOAN) value = MAX_LOAN;
  syncInputs(value);
  calculateLoan();
});

loanTerm.addEventListener('change', calculateLoan);

window.addEventListener('DOMContentLoaded', () => {
  syncInputs(MIN_LOAN);
  calculateLoan();

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href');
      if (targetId.startsWith('#')) {
        const target = document.querySelector(targetId);
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  const observers = document.querySelectorAll('[data-animate]');
  const intersection = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        intersection.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  observers.forEach((node) => intersection.observe(node));
});
