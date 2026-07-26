// ===================================================
// 1. FUNGSI LOGOUT (Dibaiki)
// ===================================================
function logoutTPMS() {
    localStorage.removeItem("tpms_logged_in");
    window.location.href = "login.html";
}

// ===================================================
// 2. SAMBUNGAN MQTT BROKER & KEMASKINI TAYAR
// ===================================================
// Guna HiveMQ WebSocket Public Broker (Port 8884)
const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const client = mqtt.connect(MQTT_BROKER);

// Pemadan Topik MQTT ke ID HTML
const tireMap = {
    "lori/VKT8821/tayar/fl1": { psiId: "psi-fl1", tempId: "temp-fl1", boxId: "box-fl1", name: "FL1" },
    "lori/VKT8821/tayar/fr1": { psiId: "psi-fr1", tempId: "temp-fr1", boxId: "box-fr1", name: "FR1" },
    "lori/VKT8821/tayar/fl2": { psiId: "psi-fl2", tempId: "temp-fl2", boxId: "box-fl2", name: "FL2" },
    "lori/VKT8821/tayar/fr2": { psiId: "psi-fr2", tempId: "temp-fr2", boxId: "box-fr2", name: "FR2" },
    "lori/VKT8821/tayar/rl1": { psiId: "psi-rl1", tempId: "temp-rl1", boxId: "box-rl1", name: "RL1" },
    "lori/VKT8821/tayar/rr1": { psiId: "psi-rr1", tempId: "temp-rr1", boxId: "box-rr1", name: "RR1" },
    "lori/VKT8821/tayar/rl2": { psiId: "psi-rl2", tempId: "temp-rl2", boxId: "box-rl2", name: "RL2" },
    "lori/VKT8821/tayar/rr2": { psiId: "psi-rr2", tempId: "temp-rr2", boxId: "box-rr2", name: "RR2" }
};

let lowPressureTires = [];

client.on("connect", () => {
    console.log("MQTT Connected!");
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> CONNECTED';
    }
    // Langgan topic lori
    client.subscribe("lori/VKT8821/tayar/#");
});

client.on("message", (topic, message) => {
    console.log("Data Terima:", topic, message.toString());

    if (tireMap[topic]) {
        try {
            const data = JSON.parse(message.toString());
            const target = tireMap[topic];

            const psiElement = document.getElementById(target.psiId);
            const tempElement = document.getElementById(target.tempId);
            const boxElement = document.getElementById(target.boxId);

            if (psiElement && tempElement && boxElement) {
                // Tampilkan data PSI dan Temp
                psiElement.innerHTML = `${data.psi} <small>PSI</small>`;
                tempElement.innerHTML = `<i class="fa-solid fa-temperature-half"></i> ${data.temp}°C`;

                // Amaran Tekanan (< 90 PSI atau > 120 PSI)
                if (data.psi < 90 || data.psi > 120) {
                    boxElement.classList.add("warning");
                    if (!lowPressureTires.includes(target.name)) {
                        lowPressureTires.push(target.name);
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
                        alertTitle.innerText = "AMARAN TEKANAN RENDAH!";
                        alertMsg.innerText = `Tayar bermasalah: ${lowPressureTires.join(", ")}`;
                    } else {
                        alertPanel.classList.remove("danger");
                        alertTitle.innerText = "SISTEM NORMAL";
                        alertMsg.innerText = "Semua 8 tayar berada dalam julat selamat.";
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
