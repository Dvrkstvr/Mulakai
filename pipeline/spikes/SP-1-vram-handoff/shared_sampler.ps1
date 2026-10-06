# Logs per-adapter Shared Usage / Dedicated Usage (MB) once per second until killed.
param([string]$Out)
"time,adapter,shared_mb,dedicated_mb" | Out-File -Encoding ascii $Out
Get-Counter -Counter '\GPU Adapter Memory(*)\Shared Usage','\GPU Adapter Memory(*)\Dedicated Usage' -SampleInterval 1 -Continuous | ForEach-Object {
  $t = (Get-Date).ToString('yyyy/MM/dd HH:mm:ss.fff')
  $by = @{}
  foreach ($s in $_.CounterSamples) {
    if ($s.InstanceName -match 'luid_0x00000000_(0x[0-9a-f]+)_phys_0') { $id=$Matches[1] } else { continue }
    if (-not $by.ContainsKey($id)) { $by[$id] = @{} }
    if ($s.Path -match 'shared usage') { $by[$id].sh = [math]::Round($s.CookedValue/1MB,1) } else { $by[$id].de = [math]::Round($s.CookedValue/1MB,1) }
  }
  foreach ($k in $by.Keys) { "$t,$k,$($by[$k].sh),$($by[$k].de)" | Out-File -Append -Encoding ascii $Out }
}
