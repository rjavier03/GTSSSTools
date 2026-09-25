// Updated JavaScript with Date.UTC fix to prevent date/weekend shifting upon Excel recalculation

let SHIFTS = {};
let apiHolidays = {};  // keyed by "YYYY-MM-DD" => { name, type, isRegular }

let appState = {
    staffId: "696969",
    staffName: "Son Goku",
    department: "GTSSS",
    reportingManager: "",
    company: "B2BE GSS",
    shiftSchedule: "AU",
    multipleShifts: [],
    cutoffMonth: new Date().toISOString().slice(0, 7),
    leaves: {},
    workedHolidays: {},
    weekendOnCallDates: {},
    transpoDates: {}
};

document.addEventListener("DOMContentLoaded", async () => {
    loadLocalStorage();
    setupEventListeners();
    setupInstantCalendarPickers();

    await loadShiftsJson();
    await loadHolidaysJson();

    renderAll();
});

// ─── Calendar Pickers ────────────────────────────────────────────────────────

function setupInstantCalendarPickers() {
    const cutoffInput = document.getElementById("cutoffMonth");
    if (cutoffInput) {
        cutoffInput.addEventListener("click", () => {
            if (typeof cutoffInput.showPicker === "function") cutoffInput.showPicker();
        });
    }

    const multiSelectIds = ["leaveDate", "transpoDate", "weekendOnCallDate"];
    multiSelectIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            flatpickr(el, {
                mode: "multiple",
                dateFormat: "Y-m-d",
                allowInput: false,
                disableMobile: true,
                locale: { firstDayOfWeek: 1 }
            });
        }
    });
}

// ─── Shift JSON Loading & Management ──────────────────────────────────────────

async function loadShiftsJson() {
    try {
        const response = await fetch("shifts.json");
        if (response.ok) {
            const fileShifts = await response.json();
            SHIFTS = { ...fileShifts };
        }
    } catch (err) {
        console.warn("Could not load shifts.json:", err);
    }

    // Merge custom shifts from localStorage
    const customShifts = JSON.parse(localStorage.getItem("customShifts") || "{}");
    Object.assign(SHIFTS, customShifts);

    updateShiftDropdownUI();
}

function updateShiftDropdownUI() {
    const select = document.getElementById("shiftSchedule");
    if (select) {
        select.innerHTML = "";
        Object.keys(SHIFTS).forEach(key => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = SHIFTS[key].label;
            if (key === appState.shiftSchedule) opt.selected = true;
            select.appendChild(opt);
        });

        const multiOpt = document.createElement("option");
        multiOpt.value = "MULTIPLE";
        multiOpt.textContent = "Multiple Shift...";
        if (appState.shiftSchedule === "MULTIPLE") multiOpt.selected = true;
        select.appendChild(multiOpt);
    }
}

// ─── Custom Shift Modals (Add & Delete / Manage) ─────────────────────────────

function openAddCustomShiftModal() {
    const modal = document.getElementById("addCustomShiftModal");
    if (modal) {
        document.getElementById("customShiftKey").value = "";
        document.getElementById("customShiftLabel").value = "";
        document.getElementById("customShiftFrom").value = "";
        document.getElementById("customShiftTo").value = "";
        document.getElementById("customShiftNd").value = "0";
        modal.style.display = "flex";
    }
}

function closeAddCustomShiftModal() {
    const modal = document.getElementById("addCustomShiftModal");
    if (modal) modal.style.display = "none";
}

function saveCustomShift() {
    const key = document.getElementById("customShiftKey").value.trim().toUpperCase().replace(/\s+/g, "_");
    const label = document.getElementById("customShiftLabel").value.trim();
    const from = document.getElementById("customShiftFrom").value.trim();
    const to = document.getElementById("customShiftTo").value.trim();
    const nd = parseInt(document.getElementById("customShiftNd").value, 10) || 0;

    if (!key) { showModal("Please enter a Shift Key (e.g. MY_SHIFT)."); return; }
    if (!label) { showModal("Please enter a Shift Label."); return; }
    if (!from || !/^\d{2}:\d{2}$/.test(from)) { showModal("Please enter a valid Time From (HH:MM)."); return; }
    if (!to || !/^\d{2}:\d{2}$/.test(to)) { showModal("Please enter a valid Time To (HH:MM)."); return; }

    const newShift = { label: `${label} (${from} - ${to})`, from, to, nd };

    // Save to localStorage under customShifts
    const customShifts = JSON.parse(localStorage.getItem("customShifts") || "{}");
    customShifts[key] = newShift;
    localStorage.setItem("customShifts", JSON.stringify(customShifts));

    SHIFTS[key] = newShift;
    appState.shiftSchedule = key;
    saveLocalStorage();
    closeAddCustomShiftModal();
    updateShiftDropdownUI();
    renderAll();
    showModal(`✅ Custom shift <strong>${key}</strong> saved successfully!`);
}

