const schema = [
  { key: "customer_id", label: "Customer ID", required: true, aliases: ["customer_id", "cust_id", "subscriber_id", "subscriber_no", "account_id"] },
  { key: "phone_number", label: "Phone Number", required: false, aliases: ["phone_number", "mobile", "mobile_no", "msisdn", "phone", "contact"] },
  { key: "state", label: "State", required: false, aliases: ["state", "circle", "region", "zone"] },
  { key: "city", label: "City", required: false, aliases: ["city", "town", "location"] },
  { key: "tenure_months", label: "Tenure Months", required: false, aliases: ["tenure_months", "tenure", "customer_age_months"] },
  { key: "plan_type", label: "Plan Type", required: false, aliases: ["plan_type", "plan", "prepaid_postpaid", "billing_type"] },
  { key: "connection_type", label: "Connection Type", required: false, aliases: ["connection_type", "network_type", "technology", "service_type"] },
  { key: "monthly_charge_inr", label: "Monthly Charge", required: false, aliases: ["monthly_charge_inr", "monthly_charge", "monthly_bill", "arpu", "bill_amount"] },
  { key: "avg_data_usage_gb", label: "Data Usage GB", required: false, aliases: ["avg_data_usage_gb", "data_usage", "data_gb", "usage_gb"] },
  { key: "avg_call_minutes", label: "Call Minutes", required: false, aliases: ["avg_call_minutes", "call_minutes", "voice_usage", "minutes"] },
  { key: "support_tickets_90d", label: "Support Tickets 90d", required: false, aliases: ["support_tickets_90d", "support_tickets", "tickets", "case_count"] },
  { key: "complaints_90d", label: "Complaints 90d", required: false, aliases: ["complaints_90d", "complaints", "complaint_count", "grievances"] },
  { key: "network_issue_count_90d", label: "Network Issues 90d", required: false, aliases: ["network_issue_count_90d", "network_issues", "call_drops", "outages"] },
  { key: "late_payment_count_6m", label: "Late Payments 6m", required: false, aliases: ["late_payment_count_6m", "late_payments", "payment_delays"] },
  { key: "last_recharge_days_ago", label: "Last Recharge Days Ago", required: false, aliases: ["last_recharge_days_ago", "days_since_recharge", "last_recharge"] },
  { key: "payment_method", label: "Payment Method", required: false, aliases: ["payment_method", "pay_method", "mode_of_payment"] },
  { key: "autopay_enabled", label: "Autopay Enabled", required: false, aliases: ["autopay_enabled", "autopay", "auto_debit"] },
  { key: "whatsapp_opt_in", label: "WhatsApp Opt In", required: false, aliases: ["whatsapp_opt_in", "wa_opt_in", "marketing_opt_in", "consent"] },
  { key: "competitor_offer_seen", label: "Competitor Offer Seen", required: false, aliases: ["competitor_offer_seen", "competitor_offer", "mnp_interest"] },
  { key: "satisfaction_score", label: "Satisfaction Score", required: false, aliases: ["satisfaction_score", "csat", "satisfaction"] },
  { key: "nps_score", label: "NPS Score", required: false, aliases: ["nps_score", "nps"] },
  { key: "churned", label: "Churned", required: true, aliases: ["churned", "churn", "left_company", "ported_out", "terminated"] },
];

const appState = {
  headers: [],
  rows: [],
  mapping: {},
  mappedRows: [],
  predictions: [],
  model: null,
  backendDrivers: [],
};

const els = {
  csvInput: document.getElementById("csvInput"),
  loadDemoBtn: document.getElementById("loadDemoBtn"),
  rowCount: document.getElementById("rowCount"),
  columnCount: document.getElementById("columnCount"),
  validCount: document.getElementById("validCount"),
  modelStatus: document.getElementById("modelStatus"),
  mappingGrid: document.getElementById("mappingGrid"),
  applyMappingBtn: document.getElementById("applyMappingBtn"),
  qualityList: document.getElementById("qualityList"),
  trainBtn: document.getElementById("trainBtn"),
  accuracy: document.getElementById("accuracy"),
  recall: document.getElementById("recall"),
  highRiskCount: document.getElementById("highRiskCount"),
  revenueAtRisk: document.getElementById("revenueAtRisk"),
  riskBars: document.getElementById("riskBars"),
  driversList: document.getElementById("driversList"),
  customerRows: document.getElementById("customerRows"),
  downloadBtn: document.getElementById("downloadBtn"),
  webhookUrl: document.getElementById("webhookUrl"),
  riskThreshold: document.getElementById("riskThreshold"),
  channel: document.getElementById("channel"),
  sendWebhookBtn: document.getElementById("sendWebhookBtn"),
  payloadPreview: document.getElementById("payloadPreview"),
};

