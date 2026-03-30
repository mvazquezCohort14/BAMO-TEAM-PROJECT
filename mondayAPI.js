// ============================================================
//  mondayAPI.js — Brewers Community Foundation
// ============================================================

const MONDAY_API_URL = "https://api.monday.com/v2";

// ── CONFIG — loaded from monday-config.json (single source of truth) ─
let MONDAY_CONFIG = null;

async function loadConfig() {
  if (MONDAY_CONFIG) return MONDAY_CONFIG;
  try {
    const res = await fetch("monday-config.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    MONDAY_CONFIG = await res.json();
    console.log("[Monday] Config loaded from monday-config.json");
  } catch (err) {
    console.error("[Monday] Could not load monday-config.json:", err);
    throw new Error("Failed to load monday-config.json. Make sure the file is in the same folder as index.html.");
  }
  return MONDAY_CONFIG;
}

/* ─────────────────────────────────────────────────────────── 
   TOAST NOTIFICATION SYSTEM
   ─────────────────────────────────────────────────────────── */
let toastTimer = null;

function createToastEl() {
  let el = document.getElementById("monday-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "monday-toast";
    el.innerHTML = `
      <div class="toast-icon" id="toast-icon"></div>
      <div class="toast-body">
        <div class="toast-title" id="toast-title"></div>
        <div class="toast-message" id="toast-msg"></div>
      </div>
      <button class="toast-close" onclick="hideToast()">&#x2715;</button>
    `;
    document.body.appendChild(el);
  }
  return el;
}

function showToast(type, title, message, duration) {
  duration = duration !== undefined ? duration : (type === "loading" ? 0 : 6000);
  const el      = createToastEl();
  const iconEl  = document.getElementById("toast-icon");
  const titleEl = document.getElementById("toast-title");
  const msgEl   = document.getElementById("toast-msg");

  el.classList.remove("toast-success", "toast-error", "toast-loading", "toast-show");

  if (type === "loading") {
    iconEl.innerHTML = '<div class="toast-spinner"></div>';
  } else if (type === "success") {
    iconEl.innerHTML = '<span style="color:#FFC52F;font-size:22px">&#x2714;</span>';
  } else {
    iconEl.innerHTML = '<span style="color:#E74C3C;font-size:22px">&#x2716;</span>';
  }

  titleEl.textContent = title;
  msgEl.textContent   = message;
  el.classList.add("toast-" + type);

  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("toast-show")));

  clearTimeout(toastTimer);
  if (duration > 0) toastTimer = setTimeout(hideToast, duration);
}

function hideToast() {
  clearTimeout(toastTimer);
  const el = document.getElementById("monday-toast");
  if (el) el.classList.remove("toast-show");
}

/* ─────────────────────────────────────────────────────────── 
   MONDAY API HELPER
   ─────────────────────────────────────────────────────────── */
async function mondayRequest(token, query) {
  await loadConfig();
  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": token,
      "API-Version":   "2024-01"
    },
    body: JSON.stringify({ query })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error("HTTP " + res.status + ": " + txt);
  }

  const data = await res.json();
  console.log("[Monday] Raw response:", JSON.stringify(data, null, 2));

  if (data.errors && data.errors.length > 0) {
    throw new Error(data.errors.map(e => e.message).join(" | "));
  }

  return data.data;
}

/* ─────────────────────────────────────────────────────────── 
   FORMAT VALUE by column type
   ─────────────────────────────────────────────────────────── */
function formatValue(type, rawValue) {
  if (type === "numbers") {
    const num = parseFloat(rawValue.toString().replace(/[^0-9.]/g, ""));
    return isNaN(num) ? "" : num;
  }
  if (type === "phone") {
    return { phone: rawValue, countryShortName: "US" };
  }
  if (type === "email") {
    return { email: rawValue, text: rawValue };
  }
  if (type === "long_text") {
    return { text: rawValue };
  }
  return rawValue;
}

