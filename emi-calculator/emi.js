document.getElementById("emiForm")?.addEventListener("submit", function(e) {
  e.preventDefault();

  let P = parseFloat(document.getElementById("amount").value);
  let R = parseFloat(document.getElementById("rate").value);
  let N = parseInt(document.getElementById("months").value);

  if (!P || !R || !N) {
    document.getElementById("result").innerText = "Please fill all fields correctly.";
    return;
  }

  let monthlyRate = R / 12 / 100;
  let emi = (P * monthlyRate * Math.pow(1 + monthlyRate, N)) / (Math.pow(1 + monthlyRate, N) - 1);

  // Generate amortization schedule
  let balance = P;
  let schedule = [];
  for (let month = 1; month <= N; month++) {
    let interest = balance * monthlyRate;
    let principal = emi - interest;
    balance -= principal;
    // Ensure balance doesn't go negative due to rounding
    if (balance < 0) balance = 0;
    schedule.push({
      month: month,
      emi: emi,
      principal: principal,
      interest: interest,
      balance: balance
    });
  }

  // Function to format currency
  function formatCurrency(amount) {
    return '₹' + amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }

  // Display EMI and amortization table
  let resultHTML = `Your Monthly EMI: ${formatCurrency(emi)}<br><br>`;
  resultHTML += `<h3>Amortization Schedule</h3>`;
  resultHTML += `<button id="toggleSchedule" style="margin-bottom:10px; padding:8px 16px; background-color:#007bff; color:white; border:none; border-radius:4px; cursor:pointer;">View Full Schedule</button>`;
  resultHTML += `<div style="max-height:400px; overflow-y:auto; border:1px solid #ddd;">`;
  resultHTML += `<table style="width:100%; border-collapse:collapse;">`;
  resultHTML += `<thead style="position:sticky; top:0; background-color:#f2f2f2; z-index:1;"><tr>`;
  resultHTML += `<th style="border:1px solid #ddd; padding:8px; text-align:left;">Month</th>`;
  resultHTML += `<th style="border:1px solid #ddd; padding:8px; text-align:right;">EMI</th>`;
  resultHTML += `<th style="border:1px solid #ddd; padding:8px; text-align:right;">Principal</th>`;
  resultHTML += `<th style="border:1px solid #ddd; padding:8px; text-align:right;">Interest</th>`;
  resultHTML += `<th style="border:1px solid #ddd; padding:8px; text-align:right;">Balance</th>`;
  resultHTML += `</tr></thead>`;
  resultHTML += `<tbody>`;
  schedule.forEach((row, index) => {
    let rowStyle = index % 2 === 0 ? 'background-color:#ffffff;' : 'background-color:#f9f9f9;';
    let isHidden = row.month > 12 && row.month <= N - 12;
    if (isHidden) {
      rowStyle += ' display:none;';
    }
    resultHTML += `<tr style="${rowStyle}" class="${isHidden ? 'hidden-row' : ''}">`;
    resultHTML += `<td style="border:1px solid #ddd; padding:8px; text-align:left;">${row.month}</td>`;
    resultHTML += `<td style="border:1px solid #ddd; padding:8px; text-align:right;">${formatCurrency(row.emi)}</td>`;
    resultHTML += `<td style="border:1px solid #ddd; padding:8px; text-align:right; color:#28a745; font-weight:bold;">${formatCurrency(row.principal)}</td>`;
    resultHTML += `<td style="border:1px solid #ddd; padding:8px; text-align:right; color:#dc3545; font-weight:bold;">${formatCurrency(row.interest)}</td>`;
    resultHTML += `<td style="border:1px solid #ddd; padding:8px; text-align:right; font-weight:bold;">${formatCurrency(row.balance)}</td>`;
    resultHTML += `</tr>`;
  });
  resultHTML += `</tbody></table>`;
  resultHTML += `</div>`;

  document.getElementById("result").innerHTML = resultHTML;

  // Add toggle functionality
  document.getElementById("toggleSchedule").addEventListener("click", function() {
    const hiddenRows = document.querySelectorAll(".hidden-row");
    const isHidden = hiddenRows.length > 0 && hiddenRows[0].style.display === "none";
    hiddenRows.forEach(row => {
      row.style.display = isHidden ? "table-row" : "none";
    });
    this.textContent = isHidden ? "View Partial Schedule" : "View Full Schedule";
  });
});
