// ===== BASIC CONFIG =====
const API_BASE = "http://localhost:3000"; // placeholder for future backend

// Demo state
const state = {
  currentUserId: 1,
  users: [
    {
      id: 1,
      name: "Admin",
      role: "admin",
      store: "ALL",
      permissions: {
        inbound: true,
        outbound: true,
        sell: true,
        transfer: true,
        print: true,
        profit: true,
        manageUsers: true,
        manageStores: true
      }
    },
    {
      id: 2,
      name: "Worker 1",
      role: "staff",
      store: "MAIN",
      permissions: {
        inbound: true,
        outbound: true,
        sell: true,
        transfer: true,
        print: true,
        profit: false,
        manageUsers: false,
        manageStores: false
      }
    }
  ],
  stores: [
    { id: 1, name: "Main warehouse", code: "MAIN", type: "warehouse" },
    { id: 2, name: "Front shop 1", code: "FS1", type: "frontShop" },
    { id: 3, name: "Front shop 2", code: "FS2", type: "frontShop" }
  ],
  clients: [
    { id: 1, name: "Walk-in client", town: "", phone: "" }
  ],
  inboundSession: [],
  outboundSession: [],
  sellItems: [],
  currentSale: null,
  outboundMode: "sell",
  currentClientId: 1,
  activeStoreCode: "MAIN"
};

// ===== HELPERS =====
function getCurrentUser() {
  return state.users.find(u => u.id === state.currentUserId) || state.users[0];
}

function getStoreByCode(code) {
  return state.stores.find(s => s.code === code);
}

function isWarehouseStore(code) {
  const store = getStoreByCode(code);
  return store && store.type === "warehouse";
}

// ===== NAVIGATION =====
function setActiveView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`view-${viewId}`);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  const navBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
  if (navBtn) navBtn.classList.add("active");
}

function initNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view");
      setActiveView(view);
    });
  });

  // Big dashboard buttons
  document.querySelectorAll(".big-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view");
      // Special case: dashboard Stores button should open outbound transfer mode
      if (view === "stores") {
        setActiveView("outbound");
        const transferBtn = document.querySelector('.mode-btn[data-mode="transfer"]');
        if (transferBtn) transferBtn.click();
      } else {
        setActiveView(view);
      }
    });
  });

  // Set user name
  document.getElementById("currentUserName").textContent = getCurrentUser().name;
}

// ===== DASHBOARD STORE SELECT / PROFIT BUTTON =====
function initDashboardStoreSelect() {
  const select = document.getElementById("dashboardStoreSelect");
  const label = document.getElementById("dashboardStoreLabel");
  if (!select || !label) return;

  select.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "ALL";
  allOpt.textContent = "All stores";
  select.appendChild(allOpt);

  state.stores.forEach(store => {
    const opt = document.createElement("option");
    opt.value = store.code;
    opt.textContent = store.name;
    select.appendChild(opt);
  });

  select.value = state.activeStoreCode || "ALL";
  const selectedOption = select.selectedOptions[0];
  label.textContent = selectedOption ? selectedOption.textContent : "All";

  select.addEventListener("change", () => {
    state.activeStoreCode = select.value;
    const opt = select.selectedOptions[0];
    label.textContent = opt ? opt.textContent : "All";
  });

  const profitBtn = document.getElementById("profitAnalysisBtn");
  if (profitBtn) {
    profitBtn.addEventListener("click", () => {
      const totalInbound = state.inboundSession.reduce(
        (sum, r) => sum + r.price * r.qty,
        0
      );
      const totalOutbound = state.outboundSession.reduce(
        (sum, r) => sum + r.price * r.qty,
        0
      );
      const profit = totalOutbound - totalInbound;
      alert(
        `Simple profit overview:\nInbound value: ${totalInbound.toFixed(
          2
        )}\nOutbound value: ${totalOutbound.toFixed(
          2
        )}\nProfit: ${profit.toFixed(2)}`
      );
    });
  }
}

