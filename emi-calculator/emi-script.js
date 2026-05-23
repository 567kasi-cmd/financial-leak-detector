import { calculateHypotheticalPrepaymentImpact, calculateSmartPrepaymentAdvisor } from '../calculations.js';
import { simulateLoan } from '../loanSimulator.js';
import { validateLoanInputs, validatePrepaymentInputs, validateHypotheticalPrepayment } from '../validation.js';
import { attachSyncedSlider, debounce, formatCurrency, formatDate, setButtonLoading } from '../shared.js';

const presets={home:{rate:8.5,years:20,months:0,amount:5000000},car:{rate:9.25,years:5,months:0,amount:800000},personal:{rate:13.5,years:3,months:0,amount:500000},education:{rate:10.25,years:7,months:0,amount:1200000},business:{rate:14.5,years:10,months:0,amount:2500000}};
let emiPieChartInstance,principalInterestChartInstance,balanceOverTimeChartInstance,lastSimulationResult=null,hasRenderedOnce=false,hypotheticalAmountInput,hypotheticalDateInput,applyWhatIfToPlanCheckbox;
const uiState={tenureYears:0,tenureMonthsInput:0,userEnteredTenureYears:0,userEnteredTenureMonths:0,tenureTouched:false};
let suspendTenureTracking=false;
let hypotheticalScenario='reduce-tenure';

const $=id=>document.getElementById(id);
const fmtTenure=m=>{const n=Math.max(0,Math.round(Number(m)||0));return `${Math.floor(n/12)}y ${n%12}m`;};
const setText=(id,v,html=false)=>{const el=$(id); if(!el)return; html?el.innerHTML=v:el.textContent=v;};
const normalizeInput=input=>{if(input&&input.value.trim()!==''){const v=Math.round(Number(input.value)); if(Number.isFinite(v)) input.value=String(v);}};
const monthlyIncomeValue=()=>{const raw=$('monthly-income')?.value; return raw?Math.round(parseFloat(raw)):null;};

function init(){
  const form=$('emi-form');
  const prepaymentsList=$('prepayments-list');
  const addPrepaymentBtn=$('add-prepayment');
  const tenureYearsInput=$('loan-tenure-years');
  const tenureMonthsInput=$('loan-tenure-months');
  hypotheticalAmountInput=$('hypothetical-prepayment-amount');
  hypotheticalDateInput=$('hypothetical-prepayment-date');
  form.addEventListener('submit',onSubmit);
  addPrepaymentBtn.addEventListener('click',()=>addPrepaymentInput());
  prepaymentsList.addEventListener('click',onPrepaymentClick);
  prepaymentsList.addEventListener('input',debounce(onAdvisorInputChange,150));
  [['loan-amount',{min:50000,max:50000000,step:50000,defaultValue:5000000,formatter:v=>formatCurrency(v,0,0),parser:v=>Math.round(Number(v))}],['interest-rate',{min:0,max:20,step:0.1,defaultValue:8.5,formatter:v=>`${v}%`}],['loan-tenure-years',{min:0,max:50,step:1,defaultValue:20,formatter:v=>`${v}y`,parser:v=>Math.round(Number(v))}],['loan-tenure-months',{min:0,max:11,step:1,defaultValue:0,formatter:v=>`${v}m`,parser:v=>Math.round(Number(v))}]].forEach(([id,opts])=>{const input=$(id); if(input){if(id==='loan-amount') input.addEventListener('blur',()=>normalizeInput(input)); attachSyncedSlider(input,opts);}});
  if($('loan-type')) $('loan-type').addEventListener('change',applyLoanPreset);
  if($('loan-start-date')&&!$('loan-start-date').value) $('loan-start-date').value=new Date().toISOString().split('T')[0];
  if(tenureYearsInput) tenureYearsInput.addEventListener('input',()=>updateTenureState('input'));
  if(tenureMonthsInput) tenureMonthsInput.addEventListener('input',()=>updateTenureState('input'));
  setupExperience(); addPrepaymentInput(); applyLoanPreset();
  displayMessage('info','Add real prepayments in the Actual Plan section. Use the simulation section separately to test an idea before applying it.','prepayment-tip');
  if(hypotheticalAmountInput){hypotheticalAmountInput.addEventListener('blur',()=>normalizeInput(hypotheticalAmountInput)); hypotheticalAmountInput.addEventListener('input',debounce(onAdvisorInputChange,150));}
  if(hypotheticalDateInput) hypotheticalDateInput.addEventListener('input',debounce(onAdvisorInputChange,150));
  form.addEventListener('input',debounce((event)=>{const t=event.target; if(!t) return; if(['hypothetical-prepayment-amount','hypothetical-prepayment-date','apply-what-if-to-plan'].includes(t.id)) return; if(hasRenderedOnce) runSimulation();},300));
}

