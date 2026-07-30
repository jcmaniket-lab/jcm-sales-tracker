// ---------- CONFIG ----------
// No PIN is stored here. It's entered at login and checked against Google's
// Script Properties on the server (see apps-script/Code.gs). It's only kept
// in sessionStorage for this browser tab, never in a file.
const SALESPEOPLE = ["Hetvi", "Sakshi", "Jayu", "Ragini", "Arvind", "Himanshu", "Shoaib"];
const BRANCHES = ["Kim GIDC", "Udhna GIDC"];
const ATTENDANCE_STATUSES = ["Present", "Half", "Leave"];
const OWNER_PHONE = ""; // optional: owner's WhatsApp number with country code, e.g. "919876543210". Leave blank to open the WhatsApp contact picker instead.

function currentPin() {
  return sessionStorage.getItem("jcm_pin") || "";
}

// ---------- LOGIN ----------
async function login() {
  const pin = document.getElementById("pinInput").value;
  const errEl = document.getElementById("loginError");
  errEl.classList.add("hidden");

  try {
    const result = await apiPostRaw(pin, { action: "getMeta" }, true);
    if (result && !result.error) {
      sessionStorage.setItem("jcm_pin", pin);
      document.getElementById("loginView").classList.add("hidden");
      document.getElementById("appView").classList.remove("hidden");
      initApp();
    } else {
      errEl.classList.remove("hidden");
    }
  } catch (err) {
    errEl.textContent = "Couldn't reach the server. Check your internet connection.";
    errEl.classList.remove("hidden");
  }
}

function logout() {
  sessionStorage.removeItem("jcm_pin");
  document.getElementById("appView").classList.add("hidden");
  document.getElementById("loginView").classList.remove("hidden");
}

async function checkSession() {
  const pin = currentPin();
  if (!pin) return;
  const result = await apiGet("getMeta");
  if (result && !result.error) {
    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("appView").classList.remove("hidden");
    initApp();
  } else {
    logout();
  }
}

// A GET-based check used only during login, since apiGet() assumes a session pin already exists.
async function apiPostRaw(pin, params) {
  let url = `${API_URL}?action=${params.action}&pin=${encodeURIComponent(pin)}`;
  const res = await fetch(url);
  return res.json();
}

// ---------- TABS ----------
function showTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add("active");
  document.querySelectorAll("[id^='tab-']").forEach(s => s.classList.add("hidden"));
  document.getElementById(`tab-${tab}`).classList.remove("hidden");

  if (tab === "dashboard") loadDashboard();
  if (tab === "invoices") loadInvoices();
  if (tab === "monthly") loadMonthlyReport();
}

// ---------- INIT ----------
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function currentMonthStr() {
  return new Date().toISOString().substring(0, 7);
}

function initApp() {
  document.getElementById("entryDate").value = todayStr();
  document.getElementById("dashDate").value = todayStr();
  document.getElementById("invDate").value = todayStr();
  document.getElementById("monthPicker").value = currentMonthStr();
  buildEntryRows();
  loadEntryForDate(todayStr());

  document.getElementById("entryDate").addEventListener("change", e => loadEntryForDate(e.target.value));
}

