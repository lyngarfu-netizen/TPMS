// ==========================================
// TPMS DASHBOARD - FULL JAVASCRIPT
// ==========================================


// ==========================================
// 1. FUNGSI LOGOUT
// ==========================================

function logoutTPMS() {
    localStorage.removeItem("tpms_logged_in");
    window.location.href = "login.html";
}


// ==========================================
// 2. HAD KESELAMATAN
// ==========================================

const MIN_SAFETY_LIMIT = 90;
const MAX_SAFETY_LIMIT = 120;


// Simpan status setiap tayar
const currentTireStatus = {};


// ==========================================
// 3. MQTT BROKER
// ==========================================

const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";

const client = mqtt.connect(MQTT_BROKER);


// ==========================================
// 4. FUNGSI UPDATE STATUS TAYAR
// ==========================================

function checkAndUpdateTire(
    boxId,
    psiId,
    psiValue,
    tireName
) {

    const psiElement =
        document.getElementById(psiId);

    const boxElement =
        document.getElementById(boxId);


    // Kalau element tak wujud
    if (!psiElement || !boxElement) {

        console.warn(
            "Element tidak dijumpai:",
            boxId,
            psiId
        );

        return;
    }


    // ==========================================
    // PASTIKAN PSI ADALAH NUMBER
    // ==========================================

    psiValue = Number(psiValue);


    if (isNaN(psiValue)) {

        console.warn(
            "PSI tidak valid:",
            psiValue
        );

        return;
    }


    // ==========================================
    // PAPAR NILAI PSI
    // ==========================================

    psiElement.innerHTML =
        `${Math.round(psiValue)} <small>PSI</small>`;


    // ==========================================
    // CHECK HAD KESELAMATAN
    // ==========================================

    const isUnderMin =
        psiValue < MIN_SAFETY_LIMIT;

    const isOverMax =
        psiValue > MAX_SAFETY_LIMIT;

    const isWarning =
        isUnderMin || isOverMax;


    // ==========================================
    // DEBUG CONSOLE
    // ==========================================

    console.log(
        "----------------------------------"
    );

    console.log(
        "Tayar:",
        tireName
    );

    console.log(
        "PSI:",
        psiValue
    );

    console.log(
        "Minimum:",
        MIN_SAFETY_LIMIT
    );

    console.log(
        "Maximum:",
        MAX_SAFETY_LIMIT
    );

    console.log(
        "Warning:",
        isWarning
    );


    // ==========================================
    // JIKA PSI TAK SELAMAT
    // < 90 ATAU > 120
    // ==========================================

    if (isWarning) {

        // Border merah
        boxElement.style.setProperty(
            "border-color",
            "#ff3366",
            "important"
        );


        // Background merah
        boxElement.style.setProperty(
            "background-color",
            "rgba(255, 51, 102, 0.35)",
            "important"
        );


        // Glow merah
        boxElement.style.setProperty(
            "box-shadow",
            "0 0 20px #ff3366",
            "important"
        );


        // Text PSI merah
        psiElement.style.setProperty(
            "color",
            "#ff3366",
            "important"
        );


        // Tambah warning class
        boxElement.classList.add("warning");


        // Simpan status
        currentTireStatus[tireName] = true;

    }


    // ==========================================
    // JIKA PSI NORMAL
    // 90 - 120
    // ==========================================

    else {

        // Border cyan
        boxElement.style.setProperty(
            "border-color",
            "#00f0ff",
            "important"
        );


        // Background normal
        boxElement.style.setProperty(
            "background-color",
            "rgba(16, 21, 32, 0.95)",
            "important"
        );


        // Glow cyan
        boxElement.style.setProperty(
            "box-shadow",
            "0 0 10px rgba(0, 240, 255, 0.2)",
            "important"
        );


        // Text PSI cyan
        psiElement.style.setProperty(
            "color",
            "#00f0ff",
            "important"
        );


        // Buang warning
        boxElement.classList.remove("warning");


        // Simpan status normal
        currentTireStatus[tireName] = false;
    }


    // ==========================================
    // UPDATE ALERT PANEL
    // ==========================================

    updateAlertPanel();
}


