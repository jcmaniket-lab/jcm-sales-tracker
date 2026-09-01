// ---------- CONFIG ----------
// No PIN is stored here. It's entered at login and checked against Google's
// Script Properties on the server (see apps-script/Code.gs). It's only kept
// in sessionStorage for this browser tab, never in a file.
const SALESPEOPLE = ["Hetvi", "Sakshi", "Jayu", "Ragini", "Arvind", "Himanshu", "Shoaib"];
const BRANCHES = ["Kim GIDC", "Udhna GIDC"];

const BRANCH_MEMBERS = {
  "Kim GIDC":   ["Arvind", "Jayu", "Sakshi"],
  "Udhna GIDC": ["Ragini", "Hetvi", "Himanshu", "Shoaib"]
};

function isSunday(dateStr) {
  return new Date(dateStr).getDay() === 0;
}
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
  const sunday = isSunday(date);
  const data = await apiGet("getDaily", { date });
  const dailyTargets = data.dailyTargets || {};

  // Stat cards — overall totals
  let empTotal = 0;
  SALESPEOPLE.forEach(n => empTotal += Number(data.salespersonSales && data.salespersonSales[n] || 0));
  let brTotal = 0;
  BRANCHES.forEach(n => brTotal += Number(data.branchSales && data.branchSales[n] || 0));
  document.getElementById("statEmpTotal").textContent = `₹${empTotal.toLocaleString("en-IN")}`;
  document.getElementById("statBranchTotal").textContent = `₹${brTotal.toLocaleString("en-IN")}`;

  // Employee tables — split by branch
  const empContainer = document.getElementById("empTablesContainer");
  empContainer.innerHTML = "";

  Object.keys(BRANCH_MEMBERS).forEach(branch => {
    const members = BRANCH_MEMBERS[branch];
    let branchEmpTotal = 0;
    let rowsHtml = "";

    members.forEach(name => {
      const amt    = Number(data.salespersonSales && data.salespersonSales[name] || 0);
      branchEmpTotal += amt;
      const target = dailyTargets[name] || 0;
      const hit    = !sunday && target > 0 && amt >= target;
      const miss   = !sunday && target > 0 && amt < target;
      const rowBg    = hit ? "var(--ok-tint)" : miss ? "var(--red-tint)" : "";
      const amtColor = hit ? "var(--ok)"      : miss ? "var(--danger)"   : "inherit";
      const dot = target > 0
        ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-left:6px;vertical-align:middle;background:${sunday ? "var(--muted)" : hit ? "var(--ok)" : "var(--danger)"}" title="${sunday ? "Sunday — bonus day" : hit ? "Hit daily target" : "Below daily target"}"></span>`
        : "";
      const targetLabel = !sunday && target > 0
        ? `<span style="color:var(--muted);font-size:10.5px;font-family:var(--font-body);"> / ₹${target.toLocaleString("en-IN")}</span>`
        : sunday && target > 0
          ? `<span style="color:var(--muted);font-size:10px;font-family:var(--font-body);"> bonus day</span>`
          : "";
      rowsHtml += `<tr style="background:${sunday ? "" : rowBg}">
        <td>${name}${dot}</td>
        <td style="text-align:right;color:${sunday ? "inherit" : amtColor};font-weight:${hit && !sunday ? "700" : "400"};">₹${amt.toLocaleString("en-IN")}${targetLabel}</td>
      </tr>`;
    });
    rowsHtml += `<tr class="total-row"><td>Total</td><td style="text-align:right;">₹${branchEmpTotal.toLocaleString("en-IN")}</td></tr>`;

    empContainer.innerHTML += `
      <div style="margin-bottom:18px;">
        <h3>${branch}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Salesperson</th><th style="text-align:right;">Sales${sunday ? " ☀ Sunday" : ""}</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>`;
  });

  // Branch totals table
  const brBody = document.querySelector("#branchTable tbody");
  brBody.innerHTML = "";
  let brTotal2 = 0;
  BRANCHES.forEach(name => {
    const amt = Number(data.branchSales && data.branchSales[name] || 0);
    brTotal2 += amt;
    brBody.innerHTML += `<tr><td>${name}</td><td style="text-align:right;">₹${amt.toLocaleString("en-IN")}</td></tr>`;
  });
  brBody.innerHTML += `<tr class="total-row"><td>Total</td><td style="text-align:right;">₹${brTotal2.toLocaleString("en-IN")}</td></tr>`;

  buildWhatsAppSummary(date, data, empTotal, brTotal2, sunday);
}

