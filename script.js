// ==========================================
// TPMS DASHBOARD - FULL JAVASCRIPT
// ==========================================

// 1. FUNGSI LOGOUT
function logoutTPMS() {
    localStorage.removeItem("tpms_logged_in");
    window.location.href = "login.html";
}

// 2. HAD KESELAMATAN (MIN DITUKAR KEPADA 80)
const MIN_SAFETY_LIMIT = 80;
const MAX_SAFETY_LIMIT = 120;

// Simpan status setiap tayar
const currentTireStatus = {};

// 3. MQTT BROKER
const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const client = mqtt.connect(MQTT_BROKER);

// 4. FUNGSI UPDATE PAPARAN HAD KESELAMATAN (DINAMIK)
function updateSafetyLimitsDisplay() {
    const optimalText = document.getElementById("psi-optimal-text");
    const minText = document.getElementById("psi-min-text");

    if (optimalText) {
        optimalText.innerHTML = `${MIN_SAFETY_LIMIT} - ${MAX_SAFETY_LIMIT} PSI`;
    }

    if (minText) {
        minText.innerHTML = `< ${MIN_SAFETY_LIMIT} PSI`;
    }
}

// 5. FUNGSI UPDATE STATUS TAYAR
function checkAndUpdateTire(boxId, psiId, psiValue, tireName) {
    const psiElement = document.getElementById(psiId);
    const boxElement = document.getElementById(boxId);

    if (!psiElement || !boxElement) {
        console.warn("Element tidak dijumpai:", boxId, psiId);
        return;
    }

    psiValue = Number(psiValue);

    if (isNaN(psiValue)) {
        console.warn("PSI tidak valid:", psiValue);
        return;
    }

    // PAPAR NILAI PSI
    psiElement.innerHTML = `${Math.round(psiValue)} <small>PSI</small>`;

    // CHECK HAD KESELAMATAN
    const isUnderMin = psiValue < MIN_SAFETY_LIMIT;
    const isOverMax = psiValue > MAX_SAFETY_LIMIT;
    const isWarning = isUnderMin || isOverMax;

    // JIKA PSI TAK SELAMAT
    if (isWarning) {
        boxElement.style.setProperty("border-color", "#ff3366", "important");
        boxElement.style.setProperty("background-color", "rgba(255, 51, 102, 0.35)", "important");
        boxElement.style.setProperty("box-shadow", "0 0 20px #ff3366", "important");
        psiElement.style.setProperty("color", "#ff3366", "important");
        boxElement.classList.add("warning");

        currentTireStatus[tireName] = true;
    } 
    // JIKA PSI NORMAL
    else {
        boxElement.style.setProperty("border-color", "#00f0ff", "important");
        boxElement.style.setProperty("background-color", "rgba(16, 21, 32, 0.95)", "important");
        boxElement.style.setProperty("box-shadow", "0 0 10px rgba(0, 240, 255, 0.2)", "important");
        psiElement.style.setProperty("color", "#00f0ff", "important");
        boxElement.classList.remove("warning");

        currentTireStatus[tireName] = false;
    }

    // UPDATE ALERT PANEL DENGAN SEGERA
    updateAlertPanel();
}

// 6. UPDATE ALERT PANEL
function updateAlertPanel() {
    // RUNKAN SENTIASA UPDATE TEKS BAWAH BILA PANELS REFRESH
    updateSafetyLimitsDisplay();

    const faultyTires = Object.keys(currentTireStatus).filter(
        name => currentTireStatus[name] === true
    );

    const alertPanel = document.getElementById("alert-panel");
    const alertTitle = document.getElementById("alert-title");
    const alertMsg = document.getElementById("alert-msg");

    if (!alertPanel || !alertTitle || !alertMsg) return;

    if (faultyTires.length > 0) {
        alertPanel.style.setProperty("background-color", "rgba(255, 51, 102, 0.2)", "important");
        alertPanel.style.setProperty("border-color", "#ff3366", "important");
        alertPanel.style.setProperty("color", "#ff3366", "important");
        alertTitle.innerText = "AMARAN TEKANAN TAYAR!";
        alertMsg.innerText = `Tayar bermasalah: ${faultyTires.join(", ")}`;
    } else {
        alertPanel.style.setProperty("background-color", "rgba(0, 255, 136, 0.1)", "important");
        alertPanel.style.setProperty("border-color", "#00ff88", "important");
        alertPanel.style.setProperty("color", "#00ff88", "important");
        alertTitle.innerText = "SISTEM NORMAL";
        alertMsg.innerText = `Semua tayar dalam julat selamat (${MIN_SAFETY_LIMIT}-${MAX_SAFETY_LIMIT} PSI).`;
    }
}

// 7. MQTT CONNECT
client.on("connect", () => {
    console.log("MQTT CONNECTED!");
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> CONNECTED';
    }

    client.subscribe("lori/VKT8821/#", (error) => {
        if (!error) {
            console.log("Subscribed to: lori/VKT8821/#");
        }
    });
});

client.on("error", (error) => {
    console.error("MQTT ERROR:", error);
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> ERROR';
    }
});

client.on("close", () => {
    console.warn("MQTT Disconnected!");
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> DISCONNECTED';
    }
});

// 8. MQTT MESSAGE RECEIVER
client.on("message", (topic, message) => {
    const msgString = message.toString().trim();
    const cleanTopic = topic.toLowerCase();
    let psiValue = NaN;

    if (msgString.startsWith("{")) {
        try {
            const data = JSON.parse(msgString);
            psiValue = parseFloat(data.psi ?? data.value ?? data.pressure);
        } catch (error) {
            return;
        }
    } else {
        psiValue = parseFloat(msgString);
    }

    if (isNaN(psiValue)) return;

    if (cleanTopic.includes("fl1")) {
        checkAndUpdateTire("box-fl1", "psi-fl1", psiValue, "Depan Kiri (FL1)");
    } else if (cleanTopic.includes("fr1")) {
        checkAndUpdateTire("box-fr1", "psi-fr1", psiValue, "Depan Kanan (FR1)");
    } else if (cleanTopic.includes("bl1")) {
        checkAndUpdateTire("box-bl1", "psi-bl1", psiValue, "B. Kiri 1 (BL1)");
    } else if (cleanTopic.includes("br1")) {
        checkAndUpdateTire("box-br1", "psi-br1", psiValue, "B. Kanan 1 (BR1)");
    } else if (cleanTopic.includes("bl2")) {
        checkAndUpdateTire("box-bl2", "psi-bl2", psiValue, "B. Kiri 2 (BL2)");
    } else if (cleanTopic.includes("br2")) {
        checkAndUpdateTire("box-br2", "psi-br2", psiValue, "B. Kanan 2 (BR2)");
    }

    const lastUpdate = document.getElementById("last-update");
    if (lastUpdate) {
        const now = new Date();
        lastUpdate.innerText = now.toLocaleTimeString();
    }
});

// 9. INITIAL STATUS
document.addEventListener("DOMContentLoaded", () => {
    console.log("TPMS Dashboard Loaded");
    updateSafetyLimitsDisplay();
    updateAlertPanel();
});
