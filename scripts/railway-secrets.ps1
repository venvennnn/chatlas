# Run locally in Windows PowerShell. Values go to your clipboard, not the console.
$ErrorActionPreference = 'Stop'
function New-ChatlasSecret {
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $bytes = New-Object byte[] 32
        $generator.GetBytes($bytes)
        return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    } finally {
        $generator.Dispose()
    }
}
$variables = "SESSION_SECRET=$(New-ChatlasSecret)`nTOKEN_ENCRYPTION_KEY=$(New-ChatlasSecret)"
Set-Clipboard -Value $variables
Write-Host 'Two new secrets are in your clipboard. Paste into Railway Variables > Raw Editor.'
Write-Host 'Generate these only for a new installation. Preserve existing values on redeploy.'