function applyLoanPreset(){
  const preset=presets[$('loan-type')?.value];
  if(!preset) return;
  [['loan-amount',preset.amount],['interest-rate',preset.rate]].forEach(([id,v])=>{if($(id)){$(id).value=String(v); $(id).dispatchEvent(new Event('input',{bubbles:true}));}});
  if(!uiState.tenureTouched){
    suspendTenureTracking=true;
    if($('loan-tenure-years')){$('loan-tenure-years').value=String(preset.years); $('loan-tenure-years').dispatchEvent(new Event('input',{bubbles:true}));}
    if($('loan-tenure-months')){$('loan-tenure-months').value=String(preset.months); $('loan-tenure-months').dispatchEvent(new Event('input',{bubbles:true}));}
    suspendTenureTracking=false;
    updateTenureState('preset');
  }
}

function updateTenureState(source='system'){
  const years=Math.max(0,Math.round(Number($('loan-tenure-years')?.value)||0));
  const months=Math.min(11,Math.max(0,Math.round(Number($('loan-tenure-months')?.value)||0)));
  uiState.tenureYears=years;
  uiState.tenureMonthsInput=months;

  if(source==='input' && !suspendTenureTracking){
    uiState.userEnteredTenureYears=years;
    uiState.userEnteredTenureMonths=months;
    uiState.tenureTouched=true;
  }

  if($('loan-tenure-years') && $('loan-tenure-years').value !== String(years)){
    $('loan-tenure-years').value=String(years);
  }
  if($('loan-tenure-months') && $('loan-tenure-months').value !== String(months)){
    $('loan-tenure-months').value=String(months);
  }
}

function protectTenureState(){
  const currentYears=Math.max(0,Math.round(Number($('loan-tenure-years')?.value)||0));
  const currentMonths=Math.min(11,Math.max(0,Math.round(Number($('loan-tenure-months')?.value)||0)));
  if(currentYears!==uiState.tenureYears || currentMonths!==uiState.tenureMonthsInput){
    console.error('BUG: Tenure overridden');
    if($('loan-tenure-years')) $('loan-tenure-years').value=String(uiState.tenureYears);
    if($('loan-tenure-months')) $('loan-tenure-months').value=String(uiState.tenureMonthsInput);
  }
}