// ===== USERS =====
function renderUserPermissionsTable() {
  const tbody = document.querySelector("#userPermissionsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const permissionKeys = [
    "inbound",
    "outbound",
    "sell",
    "transfer",
    "print",
    "profit",
    "manageUsers",
    "manageStores"
  ];

  state.users.forEach(user => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${user.name}</td>`;

    permissionKeys.forEach(key => {
      const td = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!user.permissions[key];
      checkbox.addEventListener("change", () => {
        user.permissions[key] = checkbox.checked;
      });
      td.appendChild(checkbox);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

function renderUsers() {
  const userList = document.getElementById("userList");
  if (!userList) return;

  userList.innerHTML = "";
  state.users.forEach(user => {
    const li = document.createElement("div");
    li.textContent = `${user.name} (${user.role}) - ${user.store}`;
    li.dataset.id = user.id;
    li.style.cursor = "pointer";
    li.addEventListener("click", () => selectUser(user.id));
    userList.appendChild(li);
  });

  renderUserPermissionsTable();
}

function selectUser(id) {
  const user = state.users.find(u => u.id === id);
  if (!user) return;
  state.currentUserId = id;
  document.getElementById("currentUserName").textContent = user.name;
}

function initUserManagement() {
  renderUsers();

  const saveBtn = document.getElementById("saveUserBtn");
  saveBtn.addEventListener("click", () => {
    const name = document.getElementById("userNameInput").value.trim();
    const role = document.getElementById("userRoleInput").value;
    const store = document.getElementById("userStoreInput").value.trim() || "ALL";
    if (!name) return;

    const id = Date.now();
    state.users.push({
      id,
      name,
      role,
      store,
      permissions: {
        inbound: true,
        outbound: true,
        sell: true,
        transfer: true,
        print: true,
        profit: false,
        manageUsers: false,
        manageStores: false
      }
    });
    document.getElementById("userNameInput").value = "";
    document.getElementById("userStoreInput").value = "";
    renderUsers();
  });

  document.getElementById("addUserQuickBtn").addEventListener("click", () => {
    setActiveView("users");
  });
}

// ===== STORES (CRUD) =====
function renderStores() {
  const storeList = document.getElementById("storeList");
  if (storeList) {
    storeList.innerHTML = "";
    state.stores.forEach(store => {
      const row = document.createElement("div");
      row.className = "store-list-item";

      const span = document.createElement("span");
      span.textContent = `${store.name} (${store.code}) [${store.type}]`;
      span.style.cursor = "pointer";
      span.addEventListener("click", () => {
        document.getElementById("storeNameInput").value = store.name;
        document.getElementById("storeCodeInput").value = store.code;
        document.getElementById("storeTypeInput").value = store.type;
        document.getElementById("storeNameInput").dataset.editId = store.id;
      });

      const delBtn = document.createElement("button");
      delBtn.className = "store-delete-btn";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => {
        const user = getCurrentUser();
        if (!user.permissions.manageStores) {
          alert("No permission to delete stores.");
          return;
        }
        if (!confirm(`Delete store "${store.name}"?`)) return;
        state.stores = state.stores.filter(s => s.id !== store.id);
        renderStores();
        refreshStoreSelectors();
      });

      row.appendChild(span);
      row.appendChild(delBtn);
      storeList.appendChild(row);
    });
  }

  // Refresh all selectors that depend on stores
  refreshStoreSelectors();
  initDashboardStoreSelect();
}

function refreshStoreSelectors() {
  const ids = [
    "inboundStoreSelect",
    "outboundFromStoreSelect",
    "sellStoreSelect"
  ];
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = "";
    state.stores.forEach(store => {
      const opt = document.createElement("option");
      opt.value = store.code;
      opt.textContent = store.name;
      sel.appendChild(opt);
    });
  });

  // Outbound transfer "to store" can be all stores (universal)
  const toSel = document.getElementById("outboundToStoreSelect");
  if (toSel) {
    toSel.innerHTML = "";
    state.stores.forEach(store => {
      const opt = document.createElement("option");
      opt.value = store.code;
      opt.textContent = store.name;
      toSel.appendChild(opt);
    });
  }
}

function initStoreManagement() {
  renderStores();

  document.getElementById("saveStoreBtn").addEventListener("click", () => {
    const name = document.getElementById("storeNameInput").value.trim();
    const code = document.getElementById("storeCodeInput").value.trim();
    const type = document.getElementById("storeTypeInput").value;
    if (!name || !code) return;

    const editId = document.getElementById("storeNameInput").dataset.editId;
    if (editId) {
      const store = state.stores.find(s => s.id === Number(editId));
      if (store) {
        store.name = name;
        store.code = code;
        store.type = type;
      }
      delete document.getElementById("storeNameInput").dataset.editId;
    } else {
      const id = Date.now();
      state.stores.push({ id, name, code, type });
    }

    document.getElementById("storeNameInput").value = "";
    document.getElementById("storeCodeInput").value = "";
    renderStores();
  });

  document.getElementById("clearStoreBtn").addEventListener("click", () => {
    document.getElementById("storeNameInput").value = "";
    document.getElementById("storeCodeInput").value = "";
    delete document.getElementById("storeNameInput").dataset.editId;
  });

  document.getElementById("refreshStoresBtn").addEventListener("click", () => {
    renderStores();
  });

  document.getElementById("newStoreBtn").addEventListener("click", () => {
    setActiveView("stores");
  });
}

// ===== CLIENTS =====
function renderClientSelect() {
  const sel = document.getElementById("clientSelect");
  if (!sel) return;
  sel.innerHTML = "";
  state.clients.forEach(client => {
    const opt = document.createElement("option");
    opt.value = client.id;
    opt.textContent = client.name
      ? `${client.name}${client.town ? " (" + client.town + ")" : ""}`
      : "Unnamed client";
    sel.appendChild(opt);
  });
  sel.value = state.currentClientId || state.clients[0]?.id;
}

function initClients() {
  renderClientSelect();

  const toggleBtn = document.getElementById("addNewClientToggleBtn");
  const form = document.getElementById("newClientForm");
  toggleBtn.addEventListener("click", () => {
    form.classList.toggle("hidden");
  });

  document.getElementById("saveClientBtn").addEventListener("click", () => {
    const name = document.getElementById("clientNameInput").value.trim();
    const town = document.getElementById("clientTownInput").value.trim();
    const phone = document.getElementById("clientPhoneInput").value.trim();
    if (!name) {
      alert("Client name is required.");
      return;
    }
    const id = Date.now();
    state.clients.push({ id, name, town, phone });
    state.currentClientId = id;
    document.getElementById("clientNameInput").value = "";
    document.getElementById("clientTownInput").value = "";
    document.getElementById("clientPhoneInput").value = "";
    renderClientSelect();
    form.classList.add("hidden");
  });

  document.getElementById("clientSelect").addEventListener("change", e => {
    state.currentClientId = Number(e.target.value);
  });
}

// ===== INBOUND =====
function renderInboundTable() {
  const tbody = document.querySelector("#inboundTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  state.inboundSession.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.location}</td>
      <td>${item.barcode}</td>
      <td>${item.qty}</td>
      <td>${item.price.toFixed(2)}</td>
      <td>${item.store}</td>
      <td>${item.time}</td>
    `;
    tbody.appendChild(tr);
  });
}