function buildEntryRows() {
  const spWrap = document.getElementById("salespersonRows");
  spWrap.innerHTML = "";
  SALESPEOPLE.forEach(name => {
    const row = document.createElement("div");
    row.className = "row-with-attendance";
    row.innerHTML = `
      <label>${name}</label>
      <input type="number" id="sp_${name.replace(/\s/g,'')}" placeholder="0">
      <select id="att_${name.replace(/\s/g,'')}">
        ${ATTENDANCE_STATUSES.map(s => `<option value="${s}">${s}</option>`).join("")}
      </select>`;
    spWrap.appendChild(row);
  });

  const brWrap = document.getElementById("branchRows");
  brWrap.innerHTML = "";
  BRANCHES.forEach(name => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<label>${name}</label><input type="number" id="br_${name.replace(/\s/g,'')}" placeholder="0">`;
    brWrap.appendChild(row);
  });
}

// Shows a small spinner + text in a .msg element while an async action runs.
function showLoadingMsg(elId, text) {
  const el = document.getElementById(elId);
  el.classList.remove("hidden", "success", "error");
  el.classList.add("loading");
  el.innerHTML = `<span class="spinner"></span> ${text}`;
}

function showResultMsg(elId, text, ok) {
  const el = document.getElementById(elId);
  el.classList.remove("loading", "success", "error");
  el.classList.add(ok ? "success" : "error");
  el.innerHTML = text;
}

// ---------- API HELPERS ----------
async function apiGet(action, extraParams) {
  let url = `${API_URL}?action=${action}&pin=${encodeURIComponent(currentPin())}`;
  if (extraParams) Object.keys(extraParams).forEach(k => url += `&${k}=${encodeURIComponent(extraParams[k])}`);
  const res = await fetch(url);
  return res.json();
}

async function apiPost(body) {
  body.pin = currentPin();
  const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(body) });
  return res.json();
}

// ---------- DAILY ENTRY ----------
async function loadEntryForDate(date) {
  try {
    const data = await apiGet("getDaily", { date });
    SALESPEOPLE.forEach(name => {
      const el = document.getElementById(`sp_${name.replace(/\s/g,'')}`);
      el.value = data.salespersonSales && data.salespersonSales[name] ? data.salespersonSales[name] : "";
      const attEl = document.getElementById(`att_${name.replace(/\s/g,'')}`);
      attEl.value = data.attendance && data.attendance[name] ? data.attendance[name] : "Present";
    });
    BRANCHES.forEach(name => {
      const el = document.getElementById(`br_${name.replace(/\s/g,'')}`);
      el.value = data.branchSales && data.branchSales[name] ? data.branchSales[name] : "";
    });
  } catch (err) {
    console.error("Could not load existing entries", err);
  }
}

async function saveEntry() {
  const date = document.getElementById("entryDate").value;
  const spEntries = {};
  SALESPEOPLE.forEach(name => spEntries[name] = document.getElementById(`sp_${name.replace(/\s/g,'')}`).value || 0);
  const brEntries = {};
  BRANCHES.forEach(name => brEntries[name] = document.getElementById(`br_${name.replace(/\s/g,'')}`).value || 0);
  const attEntries = {};
  SALESPEOPLE.forEach(name => attEntries[name] = document.getElementById(`att_${name.replace(/\s/g,'')}`).value || "Present");

  const msgEl = document.getElementById("entryMsg");
  msgEl.classList.remove("hidden");
  showLoadingMsg("entryMsg", "Saving...");

  try {
    await apiPost({ action: "saveDailySales", date, entries: spEntries });
    await apiPost({ action: "saveBranchSales", date, entries: brEntries });
    await apiPost({ action: "saveAttendance", date, entries: attEntries });
    showResultMsg("entryMsg", `Saved sales &amp; attendance for ${date}.`, true);
  } catch (err) {
    showResultMsg("entryMsg", "Error saving. Check your internet connection and try again.", false);
  }
}

// ---------- DASHBOARD ----------
async function loadDashboard() {
  const date = document.getElementById("dashDate").value || todayStr();
  const data = await apiGet("getDaily", { date });

  const empBody = document.querySelector("#empTable tbody");
  empBody.innerHTML = "";
  let empTotal = 0;
  SALESPEOPLE.forEach(name => {
    const amt = Number(data.salespersonSales && data.salespersonSales[name] || 0);
    empTotal += amt;
    empBody.innerHTML += `<tr><td>${name}</td><td style="text-align:right;">₹${amt.toLocaleString('en-IN')}</td></tr>`;
  });
  empBody.innerHTML += `<tr class="total-row"><td>Total</td><td style="text-align:right;">₹${empTotal.toLocaleString('en-IN')}</td></tr>`;

  const brBody = document.querySelector("#branchTable tbody");
  brBody.innerHTML = "";
  let brTotal = 0;
  BRANCHES.forEach(name => {
    const amt = Number(data.branchSales && data.branchSales[name] || 0);
    brTotal += amt;
    brBody.innerHTML += `<tr><td>${name}</td><td style="text-align:right;">₹${amt.toLocaleString('en-IN')}</td></tr>`;
  });
  brBody.innerHTML += `<tr class="total-row"><td>Total</td><td style="text-align:right;">₹${brTotal.toLocaleString('en-IN')}</td></tr>`;

  document.getElementById("statEmpTotal").textContent = `₹${empTotal.toLocaleString('en-IN')}`;
  document.getElementById("statBranchTotal").textContent = `₹${brTotal.toLocaleString('en-IN')}`;

  buildWhatsAppSummary(date, data, empTotal, brTotal);
}

function formatDateReadable(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

let currentSummaryText = "";

function buildWhatsAppSummary(date, data, empTotal, brTotal) {
  let lines = [];
  lines.push(`*JCM ENTERPRISE — DAILY SALES REPORT*`);
  lines.push(`📅 ${formatDateReadable(date)}`);
  lines.push(``);
  lines.push(`*Employee Sales*`);
  SALESPEOPLE.forEach(name => {
    const amt = Number(data.salespersonSales && data.salespersonSales[name] || 0);
    lines.push(`${name}: ₹${amt.toLocaleString('en-IN')}`);
  });
  lines.push(`*Total: ₹${empTotal.toLocaleString('en-IN')}*`);
  lines.push(``);
  lines.push(`*Branch Sales*`);
  BRANCHES.forEach(name => {
    const amt = Number(data.branchSales && data.branchSales[name] || 0);
    lines.push(`${name}: ₹${amt.toLocaleString('en-IN')}`);
  });
  lines.push(`*Total: ₹${brTotal.toLocaleString('en-IN')}*`);

  currentSummaryText = lines.join("\n");
  document.getElementById("waSummary").textContent = currentSummaryText;
}

function shareWhatsApp() {
  const text = encodeURIComponent(currentSummaryText);
  const url = OWNER_PHONE ? `https://wa.me/${OWNER_PHONE}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, "_blank");
}

function copySummary() {
  navigator.clipboard.writeText(currentSummaryText).then(() => alert("Report copied to clipboard."));
}

// ---------- INVOICES: BUSY HTML IMPORT ----------
// BUSY's "Bills Receivable" HTML export is a real <table>, which is far more
// reliable to parse than its PDF export (PDF text often loses column
// alignment). We match header cells loosely against a few known aliases.
const COLUMN_ALIASES = {
  invoiceNo: ["billno", "billno.", "voucherno", "refno", "invoiceno", "docno"],
  party: ["partyname", "party", "accountname", "name", "customername"],
  amount: ["pendingamount", "balance", "amount", "billamount", "netamount", "outstandingamount"],
  invoiceDate: ["billdate", "vchdate", "voucherdate", "invoicedate", "date"]
};

function normalizeHeader(h) {
  return String(h || "").toLowerCase().replace(/[\s.]/g, "");
}

function parseBusyDate(raw) {
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

function findColumnIndex(headers, aliasKey) {
  const normalized = headers.map(normalizeHeader);
  const aliases = COLUMN_ALIASES[aliasKey];
  for (let i = 0; i < normalized.length; i++) {
    if (aliases.includes(normalized[i])) return i;
  }
  return -1;
}

function parseBusyHtmlTable(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  if (!tables.length) return null;

  // Pick the largest table on the page (BUSY exports sometimes wrap the
  // report table inside outer layout tables).
  let best = tables[0];
  let bestRowCount = 0;
  tables.forEach(t => {
    const count = t.querySelectorAll("tr").length;
    if (count > bestRowCount) { bestRowCount = count; best = t; }
  });

  const rows = Array.from(best.querySelectorAll("tr")).map(tr =>
    Array.from(tr.querySelectorAll("td,th")).map(td => td.textContent.trim())
  ).filter(r => r.some(c => c !== ""));

  return rows;
}

async function importHtml() {
  const fileInput = document.getElementById("htmlFile");
  const msgEl = document.getElementById("importMsg");
  msgEl.classList.remove("hidden", "success", "error");

  if (!fileInput.files.length) {
    msgEl.classList.add("error");
    msgEl.textContent = "Choose the BUSY HTML export file first.";
    return;
  }

  const file = fileInput.files[0];
  const text = await file.text();
  const rows = parseBusyHtmlTable(text);

  if (!rows || rows.length < 2) {
    msgEl.classList.add("error");
    msgEl.textContent = "Couldn't find a data table in that file.";
    return;
  }

  // Find the header row: the first row where we can match at least the
  // invoice number and amount columns (BUSY HTML exports sometimes have a
  // title row above the real header row).
  let headerRowIdx = -1, idx = null;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const candidate = {
      invoiceNo: findColumnIndex(rows[i], "invoiceNo"),
      party: findColumnIndex(rows[i], "party"),
      amount: findColumnIndex(rows[i], "amount"),
      invoiceDate: findColumnIndex(rows[i], "invoiceDate")
    };
    if (candidate.invoiceNo !== -1 && candidate.amount !== -1) {
      headerRowIdx = i;
      idx = candidate;
      break;
    }
  }

  if (headerRowIdx === -1) {
    msgEl.classList.add("error");
    msgEl.textContent = "Couldn't recognize the column headers in this file. Send Claude the header row text so the matching can be updated.";
    return;
  }

  const missing = Object.keys(idx).filter(k => idx[k] === -1);
  if (missing.length) {
    msgEl.classList.add("error");
    msgEl.textContent = `Couldn't find a column for: ${missing.join(", ")}. Send Claude the header row so it can be added.`;
    return;
  }

  const dataRows = rows.slice(headerRowIdx + 1);
  const invoices = dataRows.map(r => ({
    invoiceNo: r[idx.invoiceNo],
    party: r[idx.party],
    amount: (r[idx.amount] || "").replace(/[^0-9.\-]/g, ""),
    invoiceDate: parseBusyDate(r[idx.invoiceDate])
  })).filter(inv => inv.invoiceNo && inv.invoiceNo.trim() !== "" && inv.amount !== "");

  if (!invoices.length) {
    msgEl.classList.add("error");
    msgEl.textContent = "Found the table but no usable invoice rows in it. Check the exported file.";
    return;
  }

  msgEl.textContent = "";
  showLoadingMsg("importMsg", `Importing ${invoices.length} rows...`);

  try {
    const result = await apiPost({ action: "bulkAddInvoices", invoices });
    showResultMsg("importMsg", `Imported ${result.added} new invoice(s). Skipped ${result.skipped} already on file (matched by invoice number).`, true);
    fileInput.value = "";
    loadInvoices();
  } catch (err) {
    showResultMsg("importMsg", "Import failed. Check your internet connection and try again.", false);
  }
}

// ---------- INVOICES: manual + list ----------
async function addInvoice() {
  const invoiceNo = document.getElementById("invNo").value.trim();
  const party = document.getElementById("invParty").value.trim();
  const amount = document.getElementById("invAmount").value;
  const invoiceDate = document.getElementById("invDate").value;
  const msgEl = document.getElementById("invMsg");

  if (!invoiceNo || !party || !amount || !invoiceDate) {
    msgEl.classList.remove("hidden", "success");
    msgEl.classList.add("error");
    msgEl.textContent = "Please fill in all fields.";
    return;
  }

  showLoadingMsg("invMsg", "Saving...");

  try {
    await apiPost({ action: "addInvoice", invoiceNo, party, amount, invoiceDate });
    showResultMsg("invMsg", `Invoice ${invoiceNo} added.`, true);
    document.getElementById("invNo").value = "";
    document.getElementById("invParty").value = "";
    document.getElementById("invAmount").value = "";
    loadInvoices();
  } catch (err) {
    showResultMsg("invMsg", "Error saving invoice. Try again.", false);
  }
}

async function loadInvoices() {
  const data = await apiGet("getInvoices");
  const tbody = document.querySelector("#invTable tbody");
  tbody.innerHTML = "";

  const unpaid = (data.invoices || []).filter(inv => inv.status !== "Cleared");
  unpaid.sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate));

  if (unpaid.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);">No outstanding invoices.</td></tr>`;
    return;
  }

  unpaid.forEach(inv => {
    const days = Math.floor((new Date() - new Date(inv.invoiceDate)) / (1000 * 60 * 60 * 24));
    let badgeClass = "ok";
    if (days > 60) badgeClass = "danger";
    else if (days > 30) badgeClass = "warn";

    tbody.innerHTML += `
      <tr>
        <td>${inv.invoiceNo}</td>
        <td>${inv.party}</td>
        <td style="text-align:right;">₹${Number(inv.amount).toLocaleString('en-IN')}</td>
        <td><span class="badge ${badgeClass}">${days} days</span></td>
        <td><button class="secondary" style="padding:5px 10px;font-size:11px;" onclick="clearInvoice('${inv.invoiceNo}')">Mark Cleared</button></td>
      </tr>`;
  });
}