// ==========================================
// 5. UPDATE ALERT PANEL
// ==========================================

function updateAlertPanel() {

    const faultyTires =
        Object.keys(currentTireStatus)
            .filter(
                name =>
                    currentTireStatus[name] === true
            );


    const alertPanel =
        document.getElementById("alert-panel");

    const alertTitle =
        document.getElementById("alert-title");

    const alertMsg =
        document.getElementById("alert-msg");


    // Kalau alert panel tak wujud
    if (
        !alertPanel ||
        !alertTitle ||
        !alertMsg
    ) {
        return;
    }


    // ==========================================
    // ADA TAYAR BERMASALAH
    // ==========================================

    if (faultyTires.length > 0) {

        // Background merah
        alertPanel.style.setProperty(
            "background-color",
            "rgba(255, 51, 102, 0.2)",
            "important"
        );


        // Border merah
        alertPanel.style.setProperty(
            "border-color",
            "#ff3366",
            "important"
        );


        // Text merah
        alertPanel.style.setProperty(
            "color",
            "#ff3366",
            "important"
        );


        // Tajuk
        alertTitle.innerText =
            "AMARAN TEKANAN TAYAR!";


        // Senarai tayar
        alertMsg.innerText =
            `Tayar bermasalah: ${faultyTires.join(", ")}`;
    }


    // ==========================================
    // SEMUA NORMAL
    // ==========================================

    else {

        // Background hijau
        alertPanel.style.setProperty(
            "background-color",
            "rgba(0, 255, 136, 0.1)",
            "important"
        );


        // Border hijau
        alertPanel.style.setProperty(
            "border-color",
            "#00ff88",
            "important"
        );


        // Text hijau
        alertPanel.style.setProperty(
            "color",
            "#00ff88",
            "important"
        );


        // Tajuk
        alertTitle.innerText =
            "SISTEM NORMAL";


        // Message
        alertMsg.innerText =
            `Semua tayar dalam julat selamat (${MIN_SAFETY_LIMIT}-${MAX_SAFETY_LIMIT} PSI).`;
    }
}


// ==========================================
// 6. MQTT CONNECT
// ==========================================

client.on("connect", () => {

    console.log(
        "================================="
    );

    console.log(
        "MQTT CONNECTED!"
    );

    console.log(
        "Broker:",
        MQTT_BROKER
    );


    // ==========================================
    // UPDATE CONNECTION STATUS
    // ==========================================

    const statusBox =
        document.getElementById(
            "connection-status"
        );


    if (statusBox) {

        statusBox.innerHTML =
            '<div class="pulse-dot"></div> CONNECTED';

    }


    // ==========================================
    // SUBSCRIBE
    // ==========================================

    client.subscribe(
        "lori/VKT8821/#",
        (error) => {

            if (error) {

                console.error(
                    "MQTT Subscribe Error:",
                    error
                );

            } else {

                console.log(
                    "Subscribed to:",
                    "lori/VKT8821/#"
                );

            }

        }
    );

});


// ==========================================
// 7. MQTT ERROR
// ==========================================

client.on("error", (error) => {

    console.error(
        "MQTT ERROR:",
        error
    );


    const statusBox =
        document.getElementById(
            "connection-status"
        );


    if (statusBox) {

        statusBox.innerHTML =
            '<div class="pulse-dot"></div> ERROR';

    }

});


// ==========================================
// 8. MQTT DISCONNECT
// ==========================================

client.on("close", () => {

    console.warn(
        "MQTT Disconnected!"
    );


    const statusBox =
        document.getElementById(
            "connection-status"
        );


    if (statusBox) {

        statusBox.innerHTML =
            '<div class="pulse-dot"></div> DISCONNECTED';

    }

});


// ==========================================
// 9. MQTT MESSAGE RECEIVER
// ==========================================

