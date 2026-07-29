$ErrorActionPreference = "Stop"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$pc = Join-Path $base "INSTALAR_EN_PC"

Write-Host ""
Write-Host "RADIO TIEMPO MUERTO - CONFIGURACION" -ForegroundColor Cyan
Write-Host ""

$claveRadio = Read-Host "Contraseña de la API de RadioBOSS"
$puertoRadio = Read-Host "Puerto de RadioBOSS (Enter para 9000)"
if ([string]::IsNullOrWhiteSpace($puertoRadio)) { $puertoRadio = 9000 }

$config = @{
  radioBoss = @{
    host = "127.0.0.1"
    puerto = [int]$puertoRadio
    contrasena = $claveRadio
  }
  firebase = @{
    serviceAccount = "serviceAccountKey.json"
  }
  metadata = @{
    intervaloSegundos = 5
  }
}

$config | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $pc "config.json") -Encoding UTF8

Write-Host ""
Write-Host "Ahora seleccioná la clave privada de Firebase." -ForegroundColor Yellow

Add-Type -AssemblyName System.Windows.Forms
$dialogo = New-Object System.Windows.Forms.OpenFileDialog
$dialogo.Filter = "Archivos JSON (*.json)|*.json"
$dialogo.Title = "Elegir clave privada de Firebase"

if ($dialogo.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
  throw "No se seleccionó la clave privada de Firebase."
}

Copy-Item $dialogo.FileName (Join-Path $pc "serviceAccountKey.json") -Force

Write-Host ""
Write-Host "Configuración creada correctamente." -ForegroundColor Green
Write-Host "Ahora ejecutá INSTALAR_Y_ACTIVAR.bat"
pause