els.csvInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  loadCsvText(await file.text());
});

els.loadDemoBtn.addEventListener("click", async () => {
  const response = await fetch("./data/indian_telecom_churn_sample.csv");
  loadCsvText(await response.text());
});

els.applyMappingBtn.addEventListener("click", applyMapping);
els.trainBtn.addEventListener("click", trainAndScore);
els.downloadBtn.addEventListener("click", downloadDangerZone);
els.sendWebhookBtn.addEventListener("click", sendWebhookPayload);
els.riskThreshold.addEventListener("input", updatePayloadPreview);
els.channel.addEventListener("change", updatePayloadPreview);

function loadCsvText(text) {
  const { headers, rows } = parseCsv(text);
  appState.headers = headers;
  appState.rows = rows;
  appState.predictions = [];
  appState.model = null;
  appState.mapping = autoMap(headers);
  renderMapping();
  applyMapping();
  renderModelReset();
}

function parseCsv(text) {
  const rows = [];
  let current = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      current.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      current.push(value.trim());
      if (current.some(Boolean)) rows.push(current);
      current = [];
      value = "";
    } else {
      value += char;
    }
  }

  current.push(value.trim());
  if (current.some(Boolean)) rows.push(current);

  const headers = rows.shift() || [];
  return {
    headers,
    rows: rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]))),
  };
}

function autoMap(headers) {
  const normalizedHeaders = headers.map((header) => ({ raw: header, normalized: normalizeName(header) }));
  const mapping = {};

  schema.forEach((field) => {
    const match = normalizedHeaders.find((header) => field.aliases.some((alias) => header.normalized === normalizeName(alias)));
    mapping[field.key] = match ? match.raw : "";
  });

  return mapping;
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function renderMapping() {
  els.mappingGrid.innerHTML = schema
    .map((field) => {
      const options = ['<option value="">Not available</option>']
        .concat(appState.headers.map((header) => `<option value="${escapeHtml(header)}"${appState.mapping[field.key] === header ? " selected" : ""}>${escapeHtml(header)}</option>`))
        .join("");
      return `
        <div class="map-item">
          <label for="map-${field.key}">${field.label}${field.required ? " *" : ""}</label>
          <select id="map-${field.key}" data-map-key="${field.key}">${options}</select>
        </div>
      `;
    })
    .join("");
}

function applyMapping() {
  document.querySelectorAll("[data-map-key]").forEach((select) => {
    appState.mapping[select.dataset.mapKey] = select.value;
  });

  appState.mappedRows = appState.rows.map((row) => {
    const mapped = {};
    schema.forEach((field) => {
      mapped[field.key] = appState.mapping[field.key] ? row[appState.mapping[field.key]] : "";
    });
    return mapped;
  });

  updateDatasetSummary();
  renderQualityReport();
  updatePayloadPreview();
}

function updateDatasetSummary() {
  els.rowCount.textContent = appState.rows.length.toLocaleString("en-IN");
  els.columnCount.textContent = appState.headers.length.toLocaleString("en-IN");
  els.validCount.textContent = getTrainingRows().length.toLocaleString("en-IN");
}

function getTrainingRows() {
  return appState.mappedRows.filter((row) => parseChurn(row.churned) !== null && row.customer_id);
}

function renderQualityReport() {
  const trainingRows = getTrainingRows();
  const checks = [];
  checks.push({
    label: "Required mapping",
    detail: requiredMappingsMissing().length ? `Missing ${requiredMappingsMissing().join(", ")}` : "Customer ID and churn label are mapped.",
    status: requiredMappingsMissing().length ? "bad" : "ok",
  });
  checks.push({
    label: "Training volume",
    detail: `${trainingRows.length} usable labeled rows. Aim for hundreds or thousands in a real deployment.`,
    status: trainingRows.length >= 30 ? "ok" : trainingRows.length >= 10 ? "warn" : "bad",
  });
  checks.push({
    label: "Feature coverage",
    detail: `${usableFeatureKeys().length} mapped model features are available.`,
    status: usableFeatureKeys().length >= 5 ? "ok" : usableFeatureKeys().length >= 2 ? "warn" : "bad",
  });
  checks.push({
    label: "WhatsApp automation readiness",
    detail: `${countFilled("phone_number")} phone numbers and ${countTruthy("whatsapp_opt_in")} WhatsApp opt-ins found.`,
    status: countFilled("phone_number") > 0 ? "ok" : "warn",
  });
  checks.push({
    label: "Missing churn labels",
    detail: `${appState.mappedRows.length - trainingRows.length} rows cannot train because customer ID or churn label is missing.`,
    status: appState.mappedRows.length === trainingRows.length ? "ok" : "warn",
  });

  els.qualityList.innerHTML = checks
    .map((check) => `
      <div class="quality-item">
        <span>${escapeHtml(check.label)}<br><small>${escapeHtml(check.detail)}</small></span>
        <strong class="${check.status}">${check.status.toUpperCase()}</strong>
      </div>
    `)
    .join("");
}

function requiredMappingsMissing() {
  return schema.filter((field) => field.required && !appState.mapping[field.key]).map((field) => field.label);
}

function usableFeatureKeys() {
  return schema
    .map((field) => field.key)
    .filter((key) => !["customer_id", "phone_number", "churned"].includes(key))
    .filter((key) => appState.mapping[key] && appState.mappedRows.some((row) => String(row[key] || "").trim() !== ""));
}

function countFilled(key) {
  return appState.mappedRows.filter((row) => String(row[key] || "").trim()).length;
}

function countTruthy(key) {
  return appState.mappedRows.filter((row) => isTruthy(row[key])).length;
}

function parseChurn(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["yes", "y", "true", "1", "churned", "left", "ported", "terminated"].includes(normalized)) return 1;
  if (["no", "n", "false", "0", "active", "stayed", "retained"].includes(normalized)) return 0;
  return null;
}