/* ─────────────────────────────────────────────────────────── 
   BUILD column_values JSON string
   ─────────────────────────────────────────────────────────── */
function buildColumnValues(fields, cfg) {
  const cols   = cfg.columns;
  const values = {};

  const fieldMap = {
    address:      fields.address,
    contactName:  fields.contactName,
    phoneNumber:  fields.phoneNumber,
    taxId:        fields.taxId,
    projectTitle: fields.projectTitle,
    cashAmount:   fields.cashAmount
  };

  for (const [key, rawValue] of Object.entries(fieldMap)) {
    const col = cols[key];
    if (!col) continue;
    const formatted = formatValue(col.type, rawValue);
    values[col.id]  = formatted;
    console.log("[Monday] " + key + " -> " + col.id + " (" + col.type + "):", formatted);
  }

  return JSON.stringify(values);
}

/* ─────────────────────────────────────────────────────────── 
   SUBMIT TO MONDAY
   ─────────────────────────────────────────────────────────── */
async function submitToMonday(fields) {
  const cfg = await loadConfig();
  const colVals  = buildColumnValues(fields, cfg);
  const safeName = fields.organizationName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeVals = colVals.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const query = `
    mutation {
      create_item(
        board_id:      ${cfg.boardId},
        group_id:      "${cfg.groupId}",
        item_name:     "${safeName}",
        column_values: "${safeVals}"
      ) {
        id
        name
      }
    }
  `;

  console.log("[Monday] Sending query:", query);

  const data = await mondayRequest(cfg.apiToken, query);

  if (!data || !data.create_item) {
    throw new Error("Item was not created — check boardId and groupId.");
  }

  return data.create_item;
}

/* ─────────────────────────────────────────────────────────── 
   FETCH CAROUSEL ITEMS FROM MONDAY
   Group: group_mm1x3cjv (Carousel)
   Columns pulled:
     - item name           → organization
     - text_mm15r661       → impact story
     - file_mm1xw6ta       → image asset URL
   ─────────────────────────────────────────────────────────── */