function formatDateReadable(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

let currentSummaryByBranch = {};

function buildWhatsAppSummary(date, data, empTotal, brTotal, sunday) {
  const dateLabel = formatDateReadable(date);
  const sundayNote = sunday ? "\n☀ Sunday — bonus orders, no target" : "";

  currentSummaryByBranch = {};
  Object.keys(BRANCH_MEMBERS).forEach(branch => {
    const members = BRANCH_MEMBERS[branch];
    let lines = [];
    lines.push(`*JCM ENTERPRISE — ${branch.toUpperCase()}*`);
    lines.push(`📅 ${dateLabel}${sundayNote}`);
    lines.push(``);
    let total = 0;
    members.forEach(name => {
      const amt = Number(data.salespersonSales && data.salespersonSales[name] || 0);
      total += amt;
      lines.push(`${name}: ₹${amt.toLocaleString("en-IN")}`);
    });
    lines.push(`*Total: ₹${total.toLocaleString("en-IN")}*`);
    currentSummaryByBranch[branch] = lines.join("\n");
  });

  // Combined preview in the summary box
  let allLines = [];
  allLines.push(`*JCM ENTERPRISE — DAILY SALES REPORT*`);
  allLines.push(`📅 ${dateLabel}${sundayNote}`);
  Object.keys(BRANCH_MEMBERS).forEach(branch => {
    allLines.push(``);
    allLines.push(`*${branch}*`);
    let total = 0;
    BRANCH_MEMBERS[branch].forEach(name => {
      const amt = Number(data.salespersonSales && data.salespersonSales[name] || 0);
      total += amt;
      allLines.push(`${name}: ₹${amt.toLocaleString("en-IN")}`);
    });
    allLines.push(`Total: ₹${total.toLocaleString("en-IN")}`);
  });
  allLines.push(``);
  allLines.push(`*Branch Totals*`);
  BRANCHES.forEach(name => {
    const amt = Number(data.branchSales && data.branchSales[name] || 0);
    allLines.push(`${name}: ₹${amt.toLocaleString("en-IN")}`);
  });
  allLines.push(`*Grand Total: ₹${brTotal.toLocaleString("en-IN")}*`);
  document.getElementById("waSummary").textContent = allLines.join("\n");
}

function shareWhatsApp(branch) {
  const text = branch
    ? encodeURIComponent(currentSummaryByBranch[branch] || "")
    : encodeURIComponent(Object.values(currentSummaryByBranch).join("\n\n"));
  const url = OWNER_PHONE ? `https://wa.me/${OWNER_PHONE}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, "_blank");
}

function copySummary() {
  const text = Object.values(currentSummaryByBranch).join("\n\n");
  navigator.clipboard.writeText(text).then(() => alert("Full report copied to clipboard."));
}

// ---------- INVOICES: BUSY HTML IMPORT ----------
// BUSY exports are UTF-16 LE encoded, fixed-width <pre> text inside HTML.
// The per-salesperson file has "Salesman : HETVI" in the header — we read
// that and tag every invoice with the salesperson name automatically.
// For the ALL file (no salesman filter), salesperson is left blank.

function parseBusyHtmlReport(htmlText) {
  // Handles two BUSY export formats:
  // 1. Salesman-wise Receivable (Display > Outstanding Analysis > Salesman-wise Receivables)
  //    One file, all salespeople, sections separated by "Salesman : NAME" headers.
  //    Uses <Br> tags as line separators.
  // 2. Bills Receivable filtered per salesperson (legacy, still supported)

  // Normalise: replace <Br> tags with newlines, strip all other HTML, decode &nbsp;
  const plain = htmlText
    .replace(/<[Bb][Rr]\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ');

  // SALESMAN_MAP: maps BUSY's salesman names (uppercased) to canonical app names.
  // Longest-match wins (e.g. "RAGINI SINGH" matched before "RAGINI").
  const SALESMAN_MAP = {
    'ARVIND YADAV': 'Arvind',  'ARVIND': 'Arvind',
    'HETVI': 'Hetvi',
    'HIMANSHU': 'Himanshu',
    'JAYU RAJPUT': 'Jayu',     'JAYU': 'Jayu',
    'RAGINI SINGH': 'Ragini',  'RAGINI': 'Ragini',
    'SAKSHI SHARMA': 'Sakshi', 'SAKSHI': 'Sakshi',
    'SHOHEB': 'Shoaib',        'SHOAIB': 'Shoaib'
  };
  const MAP_KEYS = Object.keys(SALESMAN_MAP).sort((a, b) => b.length - a.length);

  function matchSalesman(raw) {
    const u = raw.trim().toUpperCase();
    for (const key of MAP_KEYS) { if (u.startsWith(key)) return SALESMAN_MAP[key]; }
    return null;
  }

  // Detect file type
  const isSalesmanWise = /SALESMAN-WISE RECEIVABLE/i.test(plain);

  const invoices = [];
  const lines = plain.split('\n');

  if (isSalesmanWise) {
    // ── Salesman-wise Receivable ──────────────────────────────────────────────
    // Fixed-width columns: space + 41-char party + refno + type + date + totalAmt + pendingAmt
    const DATA_RE = /^ (.{41})(\S+)\s+(Sale|OpBl)\s+(\d{2}-\d{2}-\d{4})\s+[\d,]+\.\d{2}\s+([\d,]+\.\d{2})/;
    let currentSp = null;

    for (const line of lines) {
      const smMatch = line.match(/^\s*Salesman\s*:\s*(.+)/);
      if (smMatch) {
        currentSp = matchSalesman(smMatch[1]);
        continue;
      }
      if (!currentSp) continue;

      const m = DATA_RE.exec(line);
      if (!m) continue;
      const party = m[1].trim().replace(/^[\d\s\-]+/, '').trim();
      if (!party) continue;
      const penAmt = parseFloat(m[5].replace(/,/g, '')) || 0;
      if (penAmt <= 0) continue;
      const [d, mo, y] = m[4].split('-');
      invoices.push({
        invoiceNo:   m[2].trim(),
        party:       party,
        amount:      penAmt,
        invoiceDate: `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`,
        salesperson: currentSp
      });
    }
    return { salesman: 'ALL (Salesman-wise)', invoices };

  } else {
    // ── Bills Receivable (per-salesperson) ───────────────────────────────────
    const smMatch = plain.match(/Salesman\s*[:\-]\s*([A-Za-z][A-Za-z\s]+?)\s{3,}/);
    const salesman = smMatch ? matchSalesman(smMatch[1]) : null;

    const DATA_RE = /([A-Z0-9][^\n]{22,32}?)\s{2,}(\S+)\s+(Sale|OpBl)\s+(\S+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+[YN]\s+[\d\-]+\s+(-?\d+|-{1,4})/g;
    let m;
    while ((m = DATA_RE.exec(plain)) !== null) {
      const party = m[1].trim().replace(/^[\d\s\-]+/, '').trim();
      if (!party) continue;
      const penAmt = parseFloat(m[6].replace(/,/g, '')) || 0;
      if (penAmt <= 0) continue;
      const [d, mo, y] = m[4].split('-');
      invoices.push({
        invoiceNo:   m[2].trim(),
        party:       party,
        amount:      penAmt,
        invoiceDate: `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`,
        salesperson: salesman || ''
      });
    }
    return { salesman, invoices };
  }
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
  const { salesman, invoices } = parseBusyHtmlReport(text);

  if (!invoices.length) {
    msgEl.classList.add("error");
    msgEl.textContent = "No Sale entries found. Make sure you exported with Type of Entries: Pending and the file is the BUSY HTML Bills Receivable report.";
    return;
  }

  const spLabel = salesman || "ALL (Salesman-wise)";
  showLoadingMsg("importMsg", `Importing ${invoices.length} invoices (${spLabel})...`);

  try {
    const result = await apiPost({ action: "bulkAddInvoices", invoices });
    showResultMsg("importMsg",
      `✓ Imported ${result.added} invoice(s) (${spLabel}). ${result.skipped} already on file — skipped.`,
      true
    );
    fileInput.value = "";
    loadInvoices();
  } catch (err) {
    showResultMsg("importMsg", "Import failed. Check your internet connection and try again.", false);
  }
}


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
        <td>${inv.salesperson ? `<span class="badge warn" style="font-size:10px;">${inv.salesperson}</span>` : '<span style="color:var(--muted);font-size:11px;">—</span>'}</td>
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
  document.getElementById("monthlyCards").innerHTML = "";

  const data = await apiGet("getMonthlyReport", { month });
  currentMonthlyRows = data.rows || [];
  currentMonthlyMeta = { clawbackTotal: data.clawbackTotal, clawbackInvoices: data.clawbackInvoices };

  document.getElementById("monthlyMsg").classList.add("hidden");

  const container = document.getElementById("monthlyCards");

  if (!currentMonthlyRows.length) {
    container.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px 0;">No data for this month yet.</p>`;
    return;
  }

  currentMonthlyRows.forEach(r => {
    const pct = r.achievedPct;
    const pctLabel = pct === null ? "—" : `${pct}%`;
    let pctClass = "danger";
    if (pct === null) pctClass = "warn";
    else if (pct >= 100) pctClass = "ok";
    else if (pct >= 75) pctClass = "warn";

    // Clawback — deducted from bonus only, shown clearly
    // Only shows if there was a clawback this month (invoice raised in report month, now 60+ days unpaid)
    const hasClawback = r.clawback > 0;
    const clawbackRow = hasClawback ? `
      <div class="stat-item">
        <span class="stat-item-label">Gross Bonus (${r.bonusTier})</span>
        <span class="stat-item-val">₹${(r.grossBonus || 0).toLocaleString('en-IN')}</span>
      </div>
      <div class="stat-item" style="background:var(--red-tint);border-radius:6px;padding:4px 8px;">
        <span class="stat-item-label" style="color:var(--danger);">Clawback from bonus (this month's invoices, 60+ days unpaid)</span>
        <span class="stat-item-val" style="color:var(--danger);">−₹${r.clawback.toLocaleString('en-IN')}</span>
      </div>` : '';

    // Bonus after clawback (what's actually paid)
    const bonusLabel = (r.bonus > 0 && !hasClawback)
      ? `₹${r.bonus.toLocaleString('en-IN')} <span style="color:var(--muted);font-size:11px;">(${r.bonusTier})</span>`
      : hasClawback
        ? `₹${r.bonus.toLocaleString('en-IN')} <span style="color:var(--muted);font-size:11px;">(after clawback)</span>`
        : `<span style="color:var(--muted);">—</span>`;

    // Attendance
    const attLabel = r.attendanceMarked
      ? `${r.daysPresent} Present · ${r.daysHalf} Half · ${r.daysLeave} Leave`
      : `<span style="color:var(--warn);">Not marked yet</span>`;

    // Increment status
    let incClass = "warn", incIcon = "";
    if (r.incrementFlag === "phase1_eligible" || r.incrementFlag === "phase2_eligible") { incClass = "ok"; incIcon = "🔔 "; }
    else if (r.incrementFlag === "phase2_confirmed") { incClass = "ok"; incIcon = "✓ "; }
    else if (r.incrementFlag === "frozen") { incClass = "danger"; incIcon = "❄ "; }

    // Progress bar for rolling window (out of 5)
    const hits = r.hitsInWindow || 0;
    const windowSize = r.windowSize || 0;
    const progressDots = Array.from({ length: 5 }, (_, i) => {
      const filled = i < hits;
      return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:3px;background:${filled ? 'var(--ok)' : 'var(--line)'};" title="${filled ? 'Hit target' : 'Missed or no data'}"></span>`;
    }).join("");

    container.innerHTML += `
      <div class="person-card">
        <div class="person-card-header">
          <span class="person-name">${r.salesperson}</span>
          <span class="badge ${pctClass} person-pct">${pctLabel}</span>
        </div>

        <div class="person-stats">
          <div class="stat-item">
            <span class="stat-item-label">Monthly Salary</span>
            <span class="stat-item-val">₹${r.monthlySalary.toLocaleString('en-IN')}</span>
          </div>
          <div class="stat-item">
            <span class="stat-item-label">Target</span>
            <span class="stat-item-val">₹${r.target.toLocaleString('en-IN')}</span>
          </div>
          <div class="stat-item">
            <span class="stat-item-label">Gross Achieved</span>
            <span class="stat-item-val">₹${r.grossAchieved.toLocaleString('en-IN')}</span>
          </div>
          ${clawbackRow}
          <div class="stat-item">
            <span class="stat-item-label">Bonus Payable</span>
            <span class="stat-item-val">${bonusLabel}</span>
          </div>
          <div class="stat-item">
            <span class="stat-item-label">Attendance</span>
            <span class="stat-item-val" style="font-family:var(--font-body);font-size:12px;">${attLabel}</span>
          </div>
          <div class="stat-item">
            <span class="stat-item-label">Prorated Salary</span>
            <span class="stat-item-val">₹${r.proratedSalary.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div class="person-payable">
          <span>Total Payable</span>
          <span class="payable-amount">₹${r.totalPayable.toLocaleString('en-IN')}</span>
        </div>

        <div class="person-increment">
          <div style="margin-bottom:5px;">
            <span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.07em;">Rolling window (last 5 months)</span>
            <span style="float:right;">${progressDots}</span>
          </div>
          <span class="badge ${incClass}" style="font-size:11px;">${incIcon}${r.incrementStatus}</span>
        </div>
      </div>`;
  });

  // Clawback notice
  const clawEl = document.getElementById("clawbackNotice");
  if (data.clawbackTotal > 0) {
    clawEl.classList.remove("hidden");
    document.getElementById("clawbackAmount").textContent = `₹${data.clawbackTotal.toLocaleString('en-IN')}`;
    document.getElementById("clawbackList").innerHTML = (data.clawbackInvoices || []).map(inv =>
      `<li>${inv.invoiceNo} · ${inv.party} · ₹${Number(inv.amount).toLocaleString('en-IN')} · ${inv.daysOut} days</li>`
    ).join("");
  } else {
    clawEl.classList.add("hidden");
  }

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
  let csv = "Salesperson,Monthly Salary,Target,Gross Achieved,Achievement %,Bonus Tier,Bonus Amount,Days Present,Days Half,Days Leave,Prorated Salary,Total Payable,Increment Status\n";
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