client.on("message", (topic, message) => {

    // ==========================================
    // DAPATKAN DATA
    // ==========================================

    const msgString =
        message.toString().trim();


    const cleanTopic =
        topic.toLowerCase();


    console.log(
        "================================="
    );

    console.log(
        "MQTT TOPIC:",
        topic
    );

    console.log(
        "MQTT DATA:",
        msgString
    );


    let psiValue = NaN;


    // ==========================================
    // JIKA DATA JSON
    // ==========================================

    /*
        Contoh:

        {"psi":70}

        atau

        {"value":70}

        atau

        {"pressure":70}
    */

    if (
        msgString.startsWith("{")
    ) {

        try {

            const data =
                JSON.parse(msgString);


            psiValue =
                parseFloat(
                    data.psi ??
                    data.value ??
                    data.pressure
                );


        } catch (error) {

            console.error(
                "JSON Parse Error:",
                error
            );

            return;
        }

    }


    // ==========================================
    // JIKA DATA NOMBOR BIASA
    // ==========================================

    /*
        Contoh:

        70

        72

        97

        108
    */

    else {

        psiValue =
            parseFloat(msgString);

    }


    // ==========================================
    // CHECK INVALID DATA
    // ==========================================

    if (
        isNaN(psiValue)
    ) {

        console.warn(
            "PSI tidak valid:",
            msgString
        );

        return;
    }


    // ==========================================
    // DEBUG PSI
    // ==========================================

    console.log(
        "PSI VALUE RECEIVED:",
        psiValue
    );

    console.log(
        "MIN LIMIT:",
        MIN_SAFETY_LIMIT
    );

    console.log(
        "MAX LIMIT:",
        MAX_SAFETY_LIMIT
    );


    // ==========================================
    // LOW PRESSURE CHECK
    // ==========================================

    if (
        psiValue < MIN_SAFETY_LIMIT
    ) {

        console.warn(
            "⚠️ LOW PRESSURE:",
            psiValue,
            "PSI"
        );

    }


    // ==========================================
    // HIGH PRESSURE CHECK
    // ==========================================

    if (
        psiValue > MAX_SAFETY_LIMIT
    ) {

        console.warn(
            "⚠️ HIGH PRESSURE:",
            psiValue,
            "PSI"
        );

    }


    // ==========================================
    // PADANKAN TOPIC FL1
    // ==========================================

    if (
        cleanTopic.includes("fl1")
    ) {

        checkAndUpdateTire(
            "box-fl1",
            "psi-fl1",
            psiValue,
            "Depan Kiri (FL1)"
        );

    }


    // ==========================================
    // FR1
    // ==========================================

    else if (
        cleanTopic.includes("fr1")
    ) {

        checkAndUpdateTire(
            "box-fr1",
            "psi-fr1",
            psiValue,
            "Depan Kanan (FR1)"
        );

    }


    // ==========================================
    // BL1
    // ==========================================

    else if (
        cleanTopic.includes("bl1")
    ) {

        checkAndUpdateTire(
            "box-bl1",
            "psi-bl1",
            psiValue,
            "B. Kiri 1 (BL1)"
        );

    }


    // ==========================================
    // BR1
    // ==========================================

    else if (
        cleanTopic.includes("br1")
    ) {

        checkAndUpdateTire(
            "box-br1",
            "psi-br1",
            psiValue,
            "B. Kanan 1 (BR1)"
        );

    }


    // ==========================================
    // BL2
    // ==========================================

    else if (
        cleanTopic.includes("bl2")
    ) {

        checkAndUpdateTire(
            "box-bl2",
            "psi-bl2",
            psiValue,
            "B. Kiri 2 (BL2)"
        );

    }


    // ==========================================
    // BR2
    // ==========================================

    else if (
        cleanTopic.includes("br2")
    ) {

        checkAndUpdateTire(
            "box-br2",
            "psi-br2",
            psiValue,
            "B. Kanan 2 (BR2)"
        );

    }


    // ==========================================
    // LAST UPDATE
    // ==========================================

    const lastUpdate =
        document.getElementById(
            "last-update"
        );


    if (lastUpdate) {

        const now =
            new Date();


        lastUpdate.innerText =
            now.toLocaleTimeString();

    }

});


// ==========================================
// 10. INITIAL STATUS
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "TPMS Dashboard Loaded"
        );

        console.log(
            `Safety Range: ${MIN_SAFETY_LIMIT}-${MAX_SAFETY_LIMIT} PSI`
        );


        // Pastikan alert panel mula-mula normal
        updateAlertPanel();

    }
);