function isTruthy(value) {
  return ["yes", "y", "true", "1", "enabled", "opted in"].includes(String(value || "").trim().toLowerCase());
}

async function trainAndScore() {
  if (requiredMappingsMissing().length) {
    alert("Please map Customer ID and Churned before training.");
    return;
  }

  const featureKeys = usableFeatureKeys();
  const trainingRows = getTrainingRows();
  if (trainingRows.length < 10 || featureKeys.length < 2) {
    alert("Need at least 10 labeled rows and 2 usable features to train this demo model.");
    return;
  }

  const backendResult = await trainWithPythonBackend();
  if (backendResult) {
    appState.model = { metrics: backendResult.metrics, engine: backendResult.engine };
    appState.backendDrivers = backendResult.drivers || [];
    appState.predictions = backendResult.predictions || [];
    renderModel(backendResult.metrics);
    renderCustomers();
    updatePayloadPreview();
    return;
  }

  const encoder = buildEncoder(trainingRows, featureKeys);
  const dataset = trainingRows.map((row) => ({ x: encodeRow(row, encoder), y: parseChurn(row.churned), row }));
  const splitIndex = Math.max(1, Math.floor(dataset.length * 0.75));
  const trainSet = dataset.slice(0, splitIndex);
  const testSet = dataset.slice(splitIndex);
  const model = trainLogisticRegression(trainSet, encoder.featureNames.length);
  const metrics = evaluateModel(model, testSet.length ? testSet : trainSet);

  appState.model = { ...model, encoder, metrics };
  appState.backendDrivers = [];
  appState.predictions = appState.mappedRows
    .filter((row) => row.customer_id)
    .map((row) => {
      const probability = sigmoid(dot(model.weights, encodeRow(row, encoder)) + model.bias);
      const reasons = explainRow(row, encoder, model).slice(0, 3);
      return {
        ...row,
        risk: probability,
        level: riskLevel(probability),
        reasons,
        suggestedOffer: suggestOffer(row, reasons, probability),
      };
    })
    .sort((a, b) => b.risk - a.risk);

  renderModel(metrics);
  renderCustomers();
  updatePayloadPreview();
}