async function fetchCarouselItems() {
  const cfg = await loadConfig();
  // Carousel lives on a separate board from the grant form
  const boardIdNum = parseInt(cfg.carouselBoardId || cfg.boardId, 10);
  const groupId    = cfg.carouselGroupId || "group_mm1x3cjv";
  const storyColId = cfg.carouselColumns?.impactStory?.id || "text_mm15r661";
  const fileColId  = cfg.carouselColumns?.image?.id       || "file_mm1xw6ta";

  // Query items directly from the Carousel group using next_items_page
  // This is the most reliable way to get group-scoped items
  const query = `
    query {
      boards(ids: [${boardIdNum}]) {
        groups(ids: ["${groupId}"]) {
          id
          title
          items_page(limit: 50) {
            items {
              id
              name
              column_values(ids: ["${storyColId}", "${fileColId}"]) {
                id
                text
                value
              }
            }
          }
        }
      }
    }
  `;

  let items = [];
  try {
    const data   = await mondayRequest(cfg.apiToken, query);
    const groups = data?.boards?.[0]?.groups || [];
    console.log("[Carousel] Groups returned:", groups.map(g => g.id + " (" + g.title + ")"));
    items = groups[0]?.items_page?.items || [];
    console.log("[Carousel] Items from group query:", items.length);
  } catch (err) {
    console.warn("[Carousel] Group query failed:", err.message);
  }

  // Fallback: fetch all board items and filter by group client-side
  if (items.length === 0) {
    console.log("[Carousel] Trying flat board query as fallback...");
    try {
      const flatQuery = `
        query {
          boards(ids: [${boardIdNum}]) {
            items_page(limit: 200) {
              items {
                id
                name
                group { id title }
                column_values(ids: ["${storyColId}", "${fileColId}"]) {
                  id
                  text
                  value
                }
              }
            }
          }
        }
      `;
      const flatData = await mondayRequest(cfg.apiToken, flatQuery);
      const allItems = flatData?.boards?.[0]?.items_page?.items || [];
      console.log("[Carousel] All board items:", allItems.length);
      allItems.forEach(i => console.log("  →", i.name, "| group:", i.group?.id, i.group?.title));
      items = allItems.filter(i => i.group?.id === groupId);
      console.log("[Carousel] Filtered to carousel group:", items.length);
    } catch (err) {
      console.error("[Carousel] Flat query also failed:", err.message);
      return [];
    }
  }

  if (items.length === 0) return [];

  // Collect assetIds for image URL resolution
  const assetIds = [];
  items.forEach(item => {
    const fileCol = item.column_values.find(c => c.id === fileColId);
    if (fileCol?.value) {
      try {
        const parsed = JSON.parse(fileCol.value);
        (parsed?.files || []).forEach(f => { if (f.assetId) assetIds.push(f.assetId); });
      } catch (_) {}
    }
  });

  // Fetch public_url for all assets in one parallel request
  const assetMap = {};
  if (assetIds.length > 0) {
    try {
      const assetQuery = `query { assets(ids: [${assetIds.join(",")}]) { id public_url } }`;
      // Fire immediately — don't await sequentially, resolve alongside any other work
      const assetData = await mondayRequest(cfg.apiToken, assetQuery);
      (assetData?.assets || []).forEach(a => { assetMap[String(a.id)] = a.public_url; });
    } catch (err) {
      console.warn("[Carousel] Asset fetch failed:", err.message);
    }
  }

  return items.map(item => {
    const story   = item.column_values.find(c => c.id === storyColId)?.text || "";
    const fileCol = item.column_values.find(c => c.id === fileColId);
    let imageUrl  = "";
    if (fileCol?.value) {
      try {
        const parsed  = JSON.parse(fileCol.value);
        const assetId = String(parsed?.files?.[0]?.assetId || "");
        imageUrl = assetMap[assetId] || fileCol.text || "";
      } catch (_) {
        imageUrl = fileCol.text || "";
      }
    }
    console.log("[Carousel] Slide:", item.name, "| img:", imageUrl ? "✓" : "none");
    return { organization: item.name, story, imageUrl };
  }).filter(i => i.organization);
}


/* ─────────────────────────────────────────────────────────── 
   GRANT FORM HANDLER
   ─────────────────────────────────────────────────────────── */
window.addEventListener("load", () => {
  const form = document.getElementById("grantForm");
  if (!form) { console.warn("[Monday] #grantForm not found."); return; }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    e.stopImmediatePropagation();

    const inputs = form.querySelectorAll("input");
    const fields = {
      organizationName: inputs[0]?.value.trim() || "",
      address:          inputs[1]?.value.trim() || "",
      contactName:      inputs[2]?.value.trim() || "",
      phoneNumber:      inputs[3]?.value.trim() || "",
      taxId:            inputs[4]?.value.trim() || "",
      projectTitle:     inputs[5]?.value.trim() || "",
      cashAmount:       inputs[6]?.value.trim() || ""
    };

    for (const [key, val] of Object.entries(fields)) {
      if (!val) {
        showToast("error", "Missing Information", "Please fill in all fields before submitting.", 5000);
        return;
      }
    }

    const btn = form.querySelector("button[type='submit']");
    btn.disabled    = true;
    btn.textContent = "Submitting\u2026";
    showToast("loading", "Submitting Application\u2026", "Sending your grant request to our team.");

    try {
      const item = await submitToMonday(fields);
      showToast("success", "Application Submitted!", "Your grant request has been received. Our team will be in touch soon. (ID: " + item.id + ")", 8000);
      form.reset();
    } catch (err) {
      console.error("[Monday] Error:", err);
      showToast("error", "Submission Failed", err.message || "Something went wrong. Please try again.", 0);
    } finally {
      btn.disabled    = false;
      btn.textContent = "Submit Application";
    }
  });

  console.log("[Monday] Grant form ready.");
});