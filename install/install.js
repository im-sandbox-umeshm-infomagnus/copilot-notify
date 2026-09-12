const os = require("os");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");


function checkWindows() {
    if (os.platform() !== "win32") {
        console.error("Copilot Notify currently supports Windows only.");
        process.exit(1);
    }

    console.log("✓ Windows detected");
}

function checkPowerShell() {
    try {
        execFileSync(
            "powershell.exe",
            ["-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"],
            {
                stdio: "pipe",
                encoding: "utf8"
            }
        );

        console.log("✓ Windows PowerShell detected");
    } catch (error) {
        console.error("✗ Windows PowerShell was not detected.");
        process.exit(1);
    }
}


function checkCopilot() {
    const candidates = [
        process.env.APPDATA
            ? `${process.env.APPDATA}\\npm\\copilot.cmd`
            : null,

        process.env.LOCALAPPDATA
            ? `${process.env.LOCALAPPDATA}\\Microsoft\\WindowsApps\\copilot.exe`
            : null
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            const version = execFileSync(
                candidate,
                ["--version"],
                {
                    stdio: "pipe",
                    encoding: "utf8"
                }
            ).trim();

            console.log(`✓ GitHub Copilot CLI detected (${version})`);
            return;
        } catch {
            // Try the next candidate.
        }
    }

    console.error("✗ GitHub Copilot CLI was not detected.");
    console.error("  Install GitHub Copilot CLI before continuing.");
    process.exit(1);
}

function checkWindowsTerminal() {
    try {
        execFileSync(
            "where.exe",
            ["wt.exe"],
            {
                stdio: "pipe",
                encoding: "utf8"
            }
        );

        console.log("✓ Windows Terminal detected");
    } catch (error) {
        console.error("✗ Windows Terminal was not detected.");
        console.error("  Copilot Notify requires Windows Terminal.");
        process.exit(1);
    }
}

function checkBurntToast() {
    try {
        execFileSync(
            "powershell.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "if (Get-Module -ListAvailable -Name BurntToast) { exit 0 } else { exit 1 }"
            ],
            {
                stdio: "pipe"
            }
        );

        console.log("✓ BurntToast detected");
    } catch (error) {
        console.error("✗ BurntToast was not detected.");
        console.error("  BurntToast is required for Windows toast notifications.");
        console.error("  Install it with:");
        console.error("  Install-Module BurntToast -Scope CurrentUser");
        process.exit(1);
    }
}

function getCopilotHome() {
    const copilotHome =
        process.env.COPILOT_HOME ||
        `${process.env.USERPROFILE}\\.copilot`;

    return copilotHome;
}

function getHooksDirectory() {
    return `${getCopilotHome()}\\hooks`;
}

function checkCopilotHooksDirectory() {
    const hooksDirectory = getHooksDirectory();

    fs.mkdirSync(hooksDirectory, {
        recursive: true
    });

    console.log(`✓ Copilot hooks directory ready (${hooksDirectory})`);
}

function installNotificationScript() {
    const packageRoot = path.resolve(__dirname, "..");

    const sourceScript = path.join(
        packageRoot,
        "powershell",
        "copilot-notify.ps1"
    );

    const targetScript = path.join(
        getHooksDirectory(),
        "copilot-notify.ps1"
    );

    if (!fs.existsSync(sourceScript)) {
        console.error(`✗ Notification script not found: ${sourceScript}`);
        process.exit(1);
    }

    fs.copyFileSync(sourceScript, targetScript);

    console.log(`✓ Notification script installed`);
}

function installNotificationIcon() {
    const packageRoot = path.resolve(__dirname, "..");

    const sourceIcon = path.join(
        packageRoot,
        "assets",
        "copilot-mascot.png"
    );

    const targetIcon = path.join(
        getHooksDirectory(),
        "copilot-mascot.png"
    );

    if (!fs.existsSync(sourceIcon)) {
        console.error(`✗ Copilot mascot not found: ${sourceIcon}`);
        process.exit(1);
    }

    fs.copyFileSync(sourceIcon, targetIcon);

    console.log("✓ Copilot mascot installed");
}

function backupExistingHookConfiguration() {
    const targetPath = path.join(
        getHooksDirectory(),
        "notification-hooks.json"
    );

    if (!fs.existsSync(targetPath)) {
        return;
    }

    const backupPath = `${targetPath}.backup`;

    fs.copyFileSync(targetPath, backupPath);

    console.log(`✓ Existing hook configuration backed up`);
}

function installHookConfiguration() {
    const packageRoot = path.resolve(__dirname, "..");

    const templatePath = path.join(
        packageRoot,
        "hooks",
        "notification-hooks.json"
    );

    const targetPath = path.join(
        getHooksDirectory(),
        "notification-hooks.json"
    );

    if (!fs.existsSync(templatePath)) {
        console.error(`✗ Hook template not found: ${templatePath}`);
        process.exit(1);
    }

    const notificationScriptPath = path.join(
        getHooksDirectory(),
        "copilot-notify.ps1"
    );

    const powershellCommand =
        `& "${notificationScriptPath}"`;

    const escapedPowerShellCommand =
        JSON.stringify(powershellCommand).slice(1, -1);

    let template = fs.readFileSync(templatePath, "utf8");

    template = template.replace(
        /COPILOT_NOTIFY_COMMAND_PLACEHOLDER/g,
        escapedPowerShellCommand
    );

    fs.writeFileSync(
        targetPath,
        template,
        "utf8"
    );

    console.log("✓ Copilot hook configuration installed");
}