async function clearInvoice(invoiceNo) {
  if (!confirm(`Mark invoice ${invoiceNo} as cleared/paid?`)) return;
  await apiPost({ action: "markInvoiceCleared", invoiceNo });
  loadInvoices();
}

// ---------- MONTHLY REPORT (full incentive logic) ----------
let currentMonthlyRows = [];
let currentMonthlyMeta = {};

async function loadMonthlyReport() {
  const month = document.getElementById("monthPicker").value || currentMonthStr();
  showLoadingMsg("monthlyMsg", "Loading report...");
  document.getElementById("monthlyMsg").classList.remove("hidden");

  const data = await apiGet("getMonthlyReport", { month });
  currentMonthlyRows = data.rows || [];
  currentMonthlyMeta = { clawbackTotal: data.clawbackTotal, clawbackInvoices: data.clawbackInvoices };

  document.getElementById("monthlyMsg").classList.add("hidden");

  const tbody = document.querySelector("#monthlyTable tbody");
  tbody.innerHTML = "";

  if (!currentMonthlyRows.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px;">No data for this month yet.</td></tr>`;
    return;
  }

  currentMonthlyRows.forEach(r => {
    // Achievement badge
    let achClass = "danger";
    if (r.achievedPct === null) achClass = "warn";
    else if (r.achievedPct >= 150) achClass = "ok";
    else if (r.achievedPct >= 100) achClass = "ok";
    const pctLabel = r.achievedPct === null ? "—" : `${r.achievedPct}%`;

    // Increment status badge
    let incClass = "warn";
    let incIcon = "";
    if (r.incrementFlag === "phase1_eligible" || r.incrementFlag === "phase2_eligible") {
      incClass = "ok"; incIcon = "🔔 ";
    } else if (r.incrementFlag === "phase2_confirmed") {
      incClass = "ok"; incIcon = "✓ ";
    } else if (r.incrementFlag === "frozen") {
      incClass = "danger"; incIcon = "❄ ";
    }

    const attLabel = r.attendanceMarked
      ? `${r.daysPresent}P ${r.daysHalf}H ${r.daysLeave}L`
      : `<span class="badge warn">?</span>`;

    tbody.innerHTML += `<tr>
      <td><strong>${r.salesperson}</strong></td>
      <td style="text-align:right;">₹${r.monthlySalary.toLocaleString('en-IN')}</td>
      <td style="text-align:right;">₹${r.target.toLocaleString('en-IN')}</td>
      <td style="text-align:right;">₹${r.grossAchieved.toLocaleString('en-IN')}</td>
      <td><span class="badge ${achClass}">${pctLabel}</span></td>
      <td>${r.bonusTier}</td>
      <td style="text-align:right;color:var(--ok);font-weight:600;">₹${r.bonus.toLocaleString('en-IN')}</td>
      <td>${attLabel}</td>
      <td style="text-align:right;font-weight:700;">₹${r.totalPayable.toLocaleString('en-IN')}</td>
      <td><span class="badge ${incClass}" style="font-size:10px;white-space:nowrap;">${incIcon}${r.incrementStatus}</span></td>
    </tr>`;
  });

  // Clawback notice
  const clawEl = document.getElementById("clawbackNotice");
  if (data.clawbackTotal > 0) {
    clawEl.classList.remove("hidden");
    document.getElementById("clawbackAmount").textContent = `₹${data.clawbackTotal.toLocaleString('en-IN')}`;
    const clawList = document.getElementById("clawbackList");
    clawList.innerHTML = (data.clawbackInvoices || []).map(inv =>
      `<li>${inv.invoiceNo} — ${inv.party} — ₹${Number(inv.amount).toLocaleString('en-IN')} (${inv.daysOut} days)</li>`
    ).join("");
  } else {
    clawEl.classList.add("hidden");
  }

  // Show flagged increments
  renderIncrementAlerts(currentMonthlyRows, month);
}

