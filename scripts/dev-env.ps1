# Подхватывает .env и запускает бэкенд. Использование:
#   .\scripts\dev-env.ps1                 # только выставить переменные в текущей сессии
#   .\scripts\dev-env.ps1 -Run            # выставить и запустить bootRun на 8080
#   .\scripts\dev-env.ps1 -Run -Port 8081 # то же на другом порту (для проверок)
param(
    [switch]$Run,
    [int]$Port = 8080
)

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

if (-not (Test-Path $envFile)) {
    Write-Host "Файл .env не найден. Скопируйте scripts\env.example в .env и заполните пароли." -ForegroundColor Yellow
    exit 1
}

foreach ($line in Get-Content $envFile) {
    $trimmed = $line.Trim()
    if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
    $index = $trimmed.IndexOf('=')
    if ($index -lt 1) { continue }
    $name = $trimmed.Substring(0, $index).Trim()
    $value = $trimmed.Substring($index + 1).Trim()
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

Write-Host "Переменные из .env загружены: БД $($env:DB_USER)@$($env:DB_URL), администратор $($env:ALPHA_ADMIN_USER)." -ForegroundColor Green

if ($Run) {
    Push-Location $root
    try {
        & .\gradlew.bat :modules:api:bootRun --console=plain "--args=--server.port=$Port"
    } finally {
        Pop-Location
    }
}
