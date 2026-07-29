$ErrorActionPreference = "Stop"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$pc = Join-Path $base "INSTALAR_EN_PC"

if (-not (Test-Path (Join-Path $pc "config.json"))) {
  throw "Falta config.json. Ejecutá primero CONFIGURAR_TODO.bat"
}
if (-not (Test-Path (Join-Path $pc "serviceAccountKey.json"))) {
  throw "Falta serviceAccountKey.json. Ejecutá primero CONFIGURAR_TODO.bat"
}

Set-Location $pc

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js no está instalado."
}

npm install

$posibles = @(
  "C:\Program Files\RadioBOSS\radioboss.exe",
  "C:\Program Files (x86)\RadioBOSS\radioboss.exe",
  "C:\Program Files\DJSoft.Net\RadioBOSS\radioboss.exe",
  "C:\Program Files (x86)\DJSoft.Net\RadioBOSS\radioboss.exe"
)

$rutaRadioBoss = $null
foreach ($ruta in $posibles) {
  if (Test-Path $ruta) { $rutaRadioBoss = $ruta; break }
}

if (-not $rutaRadioBoss) {
  Add-Type -AssemblyName System.Windows.Forms
  $dialogo = New-Object System.Windows.Forms.OpenFileDialog
  $dialogo.Filter = "RadioBOSS (radioboss.exe)|radioboss.exe"
  $dialogo.Title = "Elegir radioboss.exe"
  if ($dialogo.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    throw "No se seleccionó radioboss.exe"
  }
  $rutaRadioBoss = $dialogo.FileName
}

$batMetadata = Join-Path $pc "INICIAR_METADATA_SILENCIOSO.bat"
$usuario = "$env:USERDOMAIN\$env:USERNAME"

$accionRadio = New-ScheduledTaskAction -Execute $rutaRadioBoss
$accionMetadata = New-ScheduledTaskAction `
  -Execute "cmd.exe" `
  -Argument "/c timeout /t 20 /nobreak >nul & `"$batMetadata`""

$disparador = New-ScheduledTaskTrigger -AtLogOn -User $usuario
$configuracion = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

Unregister-ScheduledTask -TaskName "RadioTM - RadioBOSS" -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "RadioTM - Metadata" -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
  -TaskName "RadioTM - RadioBOSS" `
  -Action $accionRadio `
  -Trigger $disparador `
  -Settings $configuracion | Out-Null

Register-ScheduledTask `
  -TaskName "RadioTM - Metadata" `
  -Action $accionMetadata `
  -Trigger $disparador `
  -Settings $configuracion | Out-Null

Write-Host ""
Write-Host "LISTO: RadioBOSS y la metadata arrancarán solos con Windows." -ForegroundColor Green
Write-Host "Ahora subí a GitHub los archivos de la carpeta SUBIR_A_GITHUB."
pause