function initInbound() {
  const locationInput = document.getElementById("inboundLocationInput");
  const barcodeInput = document.getElementById("inboundBarcodeInput");

  locationInput.addEventListener("input", () => {
    barcodeInput.disabled = locationInput.value.trim() === "";
  });

  document.getElementById("addInboundBtn").addEventListener("click", () => {
    const store = document.getElementById("inboundStoreSelect").value;
    const location = locationInput.value.trim();
    const barcode = barcodeInput.value.trim();
    const qty = parseInt(document.getElementById("inboundQtyInput").value, 10) || 1;
    const price =
      parseFloat(document.getElementById("inboundPriceInput").value) || 0;
    const notes = document.getElementById("inboundNotesInput").value.trim();
    if (!location || !barcode) return;

    const record = {
      store,
      location,
      barcode,
      qty,
      price,
      notes,
      time: new Date().toLocaleTimeString()
    };
    state.inboundSession.push(record);
    renderInboundTable();

    barcodeInput.value = "";
    document.getElementById("inboundQtyInput").value = 1;
    document.getElementById("inboundPriceInput").value = 0;
    document.getElementById("inboundNotesInput").value = "";
  });
}

// ===== OUTBOUND =====
function updateOutboundLocationRequirement() {
  const fromStoreCode = document.getElementById("outboundFromStoreSelect").value;
  const locationLabel = document.getElementById("outboundLocationLabel");
  const locationInput = document.getElementById("outboundLocationInput");
  const barcodeInput = document.getElementById("outboundBarcodeInput");

  if (isWarehouseStore(fromStoreCode)) {
    locationLabel.classList.remove("hidden");
    barcodeInput.disabled = locationInput.value.trim() === "";
  } else {
    locationLabel.classList.add("hidden");
    barcodeInput.disabled = false;
  }
}