function renderIncrementAlerts(rows, month) {
  const alertBox = document.getElementById("incrementAlerts");
  const phase1Eligible = rows.filter(r => r.incrementFlag === "phase1_eligible");
  const phase2Eligible = rows.filter(r => r.incrementFlag === "phase2_eligible");

  if (!phase1Eligible.length && !phase2Eligible.length) {
    alertBox.classList.add("hidden");
    return;
  }

  alertBox.classList.remove("hidden");
  let html = "";

  if (phase1Eligible.length) {
    html += `<div class="alert-block alert-orange">
      <strong>🔔 Phase 1 Increment Due</strong>
      <p>These salespeople hit 100%+ in 4 of the last 5 months. Per policy, they are eligible for <strong>50% of their increment now</strong>.</p>
      <ul>${phase1Eligible.map(r => `<li>${r.salesperson}</li>`).join("")}</ul>
      <button class="primary" style="margin-top:8px;" onclick="confirmIncrements('phase1', '${month}')">Confirm & Record Phase 1</button>
    </div>`;
  }

  if (phase2Eligible.length) {
    html += `<div class="alert-block alert-ok">
      <strong>✅ Phase 2 Increment Due</strong>
      <p>These salespeople completed 3 more months at 100%+ after Phase 1. Per policy, their <strong>remaining 50% increment is now confirmed</strong>.</p>
      <ul>${phase2Eligible.map(r => `<li>${r.salesperson}</li>`).join("")}</ul>
      <button class="primary" style="margin-top:8px;background:var(--ok);" onclick="confirmIncrements('phase2', '${month}')">Confirm & Record Phase 2</button>
    </div>`;
  }

  alertBox.innerHTML = html;
}

