#!/usr/bin/env node

const { execFileSync } = require("child_process");

const command = process.argv[2];

function testNotification() {
    const scriptPath = require("path").join(
        process.env.USERPROFILE,
        ".copilot",
        "hooks",
        "copilot-notify.ps1"
    );

    try {
        execFileSync(
            "powershell.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-File",
                scriptPath,
                "-Title",
                "Copilot Notify",
                "-Message",
                "Windows notifications are working."
            ],
            {
                stdio: "inherit"
            }
        );

        console.log("✓ Test notification sent");
    } catch (error) {
        console.error("✗ Failed to send test notification");
        process.exit(1);
    }
}

switch (command) {
    case "test":
        testNotification();
        break;

    case "status":
        console.log("Copilot Notify");
        console.log("Installation is managed automatically.");
        break;

    default:
        console.log("Copilot Notify");
        console.log("");
        console.log("Commands:");
        console.log("  copilot-notify test");
        console.log("  copilot-notify status");
        break;
}