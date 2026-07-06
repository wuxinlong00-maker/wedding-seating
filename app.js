const STORAGE_KEY = "wedding-seating-v2";
const LEGACY_STORAGE_KEY = "wedding-seating-v1";
const DEFAULT_TABLES = 58;
const DEFAULT_SEATS_PER_TABLE = 10;
const MIN_TABLES = 1;
const MAX_TABLES = 300;
const MIN_SEATS = 1;
const MAX_SEATS = 30;

const seatingMap = document.querySelector("#seatingMap");
const tableTemplate = document.querySelector("#tableTemplate");
const seatTemplate = document.querySelector("#seatTemplate");
const searchInput = document.querySelector("#searchInput");
const tableNameInput = document.querySelector("#tableNameInput");
const seatIndexInput = document.querySelector("#seatIndexInput");
const guestNameInput = document.querySelector("#guestNameInput");
const tableTotalInput = document.querySelector("#tableTotalInput");
const seatsPerTableInput = document.querySelector("#seatsPerTableInput");
const tableCount = document.querySelector("#tableCount");
const guestCount = document.querySelector("#guestCount");
const seatCount = document.querySelector("#seatCount");
const mapTitle = document.querySelector("#mapTitle");

let state = loadState();
let selected = { tableIndex: 0, seatIndex: 0 };