async function trainWithPythonBackend() {
  try {
    const response = await fetch("/api/train", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: appState.mappedRows }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function buildEncoder(rows, featureKeys) {
  const featureMeta = featureKeys.map((key) => {
    const values = rows.map((row) => row[key]).filter((value) => String(value || "").trim() !== "");
    const numericValues = values.map(Number).filter(Number.isFinite);
    const numeric = numericValues.length >= Math.max(5, values.length * 0.65);

    if (numeric) {
      const mean = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
      const variance = numericValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numericValues.length;
      return { key, type: "numeric", mean, std: Math.sqrt(variance) || 1 };
    }

    const counts = {};
    values.forEach((value) => {
      const clean = String(value).trim();
      counts[clean] = (counts[clean] || 0) + 1;
    });
    return { key, type: "category", categories: Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 6) };
  });

  const featureNames = [];
  featureMeta.forEach((meta) => {
    if (meta.type === "numeric") {
      featureNames.push(meta.key);
    } else {
      meta.categories.forEach((category) => featureNames.push(`${meta.key}=${category}`));
    }
  });

  return { featureMeta, featureNames };
}

function encodeRow(row, encoder) {
  const values = [];
  encoder.featureMeta.forEach((meta) => {
    if (meta.type === "numeric") {
      const value = Number(row[meta.key]);
      values.push(Number.isFinite(value) ? (value - meta.mean) / meta.std : 0);
    } else {
      meta.categories.forEach((category) => values.push(String(row[meta.key]).trim() === category ? 1 : 0));
    }
  });
  return values;
}

function trainLogisticRegression(dataset, size) {
  const weights = Array(size).fill(0);
  let bias = 0;
  const learningRate = 0.08;
  const regularization = 0.002;

  for (let epoch = 0; epoch < 850; epoch += 1) {
    const gradient = Array(size).fill(0);
    let biasGradient = 0;

    dataset.forEach((item) => {
      const prediction = sigmoid(dot(weights, item.x) + bias);
      const error = prediction - item.y;
      item.x.forEach((value, index) => {
        gradient[index] += error * value;
      });
      biasGradient += error;
    });

    weights.forEach((weight, index) => {
      weights[index] = weight - learningRate * (gradient[index] / dataset.length + regularization * weight);
    });
    bias -= learningRate * (biasGradient / dataset.length);
  }

  return { weights, bias };
}

function evaluateModel(model, dataset) {
  let correct = 0;
  let truePositive = 0;
  let falseNegative = 0;

  dataset.forEach((item) => {
    const predicted = sigmoid(dot(model.weights, item.x) + model.bias) >= 0.5 ? 1 : 0;
    if (predicted === item.y) correct += 1;
    if (item.y === 1 && predicted === 1) truePositive += 1;
    if (item.y === 1 && predicted === 0) falseNegative += 1;
  });

  return {
    accuracy: correct / dataset.length,
    recall: truePositive + falseNegative === 0 ? 0 : truePositive / (truePositive + falseNegative),
  };
}

function explainRow(row, encoder, model) {
  const encoded = encodeRow(row, encoder);
  return encoder.featureNames
    .map((name, index) => ({ name, impact: model.weights[index] * encoded[index] }))
    .filter((item) => item.impact > 0.04)
    .sort((a, b) => b.impact - a.impact)
    .map((item) => humanizeFeature(item.name));
}

function humanizeFeature(name) {
  return name
    .replace(/_/g, " ")
    .replace(/=/g, ": ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function suggestOffer(row, reasons, risk) {
  const reasonText = reasons.join(" ").toLowerCase();
  if (reasonText.includes("network") || Number(row.network_issue_count_90d) >= 5) return "Network care callback + service credit";
  if (reasonText.includes("monthly") || Number(row.monthly_charge_inr) >= 799) return "15-25% bill discount";
  if (reasonText.includes("data") || Number(row.avg_data_usage_gb) >= 70) return "Extra 20GB data pack";
  if (risk >= 0.85) return "Priority retention call";
  return "Recharge cashback offer";
}

function riskLevel(probability) {
  if (probability >= 0.85) return "Critical";
  if (probability >= 0.7) return "High";
  if (probability >= 0.45) return "Medium";
  return "Low";
}

function renderModel(metrics) {
  els.modelStatus.textContent = "Trained";
  els.accuracy.textContent = formatPercent(metrics.accuracy);
  els.recall.textContent = formatPercent(metrics.recall);

  const risky = appState.predictions.filter((row) => row.risk >= 0.7);
  els.highRiskCount.textContent = risky.length.toLocaleString("en-IN");
  els.revenueAtRisk.textContent = formatCurrency(risky.reduce((sum, row) => sum + (Number(row.monthly_charge_inr) || 0), 0));

  renderRiskBars();
  renderDrivers();
}

function renderModelReset() {
  els.modelStatus.textContent = "Waiting";
  els.accuracy.textContent = "-";
  els.recall.textContent = "-";
  els.highRiskCount.textContent = "-";
  els.revenueAtRisk.textContent = "-";
  els.riskBars.innerHTML = "";
  els.driversList.innerHTML = "";
  els.customerRows.innerHTML = '<tr><td colspan="6" class="empty">Upload data and train the model to see customer risk.</td></tr>';
}

function renderRiskBars() {
  const buckets = ["Critical", "High", "Medium", "Low"].map((level) => ({
    level,
    count: appState.predictions.filter((row) => row.level === level).length,
  }));
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));

  els.riskBars.innerHTML = buckets
    .map((bucket) => `
      <div class="bar-row">
        <span>${bucket.level}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(bucket.count / max) * 100}%"></div></div>
        <strong>${bucket.count}</strong>
      </div>
    `)
    .join("");
}

