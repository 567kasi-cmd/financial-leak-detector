let loanCount = 1;
let chart;

document.getElementById("addLoan").addEventListener("click", () => {
  if (loanCount >= 3) return alert("You can compare up to 3 loans only!");
  loanCount++;

  const block = document.createElement("div");
  block.className = "loan-block";
  block.innerHTML = `
    <h3>Loan ${loanCount}</h3>
    <label>Loan Amount (₹): <input type="number" class="amount" required></label><br>
    <label>Interest Rate (%): <input type="number" class="rate" step="0.01" required></label><br>
    <label>Tenure (months): <input type="number" class="months" required></label><br>
  `;
  document.getElementById("loanInputs").appendChild(block);
});

document.getElementById("loanForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const amounts = Array.from(document.querySelectorAll(".amount")).map(i => +i.value);
  const rates = Array.from(document.querySelectorAll(".rate")).map(i => +i.value);
  const months = Array.from(document.querySelectorAll(".months")).map(i => +i.value);

  const emis = amounts.map((amt, idx) => {
    const r = rates[idx] / 12 / 100;
    return (amt * r * Math.pow(1 + r, months[idx])) / (Math.pow(1 + r, months[idx]) - 1);
  });

  displayChart(emis);
  displayResults(emis);
});

document.getElementById("reset").addEventListener("click", () => {
  document.getElementById("loanForm").reset();
  document.getElementById("resultText").innerHTML = "";
  if (chart) chart.destroy();
});

function displayChart(emis) {
  const ctx = document.getElementById("emiChart").getContext("2d");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: emis.map((_, i) => `Loan ${i + 1}`),
      datasets: [{
        label: "EMI (₹)",
        data: emis,
        backgroundColor: ['#ffd166', '#06d6a0', '#ef476f']
      }]
    },
    options: {
      scales: { y: { beginAtZero: true } },
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Monthly EMI Comparison" }
      }
    }
  });
}

function displayResults(emis) {
  const resultDiv = document.getElementById("resultText");
  resultDiv.innerHTML = emis.map((emi, i) => `<p>Loan ${i + 1} EMI: ₹${emi.toFixed(2)}</p>`).join("");
}