function openManageCustomShiftsModal() {
    const modal = document.getElementById("manageCustomShiftsModal");
    if (!modal) return;
    const listEl = document.getElementById("customShiftsList");
    const customShifts = JSON.parse(localStorage.getItem("customShifts") || "{}");
    const keys = Object.keys(customShifts);
    if (keys.length === 0) {
        listEl.innerHTML = "<p style='color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px 0;'>No custom shifts saved yet.</p>";
    } else {
        listEl.innerHTML = keys.map(k => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-color);border:1px solid var(--border-color);border-radius:6px;margin-bottom:8px;">
                <div>
                    <div style="font-weight:600;font-size:0.9rem;">${k}</div>
                    <div style="font-size:0.8rem;color:var(--text-muted);">${customShifts[k].label}</div>
                </div>
                <button type="button" class="btn-delete" onclick="deleteCustomShift('${k}')">🗑️ Delete</button>
            </div>
        `).join("");
    }
    modal.style.display = "flex";
}

function closeManageCustomShiftsModal() {
    const modal = document.getElementById("manageCustomShiftsModal");
    if (modal) modal.style.display = "none";
}

function deleteCustomShift(key) {
    const customShifts = JSON.parse(localStorage.getItem("customShifts") || "{}");
    if (customShifts[key]) {
        delete customShifts[key];
        localStorage.setItem("customShifts", JSON.stringify(customShifts));
        delete SHIFTS[key];
        if (appState.shiftSchedule === key) {
            appState.shiftSchedule = Object.keys(SHIFTS)[0] || "AU";
            saveLocalStorage();
        }
        updateShiftDropdownUI();
        renderAll();
        openManageCustomShiftsModal(); // refresh list in modal
    }
}

// ─── Holiday Loading (JSON + API fallback) ───────────────────────────────────

async function loadHolidaysJson() {
    const year = parseInt(appState.cutoffMonth.split("-")[0], 10) || new Date().getFullYear();
    const prevYear = year - 1;

    let loaded = false;
    try {
        const response = await fetch("holidays.json");
        if (response.ok) {
            const data = await response.json();
            apiHolidays = {};
            [prevYear, year].forEach(y => {
                const yStr = String(y);
                if (data[yStr]) {
                    data[yStr].forEach(h => {
                        const isRegular = h.type === "Regular Holiday";
                        const isSpecialWorking = h.type === "Special Working Day";
                        if (!isSpecialWorking) {
                            apiHolidays[h.date] = {
                                name: h.name,
                                type: h.type,
                                isRegular
                            };
                        }
                    });
                }
            });
            loaded = true;
        }
    } catch (err) {
        console.warn("Could not load holidays.json:", err);
    }

    if (!loaded) {
        await fetchHolidaysApi(year);
    }
}

async function fetchHolidaysApi(year) {
    year = year || (parseInt(appState.cutoffMonth.split("-")[0], 10) || new Date().getFullYear());
    try {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/PH`);
        if (res.ok) {
            const data = await res.json();
            data.forEach(item => {
                const classified = classifyPHHoliday(item, item.date);
                apiHolidays[item.date] = classified;
            });
        }
    } catch (err) {
        console.warn("Holiday API error:", err);
    }
}

function simplifyHolidayName(rawName, dateStr) {
    const name = rawName.toLowerCase();
    if (dateStr.endsWith("-01-01") || name.includes("new year")) return "New Year's Day";
    if (dateStr.endsWith("-04-09") || name.includes("kagitingan") || name.includes("valor")) return "Day of Valor";
    if (dateStr.endsWith("-05-01") || name.includes("labor")) return "Labor Day";
    if (dateStr.endsWith("-06-12") || name.includes("independence")) return "Independence Day";
    if (dateStr.endsWith("-08-21") || name.includes("ninoy aquino") || name.includes("benigno")) return "Ninoy Aquino Day";
    if (name.includes("national heroes") || name.includes("mga bayani")) return "National Heroes Day";
    if (dateStr.endsWith("-11-01") || name.includes("all saints")) return "All Saints' Day";
    if (dateStr.endsWith("-11-02") || name.includes("all souls")) return "All Souls' Day";
    if (dateStr.endsWith("-11-30") || name.includes("bonifacio")) return "Bonifacio Day";
    if (dateStr.endsWith("-12-08") || name.includes("immaculate conception")) return "Feast of the Immaculate Conception of Mary";
    if (dateStr.endsWith("-12-25") || name.includes("christmas day")) return "Christmas Day";
    if (dateStr.endsWith("-12-30") || name.includes("rizal")) return "Rizal Day";
    if (dateStr.endsWith("-12-31") || name.includes("last day")) return "Last Day of the Year";
    if (name.includes("maundy thursday")) return "Maundy Thursday";
    if (name.includes("good friday")) return "Good Friday";
    if (name.includes("black saturday")) return "Black Saturday";
    if (name.includes("edsa")) return "EDSA People Power Revolution Anniversary";
    if (name.includes("fitr")) return "Eid'l Fitr";
    if (name.includes("adha")) return "Eid'l Adha";
    return rawName;
}

function classifyPHHoliday(item, dateStr) {
    const rawName = item.localName || item.name || "";
    const nameLower = rawName.toLowerCase();
    const cleanName = simplifyHolidayName(rawName, dateStr);

    const gazetteSpecialKeywords = [
        "ninoy aquino", "benigno", "all saints", "all souls",
        "immaculate conception", "last day of the year",
        "black saturday", "edsa people power", "special non-working"
    ];
    const gazetteRegularKeywords = [
        "new year's day", "maundy thursday", "good friday",
        "araw ng kagitingan", "day of valor", "labor day",
        "independence day", "national heroes day", "bonifacio day",
        "christmas day", "rizal day", "eid'l fitr", "eid'l adha"
    ];

    let isRegular = false;
    if (dateStr.endsWith("-08-21") || gazetteSpecialKeywords.some(kw => nameLower.includes(kw))) {
        isRegular = false;
    } else if (gazetteRegularKeywords.some(kw => nameLower.includes(kw))) {
        isRegular = true;
    } else {
        isRegular = item.types && item.types.includes("Public") && !nameLower.includes("special");
    }

    return {
        name: cleanName,
        type: isRegular ? "Regular Holiday" : "Special Non-Working Holiday",
        isRegular
    };
}

