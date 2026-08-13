// ==========================================
// 1. FUNGSI LOGOUT
// ==========================================
function logoutTPMS() {
    localStorage.removeItem("tpms_logged_in");
    window.location.href = "login.html";
}

// ==========================================
// 2. SAMBUNGAN MQTT BROKER & KEMASKINI TAYAR (6 TAYAR)
// ==========================================
const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const client = mqtt.connect(MQTT_BROKER);

const tireMap = {
    "lori/VKT8821/tayar/fl1": { psiId: "psi-fl1", boxId: "box-fl1", name: "Depan Kiri (FL1)" },
    "lori/VKT8821/tayar/fr1": { psiId: "psi-fr1", boxId: "box-fr1", name: "Depan Kanan (FR1)" },
    "lori/VKT8821/tayar/bl1": { psiId: "psi-bl1", boxId: "box-bl1", name: "B. Kiri 1 (BL1)" },
    "lori/VKT8821/tayar/br1": { psiId: "psi-br1", boxId: "box-br1", name: "B. Kanan 1 (BR1)" },
    "lori/VKT8821/tayar/bl2": { psiId: "psi-bl2", boxId: "box-bl2", name: "B. Kiri 2 (BL2)" },
    "lori/VKT8821/tayar/br2": { psiId: "psi-br2", boxId: "box-br2", name: "B. Kanan 2 (BR2)" }
};

let lowPressureTires = [];

// Nilai default awal (akan auto-override serta-merta bila MQTT hantar config baru)
let minLimit = 90;
let maxLimit = 120;

// ==========================================
// 3. FUNGSI NOTIFIKASI GAYA WHATSAPP (UI + BUNYI + GETAR)
// ==========================================
function showWhatsAppNotification(title, message) {
    if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
    }

    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        console.log("Audio disekat pelayar:", e);
    }

    const popup = document.getElementById("whatsapp-notification-popup");
    const titleEl = document.getElementById("wa-notif-title");
    const msgEl = document.getElementById("wa-notif-msg");

    if (popup && titleEl && msgEl) {
        titleEl.innerText = title;
        msgEl.innerText = message;
        popup.classList.add("show");

        setTimeout(() => {
            popup.classList.remove("show");
        }, 4000);
    }
}

// ==========================================
// 4. MQTT EVENT LISTENERS
// ==========================================
client.on("connect", () => {
    console.log("MQTT Connected!");
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> CONNECTED';
    }
    
    // Langgan topik tayar dan config secara wildcard (#)
    client.subscribe("lori/VKT8821/tayar/#");
    client.subscribe("lori/VKT8821/config/#");
});

client.on("message", (topic, message) => {
    const msgString = message.toString();
    console.log("Data Terima:", topic, msgString);

    // AUTO-UPDATE: Jika ESP32 ubah had min PSI
    if (topic === "lori/VKT8821/config/minPSI") {
        minLimit = parseInt(msgString);
        console.log("Had Min Auto-Updated ke:", minLimit);
        return;
    }
    
    // AUTO-UPDATE: Jika ESP32 ubah had max PSI
    if (topic === "lori/VKT8821/config/maxPSI") {
        maxLimit = parseInt(msgString);
        console.log("Had Max Auto-Updated ke:", maxLimit);
        return;
    }

    // Tangkap data bacaan tayar
    if (tireMap[topic]) {
        try {
            const data = JSON.parse(msgString);
            const target = tireMap[topic];

            const psiElement = document.getElementById(target.psiId);
            const boxElement = document.getElementById(target.boxId);

            if (psiElement && boxElement) {
                psiElement.innerHTML = `${data.psi} <small>PSI</small>`;

                // Semak amaran mengikut nilai limit semasa yang terkini (auto-sync)
                if (data.psi < minLimit || data.psi > maxLimit) {
                    boxElement.classList.add("warning");
                    
                    if (!lowPressureTires.includes(target.name)) {
                        lowPressureTires.push(target.name);
                        
                        showWhatsAppNotification(
                            "AMARAN TPMS LORI", 
                            `Tayar ${target.name} bermasalah! Bacaan: ${data.psi} PSI (Had: ${minLimit}-${maxLimit}).`
                        );
                    }
                } else {
                    boxElement.classList.remove("warning");
                    lowPressureTires = lowPressureTires.filter(t => t !== target.name);
                }

                // Kemaskini Panel Status Diagnostic di sebelah kanan
                const alertPanel = document.getElementById("alert-panel");
                const alertTitle = document.getElementById("alert-title");
                const alertMsg = document.getElementById("alert-msg");

                if (alertPanel && alertTitle && alertMsg) {
                    if (lowPressureTires.length > 0) {
                        alertPanel.classList.add("danger");
                        alertTitle.innerText = "AMARAN TEKANAN LORI!";
                        alertMsg.innerText = `Tayar bermasalah: ${lowPressureTires.join(", ")}`;
                    } else {
                        alertPanel.classList.remove("danger");
                        alertTitle.innerText = "SISTEM NORMAL";
                        alertMsg.innerText = `Semua tayar dalam julat selamat (${minLimit}-${maxLimit} PSI).`;
                    }
                }

                const lastUpdate = document.getElementById("last-update");
                if (lastUpdate) {
                    const now = new Date();
                    lastUpdate.innerText = now.toLocaleTimeString();
                }
            }
        } catch (e) {
            console.error("Ralat parse JSON:", e);
        }
    }
});
