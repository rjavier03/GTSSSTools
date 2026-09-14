// Updated JavaScript with Date.UTC fix to prevent date/weekend shifting upon Excel recalculation

let SHIFTS = {};
let apiHolidays = {};

let appState = {
    staffId: "100178",
    staffName: "Ronald Javier",
    department: "",
    reportingManager: "",
    company: "B2BE GSS",
    shiftSchedule: "US1",
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
    await fetchHolidaysApi();
    
    renderAll();
});

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
                conformingDateFormat: "Y-m-d",
                allowInput: false,
                disableMobile: true,
                locale: { 
                    firstDayOfWeek: 1 
                }
            });
        }
    });
}

async function loadShiftsJson() {
    try {
        const response = await fetch("shifts.json");
        if (response.ok) {
            SHIFTS = await response.json();
        }
    } catch (err) {
        console.warn("Could not load shifts.json:", err);
    }

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
    if (dateStr.endsWith("-12-25") || name.includes("christmas")) return "Christmas Day";
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
        isRegular: isRegular
    };
}

async function fetchHolidaysApi() {
    const year = parseInt(appState.cutoffMonth.split("-")[0], 10) || new Date().getFullYear();
    try {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/PH`);
        if (res.ok) {
            const data = await res.json();
            apiHolidays = {};
            data.forEach(item => {
                const classified = classifyPHHoliday(item, item.date);
                apiHolidays[item.date] = classified;
            });
        }
    } catch (err) {
        console.warn("Holiday API error, falling back:", err);
    }
}

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

function setupEventListeners() {
    const inputs = ["staffId", "staffName", "department", "reportingManager", "company", "cutoffMonth"];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", async (e) => {
                appState[id] = e.target.value;
                saveLocalStorage();
                if (id === "cutoffMonth") await fetchHolidaysApi();
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

    const list = appState.multipleShifts && appState.multipleShifts.length > 0 
        ? appState.multipleShifts 
        : [{ fromDate: "", toDate: "", shiftKey: Object.keys(SHIFTS)[0] || "" }];

    list.forEach((item) => {
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
        container.appendChild(row);
    });
}

function addMultipleShiftRow() {
    const container = document.getElementById("multipleShiftEntriesContainer");
    if (!container) return;
    
    const { startDate, endDate } = getCutoffRange(appState.cutoffMonth);
    const minDate = formatYMD(startDate);
    const maxDate = formatYMD(endDate);
    
    const row = document.createElement("div");
    row.className = "multiple-shift-row";
    let optionsHtml = "";
    Object.keys(SHIFTS).forEach(k => {
        optionsHtml += `<option value="${k}">${SHIFTS[k].label}</option>`;
    });

    row.innerHTML = `
        <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:2px;">From Date</label>
            <input type="date" class="ms-from" min="${minDate}" max="${maxDate}" style="width:100%; padding:6px; border:1px solid var(--border-color); border-radius:4px; background:var(--bg-color); color:var(--text-color);">
        </div>
        <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:2px;">To Date</label>
            <input type="date" class="ms-to" min="${minDate}" max="${maxDate}" style="width:100%; padding:6px; border:1px solid var(--border-color); border-radius:4px; background:var(--bg-color); color:var(--text-color);">
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

function renderAll() {
    renderHolidaysAndLeavesLists();
    renderTimesheetTable();
}

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

function calculateRowsForDate(dateObj) {
    const current = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const dateStr = formatYMD(current);
    const dayName = current.toLocaleDateString("en-US", { weekday: "long" });
    const dayOfWeek = current.getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const holidayInfo = apiHolidays[dateStr];
    const currentShift = getShiftForDate(dateStr);

    const buildRow = (timeFrom, timeTo, forceHolidayInfo = null, isMorningCarryOver = false, overrideDateObj = null, overrideDateStr = null, overrideDayName = null, overrideIsWeekend = null) => {
        const targetHoliday = forceHolidayInfo;
        const targetDateStr = overrideDateStr || dateStr;
        const targetDateObj = overrideDateObj || current;
        const targetDayName = overrideDayName || dayName;
        const targetIsWeekend = overrideIsWeekend !== null ? overrideIsWeekend : isWeekend;
        
        let ndHours = 0;
        if (!timeFrom || !timeTo) {
            ndHours = 0;
        } else if (targetHoliday && appState.leaves[targetDateStr]) {
            ndHours = 0;
        } else {
            ndHours = calculateNightDiffHours(timeFrom, timeTo);
        }

        const rawDuration = calculateDurationHours(timeFrom, timeTo);
        const effectiveDuration = rawDuration >= 8 ? rawDuration - 1 : rawDuration;

        let row = {
            dateObj: new Date(targetDateObj.getTime()),
            dateStr: targetDateStr,
            displayDate: formatDisplayDate(targetDateObj),
            dayName: targetDayName,
            isWeekend: targetIsWeekend,
            timeFrom: timeFrom,
            timeTo: timeTo,
            nightDiff: ndHours,
            restDayOt: 0,
            regDayOt: 0,
            specialHol: 0,
            regHol: 0,
            transportation: appState.transpoDates[targetDateStr] || 0,
            onCall: appState.weekendOnCallDates[targetDateStr] ? "Yes" : "No",
            remarks: targetHoliday ? targetHoliday.name : ""
        };

        if (targetIsWeekend && appState.weekendOnCallDates[targetDateStr]) {
            row.restDayOt = 8;
            row.timeFrom = "00:00";
            row.timeTo = "23:59";
            row.nightDiff = 0;
        }

        if (targetHoliday) {
            const originDate = targetHoliday.dateStr || targetDateStr;
            const isWorked = appState.workedHolidays[originDate] !== false;
            row.remarks = targetHoliday.name;

            if (isWorked) {
                let hours = Math.min(effectiveDuration, 8);
                if (isMorningCarryOver && currentShift) {
                    const [fromH] = currentShift.from.split(":").map(Number);
                    const eveningHours = fromH >= 21 ? (24 - fromH) : 0;
                    hours = Math.min(effectiveDuration, Math.max(0, 8 - eveningHours));
                }

                if (targetHoliday.isRegular) {
                    row.regHol = Math.min(8, hours);
                } else {
                    row.specialHol = Math.min(8, hours);
                }
            } else {
                row.timeFrom = "";
                row.timeTo = "";
                row.nightDiff = 0;
            }
        }

        if (appState.leaves[targetDateStr]) {
            row.timeFrom = "";
            row.timeTo = "";
            row.nightDiff = 0;
            row.restDayOt = 0;
            row.regDayOt = 0;
            row.specialHol = 0;
            row.regHol = 0;
            row.remarks = `Leave ID: ${appState.leaves[targetDateStr]}`;
        }

        return row;
    };

    if (isWeekend && appState.weekendOnCallDates[dateStr]) {
        return [buildRow("00:00", "23:59", holidayInfo, false)];
    }

    if (currentShift && currentShift.from && currentShift.to) {
        const [hFrom] = currentShift.from.split(":").map(Number);
        const [hTo] = currentShift.to.split(":").map(Number);
        const isCrossMidnight = hTo <= hFrom;

        if (isCrossMidnight) {
            const rows = [];
            const eveningLegActive = !isWeekend;
            if (eveningLegActive) {
                const eveningHoliday = holidayInfo ? { ...holidayInfo, dateStr } : null;
                rows.push(buildRow(currentShift.from, "00:00", eveningHoliday, false));
            }
            return rows.length > 0 ? rows : [buildRow("", "")];
        } else {
            const timeFrom = isWeekend ? "" : currentShift.from;
            const timeTo = isWeekend ? "" : currentShift.to;
            return [buildRow(timeFrom, timeTo, holidayInfo, false)];
        }
    } 
    else {
        const shift = currentShift || { from: "06:30", to: "15:30" };
        const timeFrom = isWeekend ? "" : shift.from;
        const timeTo = isWeekend ? "" : shift.to;
        return [buildRow(timeFrom, timeTo, holidayInfo, false)];
    }
}

function renderTimesheetTable() {
    const { startDate, endDate } = getCutoffRange(appState.cutoffMonth);
    const periodDisplay = document.getElementById("periodDisplay");
    if (periodDisplay) {
        periodDisplay.value = `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
    }

    const tbody = document.getElementById("timesheetBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    let totals = { nightDiff: 0, restDayOt: 0, regDayOt: 0, specialHol: 0, regHol: 0, transpo: 0 };
    let curr = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    let pendingMorningCarryOver = null;

    while (curr <= endDate) {
        const dateStr = formatYMD(curr);
        const dayOfWeek = curr.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const currentShift = getShiftForDate(dateStr);
        const isCrossMidnight = currentShift && currentShift.from && currentShift.to && (() => {
            const [hFrom] = currentShift.from.split(":").map(Number);
            const [hTo] = currentShift.to.split(":").map(Number);
            return hTo <= hFrom;
        })();

        let dayRows = [];

        if (pendingMorningCarryOver) {
            const prevDateStr = pendingMorningCarryOver.originDateStr;
            const prevShift = getShiftForDate(prevDateStr);
            const carryHoliday = apiHolidays[dateStr] ? { ...apiHolidays[dateStr], dateStr } : null;
            
            const morningDateObj = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate());
            const morningDayName = morningDateObj.toLocaleDateString("en-US", { weekday: "long" });
            const morningDayOfWeek = morningDateObj.getDay();
            const morningIsWeekend = (morningDayOfWeek === 0 || morningDayOfWeek === 6);

            const morningRow = {
                dateObj: morningDateObj,
                dateStr,
                displayDate: formatDisplayDate(morningDateObj),
                dayName: morningDayName,
                isWeekend: morningIsWeekend,
                timeFrom: "00:00",
                timeTo: prevShift ? prevShift.to : "06:00",
                nightDiff: (!carryHoliday || !appState.leaves[dateStr]) ? calculateNightDiffHours("00:00", prevShift ? prevShift.to : "06:00") : 0,
                restDayOt: 0,
                regDayOt: 0,
                specialHol: 0,
                regHol: 0,
                transportation: appState.transpoDates[dateStr] || 0,
                onCall: appState.weekendOnCallDates[dateStr] ? "Yes" : "No",
                remarks: carryHoliday ? carryHoliday.name : ""
            };

            if (carryHoliday) {
                const isWorked = appState.workedHolidays[prevDateStr] !== false;
                morningRow.remarks = carryHoliday.name;
                if (isWorked) {
                    const rawDuration = calculateDurationHours("00:00", prevShift ? prevShift.to : "06:00");
                    const effectiveDuration = rawDuration >= 8 ? rawDuration - 1 : rawDuration;
                    const [fromH] = prevShift ? prevShift.from.split(":").map(Number) : [22];
                    const eveningHours = fromH >= 21 ? (24 - fromH) : 0;
                    let hours = Math.min(effectiveDuration, Math.max(0, 8 - eveningHours));

                    if (carryHoliday.isRegular) {
                        morningRow.regHol = Math.min(8, hours);
                    } else {
                        morningRow.specialHol = Math.min(8, hours);
                    }
                } else {
                    morningRow.timeFrom = "";
                    morningRow.timeTo = "";
                    morningRow.nightDiff = 0;
                }
            }

            if (appState.leaves[dateStr]) {
                morningRow.timeFrom = "";
                morningRow.timeTo = "";
                morningRow.nightDiff = 0;
                morningRow.remarks = `Leave ID: ${appState.leaves[dateStr]}`;
            }

            dayRows.push(morningRow);
            pendingMorningCarryOver = null;
        }

        const normalRows = calculateRowsForDate(curr);
        dayRows = dayRows.concat(normalRows);

        if (isCrossMidnight && !isWeekend && currentShift) {
            pendingMorningCarryOver = { originDateStr: dateStr };
        } else {
            pendingMorningCarryOver = null;
        }

        dayRows.forEach((data) => {
            if (data.timeFrom === "00:00" && data.timeTo === "00:00") {
                return;
            }

            totals.nightDiff += parseFloat(data.nightDiff) || 0;
            totals.restDayOt += parseFloat(data.restDayOt) || 0;
            totals.regDayOt += parseFloat(data.regDayOt) || 0;
            totals.specialHol += parseFloat(data.specialHol) || 0;
            totals.regHol += parseFloat(data.regHol) || 0;
            totals.transpo += parseFloat(data.transportation) || 0;

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

        curr.setDate(curr.getDate() + 1);
    }

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

async function exportToExcel() {
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

    const { startDate, endDate } = getCutoffRange(appState.cutoffMonth);
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

    let curr = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    let currentRowIndex = 10;
    let pendingMorningCarryOver = null;
    let totals = { nightDiff: 0, restDayOt: 0, regDayOt: 0, specialHol: 0, regHol: 0, transpo: 0 };

    while (curr <= endDate) {
        const dateStr = formatYMD(curr);
        const dayOfWeek = curr.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const currentShift = getShiftForDate(dateStr);
        const isCrossMidnight = currentShift && currentShift.from && currentShift.to && (() => {
            const [hFrom] = currentShift.from.split(":").map(Number);
            const [hTo] = currentShift.to.split(":").map(Number);
            return hTo <= hFrom;
        })();

        let dayRows = [];

        if (pendingMorningCarryOver) {
            const prevDateStr = pendingMorningCarryOver.originDateStr;
            const prevShift = getShiftForDate(prevDateStr);
            const carryHoliday = apiHolidays[dateStr] ? { ...apiHolidays[dateStr], dateStr } : null;
            
            const morningDateObj = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate());
            const morningDayName = morningDateObj.toLocaleDateString("en-US", { weekday: "long" });
            const morningDayOfWeek = morningDateObj.getDay();
            const morningIsWeekend = (morningDayOfWeek === 0 || morningDayOfWeek === 6);

            const morningRow = {
                dateObj: morningDateObj,
                dateStr,
                displayDate: formatDisplayDate(morningDateObj),
                dayName: morningDayName,
                isWeekend: morningIsWeekend,
                timeFrom: "00:00",
                timeTo: prevShift ? prevShift.to : "06:00",
                nightDiff: (!carryHoliday || !appState.leaves[dateStr]) ? calculateNightDiffHours("00:00", prevShift ? prevShift.to : "06:00") : 0,
                restDayOt: 0,
                regDayOt: 0,
                specialHol: 0,
                regHol: 0,
                transportation: appState.transpoDates[dateStr] || 0,
                onCall: appState.weekendOnCallDates[dateStr] ? "Yes" : "No",
                remarks: carryHoliday ? carryHoliday.name : ""
            };

            if (carryHoliday) {
                const isWorked = appState.workedHolidays[prevDateStr] !== false;
                morningRow.remarks = carryHoliday.name;
                if (isWorked) {
                    const rawDuration = calculateDurationHours("00:00", prevShift ? prevShift.to : "06:00");
                    const effectiveDuration = rawDuration >= 8 ? rawDuration - 1 : rawDuration;
                    const [fromH] = prevShift ? prevShift.from.split(":").map(Number) : [22];
                    const eveningHours = fromH >= 21 ? (24 - fromH) : 0;
                    let hours = Math.min(effectiveDuration, Math.max(0, 8 - eveningHours));

                    if (carryHoliday.isRegular) {
                        morningRow.regHol = Math.min(8, hours);
                    } else {
                        morningRow.specialHol = Math.min(8, hours);
                    }
                } else {
                    morningRow.timeFrom = "";
                    morningRow.timeTo = "";
                    morningRow.nightDiff = 0;
                }
            }

            if (appState.leaves[dateStr]) {
                morningRow.timeFrom = "";
                morningRow.timeTo = "";
                morningRow.nightDiff = 0;
                morningRow.remarks = `Leave ID: ${appState.leaves[dateStr]}`;
            }

            dayRows.push(morningRow);
            pendingMorningCarryOver = null;
        }

        const normalRows = calculateRowsForDate(curr);
        dayRows = dayRows.concat(normalRows);

        if (isCrossMidnight && !isWeekend && currentShift) {
            pendingMorningCarryOver = { originDateStr: dateStr };
        } else {
            pendingMorningCarryOver = null;
        }

        dayRows.forEach((rowData) => {
            if (rowData.timeFrom === "00:00" && rowData.timeTo === "00:00") {
                return;
            }

            totals.nightDiff += parseFloat(rowData.nightDiff) || 0;
            totals.restDayOt += parseFloat(rowData.restDayOt) || 0;
            totals.regDayOt += parseFloat(rowData.regDayOt) || 0;
            totals.specialHol += parseFloat(rowData.specialHol) || 0;
            totals.regHol += parseFloat(rowData.regHol) || 0;
            totals.transpo += parseFloat(rowData.transportation) || 0;

            const [y, m, d] = rowData.dateStr.split("-").map(Number);
            // FIXED: Use Date.UTC to prevent local timezone offset shifting dates by 1 day upon recalculation
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

        curr.setDate(curr.getDate() + 1);
    }

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

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
    const btn = document.getElementById("themeTraceToggleBtn") || document.getElementById("themeToggleBtn");
    if (btn) btn.textContent = newTheme === "dark" ? "🌙 Dark" : "☀️ Light";
    localStorage.setItem("timesheetTheme", newTheme);
}

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