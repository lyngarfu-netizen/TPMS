// ==========================================
// 1. FUNGSI LOGOUT
// ==========================================
function logoutTPMS() {
    localStorage.removeItem("tpms_logged_in");
    window.location.href = "login.html";
}

// ==========================================
// 2. HAD KESELAMATAN (MIN: 90, MAX: 120)
// ==========================================
const MIN_SAFETY_LIMIT = 90;
const MAX_SAFETY_LIMIT = 120;
const currentTireStatus = {}; 

const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const client = mqtt.connect(MQTT_BROKER);

// ==========================================
// 3. FUNGSI SEMAK AMARAN & TUKAR WARNA RED
// ==========================================
function checkAndUpdateTire(boxId, psiId, psiValue, tireName) {
    const psiElement = document.getElementById(psiId);
    const boxElement = document.getElementById(boxId);

    if (!psiElement || !boxElement) return;

    // Papar Nilai PSI
    psiElement.innerHTML = `${Math.round(psiValue)} <small>PSI</small>`;

    // Semak Had Amaran (Di bawah 90 PSI atau Atas 120 PSI)
    const isUnderMin = psiValue < MIN_SAFETY_LIMIT;
    const isOverMax = psiValue > MAX_SAFETY_LIMIT;
    const isWarning = isUnderMin || isOverMax;

    if (isWarning) {
        // Paksa Style Merah Terus Melalui Inline Style (Tanda Kurang Kebergantungan Pada CSS Class)
        boxElement.style.borderColor = "#ff3366";
        boxElement.style.backgroundColor = "rgba(255, 51, 102, 0.35)";
        boxElement.style.boxShadow = "0 0 20px #ff3366";
        psiElement.style.color = "#ff3366";
        
        boxElement.classList.add("warning");
        currentTireStatus[tireName] = true;
    } else {
        // Reset Balik Ke Warna Biru/Cyan
        boxElement.style.borderColor = "#00f0ff";
        boxElement.style.backgroundColor = "rgba(16, 21, 32, 0.95)";
        boxElement.style.boxShadow = "0 0 10px rgba(0, 240, 255, 0.2)";
        psiElement.style.color = "#00f0ff";

        boxElement.classList.remove("warning");
        currentTireStatus[tireName] = false;
    }

    updateAlertPanel();
}

function updateAlertPanel() {
    const faultyTires = Object.keys(currentTireStatus).filter(name => currentTireStatus[name] === true);
    const alertPanel = document.getElementById("alert-panel");
    const alertTitle = document.getElementById("alert-title");
    const alertMsg = document.getElementById("alert-msg");

    if (alertPanel && alertTitle && alertMsg) {
        if (faultyTires.length > 0) {
            alertPanel.style.backgroundColor = "rgba(255, 51, 102, 0.2)";
            alertPanel.style.borderColor = "#ff3366";
            alertPanel.style.color = "#ff3366";
            alertTitle.innerText = "AMARAN TEKANAN LORI!";
            alertMsg.innerText = `Tayar bermasalah: ${faultyTires.join(", ")}`;
        } else {
            alertPanel.style.backgroundColor = "rgba(0, 255, 136, 0.1)";
            alertPanel.style.borderColor = "#00ff88";
            alertPanel.style.color = "#00ff88";
            alertTitle.innerText = "SISTEM NORMAL";
            alertMsg.innerText = `Semua tayar dalam julat selamat (${MIN_SAFETY_LIMIT}-${MAX_SAFETY_LIMIT} PSI).`;
        }
    }
}

// ==========================================
// 4. MQTT RECEIVER WITH TOPIC AUTO-MATCHING
// ==========================================
client.on("connect", () => {
    console.log("MQTT Connected!");
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> CONNECTED';
    }
    // Subscribe ke semua topik berkaitan lori VKT8821
    client.subscribe("lori/VKT8821/#");
});

client.on("message", (topic, message) => {
    const msgString = message.toString().trim();
    const cleanTopic = topic.toLowerCase(); // Convert ke huruf kecil untuk elak bug Case Sensitivity

    let psiValue = parseFloat(msgString);
    if (msgString.startsWith("{")) {
        try {
            const data = JSON.parse(msgString);
            psiValue = parseFloat(data.psi ?? data.value ?? 0);
        } catch(e) {}
    }

    if (isNaN(psiValue)) return;

    // Padankan Topik Secara Fleksibel
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
