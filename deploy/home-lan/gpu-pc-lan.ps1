#Requires -RunAsAdministrator
# One-time setup on the GPU PC so the home server can reach the engines as well as this PC
# (README.md "Engines"). Run it in an elevated PowerShell. Safe to run again.
#
#   1. Windows Firewall lets the engine ports in from the home server only.
#   2. WSL uses mirrored networking, so YuE2 answers on this PC's LAN address, and the
#      Hyper-V firewall lets its port in from the home server only.
#   3. ENGINE_HOST=0.0.0.0 for your user, so start-all.bat binds the engines to the LAN.
#
# Afterwards: run `wsl --shutdown`, quit Ollama from the tray, close the engine windows,
# then run start-all.bat again.
param(
    [string]$Server = '192.168.2.13',
    [int[]]$Ports = @(8001, 8002, 8004, 8005, 11434)
)
$ErrorActionPreference = 'Stop'
$name = 'Mulakai engines (home server)'

# 1. Windows Firewall: the engine ports, from the server's address only.
Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP `
    -LocalPort $Ports -RemoteAddress $Server -Profile Any | Out-Null
Write-Host "Firewall: TCP $($Ports -join ', ') open to $Server only"

# 2. WSL: mirrored networking, plus a Hyper-V firewall rule (WSL blocks inbound by default).
$wslConfig = Join-Path $env:USERPROFILE '.wslconfig'
$lines = @()
if (Test-Path $wslConfig) { $lines = @(Get-Content $wslConfig) }
if ($lines -match '^\s*networkingMode\s*=\s*mirrored') {
    Write-Host 'WSL: already mirrored'
} else {
    $lines = @($lines | Where-Object { $_ -notmatch '^\s*networkingMode\s*=' })
    $at = [array]::IndexOf(@($lines | ForEach-Object { $_.Trim().ToLower() }), '[wsl2]')
    if ($at -lt 0) { $lines += '[wsl2]', 'networkingMode=mirrored' }
    else { $lines = $lines[0..$at] + 'networkingMode=mirrored' + $(if ($at + 1 -lt $lines.Count) { $lines[($at + 1)..($lines.Count - 1)] }) }
    Set-Content -Path $wslConfig -Value $lines -Encoding ascii
    Write-Host "WSL: networkingMode=mirrored written to $wslConfig (takes effect after wsl --shutdown)"
}
$wslVm = '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'
Get-NetFirewallHyperVRule -Name 'MulakaiYuE' -ErrorAction SilentlyContinue | Remove-NetFirewallHyperVRule
New-NetFirewallHyperVRule -Name 'MulakaiYuE' -DisplayName "$name - YuE2 in WSL" -Direction Inbound `
    -VMCreatorId $wslVm -Protocol TCP -LocalPorts 8004 -RemoteAddresses $Server -Action Allow | Out-Null
Write-Host "Hyper-V firewall: WSL port 8004 open to $Server only"

# 3. start-all.bat reads this.
[Environment]::SetEnvironmentVariable('ENGINE_HOST', '0.0.0.0', 'User')
Write-Host 'ENGINE_HOST=0.0.0.0 set for your user (new terminals pick it up)'
Write-Host ''
Write-Host 'Next: wsl --shutdown, quit Ollama from the tray, close the engine windows, run start-all.bat.'
