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

  const resultContainer = document.getElementById("result");
  resultContainer.innerHTML = '';

  const emiSummary = document.createElement('p');
  emiSummary.textContent = `Your Monthly EMI: ${formatCurrency(emi)}`;

  const title = document.createElement('h3');
  title.textContent = 'Amortization Schedule';

  const tableContainer = document.createElement('div');
  tableContainer.className = 'table-container';

  const table = document.createElement('table');
  table.className = 'amortization-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Month', 'EMI', 'Principal', 'Interest', 'Balance'].forEach(label => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement('tbody');
  const fragment = document.createDocumentFragment();

  schedule.forEach((row) => {
    const tr = document.createElement('tr');

    const monthCell = document.createElement('td');
    monthCell.textContent = row.month;

    const emiCell = document.createElement('td');
    emiCell.className = 'currency';
    emiCell.textContent = formatCurrency(row.emi);

    const principalCell = document.createElement('td');
    principalCell.className = 'currency principal';
    principalCell.textContent = formatCurrency(row.principal);

    const interestCell = document.createElement('td');
    interestCell.className = 'currency interest';
    interestCell.textContent = formatCurrency(row.interest);

    const balanceCell = document.createElement('td');
    balanceCell.className = 'currency balance';
    balanceCell.textContent = formatCurrency(row.balance);

    tr.appendChild(monthCell);
    tr.appendChild(emiCell);
    tr.appendChild(principalCell);
    tr.appendChild(interestCell);
    tr.appendChild(balanceCell);

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  table.appendChild(thead);
  table.appendChild(tbody);
  tableContainer.appendChild(table);

  resultContainer.appendChild(emiSummary);
  resultContainer.appendChild(title);
  resultContainer.appendChild(tableContainer);
});