function renderOutboundTable() {
  const tbody = document.querySelector("#outboundTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  state.outboundSession.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.mode}</td>
      <td>${item.clientOrStore}</td>
      <td>${item.location || "-"}</td>
      <td>${item.barcode}</td>
      <td>${item.qty}</td>
      <td>${item.price.toFixed(2)}</td>
      <td>${item.from}</td>
      <td>${item.to || "-"}</td>
      <td>${item.time}</td>
    `;
    tbody.appendChild(tr);
  });
}

function initOutbound() {
  const locationInput = document.getElementById("outboundLocationInput");
  const barcodeInput = document.getElementById("outboundBarcodeInput");
  const toStoreWrapper = document.getElementById("outboundToStoreWrapper");
  const clientPanel = document.getElementById("clientPanel");

  // Mode buttons
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.outboundMode = btn.getAttribute("data-mode");

      if (state.outboundMode === "sell") {
        clientPanel.style.display = "block";
        toStoreWrapper.style.display = "none";
      } else {
        clientPanel.style.display = "none";
        toStoreWrapper.style.display = "block";
      }
    });
  });

  // Initial visibility
  clientPanel.style.display = "block";
  toStoreWrapper.style.display = "none";

  locationInput.addEventListener("input", () => {
    updateOutboundLocationRequirement();
  });

  document.getElementById("outboundFromStoreSelect").addEventListener("change", () => {
    updateOutboundLocationRequirement();
  });

  document.getElementById("addOutboundBtn").addEventListener("click", () => {
    const fromStore = document.getElementById("outboundFromStoreSelect").value;
    const toStore = document.getElementById("outboundToStoreSelect").value;
    const location = locationInput.value.trim();
    const barcode = barcodeInput.value.trim();
    const qty = parseInt(document.getElementById("outboundQtyInput").value, 10) || 1;
    const price =
      parseFloat(document.getElementById("outboundPriceInput").value) || 0;
    const notes = document.getElementById("outboundNotesInput").value.trim();

    // Enforce location only if warehouse
    if (isWarehouseStore(fromStore) && !location) {
      alert("Location is required when outbound from a warehouse.");
      return;
    }
    if (!barcode) return;

    let clientOrStore = "-";
    if (state.outboundMode === "sell") {
      const client = state.clients.find(c => c.id === state.currentClientId);
      clientOrStore = client
        ? `${client.name}${client.town ? " (" + client.town + ")" : ""}`
        : "Client";
    } else if (state.outboundMode === "transfer") {
      const store = getStoreByCode(toStore);
      clientOrStore = store ? store.name : toStore;
    }

    const record = {
      mode: state.outboundMode,
      clientOrStore,
      from: fromStore,
      to: state.outboundMode === "transfer" ? toStore : null,
      location: isWarehouseStore(fromStore) ? location : "",
      barcode,
      qty,
      price,
      notes,
      time: new Date().toLocaleTimeString()
    };
    state.outboundSession.push(record);
    renderOutboundTable();

    barcodeInput.value = "";
    document.getElementById("outboundQtyInput").value = 1;
    document.getElementById("outboundPriceInput").value = 0;
    document.getElementById("outboundNotesInput").value = "";
    if (isWarehouseStore(fromStore)) {
      locationInput.value = "";
      updateOutboundLocationRequirement();
    }
  });

  updateOutboundLocationRequirement();
}

// ===== SELL & RECEIPT =====
function updateSellLocationRequirement() {
  const storeCode = document.getElementById("sellStoreSelect").value;
  const row = document.getElementById("sellWarehouseLocationRow");
  const locationInput = document.getElementById("sellLocationInput");
  const barcodeInput = document.getElementById("sellBarcodeInput");

  if (isWarehouseStore(storeCode)) {
    row.style.display = "flex";
    barcodeInput.disabled = locationInput.value.trim() === "";
  } else {
    row.style.display = "none";
    barcodeInput.disabled = false;
  }
}

function calcTotals() {
  let subtotal = 0;
  state.sellItems.forEach(item => {
    subtotal += item.price * item.qty;
  });
  const tax = subtotal * 0.21;
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

function renderSellTable() {
  const tbody = document.querySelector("#sellTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  state.sellItems.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.barcode}</td>
      <td>${item.qty}</td>
      <td>${item.price.toFixed(2)}</td>
      <td>${(item.price * item.qty).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  const totals = calcTotals();
  document.getElementById("sellSubtotal").textContent = totals.subtotal.toFixed(2);
  document.getElementById("sellTax").textContent = totals.tax.toFixed(2);
  document.getElementById("sellTotal").textContent = totals.total.toFixed(2);
}

function initSell() {
  const storeSelect = document.getElementById("sellStoreSelect");
  const locationInput = document.getElementById("sellLocationInput");
  const barcodeInput = document.getElementById("sellBarcodeInput");

  storeSelect.addEventListener("change", () => {
    updateSellLocationRequirement();
  });

  locationInput.addEventListener("input", () => {
    updateSellLocationRequirement();
  });

  document.getElementById("sellAddStoreBtn").addEventListener("click", () => {
    setActiveView("stores");
  });

  document.getElementById("addSellItemBtn").addEventListener("click", () => {
    const storeCode = storeSelect.value;
    const barcode = barcodeInput.value.trim();
    const qty = parseInt(document.getElementById("sellQtyInput").value, 10) || 1;
    const price =
      parseFloat(document.getElementById("sellPriceInput").value) || 0;

    if (isWarehouseStore(storeCode)) {
      if (!locationInput.value.trim()) {
        alert("Location is required for warehouse sale.");
        return;
      }
    }

    if (!barcode) return;

    state.sellItems.push({ barcode, qty, price });
    renderSellTable();

    barcodeInput.value = "";
    document.getElementById("sellQtyInput").value = 1;
    document.getElementById("sellPriceInput").value = 0;
  });

  document.getElementById("completeSaleBtn").addEventListener("click", () => {
    if (!state.sellItems.length) return;
    const storeCode = storeSelect.value;
    const store = getStoreByCode(storeCode);
    state.currentSale = {
      id: Date.now(),
      time: new Date().toLocaleString(),
      storeCode,
      storeName: store ? store.name : storeCode,
      items: [...state.sellItems],
      totals: calcTotals()
    };
    fillReceiptFromSale(state.currentSale);
    setActiveView("receipt");
  });

  document.getElementById("cancelSaleBtn").addEventListener("click", () => {
    state.sellItems = [];
    renderSellTable();
  });

  updateSellLocationRequirement();
}

function fillReceiptFromSale(sale) {
  const meta = document.getElementById("receiptMeta");
  const tbody = document.querySelector("#receiptTable tbody");
  const totalsDiv = document.getElementById("receiptTotals");
  if (!meta || !tbody || !totalsDiv) return;

  meta.innerHTML = `
    <div><strong>Receipt ID:</strong> ${sale.id}</div>
    <div><strong>Time:</strong> ${sale.time}</div>
    <div><strong>Store:</strong> ${sale.storeName}</div>
  `;

  tbody.innerHTML = "";
  sale.items.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.barcode}</td>
      <td>${item.qty}</td>
      <td>${item.price.toFixed(2)}</td>
      <td>${(item.price * item.qty).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  totalsDiv.innerHTML = `
    <div><strong>Subtotal:</strong> ${sale.totals.subtotal.toFixed(2)}</div>
    <div><strong>Tax:</strong> ${sale.totals.tax.toFixed(2)}</div>
    <div><strong>Total:</strong> ${sale.totals.total.toFixed(2)}</div>
  `;
}

// ===== STORE TABLE VIEW (placeholder) =====
function initStoreView() {
  const tbody = document.querySelector("#storeTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const demoRows = [
    { store: "MAIN", barcode: "123456", name: "Demo item 1", stock: 15, lastMove: "Inbound 09:00" },
    { store: "FS1", barcode: "789012", name: "Demo item 2", stock: 3, lastMove: "Sell 10:15" }
  ];
  demoRows.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.store}</td>
      <td>${row.barcode}</td>
      <td>${row.name}</td>
      <td>${row.stock}</td>
      <td>${row.lastMove}</td>
    `;
    tr.addEventListener("click", () => {
      document.getElementById("detailBarcode").textContent = row.barcode;
      document.getElementById("detailName").textContent = row.name;
      document.getElementById("detailStore").textContent = row.store;
      document.getElementById("detailStock").textContent = row.stock;
      document.getElementById("detailLastInbound").textContent = "Yesterday";
      document.getElementById("detailLastOutbound").textContent = "Today 10:15";
    });
    tbody.appendChild(tr);
  });
}

