param(
    [Parameter(Mandatory=$true)]
    [string]$Title,

    [Parameter(Mandatory=$true)]
    [string]$Message
)

# ------------------------------------------------------------
# Identify the hook source.
#
# VS Code-compatible Stop hooks include:
#   hook_event_name = "Stop"
#
# Native Copilot CLI agentStop payloads use the camelCase
# format and do not include hook_event_name.
# ------------------------------------------------------------

$hookInput = $null

if ([Console]::IsInputRedirected) {
    try {
        $stdinText = [Console]::In.ReadToEnd()

        if (-not [string]::IsNullOrWhiteSpace($stdinText)) {
            $hookInput = $stdinText | ConvertFrom-Json -ErrorAction Stop
        }
    }
    catch {
        # Ignore malformed or missing hook input.
        # Continue with normal notification behavior.
    }
}

# ------------------------------------------------------------
# Ignore VS Code Copilot Stop events.
# This notification system is intended for Copilot CLI only.
# ------------------------------------------------------------

if ($hookInput -and $hookInput.hook_event_name -eq "Stop") {
    exit 0
}

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

$copilotTabPrefix = "Copilot ["

# ------------------------------------------------------------
# Windows notification helper
# ------------------------------------------------------------

function Show-Notification {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Title,

        [Parameter(Mandatory=$true)]
        [string]$Message
    )

    Import-Module BurntToast

    $iconPath = Join-Path $PSScriptRoot "copilot-mascot.png"

    if (Test-Path $iconPath) {
        New-BurntToastNotification `
            -Text $Title, $Message `
            -AppLogo $iconPath
    }
    else {
        # Fallback if the mascot is unavailable.
        New-BurntToastNotification `
            -Text $Title, $Message
    }
}

# ------------------------------------------------------------
# Win32 APIs
# ------------------------------------------------------------

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(
        IntPtr hWnd,
        out uint processId
    );
}
"@

# ------------------------------------------------------------
# Get foreground window
# ------------------------------------------------------------

$foregroundHwnd = [Win32]::GetForegroundWindow()

if ($foregroundHwnd -eq [IntPtr]::Zero) {
    # Detection failed -> fail open and show notification.
    Show-Notification -Title $Title -Message $Message
    exit 0
}

$foregroundPid = 0

[Win32]::GetWindowThreadProcessId(
    $foregroundHwnd,
    [ref]$foregroundPid
) | Out-Null

$foregroundProcess = Get-Process `
    -Id $foregroundPid `
    -ErrorAction SilentlyContinue

# ------------------------------------------------------------
# Is the foreground application Windows Terminal?
# ------------------------------------------------------------

if (
    -not $foregroundProcess -or
    $foregroundProcess.ProcessName -ne "WindowsTerminal"
) {
    # Chrome, Edge, VS Code, etc. is foreground.
    Show-Notification -Title $Title -Message $Message
    exit 0
}

# ------------------------------------------------------------
# Determine this Copilot session's expected tab name.
#
# The Copilot launcher sets:
#
#   Copilot [XXXXXXXX]
#
# using WT_SESSION.
# ------------------------------------------------------------

$session = $env:WT_SESSION

if (-not $session) {
    # Not running inside Windows Terminal.
    Show-Notification -Title $Title -Message $Message
    exit 0
}

$cleanSession = $session.Replace("-", "")

if ($cleanSession.Length -lt 8) {
    Show-Notification -Title $Title -Message $Message
    exit 0
}

$shortSession = $cleanSession.Substring(0, 8)

$expectedTabName = "Copilot [$shortSession]"

# ------------------------------------------------------------
# Windows UI Automation
# ------------------------------------------------------------

try {
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes

    $root = [System.Windows.Automation.AutomationElement]::RootElement

    # Find Windows Terminal windows.
    $terminalCondition =
        New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ClassNameProperty,
            "CASCADIA_HOSTING_WINDOW_CLASS"
        )

    $terminals = $root.FindAll(
        [System.Windows.Automation.TreeScope]::Children,
        $terminalCondition
    )

    $copilotTabIsSelected = $false

    foreach ($terminal in $terminals) {

        # Only inspect the foreground Terminal window.
        if (
            $terminal.Current.NativeWindowHandle -ne
            $foregroundHwnd.ToInt32()
        ) {
            continue
        }

        $tabCondition =
            New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                [System.Windows.Automation.ControlType]::TabItem
            )

        $tabs = $terminal.FindAll(
            [System.Windows.Automation.TreeScope]::Descendants,
            $tabCondition
        )

        foreach ($tab in $tabs) {

            $tabName = $tab.Current.Name

            if ($tabName -ne $expectedTabName) {
                continue
            }

            try {
                $selectionPattern = $tab.GetCurrentPattern(
                    [System.Windows.Automation.SelectionItemPattern]::Pattern
                )

                if ($selectionPattern.Current.IsSelected) {
                    $copilotTabIsSelected = $true
                }
            }
            catch {
                # Continue; fail open below.
            }
        }
    }

    # --------------------------------------------------------
    # Copilot tab is currently visible.
    # Do NOT show notification.
    # --------------------------------------------------------

    if ($copilotTabIsSelected) {
        exit 0
    }
}
catch {
    # UI Automation failed.
    # Fail open so notifications are not silently lost.
}

# ------------------------------------------------------------
# Copilot is in the background.
# Show notification.
# ------------------------------------------------------------

Show-Notification -Title $Title -Message $Message