function renderDrivers() {
  if (!appState.model) return;
  if (appState.backendDrivers.length) {
    els.driversList.innerHTML = appState.backendDrivers
      .map((driver) => `
        <div class="driver">
          <span>${escapeHtml(driver.name)}</span>
          <strong>${Number(driver.weight).toFixed(2)}</strong>
        </div>
      `)
      .join("");
    return;
  }

  const drivers = appState.model.encoder.featureNames
    .map((name, index) => ({ name: humanizeFeature(name), weight: appState.model.weights[index] }))
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);

  els.driversList.innerHTML = drivers
    .map((driver) => `
      <div class="driver">
        <span>${escapeHtml(driver.name)}</span>
        <strong>${driver.weight.toFixed(2)}</strong>
      </div>
    `)
    .join("");
}

function renderCustomers() {
  const rows = appState.predictions.filter((row) => row.risk >= 0.45).slice(0, 30);
  if (!rows.length) {
    els.customerRows.innerHTML = '<tr><td colspan="6" class="empty">No medium or high-risk customers found.</td></tr>';
    return;
  }

  els.customerRows.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.customer_id)}</td>
        <td>${escapeHtml(row.phone_number || "-")}</td>
        <td>${formatPercent(row.risk)}</td>
        <td><span class="pill ${row.level.toLowerCase()}">${row.level}</span></td>
        <td>${escapeHtml(row.reasons.join(", ") || "Mixed churn indicators")}</td>
        <td>${escapeHtml(row.suggestedOffer)}</td>
      </tr>
    `)
    .join("");
}

function buildAutomationPayload() {
  const threshold = Number(els.riskThreshold.value || 70) / 100;
  return {
    source: "RetainIQ Telecom Churn Studio",
    channel: els.channel.value,
    threshold_percent: Number(els.riskThreshold.value || 70),
    generated_at: new Date().toISOString(),
    customers: appState.predictions
      .filter((row) => row.risk >= threshold)
      .filter((row) => !row.whatsapp_opt_in || isTruthy(row.whatsapp_opt_in))
      .slice(0, 25)
      .map((row) => ({
        customer_id: row.customer_id,
        phone_number: row.phone_number,
        city: row.city,
        state: row.state,
        risk_score: Number((row.risk * 100).toFixed(1)),
        risk_level: row.level,
        reasons: row.reasons,
        suggested_offer: row.suggestedOffer,
      })),
  };
}

function updatePayloadPreview() {
  els.payloadPreview.textContent = JSON.stringify(buildAutomationPayload(), null, 2);
}

async function sendWebhookPayload() {
  const url = els.webhookUrl.value.trim();
  if (!url) {
    alert("Add your n8n webhook URL first. The payload preview below is ready for testing.");
    return;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildAutomationPayload()),
  });

  alert(response.ok ? "Payload sent to n8n." : `n8n returned ${response.status}. Check the workflow URL and logs.`);
}

function downloadDangerZone() {
  const rows = appState.predictions.filter((row) => row.risk >= 0.7);
  if (!rows.length) {
    alert("Train the model first, then download high-risk customers.");
    return;
  }

  const headers = ["customer_id", "phone_number", "risk_score", "risk_level", "reasons", "suggested_offer"];
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.customer_id,
        row.phone_number,
        (row.risk * 100).toFixed(1),
        row.level,
        row.reasons.join("; "),
        row.suggestedOffer,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "danger-zone-customers.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, value))));
}

function dot(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