function installPowerShellWrapper() {
    const packageRoot = path.resolve(__dirname, "..");

    const wrapperPath = path.join(
        packageRoot,
        "powershell",
        "terminal-wrapper.ps1"
    );

    if (!fs.existsSync(wrapperPath)) {
        console.error(`✗ PowerShell wrapper not found: ${wrapperPath}`);
        process.exit(1);
    }

    const powershellCommand = `
# >>> copilot-notify >>>
. "${wrapperPath}"
# <<< copilot-notify <<<
`;

    const profilePath = execFileSync(
        "powershell.exe",
        [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$PROFILE"
        ],
        {
            encoding: "utf8"
        }
    ).trim();

    if (!profilePath) {
        console.error("✗ Could not determine PowerShell profile path.");
        process.exit(1);
    }

    const existingProfile = fs.existsSync(profilePath)
        ? fs.readFileSync(profilePath, "utf8")
        : "";

    const startMarker = "# >>> copilot-notify >>>";
    const endMarker = "# <<< copilot-notify <<<";

    const startIndex = existingProfile.indexOf(startMarker);
    const endIndex = existingProfile.indexOf(endMarker);

    let updatedProfile = existingProfile;

    if (startIndex !== -1 && endIndex !== -1) {
        const endPosition = endIndex + endMarker.length;

        updatedProfile =
            existingProfile.slice(0, startIndex) +
            powershellCommand.trim() +
            existingProfile.slice(endPosition);
    } else {
        if (updatedProfile && !updatedProfile.endsWith("\n")) {
            updatedProfile += "\n";
        }

        updatedProfile += powershellCommand;
    }

    fs.writeFileSync(
        profilePath,
        updatedProfile,
        "utf8"
    );

    console.log(`✓ PowerShell wrapper installed (${profilePath})`);
}


function configureCopilotSettings() {
    const copilotHome = getCopilotHome();

    const settingsPath = path.join(
        copilotHome,
        "settings.json"
    );

    let settings = {};

    if (fs.existsSync(settingsPath)) {
        try {
            settings = JSON.parse(
                fs.readFileSync(settingsPath, "utf8")
            );
        } catch (error) {
            console.error("✗ Could not parse Copilot settings.json.");
            console.error("  Aborting to avoid overwriting existing settings.");
            process.exit(1);
        }
    }

    settings.updateTerminalTitle = false;

    fs.writeFileSync(
        settingsPath,
        JSON.stringify(settings, null, 2) + "\n",
        "utf8"
    );

    console.log("✓ Copilot terminal title updates disabled");
}

function verifyInstallation() {
    const hooksDirectory = getHooksDirectory();

    const notificationScriptPath = path.join(
        hooksDirectory,
        "copilot-notify.ps1"
    );

    const hookConfigPath = path.join(
        hooksDirectory,
        "notification-hooks.json"
    );

    const profilePath = execFileSync(
        "powershell.exe",
        [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$PROFILE"
        ],
        {
            encoding: "utf8"
        }
    ).trim();

    let valid = true;

    if (!fs.existsSync(notificationScriptPath)) {
        console.error("✗ Notification script verification failed");
        valid = false;
    } else {
        console.log("✓ Notification script verified");
    }

    if (!fs.existsSync(hookConfigPath)) {
        console.error("✗ Hook configuration verification failed");
        valid = false;
    } else {
        try {
            JSON.parse(
                fs.readFileSync(hookConfigPath, "utf8")
            );

            console.log("✓ Hook configuration verified");
        } catch {
            console.error("✗ Hook configuration contains invalid JSON");
            valid = false;
        }
    }

    if (!fs.existsSync(profilePath)) {
        console.error("✗ PowerShell profile verification failed");
        valid = false;
    } else {
        const profileContent = fs.readFileSync(
            profilePath,
            "utf8"
        );

        if (
            profileContent.includes("# >>> copilot-notify >>>") &&
            profileContent.includes("# <<< copilot-notify <<<")
        ) {
            console.log("✓ PowerShell wrapper verified");
        } else {
            console.error("✗ PowerShell wrapper was not found in profile");
            valid = false;
        }
    }

    const settingsPath = path.join(
        getCopilotHome(),
        "settings.json"
    );

    if (fs.existsSync(settingsPath)) {
        try {
            const settings = JSON.parse(
                fs.readFileSync(settingsPath, "utf8")
            );

            if (settings.updateTerminalTitle === false) {
                console.log("✓ Copilot terminal-title setting verified");
            } else {
                console.error(
                    "✗ updateTerminalTitle is not set to false"
                );
                valid = false;
            }
        } catch {
            console.error("✗ Could not verify Copilot settings");
            valid = false;
        }
    } else {
        console.error("✗ Copilot settings.json not found");
        valid = false;
    }

    if (!valid) {
        console.error("");
        console.error("Installation verification failed.");
        process.exit(1);
    }

    console.log("");
    console.log("✓ Installation verified successfully");
}


function main() {
    console.log("");
    console.log("Copilot Notify installer");
    console.log("-----------------------");

    checkWindows();
    checkPowerShell();
    checkCopilot();
    checkWindowsTerminal();
    checkBurntToast();
    checkCopilotHooksDirectory();

    backupExistingHookConfiguration();

    installNotificationScript();
    installNotificationIcon();
    installHookConfiguration();
    installPowerShellWrapper();
    configureCopilotSettings();
    verifyInstallation();

    console.log("");
    console.log("Installation checks passed.");
    
}

main();