// ─── Local Storage ───────────────────────────────────────────────────────────

function loadLocalStorage() {
    const saved = localStorage.getItem("timesheetAppState");
    if (saved) {
        try { appState = { ...appState, ...JSON.parse(saved) }; } catch(e) {}
    }
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
    setVal("staffId", appState.staffId);
    setVal("staffName", appState.staffName);
    setVal("department", appState.department);
    setVal("reportingManager", appState.reportingManager);
    setVal("company", appState.company);
    setVal("cutoffMonth", appState.cutoffMonth);

    updateShiftDropdownUI();

    const theme = localStorage.getItem("timesheetTheme") || "light";
    document.documentElement.setAttribute("data-theme", theme);
    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) themeBtn.textContent = theme === "dark" ? "🌙 Dark" : "☀️ Light";
}

function saveLocalStorage() {
    localStorage.setItem("timesheetAppState", JSON.stringify(appState));
}

// ─── Event Listeners ─────────────────────────────────────────────────────────

function setupEventListeners() {
    const inputs = ["staffId", "staffName", "department", "reportingManager", "company", "cutoffMonth"];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", async (e) => {
                appState[id] = e.target.value;
                saveLocalStorage();
                if (id === "cutoffMonth") await loadHolidaysJson();
                renderAll();
            });
        }
    });

    const shiftSelect = document.getElementById("shiftSchedule");
    if (shiftSelect) {
        shiftSelect.addEventListener("change", async (e) => {
            const val = e.target.value;
            if (val === "MULTIPLE") {
                openMultipleShiftModal();
            } else {
                appState.shiftSchedule = val;
                saveLocalStorage();
                renderAll();
            }
        });
    }
}

// ─── Multiple Shift Modal & Date Sorting ──────────────────────────────────────

function openMultipleShiftModal() {
    const modal = document.getElementById("multipleShiftModal");
    if (modal) {
        modal.style.display = "flex";
        populateMultipleShiftModalEntries();
    }
}

function closeMultipleShiftModal() {
    const modal = document.getElementById("multipleShiftModal");
    if (modal) {
        modal.style.display = "none";
        if (appState.shiftSchedule === "MULTIPLE" && (!appState.multipleShifts || appState.multipleShifts.length === 0)) {
            appState.shiftSchedule = Object.keys(SHIFTS)[0] || "US1";
            updateShiftDropdownUI();
            saveLocalStorage();
            renderAll();
        }
    }
}

function populateMultipleShiftModalEntries() {
    const container = document.getElementById("multipleShiftEntriesContainer");
    if (!container) return;
    container.innerHTML = "";

    const { startDate, endDate } = getCutoffRange(appState.cutoffMonth);
    const minDate = formatYMD(startDate);
    const maxDate = formatYMD(endDate);

    const rawList = appState.multipleShifts && appState.multipleShifts.length > 0
        ? appState.multipleShifts
        : [{ fromDate: "", toDate: "", shiftKey: Object.keys(SHIFTS)[0] || "" }];
    
    // Always sort list by start date (fromDate) ascending
    const list = [...rawList].sort((a, b) => (a.fromDate || "").localeCompare(b.fromDate || ""));

    list.forEach((item) => {
        const row = createMultipleShiftRowElement(item, minDate, maxDate);
        container.appendChild(row);
    });
}

function createMultipleShiftRowElement(item, minDate, maxDate) {
    const row = document.createElement("div");
    row.className = "multiple-shift-row";

    let optionsHtml = "";
    Object.keys(SHIFTS).forEach(k => {
        optionsHtml += `<option value="${k}" ${item.shiftKey === k ? "selected" : ""}>${SHIFTS[k].label}</option>`;
    });

    row.innerHTML = `
        <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:2px;">From Date</label>
            <input type="date" class="ms-from" value="${item.fromDate || ""}" min="${minDate}" max="${maxDate}" style="width:100%; padding:6px; border:1px solid var(--border-color); border-radius:4px; background:var(--bg-color); color:var(--text-color);">
        </div>
        <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:2px;">To Date</label>
            <input type="date" class="ms-to" value="${item.toDate || ""}" min="${minDate}" max="${maxDate}" style="width:100%; padding:6px; border:1px solid var(--border-color); border-radius:4px; background:var(--bg-color); color:var(--text-color);">
        </div>
        <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:2px;">Shift Schedule</label>
            <select class="ms-shift" style="width:100%; padding:6px; border:1px solid var(--border-color); border-radius:4px; background:var(--bg-color); color:var(--text-color);">
                ${optionsHtml}
            </select>
        </div>
        <div style="padding-top:16px;">
            <button type="button" class="btn-delete" onclick="removeMultipleShiftRow(this)">Remove</button>
        </div>
    `;
    return row;
}

function addMultipleShiftRow() {
    const container = document.getElementById("multipleShiftEntriesContainer");
    if (!container) return;

    const { startDate, endDate } = getCutoffRange(appState.cutoffMonth);
    const minDate = formatYMD(startDate);
    const maxDate = formatYMD(endDate);

    const row = createMultipleShiftRowElement({ fromDate: "", toDate: "", shiftKey: Object.keys(SHIFTS)[0] || "" }, minDate, maxDate);
    container.appendChild(row);
}

function removeMultipleShiftRow(btn) {
    const row = btn.closest(".multiple-shift-row");
    if (row) row.remove();
}