// ===== PRINT MODES (3 ways) =====
function initPrintMenu() {
  const openBtn = document.getElementById("openPrintMenuBtn");
  const dropdown = document.getElementById("printDropdown");

  openBtn.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", e => {
    if (!dropdown.contains(e.target) && e.target !== openBtn) {
      dropdown.classList.add("hidden");
    }
  });

  dropdown.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-print-mode");
      handlePrint(mode);
      dropdown.classList.add("hidden");
    });
  });
}

function handlePrint(mode) {
  if (mode === "itemBarcodes") {
    const barcode = prompt("Enter item barcode (or leave blank to use first sale item):");
    const qtyStr = prompt("How many labels to print?");
    const qty = parseInt(qtyStr, 10) || 1;

    const w = window.open("", "itemBarcodesPrint");
    w.document.write("<h3>Item barcode labels</h3>");
    for (let i = 0; i < qty; i++) {
      const code =
        barcode ||
        (state.currentSale && state.currentSale.items[0]
          ? state.currentSale.items[0].barcode
          : "NO-CODE");
      w.document.write(
        `<div style="border:1px solid #000;padding:8px;margin:4px;display:inline-block">
           <div><strong>Barcode:</strong> ${code}</div>
         </div>`
      );
    }
    w.document.close();
    w.focus();
    w.print();
    w.close();
  } else if (mode === "locationBarcodes") {
    const locationCode = prompt("Enter location code (e.g. R1-S2-B3):");
    const size = prompt("Size: small, medium, large?", "medium");
    const qtyStr = prompt("How many labels to print?");
    const qty = parseInt(qtyStr, 10) || 1;

    const w = window.open("", "locationBarcodesPrint");
    w.document.write(`<h3>Location labels (${size})</h3>`);
    const fontSize = size === "small" ? "10px" : size === "large" ? "20px" : "14px";
    for (let i = 0; i < qty; i++) {
      w.document.write(
        `<div style="border:1px solid #000;padding:8px;margin:4px;display:inline-block;font-size:${fontSize}">
           <div><strong>Location:</strong> ${locationCode || "NO-LOCATION"}</div>
         </div>`
      );
    }
    w.document.close();
    w.focus();
    w.print();
    w.close();
  } else if (mode === "packingList") {
    const w = window.open("", "packingListPrint");
    const rows = state.outboundSession.slice(-20); // last 20 moves

    w.document.write(`
      <div style="font-family:system-ui;max-width:800px;margin:auto">
        <h2 style="text-align:center;margin-bottom:4px">Tikure Warehouse</h2>
        <h3 style="text-align:center;margin-top:0;margin-bottom:16px">Packing list</h3>

        <div style="margin-bottom:12px">
          <div><strong>Date:</strong> ${new Date().toLocaleString()}</div>
          <div><strong>Prepared by:</strong> ${document.getElementById("currentUserName").textContent}</div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr>
              <th style="border-bottom:1px solid #ccc;text-align:left;padding:4px">#</th>
              <th style="border-bottom:1px solid #ccc;text-align:left;padding:4px">Barcode</th>
              <th style="border-bottom:1px solid #ccc;text-align:left;padding:4px">Qty</th>
              <th style="border-bottom:1px solid #ccc;text-align:left;padding:4px">From</th>
              <th style="border-bottom:1px solid #ccc;text-align:left;padding:4px">To</th>
              <th style="border-bottom:1px solid #ccc;text-align:left;padding:4px">Location</th>
              <th style="border-bottom:1px solid #ccc;text-align:left;padding:4px">Client / Store</th>
            </tr>
          </thead>
          <tbody>
    `);

    rows.forEach((r, idx) => {
      w.document.write(`
        <tr>
          <td style="border-bottom:1px solid #eee;padding:4px">${idx + 1}</td>
          <td style="border-bottom:1px solid #eee;padding:4px">${r.barcode}</td>
          <td style="border-bottom:1px solid #eee;padding:4px">${r.qty}</td>
          <td style="border-bottom:1px solid #eee;padding:4px">${r.from}</td>
          <td style="border-bottom:1px solid #eee;padding:4px">${r.to || "-"}</td>
          <td style="border-bottom:1px solid #eee;padding:4px">${r.location || "-"}</td>
          <td style="border-bottom:1px solid #eee;padding:4px">${r.clientOrStore}</td>
        </tr>
      `);
    });

    w.document.write(`
          </tbody>
        </table>

        <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:12px">
          <div>
            <div><strong>Checked by:</strong> ______________________</div>
            <div style="margin-top:8px"><strong>Signature:</strong> ______________________</div>
          </div>
          <div>
            <div><strong>Received by:</strong> ______________________</div>
            <div style="margin-top:8px"><strong>Signature:</strong> ______________________</div>
          </div>
        </div>
      </div>
    `);

    w.document.close();
    w.focus();
    w.print();
    w.close();
  }
}

// ===== INIT =====
window.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initUserManagement();
  initStoreManagement();
  initInbound();
  initClients();
  initOutbound();
  initSell();
  initStoreView();
  initPrintMenu();
});
