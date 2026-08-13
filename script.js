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

// Pemadan Topik MQTT ke ID HTML (6 Tayar: FL1, FR1, BL1, BR1, BL2, BR2)
const tireMap = {
    "lori/VKT8821/tayar/fl1": { psiId: "psi-fl1", boxId: "box-fl1", name: "FL1" },
    "lori/VKT8821/tayar/fr1": { psiId: "psi-fr1", boxId: "box-fr1", name: "FR1" },
    "lori/VKT8821/tayar/bl1": { psiId: "psi-bl1", boxId: "box-bl1", name: "BL1" },
    "lori/VKT8821/tayar/br1": { psiId: "psi-br1", boxId: "box-br1", name: "BR1" },
    "lori/VKT8821/tayar/bl2": { psiId: "psi-bl2", boxId: "box-bl2", name: "BL2" },
    "lori/VKT8821/tayar/br2": { psiId: "psi-br2", boxId: "box-br2", name: "BR2" }
};

let lowPressureTires = [];

// Tetapan Had Awal (Default sebelum terima dari ESP32)
let minLimit = 90;
let maxLimit = 120;

// ==========================================
// 3. FUNGSI NOTIFIKASI, BUNYI & GETARAN
// ==========================================
function triggerAlertEffects() {
    // Getaran telefon (Getar 200ms, rehat 100ms, getar 200ms)
    if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
    }

    // Bunyi amaran (Web Audio API)
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
        console.log("Audio context disekat pelayar:", e);
    }
}

client.on("connect", () => {
    console.log("MQTT Connected!");
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> CONNECTED';
    }
    
    // Langgan semua topik lori (termasuk tayar dan config)
    client.subscribe("lori/VKT8821/tayar/#");
    client.subscribe("lori/VKT8821/config/#");

    // Minta izin untuk paparkan notifikasi browser
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
});

client.on("message", (topic, message) => {
    console.log("Data Terima:", topic, message.toString());

    // 1. Tangkap data jika ia melibatkan tetapan Had (Config)
    if (topic === "lori/VKT8821/config/minPSI") {
        minLimit = parseInt(message.toString());
        console.log("Had Min Ditukar ke:", minLimit);
        return;
    }
    if (topic === "lori/VKT8821/config/maxPSI") {
        maxLimit = parseInt(message.toString());
        console.log("Had Max Ditukar ke:", maxLimit);
        return;
    }

    // 2. Tangkap data bacaan tayar
    if (tireMap[topic]) {
        try {
            const data = JSON.parse(message.toString());
            const target = tireMap[topic];

            const psiElement = document.getElementById(target.psiId);
            const boxElement = document.getElementById(target.boxId);

            if (psiElement && boxElement) {
                // Tampilkan data PSI sahaja
                psiElement.innerHTML = `${data.psi} <small>PSI</small>`;

                // Amaran Tekanan mengikut had dinamik (minLimit & maxLimit)
                if (data.psi < minLimit || data.psi > maxLimit) {
                    boxElement.classList.add("warning");
                    
                    if (!lowPressureTires.includes(target.name)) {
                        lowPressureTires.push(target.name);
                        
                        // Cetuskan kesan amaran (Bunyi, Getar & Notifikasi Browser)
                        triggerAlertEffects();

                        if ("Notification" in window && Notification.permission === "granted") {
                            new Notification("AMARAN TPMS LORI!", {
                                body: `Perhatian! Tayar ${target.name} bermasalah (${data.psi} PSI).`,
                            });
                        }
                    }
                } else {
                    boxElement.classList.remove("warning");
                    lowPressureTires = lowPressureTires.filter(t => t !== target.name);
                }

                // Kemaskini Alert Panel
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
                        alertMsg.innerText = "Semua 6 tayar berada dalam julat selamat.";
                    }
                }

                // Kemaskini masa
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