function saveMultipleShiftsConfig() {
    const container = document.getElementById("multipleShiftEntriesContainer");
    if (!container) return;
    const rows = container.querySelectorAll(".multiple-shift-row");
    let newShifts = [];
    const { startDate, endDate } = getCutoffRange(appState.cutoffMonth);
    const minStr = formatYMD(startDate);
    const maxStr = formatYMD(endDate);

    let validationErrors = [];

    rows.forEach((r, idx) => {
        const fromDate = r.querySelector(".ms-from").value;
        const toDate = r.querySelector(".ms-to").value;
        const shiftKey = r.querySelector(".ms-shift").value;

        if (fromDate && toDate) {
            if (fromDate < minStr || fromDate > maxStr || toDate < minStr || toDate > maxStr) {
                validationErrors.push(`Row ${idx + 1}: Dates must be within the current cutoff period (${minStr} to ${maxStr}).`);
            } else if (fromDate > toDate) {
                validationErrors.push(`Row ${idx + 1}: 'From Date' cannot be later than 'To Date'.`);
            } else {
                newShifts.push({ fromDate, toDate, shiftKey });
            }
        }
    });

    if (validationErrors.length > 0) {
        showModal("<strong>Validation Error:</strong><br><br>" + validationErrors.join("<br>"));
        return;
    }

    // Sort multiple shifts by fromDate ascending before saving
    newShifts.sort((a, b) => a.fromDate.localeCompare(b.fromDate));

    appState.shiftSchedule = "MULTIPLE";
    appState.multipleShifts = newShifts;
    saveLocalStorage();
    updateShiftDropdownUI();
    closeMultipleShiftModal();
    renderAll();
}

function getShiftForDate(dateStr) {
    if (appState.shiftSchedule === "MULTIPLE" && appState.multipleShifts) {
        for (let ms of appState.multipleShifts) {
            if (dateStr >= ms.fromDate && dateStr <= ms.toDate) {
                return SHIFTS[ms.shiftKey] || null;
            }
        }
    }
    return SHIFTS[appState.shiftSchedule] || null;
}

// ─── Render ──────────────────────────────────────────────────────────────────

function renderAll() {
    renderHolidaysAndLeavesLists();
    renderTimesheetTable();
}

// ─── Cutoff Range ─────────────────────────────────────────────────────────────

function getCutoffRange(yearMonthStr) {
    const [year, month] = yearMonthStr.split("-").map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const startDate = new Date(prevYear, prevMonth - 1, 16);
    const endDate = new Date(year, month - 1, 15);
    return { startDate, endDate };
}

function formatYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDisplayDate(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${date.getFullYear()}`;
}

function parseDatesInput(inputStr) {
    if (!inputStr) return [];
    return inputStr.split(/[\s,]+/).map(s => s.trim()).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s));
}

// ─── Leave / Transpo / Weekend Actions ───────────────────────────────────────

function addLeave() {
    const leaveInput = document.getElementById("leaveDate");
    const leaveId = document.getElementById("leaveId").value.trim();
    if (!leaveInput.value) { showModal("Please select date(s) for the leave."); return; }
    if (!leaveId) { showModal("Please enter a Leave ID."); return; }
    const dates = parseDatesInput(leaveInput.value);
    dates.forEach(d => { appState.leaves[d] = leaveId; });
    document.getElementById("leaveId").value = "";
    if (leaveInput._flatpickr) leaveInput._flatpickr.clear();
    saveLocalStorage();
    renderAll();
}

function deleteLeave(dateStr) {
    delete appState.leaves[dateStr];
    saveLocalStorage();
    renderAll();
}

function addTranspoDate() {
    const transpoInput = document.getElementById("transpoDate");
    if (!transpoInput || !transpoInput.value) { showModal("Please select date(s) for Transportation."); return; }
    const dates = parseDatesInput(transpoInput.value);
    dates.forEach(d => { appState.transpoDates[d] = 100; });
    if (transpoInput._flatpickr) transpoInput._flatpickr.clear();
    saveLocalStorage();
    renderAll();
}

function deleteTranspoDate(dateStr) {
    delete appState.transpoDates[dateStr];
    saveLocalStorage();
    renderAll();
}

function toggleWeekendOnCall() {
    const weekendInput = document.getElementById("weekendOnCallDate");
    if (!weekendInput || !weekendInput.value) { showModal("Please select date(s) for Weekend On-Call."); return; }
    const { startDate, endDate } = getCutoffRange(appState.cutoffMonth);
    const dates = parseDatesInput(weekendInput.value);
    let invalidMessages = [];

    dates.forEach(dateInput => {
        const parts = dateInput.split("-");
        const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
        const dayOfWeek = dateObj.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const isInCutoff = (dateObj >= startDate && dateObj <= endDate);

        if (!isInCutoff) {
            invalidMessages.push(`<strong>${dateInput}</strong> is outside the current cutoff range.`);
        } else if (!isWeekend) {
            invalidMessages.push(`<strong>${dateInput}</strong> is not a weekend.`);
        } else {
            if (appState.weekendOnCallDates[dateInput]) {
                delete appState.weekendOnCallDates[dateInput];
            } else {
                appState.weekendOnCallDates[dateInput] = true;
            }
        }
    });

    if (invalidMessages.length > 0) {
        showModal("<strong>Invalid Date Selection:</strong><br><br>" + invalidMessages.join("<br>"));
        return;
    }
    if (weekendInput._flatpickr) weekendInput._flatpickr.clear();
    saveLocalStorage();
    renderAll();
}

function deleteWeekendOnCall(dateStr) {
    delete appState.weekendOnCallDates[dateStr];
    saveLocalStorage();
    renderAll();
}

function toggleWorkedHoliday(dateStr, isWorked) {
    appState.workedHolidays[dateStr] = isWorked;
    saveLocalStorage();
    renderAll();
}

function countCutoffOnCallDays(startDate, endDate) {
    let count = 0;
    Object.keys(appState.weekendOnCallDates).forEach(dateStr => {
        const parts = dateStr.split("-");
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        if (d >= startDate && d <= endDate) count++;
    });
    return count;
}

// ─── Holidays & Leaves List Render ───────────────────────────────────────────

function renderHolidaysAndLeavesLists() {
    const { startDate, endDate } = getCutoffRange(appState.cutoffMonth);

    const leaveList = document.getElementById("leaveList");
    if (leaveList) {
        leaveList.innerHTML = "";
        Object.keys(appState.leaves).sort().forEach(date => {
            const parts = date.split("-");
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            if (d >= startDate && d <= endDate) {
                leaveList.innerHTML += `<li><span><strong>${date}</strong> — ${appState.leaves[date]}</span> <button class="btn-delete" onclick="deleteLeave('${date}')">Remove</button></li>`;
            }
        });
    }

    const weekendList = document.getElementById("weekendOnCallList");
    if (weekendList) {
        weekendList.innerHTML = "";
        Object.keys(appState.weekendOnCallDates).sort().forEach(date => {
            const parts = date.split("-");
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            if (d >= startDate && d <= endDate) {
                weekendList.innerHTML += `
                    <li>
                        <span><strong>${date}</strong> (Weekend Duty)</span>
                        <button class="btn-delete" onclick="deleteWeekendOnCall('${date}')">Remove</button>
                    </li>`;
            }
        });
    }

    const transpoList = document.getElementById("transpoList");
    if (transpoList) {
        transpoList.innerHTML = "";
        Object.keys(appState.transpoDates).sort().forEach(date => {
            const parts = date.split("-");
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            if (d >= startDate && d <= endDate) {
                transpoList.innerHTML += `<li><span><strong>${date}</strong> — Allowance: ₱100</span> <button class="btn-delete" onclick="deleteTranspoDate('${date}')">Remove</button></li>`;
            }
        });
    }

    const cutoffHolidayList = document.getElementById("cutoffHolidayList");
    if (cutoffHolidayList) {
        cutoffHolidayList.innerHTML = "";
        let curr = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        let foundHolidays = 0;

        while (curr <= endDate) {
            const dateStr = formatYMD(curr);
            if (apiHolidays[dateStr]) {
                foundHolidays++;
                const hol = apiHolidays[dateStr];
                const isWorked = appState.workedHolidays[dateStr] !== false;
                const badgeClass = hol.isRegular ? 'badge-regular' : 'badge-special';

                cutoffHolidayList.innerHTML += `
                    <div class="holiday-item">
                        <div>
                            <div style="font-weight: 600;">${formatDisplayDate(curr)} — ${hol.name}</div>
                            <span class="badge ${badgeClass}">${hol.type}</span>
                        </div>
                        <label class="switch">
                            <input type="checkbox" ${isWorked ? "checked" : ""} onchange="toggleWorkedHoliday('${dateStr}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </div>
                `;
            }
            curr.setDate(curr.getDate() + 1);
        }

        if (foundHolidays === 0) {
            cutoffHolidayList.innerHTML = "<p style='color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 12px 0;'>No public holidays in this cutoff period.</p>";
        }
    }
}

// ─── Time Calculation Helpers ─────────────────────────────────────────────────

function calculateDurationHours(timeFrom, timeTo) {
    if (!timeFrom || !timeTo) return 0;
    const [h1, m1] = timeFrom.split(":").map(Number);
    let [h2, m2] = timeTo.split(":").map(Number);
    if (h2 === 0 && m2 === 0 && h1 > 0) h2 = 24;
    return (h2 + m2 / 60) - (h1 + m1 / 60);
}

function calculateNightDiffHours(timeFrom, timeTo) {
    if (!timeFrom || !timeTo) return 0;
    const [h1, m1] = timeFrom.split(":").map(Number);
    let [h2, m2] = timeTo.split(":").map(Number);
    if (h2 === 0 && m2 === 0 && h1 > 0) h2 = 24;

    const startDecimal = h1 + (m1 / 60);
    const endDecimal = h2 + (m2 / 60);
    let ndHours = 0;

    if (startDecimal < 24 && endDecimal > 22) {
        const segStart = Math.max(startDecimal, 22);
        const segEnd = Math.min(endDecimal, 24);
        if (segEnd > segStart) ndHours += (segEnd - segStart);
    }
    if (startDecimal < 6 && endDecimal > 0) {
        const segStart = Math.max(startDecimal, 0);
        const segEnd = Math.min(endDecimal, 6);
        if (segEnd > segStart) ndHours += (segEnd - segStart);
    }
    return Math.min(7, ndHours);
}

// ─── Timesheet Core Calculation Engine ───────────────────────────────────────

/**
 * Unified timesheet generator used by both Table Preview and Excel Export.
 *
 * For cross-midnight shifts (e.g. US1 21:00-06:00 or US2 22:00-07:00):
 * 1. If Thursday shift is worked and Friday is a holiday:
 *    - Thursday evening (21:00-00:00): normal ND (2), 0 holiday hours (Thu is not holiday).
 *    - Friday morning carryover (00:00-06:00): worked on Friday (holiday) -> gets ND (6), 5 holiday hours, Friday holiday remarks.
 * 2. If Friday shift is NOT worked on holiday (or on leave):
 *    - Friday evening (21:00-00:00): blank time/hours, Friday holiday remarks.
 *    - Saturday morning (00:00-06:00): blank (no carryover because Friday shift was not worked).
 * 3. If Friday shift IS worked on holiday:
 *    - Friday evening (21:00-00:00): gets ND (2), 3 holiday hours, Friday holiday remarks.
 *    - Saturday morning carryover (00:00-06:00): gets ND (6), 0 holiday hours (Sat is not holiday).
 * 4. Night diff is ALWAYS retained when working on a holiday (paid on top of holiday pay).
 */
function generateTimesheetData() {
    const { startDate, endDate } = getCutoffRange(appState.cutoffMonth);
    const rows = [];
    let totals = { nightDiff: 0, restDayOt: 0, regDayOt: 0, specialHol: 0, regHol: 0, transpo: 0 };
    let curr = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

    // Track cross-midnight carryover from the previous calendar day
    // Structure: { originDateStr, prevShift, shiftWasWorked }
    let pendingMorningCarryOver = null;

    while (curr <= endDate) {
        const dateStr = formatYMD(curr);
        const dayOfWeek = curr.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const dayName = curr.toLocaleDateString("en-US", { weekday: "long" });
        const currentShift = getShiftForDate(dateStr);
        const holidayToday = apiHolidays[dateStr] || null;
        const leaveToday = appState.leaves[dateStr] || null;
        const workedHolidayToday = holidayToday ? (appState.workedHolidays[dateStr] !== false) : true;
        
        const isCrossMidnight = currentShift && currentShift.from && currentShift.to && (() => {
            const [hFrom] = currentShift.from.split(":").map(Number);
            const [hTo] = currentShift.to.split(":").map(Number);
            return hTo <= hFrom;
        })();

        // ── 1. Morning Carryover Leg from yesterday's cross-midnight shift ──
        if (pendingMorningCarryOver) {
            const { originDateStr, prevShift, shiftWasWorked } = pendingMorningCarryOver;

            // If yesterday's shift was actually WORKED by the employee:
            if (shiftWasWorked && prevShift) {
                const morningDateObj = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate());
                const toTime = prevShift.to || "06:00";
                
                // Calculate split holiday hours for morning leg:
                // Full shift = 8 working hrs. Morning leg = 8 - eveningLegHours.
                const [prevFromH] = prevShift.from.split(":").map(Number);
                const prevEveningRaw = prevFromH >= 21 ? (24 - prevFromH) : 0;
                const prevEveningHol = Math.min(prevEveningRaw, 8);
                const morningHolHours = Math.max(0, 8 - prevEveningHol);

                let morningRow = {
                    dateObj: morningDateObj,
                    dateStr,
                    displayDate: formatDisplayDate(morningDateObj),
                    dayName,
                    isWeekend,
                    timeFrom: "00:00",
                    timeTo: toTime,
                    nightDiff: calculateNightDiffHours("00:00", toTime),
                    restDayOt: 0,
                    regDayOt: 0,
                    specialHol: 0,
                    regHol: 0,
                    transportation: appState.transpoDates[dateStr] || 0,
                    onCall: appState.weekendOnCallDates[dateStr] ? "Yes" : "No",
                    remarks: holidayToday ? holidayToday.name : ""
                };

                if (holidayToday) {
                    // This morning portion falls on TODAY's holiday
                    if (holidayToday.isRegular) {
                        morningRow.regHol = morningHolHours;
                    } else {
                        morningRow.specialHol = morningHolHours;
                    }
                }

                rows.push(morningRow);
            }
            pendingMorningCarryOver = null;
        }

        // ── 2. Today's Scheduled Shift / Day Row ────────────────────────────
        if (isWeekend) {
            if (appState.weekendOnCallDates[dateStr]) {
                rows.push({
                    dateObj: new Date(curr.getTime()),
                    dateStr,
                    displayDate: formatDisplayDate(curr),
                    dayName,
                    isWeekend: true,
                    timeFrom: "00:00",
                    timeTo: "23:59",
                    nightDiff: 0,
                    restDayOt: 8,
                    regDayOt: 0,
                    specialHol: 0,
                    regHol: 0,
                    transportation: appState.transpoDates[dateStr] || 0,
                    onCall: "Yes",
                    remarks: holidayToday ? holidayToday.name : ""
                });
            } else {
                rows.push({
                    dateObj: new Date(curr.getTime()),
                    dateStr,
                    displayDate: formatDisplayDate(curr),
                    dayName,
                    isWeekend: true,
                    timeFrom: "",
                    timeTo: "",
                    nightDiff: 0,
                    restDayOt: 0,
                    regDayOt: 0,
                    specialHol: 0,
                    regHol: 0,
                    transportation: appState.transpoDates[dateStr] || 0,
                    onCall: "No",
                    remarks: holidayToday ? holidayToday.name : ""
                });
            }
            pendingMorningCarryOver = null;
        } else {
            // Weekday
            if (leaveToday) {
                // Today is on leave -> Blank row, no working hours
                rows.push({
                    dateObj: new Date(curr.getTime()),
                    dateStr,
                    displayDate: formatDisplayDate(curr),
                    dayName,
                    isWeekend: false,
                    timeFrom: "",
                    timeTo: "",
                    nightDiff: 0,
                    restDayOt: 0,
                    regDayOt: 0,
                    specialHol: 0,
                    regHol: 0,
                    transportation: appState.transpoDates[dateStr] || 0,
                    onCall: "No",
                    remarks: `Leave ID: ${leaveToday}`
                });
                if (isCrossMidnight && currentShift) {
                    pendingMorningCarryOver = { originDateStr: dateStr, prevShift: currentShift, shiftWasWorked: false };
                } else {
                    pendingMorningCarryOver = null;
                }
            } else if (holidayToday && !workedHolidayToday) {
                // Today is a holiday and employee did NOT work on holiday -> Blank row
                rows.push({
                    dateObj: new Date(curr.getTime()),
                    dateStr,
                    displayDate: formatDisplayDate(curr),
                    dayName,
                    isWeekend: false,
                    timeFrom: "",
                    timeTo: "",
                    nightDiff: 0,
                    restDayOt: 0,
                    regDayOt: 0,
                    specialHol: 0,
                    regHol: 0,
                    transportation: appState.transpoDates[dateStr] || 0,
                    onCall: "No",
                    remarks: holidayToday.name
                });
                if (isCrossMidnight && currentShift) {
                    pendingMorningCarryOver = { originDateStr: dateStr, prevShift: currentShift, shiftWasWorked: false };
                } else {
                    pendingMorningCarryOver = null;
                }
            } else {
                // Today's shift IS WORKED (normal workday or worked holiday)
                if (isCrossMidnight && currentShift) {
                    // Evening leg on today (e.g. 21:00/22:00 to 00:00)
                    const [fromH] = currentShift.from.split(":").map(Number);
                    const eveningRaw = fromH >= 21 ? (24 - fromH) : 0;
                    const eveningHolHours = Math.min(eveningRaw, 8);

                    let eveningRow = {
                        dateObj: new Date(curr.getTime()),
                        dateStr,
                        displayDate: formatDisplayDate(curr),
                        dayName,
                        isWeekend: false,
                        timeFrom: currentShift.from,
                        timeTo: "00:00",
                        nightDiff: calculateNightDiffHours(currentShift.from, "00:00"),
                        restDayOt: 0,
                        regDayOt: 0,
                        specialHol: 0,
                        regHol: 0,
                        transportation: appState.transpoDates[dateStr] || 0,
                        onCall: "No",
                        remarks: holidayToday ? holidayToday.name : ""
                    };

                    if (holidayToday) {
                        // Today is holiday and employee worked today's evening
                        if (holidayToday.isRegular) {
                            eveningRow.regHol = eveningHolHours;
                        } else {
                            eveningRow.specialHol = eveningHolHours;
                        }
                    }

                    rows.push(eveningRow);
                    pendingMorningCarryOver = { originDateStr: dateStr, prevShift: currentShift, shiftWasWorked: true };
                } else {
                    // Same-day shift (e.g. AU 06:30 - 15:30)
                    const shift = currentShift || { from: "06:30", to: "15:30" };
                    const rawDuration = calculateDurationHours(shift.from, shift.to);
                    const effectiveDuration = rawDuration >= 8 ? rawDuration - 1 : rawDuration;

                    let dayRow = {
                        dateObj: new Date(curr.getTime()),
                        dateStr,
                        displayDate: formatDisplayDate(curr),
                        dayName,
                        isWeekend: false,
                        timeFrom: shift.from,
                        timeTo: shift.to,
                        nightDiff: calculateNightDiffHours(shift.from, shift.to),
                        restDayOt: 0,
                        regDayOt: 0,
                        specialHol: 0,
                        regHol: 0,
                        transportation: appState.transpoDates[dateStr] || 0,
                        onCall: "No",
                        remarks: holidayToday ? holidayToday.name : ""
                    };

                    if (holidayToday) {
                        const holHours = Math.min(8, effectiveDuration);
                        if (holidayToday.isRegular) {
                            dayRow.regHol = holHours;
                        } else {
                            dayRow.specialHol = holHours;
                        }
                    }

                    rows.push(dayRow);
                    pendingMorningCarryOver = null;
                }
            }
        }

        curr.setDate(curr.getDate() + 1);
    }

    // Tally totals
    rows.forEach(r => {
        totals.nightDiff += parseFloat(r.nightDiff) || 0;
        totals.restDayOt += parseFloat(r.restDayOt) || 0;
        totals.regDayOt += parseFloat(r.regDayOt) || 0;
        totals.specialHol += parseFloat(r.specialHol) || 0;
        totals.regHol += parseFloat(r.regHol) || 0;
        totals.transpo += parseFloat(r.transportation) || 0;
    });

    return { rows, totals, startDate, endDate };
}

// ─── Timesheet Table Render ───────────────────────────────────────────────────

function renderTimesheetTable() {
    const { rows, totals, startDate, endDate } = generateTimesheetData();
    
    const periodDisplay = document.getElementById("periodDisplay");
    if (periodDisplay) {
        periodDisplay.value = `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
    }

    const tbody = document.getElementById("timesheetBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    rows.forEach((data) => {
        const tr = document.createElement("tr");
        if (data.isWeekend) tr.classList.add("weekend-row");

        tr.innerHTML = `
            <td class="sticky-col col-1">${data.displayDate}</td>
            <td class="sticky-col col-2">${data.dayName}</td>
            <td class="sticky-col col-3">${data.timeFrom}</td>
            <td class="sticky-col col-4">${data.timeTo}</td>
            <td>${data.nightDiff || ""}</td>
            <td>${data.restDayOt || ""}</td>
            <td>${data.regDayOt || ""}</td>
            <td>${data.specialHol || ""}</td>
            <td>${data.regHol || ""}</td>
            <td>${data.transportation || ""}</td>
            <td>${data.remarks}</td>
        `;
        tbody.appendChild(tr);
    });

    const totalRow = document.createElement("tr");
    totalRow.className = "weekend-row";
    totalRow.style.fontWeight = "bold";
    totalRow.style.color = "#0f172a";
    totalRow.innerHTML = `
        <td class="sticky-col col-1" style="background-color: #6699ff;">TOTAL</td>
        <td class="sticky-col col-2" style="background-color: #6699ff;"></td>
        <td class="sticky-col col-3" style="background-color: #6699ff;"></td>
        <td class="sticky-col col-4" style="background-color: #6699ff;"></td>
        <td>${totals.nightDiff}</td>
        <td>${totals.restDayOt}</td>
        <td>${totals.regDayOt}</td>
        <td>${totals.specialHol}</td>
        <td>${totals.regHol}</td>
        <td>${totals.transpo}</td>
        <td></td>
    `;
    tbody.appendChild(totalRow);
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

