const { send, isConfigured } = require("../services/telegram");

async function main() {
    if (!isConfigured()) {
        console.log("XATO: Telegram token yoki Chat ID sozlanmagan.");
        return;
    }

    const success = await send(
        "Telefon Market: Telegram bot muvaffaqiyatli ulandi!"
    );

    if (success) {
        console.log("OK: Telegram xabari yuborildi!");
    } else {
        console.log("XATO: Xabar yuborilmadi. Token va Chat ID ni tekshir.");
    }
}

main();