function setupExperience(){
  const prepaymentsList=$('prepayments-list'); const addPrepaymentBtn=$('add-prepayment');
  const prepaymentHeading=prepaymentsList?.previousElementSibling; const prepaymentSmall=addPrepaymentBtn?.nextElementSibling; const hypotheticalHeading=hypotheticalAmountInput?.closest('.form-group')?.previousElementSibling; const hypotheticalSmall=hypotheticalDateInput?.closest('.form-group')?.nextElementSibling;
  if(prepaymentHeading?.tagName==='H3') prepaymentHeading.innerHTML='<span class="plan-badge plan-badge-actual">&#9989; Actual Plan</span> Prepayments (Optional)';
  if(prepaymentSmall) prepaymentSmall.textContent='These are real payments. Results shown below will include these prepayments.';
  if(addPrepaymentBtn) addPrepaymentBtn.textContent='Add Actual Prepayment';
  if(hypotheticalHeading?.tagName==='H3') hypotheticalHeading.innerHTML='<span class="plan-badge plan-badge-simulated">&#128269; Simulation Only</span> Try a Prepayment (Simulation Only)';
  if(hypotheticalSmall) hypotheticalSmall.textContent='This is only for comparison and decision-making. It does not affect your current results.';
  if(hypotheticalSmall&&!$('apply-hypothetical-to-prepayments')){const controls=document.createElement('div'); controls.className='simulation-actions'; controls.innerHTML='<label class="checkbox-row mt-2" for="apply-what-if-to-plan"><input type="checkbox" id="apply-what-if-to-plan"><span>Apply What-If to Actual Prepayments</span></label><p class="helper-text">Happy with this scenario? Add it to your actual plan.</p><button type="button" class="btn btn-secondary btn-block mt-2" id="apply-hypothetical-to-prepayments">Add to Prepayments</button>'; hypotheticalSmall.insertAdjacentElement('afterend',controls);}
  const comparisonHeading=document.querySelector('#emi-results .card.mt-3 h3'); if(comparisonHeading?.textContent.trim()==='Before vs After') comparisonHeading.textContent='Current Loan vs Actual Plan';
  const panels=document.querySelectorAll('.comparison-panel h4'); if(panels[0]) panels[0].textContent='Without Actual Prepayments'; if(panels[1]) panels[1].textContent='With Actual Prepayments';
  const hypotheticalImpactCard=$('hypothetical-impact-card'); if(hypotheticalImpactCard) hypotheticalImpactCard.innerHTML=`<div class="scenario-comparison-header"><div><span class="plan-badge plan-badge-simulated">&#128269; Simulation Only</span><h3>Scenario Comparison</h3></div><p class="scenario-highlight" id="hypothetical-highlight">Try a hypothetical prepayment to compare it against your current actual plan.</p></div><div class="simulation-actions mt-2"><label class="checkbox-row" for="scenario-reduce-tenure"><input type="radio" id="scenario-reduce-tenure" name="hypothetical-scenario" value="reduce-tenure" checked><span>Reduce Tenure</span></label><label class="checkbox-row" for="scenario-reduce-emi"><input type="radio" id="scenario-reduce-emi" name="hypothetical-scenario" value="reduce-emi"><span>Reduce EMI</span></label></div><p class="helper-text" id="scenario-selection-label">Showing: Reduce Tenure Scenario</p><p class="scenario-context">If you prepay <span id="hypothetical-amount">${formatCurrency(0)}</span> on <span id="hypothetical-date"></span>, this is how your current plan would compare.</p><div class="comparison-grid scenario-comparison-grid"><div class="comparison-panel"><h4>Current Plan</h4><div class="comparison-item"><span>EMI</span><span id="scenario-current-emi" class="value">${formatCurrency(0)}</span></div><div class="comparison-item"><span>Total Interest</span><span id="scenario-current-interest" class="value">${formatCurrency(0)}</span></div><div class="comparison-item"><span>Tenure</span><span id="scenario-current-tenure" class="value">0m</span></div></div><div class="comparison-panel comparison-panel-simulated"><h4>With What-If</h4><div class="comparison-item"><span>EMI</span><span id="scenario-hypothetical-emi" class="value">${formatCurrency(0)}</span></div><div class="comparison-item"><span>Total Interest</span><span id="scenario-hypothetical-interest" class="value">${formatCurrency(0)}</span></div><div class="comparison-item"><span>Tenure</span><span id="scenario-hypothetical-tenure" class="value">0m</span></div></div></div><p class="helper-text mt-2">Simulation does not affect your actual loan unless applied.</p>`;
  applyWhatIfToPlanCheckbox=$('apply-what-if-to-plan'); const applyBtn=$('apply-hypothetical-to-prepayments'); if(applyBtn) applyBtn.addEventListener('click',applyWhatIfToPlan);
  document.querySelectorAll('input[name="hypothetical-scenario"]').forEach(input=>input.addEventListener('change',(event)=>{hypotheticalScenario=event.target.value; refreshWhatIfComparison(false);}));
}