async function exportToExcel() {
    const { rows, totals, startDate, endDate } = generateTimesheetData();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet 1');

    worksheet.views = [
        { state: 'frozen', xSplit: 4, ySplit: 9, topLeftCell: 'E10', activeCell: 'E10' }
    ];

    const columnWidths = [20.0, 21.33, 11.66, 13.0, 13.0, 13.0, 13.0, 13.0, 13.0, 18.88, 63.44];
    columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
    });

    const solidBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    const weekendFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6699FF' } };
    const greenAccent6Lighter60Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    const headerFills = { 6: greenAccent6Lighter60Fill, 7: greenAccent6Lighter60Fill, 8: greenAccent6Lighter60Fill, 9: greenAccent6Lighter60Fill, 10: greenAccent6Lighter60Fill };

    const cutoffOnCallCount = countCutoffOnCallDays(startDate, endDate);

    const headerData = [
        ["Staff ID:", appState.staffId ? Number(appState.staffId) || appState.staffId : ""],
        ["Staff Name: ", appState.staffName],
        ["Department: ", appState.department],
        ["Reporting Manager: ", appState.reportingManager],
        ["Company: ", appState.company],
        ["On Call Days:", cutoffOnCallCount || ""],
        ["Period:  ", `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`]
    ];

    headerData.forEach((row) => {
        const r = worksheet.addRow(row);
        r.getCell(1).font = { bold: false, size: 10, name: 'Calibri' };
        r.getCell(2).font = { bold: true, size: 10, name: 'Calibri' };
        r.getCell(2).alignment = { horizontal: 'left' };
    });

    worksheet.addRow([]);

    const tableHeaderRow = worksheet.addRow([
        "Date", "Days", "Time (From)", "Time (To)", "Night Diff",
        "Rest Day OT", "Regular Day (OT)", "Special Holiday",
        "Regular Holiday", "Transportation", "Remarks"
    ]);
    tableHeaderRow.height = 28.8;

    tableHeaderRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { bold: true, size: 10, color: { argb: 'FF000000' }, name: 'Calibri' };
        if (headerFills[colNumber]) cell.fill = headerFills[colNumber];
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = solidBorder;
    });

    let currentRowIndex = 10;

    rows.forEach((rowData) => {
        const [y, m, d] = rowData.dateStr.split("-").map(Number);
        const localDateVal = new Date(Date.UTC(y, m - 1, d));

        const row = worksheet.addRow([
            localDateVal,
            { formula: `TEXT(A${currentRowIndex},"DDDD")`, result: rowData.dayName },
            rowData.timeFrom,
            rowData.timeTo,
            rowData.nightDiff || "",
            rowData.restDayOt || "",
            rowData.regDayOt || "",
            rowData.specialHol || "",
            rowData.regHol || "",
            rowData.transportation || "",
            rowData.remarks
        ]);

        row.getCell(1).numFmt = 'MM/DD/YYYY';

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.border = solidBorder;
            cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF000000' } };
            if (colNumber === 1 || colNumber === 2 || (colNumber >= 3 && colNumber <= 10)) {
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            } else {
                cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            }
            if (rowData.isWeekend) cell.fill = weekendFill;
        });

        currentRowIndex++;
    });

    const totalRow = worksheet.addRow([
        "TOTAL", "", "", "",
        { formula: `SUM(E10:E${currentRowIndex - 1})`, result: totals.nightDiff },
        { formula: `SUM(F10:F${currentRowIndex - 1})`, result: totals.restDayOt },
        { formula: `SUM(G10:G${currentRowIndex - 1})`, result: totals.regDayOt },
        { formula: `SUM(H10:H${currentRowIndex - 1})`, result: totals.specialHol },
        { formula: `SUM(I10:I${currentRowIndex - 1})`, result: totals.regHol },
        { formula: `SUM(J10:J${currentRowIndex - 1})`, result: totals.transpo },
        ""
    ]);

    totalRow.height = 24;
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { bold: true, size: 10, color: { argb: 'FF000000' }, name: 'Calibri' };
        cell.border = solidBorder;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = weekendFill;
    });

    const startMonthName = startDate.toLocaleString('en-US', { month: 'long' });
    const endMonthName = endDate.toLocaleString('en-US', { month: 'long' });
    const fileName = `Timesheet - ${appState.staffName || 'Staff'} - ${startMonthName} to ${endMonthName} ${endDate.getFullYear()}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
}

// ─── Theme ────────────────────────────────────────────────────────────────────

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
    const btn = document.getElementById("themeTraceToggleBtn") || document.getElementById("themeToggleBtn");
    if (btn) btn.textContent = newTheme === "dark" ? "🌙 Dark" : "☀️ Light";
    localStorage.setItem("timesheetTheme", newTheme);
}

// ─── Modal Helpers ────────────────────────────────────────────────────────────

function showModal(message) {
    const modal = document.getElementById("validationModal");
    const msg = document.getElementById("modalMessage");
    if (modal && msg) {
        msg.innerHTML = message;
        modal.style.display = "flex";
    }
}

function closeModal() {
    const modal = document.getElementById("validationModal");
    if (modal) modal.style.display = "none";
}
