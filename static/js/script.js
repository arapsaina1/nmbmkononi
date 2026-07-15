const menuButton = document.getElementById("menuButton");
const mobileMenu = document.getElementById("mobileMenu");
menuButton?.addEventListener("click", () => {
  mobileMenu.classList.toggle("hidden");
});

const loanRange = document.getElementById("loanRange");
const loanAmount = document.getElementById("loanAmount");
const monthlyPayment = document.getElementById("monthlyPayment");
const totalPayment = document.getElementById("totalPayment");

const formatTsh = (value) => {
  return "TSh " + Number(value).toLocaleString("en-US");
};

const calculateLoan = (amount) => {
  const apr = 0.12;
  const months = 12;
  const monthlyRate = apr / 12;
  const payment = (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  const total = payment * months;
  monthlyPayment.textContent = formatTsh(Math.round(payment));
  totalPayment.textContent = formatTsh(Math.round(total));
  loanAmount.textContent = formatTsh(amount);
};

loanRange?.addEventListener("input", (event) => {
  const value = Number(event.target.value);
  calculateLoan(value);
});

if (loanRange) {
  calculateLoan(Number(loanRange.value));
}

const animateElements = document.querySelectorAll("[data-animate]");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("animate-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.2 }
);

animateElements.forEach((el) => observer.observe(el));
