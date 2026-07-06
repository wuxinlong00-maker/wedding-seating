const STORAGE_KEY = "wedding-seating-v1";
const DEFAULT_TABLES = 58;
const SEATS_PER_TABLE = 10;
const seatingMap = document.querySelector("#seatingMap");
const tableTemplate = document.querySelector("#tableTemplate");
const seatTemplate = document.querySelector("#seatTemplate");
const searchInput = document.querySelector("#searchInput");
const tableNameInput = document.querySelector("#tableNameInput");
const seatIndexInput = document.querySelector("#seatIndexInput");
const guestNameInput = document.querySelector("#guestNameInput");
const tableCount = document.querySelector("#tableCount");
const guestCount = document.querySelector("#guestCount");
const seatCount = document.querySelector("#seatCount");
let state = loadState();
let selected = { tableIndex: 0, seatIndex: 0 };
function makeDefaultState() { return { theme: "light", view: "grid", tables: Array.from({ length: DEFAULT_TABLES }, (_, index) => ({ name: `第 ${index + 1} 桌`, seats: Array.from({ length: SEATS_PER_TABLE }, () => "") })) }; }
function normalizeState(data) { if (!data || !Array.isArray(data.tables)) return makeDefaultState(); return { theme: data.theme || "light", view: data.view || "grid", tables: data.tables.map((table, index) => ({ name: table.name || `第 ${index + 1} 桌`, seats: Array.from({ length: SEATS_PER_TABLE }, (_, seatIndex) => table.seats?.[seatIndex] || "") })) }; }
function loadState() { try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return makeDefaultState(); } }
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function render() {
  document.body.classList.toggle("dark", state.theme === "dark");
  seatingMap.className = `seating-map ${state.view}-view`;
  document.querySelectorAll(".view-button").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  seatingMap.innerHTML = "";
  const query = searchInput.value.trim().toLowerCase();
  state.tables.forEach((table, tableIndex) => {
    const card = tableTemplate.content.firstElementChild.cloneNode(true);
    const nameInput = card.querySelector(".table-name");
    const filledCount = card.querySelector(".filled-count");
    const seatRing = card.querySelector(".seat-ring");
    const filled = table.seats.filter(Boolean).length;
    const tableMatches = table.name.toLowerCase().includes(query) || String(tableIndex + 1).includes(query);
    card.classList.toggle("selected", selected.tableIndex === tableIndex);
    nameInput.value = table.name;
    filledCount.textContent = `${filled}/${SEATS_PER_TABLE}`;
    nameInput.addEventListener("input", () => { table.name = nameInput.value || `第 ${tableIndex + 1} 桌`; if (selected.tableIndex === tableIndex) tableNameInput.value = table.name; saveState(); updateStats(); });
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
function updateStats() { tableCount.textContent = state.tables.length; guestCount.textContent = state.tables.reduce((sum, table) => sum + table.seats.filter(Boolean).length, 0); seatCount.textContent = state.tables.length * SEATS_PER_TABLE; }
function updateEditor() { const table = state.tables[selected.tableIndex]; if (!table) return; tableNameInput.value = table.name; seatIndexInput.value = `${table.name} · ${selected.seatIndex + 1} 号座`; guestNameInput.value = table.seats[selected.seatIndex] || ""; }
function selectSeat(tableIndex, seatIndex) { selected = { tableIndex, seatIndex }; render(); guestNameInput.focus(); guestNameInput.select(); }
function findNextEmpty() { const start = selected.tableIndex * SEATS_PER_TABLE + selected.seatIndex + 1; const total = state.tables.length * SEATS_PER_TABLE; for (let offset = 0; offset < total; offset += 1) { const flat = (start + offset) % total; const tableIndex = Math.floor(flat / SEATS_PER_TABLE); const seatIndex = flat % SEATS_PER_TABLE; if (!state.tables[tableIndex].seats[seatIndex]) { selectSeat(tableIndex, seatIndex); return; } } }
tableNameInput.addEventListener("input", () => { state.tables[selected.tableIndex].name = tableNameInput.value || `第 ${selected.tableIndex + 1} 桌`; saveState(); render(); });
guestNameInput.addEventListener("input", () => { state.tables[selected.tableIndex].seats[selected.seatIndex] = guestNameInput.value.trim(); saveState(); render(); });
searchInput.addEventListener("input", render);
document.querySelector("#clearSeatButton").addEventListener("click", () => { state.tables[selected.tableIndex].seats[selected.seatIndex] = ""; saveState(); render(); guestNameInput.focus(); });
document.querySelector("#nextEmptyButton").addEventListener("click", findNextEmpty);
document.querySelector("#addTableButton").addEventListener("click", () => { state.tables.push({ name: `第 ${state.tables.length + 1} 桌`, seats: Array.from({ length: SEATS_PER_TABLE }, () => "") }); selected = { tableIndex: state.tables.length - 1, seatIndex: 0 }; saveState(); render(); });
document.querySelector("#removeTableButton").addEventListener("click", () => { if (state.tables.length <= 1) return; const last = state.tables.at(-1); if (last.seats.some(Boolean) && !confirm("末桌已有姓名，确定删除吗？")) return; state.tables.pop(); selected.tableIndex = Math.min(selected.tableIndex, state.tables.length - 1); selected.seatIndex = Math.min(selected.seatIndex, SEATS_PER_TABLE - 1); saveState(); render(); });
document.querySelector("#exportButton").addEventListener("click", () => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `婚礼座位图-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href); });
document.querySelector("#importInput").addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; try { state = normalizeState(JSON.parse(await file.text())); selected = { tableIndex: 0, seatIndex: 0 }; saveState(); render(); } catch { alert("导入失败，请选择此前导出的 JSON 文件。"); } finally { event.target.value = ""; } });
document.querySelector("#printButton").addEventListener("click", () => window.print());
document.querySelector("#resetButton").addEventListener("click", () => { if (!confirm("确定重置为 58 桌空座位图吗？")) return; state = makeDefaultState(); selected = { tableIndex: 0, seatIndex: 0 }; saveState(); render(); });
document.querySelector("#themeToggle").addEventListener("click", () => { state.theme = state.theme === "dark" ? "light" : "dark"; saveState(); render(); });
document.querySelectorAll(".view-button").forEach((button) => button.addEventListener("click", () => { state.view = button.dataset.view; saveState(); render(); }));
render();