async function confirmIncrements(phase, month) {
  if (!confirm(`Record ${phase === "phase1" ? "Phase 1" : "Phase 2"} increment confirmations for ${month}? This will update the IncentiveStatus sheet.`)) return;

  const eligible = currentMonthlyRows.filter(r =>
    r.incrementFlag === (phase === "phase1" ? "phase1_eligible" : "phase2_eligible")
  );

  const records = currentMonthlyRows.map(r => ({
    salesperson: r.salesperson,
    achievedPct: r.achievedPct,
    hitTarget: r.hitTarget,
    phase1Triggered: phase === "phase1" ? eligible.some(e => e.salesperson === r.salesperson) : (r.phase1Month !== null),
    phase2Triggered: phase === "phase2" ? eligible.some(e => e.salesperson === r.salesperson) : (r.phase2Month !== null),
    notes: phase === "phase1"
      ? (eligible.some(e => e.salesperson === r.salesperson) ? "Phase 1 confirmed" : "")
      : (eligible.some(e => e.salesperson === r.salesperson) ? "Phase 2 confirmed" : "")
  }));

  await apiPost({ action: "saveMonthlyIncentiveRecord", month, records });
  alert("Recorded. Update salaries in the Targets sheet manually to complete the increment.");
  loadMonthlyReport();
}

function downloadMonthlyCsv() {
  const month = document.getElementById("monthPicker").value || currentMonthStr();
  let csv = "Salesperson,Monthly Salary,Target (x40),Gross Achieved,Achievement %,Bonus Tier,Bonus Amount,Days Present,Days Half,Days Leave,Prorated Salary,Total Payable,Increment Status\n";
  currentMonthlyRows.forEach(r => {
    csv += [
      r.salesperson, r.monthlySalary, r.target, r.grossAchieved,
      r.achievedPct === null ? "" : r.achievedPct,
      `"${r.bonusTier}"`, r.bonus,
      r.daysPresent, r.daysHalf, r.daysLeave,
      r.proratedSalary, r.totalPayable,
      `"${r.incrementStatus}"`
    ].join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `JCM_Salary_Calc_${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- START ----------
window.addEventListener("DOMContentLoaded", checkSession);