function clampNumber(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function makeEmptyTable(index, seatsPerTable) {
  return {
    name: `第 ${index + 1} 桌`,
    seats: Array.from({ length: seatsPerTable }, () => "")
  };
}

function makeDefaultState() {
  return {
    theme: "light",
    view: "grid",
    seatsPerTable: DEFAULT_SEATS_PER_TABLE,
    tables: Array.from({ length: DEFAULT_TABLES }, (_, index) => makeEmptyTable(index, DEFAULT_SEATS_PER_TABLE))
  };
}

function normalizeState(data) {
  if (!data || !Array.isArray(data.tables)) return makeDefaultState();
  const seatsPerTable = clampNumber(data.seatsPerTable || data.tables[0]?.seats?.length, MIN_SEATS, MAX_SEATS, DEFAULT_SEATS_PER_TABLE);
  const tables = data.tables.map((table, index) => ({
    name: table.name || `第 ${index + 1} 桌`,
    seats: Array.from({ length: seatsPerTable }, (_, seatIndex) => table.seats?.[seatIndex] || "")
  }));
  return {
    theme: data.theme || "light",
    view: data.view || "grid",
    seatsPerTable,
    tables: tables.length ? tables : [makeEmptyTable(0, seatsPerTable)]
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return normalizeState(JSON.parse(saved));
  } catch {
    return makeDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  document.body.classList.toggle("dark", state.theme === "dark");
  seatingMap.className = `seating-map ${state.view}-view`;
  document.querySelectorAll(".view-button").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  seatingMap.innerHTML = "";

  const query = searchInput.value.trim().toLowerCase();
  const seatsPerTable = state.seatsPerTable;

  state.tables.forEach((table, tableIndex) => {
    const card = tableTemplate.content.firstElementChild.cloneNode(true);
    const nameInput = card.querySelector(".table-name");
    const filledCount = card.querySelector(".filled-count");
    const seatRing = card.querySelector(".seat-ring");
    const filled = table.seats.filter(Boolean).length;
    const tableMatches = table.name.toLowerCase().includes(query) || String(tableIndex + 1).includes(query);

    card.classList.toggle("selected", selected.tableIndex === tableIndex);
    nameInput.value = table.name;
    filledCount.textContent = `${filled}/${seatsPerTable}`;
    seatRing.style.gridTemplateColumns = `repeat(${Math.min(5, seatsPerTable)}, minmax(0, 1fr))`;

    nameInput.addEventListener("input", () => {
      table.name = nameInput.value || `第 ${tableIndex + 1} 桌`;
      if (selected.tableIndex === tableIndex) tableNameInput.value = table.name;
      saveState();
      updateStats();
    });

    table.seats.forEach((guest, seatIndex) => {
      const seat = seatTemplate.content.firstElementChild.cloneNode(true);
      seat.classList.toggle("filled", Boolean(guest));
      seat.classList.toggle("active", selected.tableIndex === tableIndex && selected.seatIndex === seatIndex);
      seat.querySelector(".seat-number").textContent = seatIndex + 1;
      seat.querySelector(".guest-name").textContent = guest || "空";
      seat.addEventListener("click", () => selectSeat(tableIndex, seatIndex));
      seatRing.appendChild(seat);
    });

    const hasGuestMatch = table.seats.some((guest) => guest.toLowerCase().includes(query));
    card.classList.toggle("hidden", Boolean(query) && !tableMatches && !hasGuestMatch);
    seatingMap.appendChild(card);
  });

  updateEditor();
  updateStats();
}

function updateStats() {
  tableCount.textContent = state.tables.length;
  guestCount.textContent = state.tables.reduce((sum, table) => sum + table.seats.filter(Boolean).length, 0);
  seatCount.textContent = state.tables.length * state.seatsPerTable;
  tableTotalInput.value = state.tables.length;
  seatsPerTableInput.value = state.seatsPerTable;
  mapTitle.textContent = `${state.tables.length} 桌 × 每桌 ${state.seatsPerTable} 人`;
}

function updateEditor() {
  const table = state.tables[selected.tableIndex];
  if (!table) return;
  tableNameInput.value = table.name;
  seatIndexInput.value = `${table.name} · ${selected.seatIndex + 1} 号座`;
  guestNameInput.value = table.seats[selected.seatIndex] || "";
}

function selectSeat(tableIndex, seatIndex) {
  selected = { tableIndex, seatIndex };
  render();
  guestNameInput.focus();
  guestNameInput.select();
}

function findNextEmpty() {
  const total = state.tables.length * state.seatsPerTable;
  const start = selected.tableIndex * state.seatsPerTable + selected.seatIndex + 1;
  for (let offset = 0; offset < total; offset += 1) {
    const flat = (start + offset) % total;
    const tableIndex = Math.floor(flat / state.seatsPerTable);
    const seatIndex = flat % state.seatsPerTable;
    if (!state.tables[tableIndex].seats[seatIndex]) {
      selectSeat(tableIndex, seatIndex);
      return;
    }
  }
}

function hasDataOutsideNewSize(tableTotal, seatsPerTable) {
  const removedTables = state.tables.slice(tableTotal).some((table) => table.seats.some(Boolean));
  const removedSeats = state.tables.slice(0, tableTotal).some((table) => table.seats.slice(seatsPerTable).some(Boolean));
  return removedTables || removedSeats;
}

function applySizeSettings() {
  const nextTableTotal = clampNumber(tableTotalInput.value, MIN_TABLES, MAX_TABLES, state.tables.length);
  const nextSeatsPerTable = clampNumber(seatsPerTableInput.value, MIN_SEATS, MAX_SEATS, state.seatsPerTable);

  if (hasDataOutsideNewSize(nextTableTotal, nextSeatsPerTable) && !confirm("减少后的桌数或座位数会移除已填写的姓名，确定继续吗？")) {
    updateStats();
    return;
  }

  const nextTables = Array.from({ length: nextTableTotal }, (_, index) => {
    const existing = state.tables[index];
    if (!existing) return makeEmptyTable(index, nextSeatsPerTable);
    return {
      name: existing.name || `第 ${index + 1} 桌`,
      seats: Array.from({ length: nextSeatsPerTable }, (_, seatIndex) => existing.seats[seatIndex] || "")
    };
  });

  state.tables = nextTables;
  state.seatsPerTable = nextSeatsPerTable;
  selected.tableIndex = Math.min(selected.tableIndex, state.tables.length - 1);
  selected.seatIndex = Math.min(selected.seatIndex, state.seatsPerTable - 1);
  saveState();
  render();
}

tableNameInput.addEventListener("input", () => {
  state.tables[selected.tableIndex].name = tableNameInput.value || `第 ${selected.tableIndex + 1} 桌`;
  saveState();
  render();
});

guestNameInput.addEventListener("input", () => {
  state.tables[selected.tableIndex].seats[selected.seatIndex] = guestNameInput.value.trim();
  saveState();
  render();
});

searchInput.addEventListener("input", render);
document.querySelector("#applySizeButton").addEventListener("click", applySizeSettings);

document.querySelector("#clearSeatButton").addEventListener("click", () => {
  state.tables[selected.tableIndex].seats[selected.seatIndex] = "";
  saveState();
  render();
  guestNameInput.focus();
});

document.querySelector("#nextEmptyButton").addEventListener("click", findNextEmpty);

document.querySelector("#addTableButton").addEventListener("click", () => {
  state.tables.push(makeEmptyTable(state.tables.length, state.seatsPerTable));
  selected = { tableIndex: state.tables.length - 1, seatIndex: 0 };
  saveState();
  render();
});

document.querySelector("#removeTableButton").addEventListener("click", () => {
  if (state.tables.length <= 1) return;
  const last = state.tables.at(-1);
  if (last.seats.some(Boolean) && !confirm("末桌已有姓名，确定删除吗？")) return;
  state.tables.pop();
  selected.tableIndex = Math.min(selected.tableIndex, state.tables.length - 1);
  selected.seatIndex = Math.min(selected.seatIndex, state.seatsPerTable - 1);
  saveState();
  render();
});

document.querySelector("#exportButton").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `婚礼座位图-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector("#importInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    state = normalizeState(JSON.parse(await file.text()));
    selected = { tableIndex: 0, seatIndex: 0 };
    saveState();
    render();
  } catch {
    alert("导入失败，请选择此前导出的 JSON 文件。");
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#printButton").addEventListener("click", () => window.print());

document.querySelector("#resetButton").addEventListener("click", () => {
  if (!confirm("确定重置为 58 桌、每桌 10 人的空座位图吗？")) return;
  state = makeDefaultState();
  selected = { tableIndex: 0, seatIndex: 0 };
  saveState();
  render();
});

document.querySelector("#themeToggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  saveState();
  render();
});

document.querySelectorAll(".view-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    saveState();
    render();
  });
});

render();
