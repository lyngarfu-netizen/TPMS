// ===================================================
// 1. FUNGSI LOGOUT
// ===================================================
function logoutTPMS() {
    localStorage.removeItem("tpms_logged_in");
    window.location.href = "login.html";
}

// ===================================================
// 2. SAMBUNGAN MQTT BROKER & KEMASKINI TAYAR (6 TAYAR)
// ===================================================
// Guna HiveMQ WebSocket Public Broker (Port 8884)
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
            const boxElement = document.getElementById(target.boxId);

            if (psiElement && boxElement) {
                // Tampilkan data PSI sahaja
                psiElement.innerHTML = `${data.psi} <small>PSI</small>`;

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