function displayMessage(type,message,id=''){const container=$('message-container'); if(!container) return; if(id) clearMessages(id); const el=document.createElement('div'); el.className=`message-banner message-${type}`; if(id) el.id=id; el.textContent=message; container.appendChild(el);}
function clearMessages(id=''){const container=$('message-container'); if(!container) return; if(!id){container.innerHTML=''; return;} const el=$(id); if(el) el.remove();}
function collectRawPrepayments(){const rows=[]; document.querySelectorAll('.prepayment-item').forEach(item=>{const amount=item.querySelector('.prepayment-item-amount')?.value.trim()||''; const date=item.querySelector('.prepayment-item-date')?.value.trim()||''; if(amount||date) rows.push({amount,date});}); return rows;}
function loanFormState(){protectTenureState(); const tenureMonths=(uiState.tenureYears*12)+uiState.tenureMonthsInput; return {loanAmount:Math.round(parseFloat($('loan-amount').value)),annualInterestRate:parseFloat($('interest-rate').value),loanTenureMonths:tenureMonths,loanStartDate:$('loan-start-date').value,monthlyIncome:monthlyIncomeValue()};}
async function onSubmit(event){event.preventDefault(); await runSimulation({scrollToResults:true});}
function onAdvisorInputChange(){if(!hasRenderedOnce){clearMessages('what-if-validation'); clearMessages('advisor-validation'); return;} refreshWhatIfComparison(true); refreshAdvisor(true);}
async function runSimulation({scrollToResults=false}={}){
  clearMessages(); resetHypotheticalComparison(); resetAdvisor(); showLoading();
  const {loanAmount,annualInterestRate,loanTenureMonths,loanStartDate,monthlyIncome}=loanFormState();
  const loanValidation=validateLoanInputs(loanAmount,annualInterestRate,loanTenureMonths,loanStartDate); if(!loanValidation.isValid){loanValidation.errors.forEach(e=>displayMessage('error',e)); hideLoading(); return;}
  const prepaymentValidation=validatePrepaymentInputs(collectRawPrepayments()); if(!prepaymentValidation.isValid){prepaymentValidation.errors.forEach(e=>displayMessage('error',e)); hideLoading(); return;}
  const prepayments=prepaymentValidation.validatedData; if(prepayments.length>0) clearMessages('prepayment-tip');
  try{lastSimulationResult=await simulateLoan({loanAmount,annualInterestRate:annualInterestRate/100,loanTenureMonths,loanStartDate:new Date(loanStartDate),monthlyIncome},prepayments,new Date()); hasRenderedOnce=true; renderResults(lastSimulationResult); refreshWhatIfComparison(true); refreshAdvisor(true); if(scrollToResults) $('emi-results')?.scrollIntoView({behavior:'smooth'});}catch(error){displayMessage('error',`Calculation error: ${error.message}`);}finally{hideLoading();}
}
function addPrepaymentInput(prefill={}){const count=document.querySelectorAll('.prepayment-item').length; const div=document.createElement('div'); div.classList.add('form-group','prepayment-item'); div.innerHTML=`<label>Prepayment ${count+1}</label><div class="tenure-inputs"><input type="number" class="prepayment-item-amount" min="0" step="0.01" placeholder="Amount (INR)" value="${prefill.amount??''}"><input type="date" class="prepayment-item-date" value="${prefill.date??''}"><button type="button" class="btn btn-danger btn-sm remove-prepayment">Remove</button></div>`; $('prepayments-list').appendChild(div);}
function onPrepaymentClick(event){if(!event.target.classList.contains('remove-prepayment')) return; event.target.closest('.prepayment-item')?.remove(); document.querySelectorAll('.prepayment-item').forEach((item,index)=>item.querySelector('label').textContent=`Prepayment ${index+1}`); if(hasRenderedOnce) runSimulation();}
async function applyWhatIfToPlan(){clearMessages('what-if-validation'); clearMessages('what-if-applied'); const validation=validateHypotheticalPrepayment(hypotheticalAmountInput.value.trim(),hypotheticalDateInput.value.trim()); if(!validation.isValid){validation.errors.forEach(e=>displayMessage('error',e,'what-if-validation')); return;} if(!validation.validatedData){displayMessage('info','Enter a simulation amount and date before adding it to your actual plan.','what-if-applied'); return;} const runNow=Boolean(applyWhatIfToPlanCheckbox?.checked); addPrepaymentInput({amount:validation.validatedData.amount,date:hypotheticalDateInput.value.trim()}); hypotheticalAmountInput.value=''; hypotheticalDateInput.value=''; if(applyWhatIfToPlanCheckbox) applyWhatIfToPlanCheckbox.checked=false; resetHypotheticalComparison(); displayMessage('success','The simulated prepayment has been copied to your Actual Plan.','what-if-applied'); if(hasRenderedOnce&&runNow) await runSimulation();}
function renderResults(result){
  const {userInput,originalLoan,modifiedLoan,loanProgress,prepaymentImpact,insights,updatedSchedule,loanHealth}=result;
  const noPrepayment=(prepaymentImpact?.monthsReduced||0)===0&&(prepaymentImpact?.interestSaved||0)===0;
  if(noPrepayment&&originalLoan.totalMonths!==userInput.tenureMonths) throw new Error('Tenure override bug');
  $('emi-amount').textContent=formatCurrency(originalLoan.emi);
  $('total-interest').textContent=formatCurrency(modifiedLoan.totalInterest);
  $('total-payment').textContent=formatCurrency(modifiedLoan.totalPayment);
  $('loan-tenure-display').textContent=fmtTenure(modifiedLoan.totalMonths);
  if($('compare-original-principal')) $('compare-original-principal').textContent=formatCurrency(originalLoan.principal);
  if($('compare-modified-principal')) $('compare-modified-principal').textContent=formatCurrency(modifiedLoan.principal);
  $('compare-original-emi').textContent=formatCurrency(originalLoan.emi);
  $('compare-original-interest').textContent=formatCurrency(originalLoan.totalInterest);
  $('compare-original-payment').textContent=formatCurrency(originalLoan.totalPayment);
  $('compare-original-tenure').textContent=fmtTenure(originalLoan.totalMonths);
  $('compare-modified-emi').textContent=formatCurrency(modifiedLoan.emi);
  $('compare-modified-interest').textContent=formatCurrency(modifiedLoan.totalInterest);
  $('compare-modified-payment').textContent=formatCurrency(modifiedLoan.totalPayment);
  $('compare-modified-tenure').textContent=fmtTenure(modifiedLoan.totalMonths);
  updateSummary(originalLoan,modifiedLoan,prepaymentImpact,loanHealth);
  $('progress-emis-paid').textContent=loanProgress.paidEmis.toLocaleString('en-IN');
  $('progress-principal-paid').textContent=formatCurrency(loanProgress.principalPaid);
  $('progress-interest-paid').textContent=formatCurrency(loanProgress.interestPaid);
  $('progress-remaining-balance').textContent=formatCurrency(loanProgress.remainingBalance);
  $('progress-months-remaining').textContent=loanProgress.monthsRemaining.toLocaleString('en-IN');
  const alt=prepaymentImpact?.alternativeReduceEmiImpact;
  $('impact-tenure-interest-saved').textContent=formatCurrency(prepaymentImpact?.interestSaved||0);
  $('impact-tenure-months-reduced').textContent=(prepaymentImpact?.monthsReduced||0).toLocaleString('en-IN');
  $('impact-tenure-percentage-savings').textContent=`${(prepaymentImpact?.percentageSavings||0).toFixed(2)}%`;
  $('impact-emi-new-emi').textContent=formatCurrency(alt?.newEmi||modifiedLoan.emi);
  $('impact-emi-interest-saved').textContent=formatCurrency(alt?.interestSaved||0);
  $('impact-emi-percentage-savings').textContent=`${(alt?.percentageSavings||0).toFixed(2)}%`;
  $('loan-health-score').textContent=loanHealth.score.toString();
  $('loan-health-rating').textContent=loanHealth.rating;
  $('loan-health-message').textContent=loanHealth.message;
  updateEmiPieChart(modifiedLoan.principal,modifiedLoan.totalInterest);
  updatePrincipalInterestChart(updatedSchedule.map(e=>({month:e.month,principal:e.cumulativePrincipalPaid,interest:e.cumulativeInterestPaid})));
  updateBalanceOverTimeChart(updatedSchedule.map(e=>({month:e.month,balance:e.closingBalance})));
  populateAmortizationTable(updatedSchedule);
  displayInsights(insights,result.breakEvenMonth);
  $('emi-results').classList.remove('hidden');
  $('emi-chart-card').classList.remove('hidden');
}
function refreshWhatIfComparison(showErrors=false){clearMessages('what-if-validation'); const {amountStr,dateStr}={amountStr:hypotheticalAmountInput?.value.trim()||'',dateStr:hypotheticalDateInput?.value.trim()||''}; const validation=validateHypotheticalPrepayment(amountStr,dateStr); if(!validation.isValid){resetHypotheticalComparison(); if(showErrors) validation.errors.forEach(e=>displayMessage('error',e,'what-if-validation')); return null;} if(!lastSimulationResult||!validation.validatedData){resetHypotheticalComparison(); return validation.validatedData;} try{const impact=calculateHypotheticalPrepaymentImpact(lastSimulationResult.modifiedLoan,validation.validatedData,lastSimulationResult.updatedSchedule); renderHypotheticalComparison(lastSimulationResult.modifiedLoan,impact); return validation.validatedData;}catch(error){resetHypotheticalComparison(); if(showErrors) displayMessage('error',error.message,'what-if-validation'); return null;}}
function resetHypotheticalComparison(){const card=$('hypothetical-impact-card'); card.classList.add('hidden'); card.classList.remove('scenario-flash'); setText('hypothetical-highlight','Try a hypothetical prepayment to compare it against your current actual plan.'); setText('scenario-selection-label',hypotheticalScenario==='reduce-emi'?'Showing: Reduce EMI Scenario':'Showing: Reduce Tenure Scenario'); setText('hypothetical-amount',formatCurrency(0)); setText('hypothetical-date',''); setText('scenario-current-emi',formatCurrency(0)); setText('scenario-current-interest',formatCurrency(0)); setText('scenario-current-tenure','0m'); setText('scenario-hypothetical-emi',formatCurrency(0)); setText('scenario-hypothetical-interest',formatCurrency(0)); setText('scenario-hypothetical-tenure','0m');}
function renderHypotheticalComparison(baseLoan,impact){const card=$('hypothetical-impact-card'); if(!baseLoan||!impact){resetHypotheticalComparison(); return;} const selectedScenario=impact.comparisonScenarios?.[hypotheticalScenario] || impact.comparisonScenarios?.['reduce-tenure'] || impact.resultingLoan; const tenureSaved=Math.max(0,baseLoan.totalMonths-selectedScenario.totalMonths); const interestSaved=Math.max(0,baseLoan.totalInterest-selectedScenario.totalInterest); if(!selectedScenario){resetHypotheticalComparison(); return;} card.classList.remove('hidden'); card.classList.remove('scenario-flash'); void card.offsetWidth; card.classList.add('scenario-flash'); setText('scenario-selection-label',hypotheticalScenario==='reduce-emi'?'Showing: Reduce EMI Scenario':'Showing: Reduce Tenure Scenario'); setText('hypothetical-highlight',`You save ${formatCurrency(interestSaved)} and ${fmtTenure(tenureSaved)} in this simulation.`); setText('hypothetical-amount',formatCurrency(impact.amount)); setText('hypothetical-date',formatDate(impact.date)); setText('scenario-current-emi',formatCurrency(baseLoan.emi)); setText('scenario-current-interest',formatCurrency(baseLoan.totalInterest)); setText('scenario-current-tenure',fmtTenure(baseLoan.totalMonths)); setText('scenario-hypothetical-emi',formatCurrency(selectedScenario.emi)); setText('scenario-hypothetical-interest',formatCurrency(selectedScenario.totalInterest)); setText('scenario-hypothetical-tenure',fmtTenure(selectedScenario.totalMonths));}
function resetAdvisor(){const card=$('smart-prepayment-advisor-card'); card.classList.add('hidden'); setText('advisor-highlight','Enter a prepayment amount to see savings.'); setText('advisor-interest-saved',formatCurrency(0)); setText('advisor-tenure-saved','0m'); setText('advisor-emi-reduction',formatCurrency(0)); setText('advisor-recommendation','Reduce tenure to maximize savings.'); setText('advisor-timing','Earlier prepayments usually create the highest interest savings.'); setText('advisor-helper-text','Earlier prepayments save more interest.'); setText('advisor-comparison-body',`<tr><td>Current</td><td>${formatCurrency(0)}</td><td>${formatCurrency(0)}</td><td>0m</td></tr>`,true);}
function refreshAdvisor(showErrors=false){clearMessages('advisor-validation'); if(!lastSimulationResult){resetAdvisor(); return;} const hypoValidation=validateHypotheticalPrepayment(hypotheticalAmountInput?.value.trim()||'',hypotheticalDateInput?.value.trim()||''); if(hypoValidation.validatedData){const advisor=calculateSmartPrepaymentAdvisor(lastSimulationResult.modifiedLoan,hypoValidation.validatedData,lastSimulationResult.updatedSchedule,monthlyIncomeValue()); if(!advisor?.isValid){resetAdvisor(); if(showErrors&&advisor?.error) displayMessage('error',advisor.error,'advisor-validation'); return;} renderSmartAdvisor(advisor,'Simulation only'); return;} if(!hypoValidation.isValid&&showErrors&&(hypotheticalAmountInput?.value||hypotheticalDateInput?.value)){hypoValidation.errors.forEach(e=>displayMessage('error',e,'advisor-validation')); resetAdvisor(); return;} const prepaymentValidation=validatePrepaymentInputs(collectRawPrepayments()); if(!prepaymentValidation.isValid){if(showErrors) prepaymentValidation.errors.forEach(e=>displayMessage('error',e,'advisor-validation')); resetAdvisor(); return;} if(prepaymentValidation.validatedData.length===0){resetAdvisor(); return;} renderActualAdvisor(lastSimulationResult,monthlyIncomeValue());}
function renderActualAdvisor(result,monthlyIncome){const {originalLoan,modifiedLoan,prepaymentImpact,reduceEmiLoan,loanProgress}=result; const ratio=monthlyIncome&&monthlyIncome>0?originalLoan.emi/monthlyIncome:null; const recommendation=ratio!==null&&ratio>0.35?'Recommendation: Reduce EMI to ease monthly cash flow.':'Recommendation: Reduce tenure to maximize savings.'; const timing=loanProgress.paidEmis<originalLoan.totalMonths*0.3?'Best time to prepay - maximum savings.':loanProgress.paidEmis<originalLoan.totalMonths*0.7?'Moderate benefit.':'Lower impact - most interest is already paid.'; renderAdvisorCard({title:`Your actual prepayment plan is already saving ${formatCurrency(prepaymentImpact.interestSaved)}.`,interestSaved:prepaymentImpact.interestSaved,tenureSaved:prepaymentImpact.monthsReduced,emiReduction:Math.max(0,originalLoan.emi-reduceEmiLoan.emi),recommendation,timing,helperText:'Earlier prepayments save more interest.',rows:[{label:'Current',emi:originalLoan.emi,interest:originalLoan.totalInterest,tenure:originalLoan.totalMonths},{label:'Reduce Tenure',emi:modifiedLoan.emi,interest:modifiedLoan.totalInterest,tenure:modifiedLoan.totalMonths},{label:'Reduce EMI',emi:reduceEmiLoan.emi,interest:reduceEmiLoan.totalInterest,tenure:reduceEmiLoan.totalMonths}]});}
function renderSmartAdvisor(advisor,sourceLabel){const recommendation=advisor.recommendation==='Reduce EMI'?'Recommendation: Reduce EMI to ease monthly cash flow.':'Recommendation: Reduce tenure to maximize savings.'; renderAdvisorCard({title:`${sourceLabel}: prepay ${formatCurrency(advisor.sourceAmount)} on ${formatDate(advisor.sourceDate)} and save up to ${formatCurrency(advisor.scenarios.reduceTenure.interestSaved)}.`,interestSaved:advisor.scenarios.reduceTenure.interestSaved,tenureSaved:advisor.scenarios.reduceTenure.monthsSaved,emiReduction:advisor.scenarios.reduceEmi.emiReduction,recommendation,timing:advisor.timingInsight,helperText:advisor.helperText,rows:[{label:'Current',emi:advisor.scenarios.current.emi,interest:advisor.scenarios.current.totalInterest,tenure:advisor.scenarios.current.totalMonths},{label:'Reduce Tenure',emi:advisor.scenarios.reduceTenure.emi,interest:advisor.scenarios.reduceTenure.totalInterest,tenure:advisor.scenarios.reduceTenure.totalMonths},{label:'Reduce EMI',emi:advisor.scenarios.reduceEmi.emi,interest:advisor.scenarios.reduceEmi.totalInterest,tenure:advisor.scenarios.reduceEmi.totalMonths}]});}
function renderAdvisorCard({title,interestSaved,tenureSaved,emiReduction,recommendation,timing,helperText,rows}){$('smart-prepayment-advisor-card').classList.remove('hidden'); setText('advisor-highlight',title); animateValue($('advisor-interest-saved'),interestSaved,v=>formatCurrency(v)); animateValue($('advisor-tenure-saved'),tenureSaved,v=>fmtTenure(Math.round(v))); animateValue($('advisor-emi-reduction'),emiReduction,v=>formatCurrency(v)); setText('advisor-recommendation',recommendation); setText('advisor-timing',timing); setText('advisor-helper-text',helperText); $('advisor-comparison-body').innerHTML=rows.map(r=>`<tr><td>${r.label}</td><td>${formatCurrency(r.emi)}</td><td>${formatCurrency(r.interest)}</td><td>${fmtTenure(r.tenure)}</td></tr>`).join('');}
function animateValue(element,targetValue,formatter){if(!element) return; const start=performance.now(),duration=700,target=Number(targetValue)||0; element.classList.remove('count-up'); void element.offsetWidth; element.classList.add('count-up'); const step=now=>{const progress=Math.min((now-start)/duration,1),eased=1-Math.pow(1-progress,3); element.textContent=formatter(target*eased); if(progress<1) requestAnimationFrame(step);}; requestAnimationFrame(step);}
function updateSummary(originalLoan,modifiedLoan,prepaymentImpact,loanHealth){if(prepaymentImpact&&prepaymentImpact.interestSaved>0) $('loan-summary-primary').textContent=`Your actual prepayment plan already saves ${formatCurrency(prepaymentImpact.interestSaved)} and shortens the loan by ${fmtTenure(prepaymentImpact.monthsReduced)}.`; else if(loanHealth.score<60) $('loan-summary-primary').textContent='Your current loan looks interest-heavy. Add real prepayments only when you are confident, and use the simulation section first to test ideas.'; else $('loan-summary-primary').textContent='Your actual plan is stable. Use the simulation section to test one extra prepayment before committing it.'; const ratio=originalLoan.totalInterest>0&&modifiedLoan.totalPayment>0?(modifiedLoan.totalInterest/modifiedLoan.totalPayment)*100:0; $('loan-summary-interest').textContent=`Interest is about ${ratio.toFixed(1)}% of total cash outflow in your current actual plan.`; $('loan-summary-prepayment').textContent='Actual prepayments change your main results. Simulation-only ideas stay separate until you add them to your actual plan.';}
function showLoading(){setButtonLoading(document.querySelector('#emi-form button[type="submit"]'),$('emi-loading-spinner'),true,'Run Simulation','Calculating...');}
function hideLoading(){setButtonLoading(document.querySelector('#emi-form button[type="submit"]'),$('emi-loading-spinner'),false,'Run Simulation','Calculating...');}
function updateEmiPieChart(principal,totalInterest){const ctx=$('emi-pie-chart'); if(!ctx) return; if(emiPieChartInstance) emiPieChartInstance.destroy(); emiPieChartInstance=new Chart(ctx,{type:'doughnut',data:{labels:['Principal','Interest'],datasets:[{data:[principal,totalInterest],backgroundColor:['#3498db','#e74c3c'],borderColor:'#fff',borderWidth:2}]},options:{responsive:true,plugins:{legend:{position:'bottom'}}}});}
function chartOptions(title){return {responsive:true,plugins:{title:{display:true,text:title},tooltip:{callbacks:{label(context){const prefix=context.dataset.label?`${context.dataset.label}: `:''; return `${prefix}${formatCurrency(context.parsed.y)}`;}}}},scales:{x:{title:{display:true,text:'Month'}},y:{title:{display:true,text:'Amount (INR)'},beginAtZero:true}}};}
function updatePrincipalInterestChart(data){const ctx=$('principal-interest-chart'); if(!ctx) return; if(principalInterestChartInstance) principalInterestChartInstance.destroy(); principalInterestChartInstance=new Chart(ctx,{type:'line',data:{labels:data.map(d=>`Month ${d.month}`),datasets:[{label:'Cumulative Principal Paid',data:data.map(d=>d.principal),borderColor:'#2ecc71',backgroundColor:'rgba(46, 204, 113, 0.2)',fill:true,tension:0.3},{label:'Cumulative Interest Paid',data:data.map(d=>d.interest),borderColor:'#e74c3c',backgroundColor:'rgba(231, 76, 60, 0.2)',fill:true,tension:0.3}]},options:chartOptions('Cumulative Principal vs Interest Paid Over Time')});}
function updateBalanceOverTimeChart(data){const ctx=$('balance-over-time-chart'); if(!ctx) return; if(balanceOverTimeChartInstance) balanceOverTimeChartInstance.destroy(); balanceOverTimeChartInstance=new Chart(ctx,{type:'line',data:{labels:data.map(d=>`Month ${d.month}`),datasets:[{label:'Remaining Balance',data:data.map(d=>d.balance),borderColor:'#3498db',backgroundColor:'rgba(52, 152, 219, 0.2)',fill:true,tension:0.3}]},options:chartOptions('Loan Balance Over Time')});}
function populateAmortizationTable(schedule){const tbody=$('emi-table-body'); tbody.innerHTML=''; const frag=document.createDocumentFragment(); schedule.forEach(row=>{const tr=document.createElement('tr'); tr.innerHTML=`<td>${row.month}</td><td>${formatDate(row.date)}</td><td class="currency">${formatCurrency(row.openingBalance)}</td><td class="currency">${formatCurrency(row.emi)}</td><td class="currency principal">${formatCurrency(row.principalComponent)}</td><td class="currency interest">${formatCurrency(row.interestComponent)}</td><td class="currency balance">${formatCurrency(row.closingBalance)}</td><td class="currency">${formatCurrency(row.cumulativePrincipalPaid)}</td><td class="currency">${formatCurrency(row.cumulativeInterestPaid)}</td>`; frag.appendChild(tr);}); tbody.appendChild(frag);}
function displayInsights(insights,breakEvenMonth){const list=$('emi-insight-list'); list.innerHTML=''; if(!insights||insights.length===0){displayMessage('info','No specific insights generated for this scenario. Your loan appears to be well-managed.','no-insights-tip'); return;} insights.forEach(insight=>{const li=document.createElement('li'); li.className=`insight-item insight-item-${insight.type}`; li.innerHTML=`<span class="insight-icon">${insight.icon}</span><div class="insight-content"><h4 class="insight-title">${insight.title}</h4><p class="insight-message">${insight.message}</p>${insight.action?`<p class="insight-action"><strong>Action:</strong> ${insight.action}</p>`:''}</div>`; list.appendChild(li);}); $('break-even-point-display').textContent=breakEvenMonth!==undefined&&breakEvenMonth!==null?`Break-even Point: Principal paid exceeds interest paid at month ${breakEvenMonth}.`:'Break-even Point: Not reached within the loan tenure, or principal always exceeded interest.';}
try{init();}catch(error){console.error('App crashed:',error);}

