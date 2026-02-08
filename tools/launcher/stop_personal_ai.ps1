# --- 自分が管理者かチェック。違ったら自分自身を管理者で再実行 ---
$IsAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $IsAdmin) {
  Write-Host "Re-launching as Administrator..."
  Start-Process powershell -Verb RunAs -ArgumentList @(
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$PSCommandPath`""
  )
  exit
}

# --- ここから停止処理 ---
$ports = @(3001, 3002, 3100)

foreach ($port in $ports) {
  $procIds = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
             Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($procId in $procIds) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
      Write-Host "Stopped PID $procId (port $port)"
    } catch {
      Write-Host "Stop-Process failed for PID $procId (port $port): $($_.Exception.Message)"
      # フォールバック（子プロセス含めて強制終了）
      try {
        taskkill /PID $procId /T /F | Out-Null
        Write-Host "taskkill succeeded for PID $procId (port $port)"
      } catch {
        Write-Host "taskkill failed for PID $procId (port $port): $($_.Exception.Message)"
      }
    }
  }
}

Write-Host "Done. Target ports: $($ports -join ', ')"

