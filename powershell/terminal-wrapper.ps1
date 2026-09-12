function copilot {
    $session = $env:WT_SESSION

    # If we are not running inside Windows Terminal,
    # just invoke the real Copilot CLI normally.
    if (-not $session) {
        $realCopilot = Get-Command copilot -CommandType Application |
            Select-Object -First 1

        if ($realCopilot) {
            & $realCopilot.Source @args
        }

        return
    }

    $cleanSession = $session.Replace("-", "")

    if ($cleanSession.Length -lt 8) {
        $realCopilot = Get-Command copilot -CommandType Application |
            Select-Object -First 1

        if ($realCopilot) {
            & $realCopilot.Source @args
        }

        return
    }

    $shortSession = $cleanSession.Substring(0, 8)

    $oldTitle = $Host.UI.RawUI.WindowTitle

    try {
        $Host.UI.RawUI.WindowTitle = "Copilot [$shortSession]"

        $realCopilot = Get-Command copilot -CommandType Application |
            Where-Object {
                $_.Source -and
                $_.Source -notlike "*terminal-wrapper.ps1"
            } |
            Select-Object -First 1

        if ($realCopilot) {
            & $realCopilot.Source @args
        }
        else {
            Write-Error "GitHub Copilot CLI executable was not found."
        }
    }
    finally {
        $Host.UI.RawUI.WindowTitle = $oldTitle
    }
}