# Script para generar el Keystore de Android y configurar keystore.properties automáticamente

$KeystoreName = "release-key.jks"
$Alias = "autotech-alias"

Write-Host "--- Generador de Keystore para AutoTech ---" -ForegroundColor Cyan

# Buscar keytool en el PATH o ubicaciones comunes de Windows
$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) {
    $javaPaths = @(
        "C:\Program Files\Java\jdk*\bin\keytool.exe",
        "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe",
        "C:\Program Files\Android\Android Studio\jre\bin\keytool.exe"
    )
    foreach ($path in $javaPaths) {
        $found = Resolve-Path $path -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $keytool = $found.Path
            break
        }
    }
}

if (-not $keytool) {
    Write-Host "ERROR: No se encontró la herramienta 'keytool' en el sistema." -ForegroundColor Red
    Write-Host "Para solucionarlo:"
    Write-Host "1. Asegúrate de tener instalado Java JDK o Android Studio."
    Write-Host "2. Agrega la carpeta 'bin' de Java o Android Studio al PATH del sistema, o ejecuta este script desde el Terminal de Android Studio."
    exit 1
}

Write-Host "Usando keytool encontrado en: $keytool"

# Solicitar contraseña de forma segura
$Password = Read-Host -Prompt "Ingresa una contraseña para tu Keystore (mínimo 6 caracteres)"
if ($Password.Length -lt 6) {
    Write-Host "ERROR: La contraseña debe tener al menos 6 caracteres." -ForegroundColor Red
    exit 1
}

Write-Host "`nGenerando el Keystore..." -ForegroundColor Yellow

# Ejecutar keytool
& $keytool -genkey -v -keystore $KeystoreName -alias $Alias -keyalg RSA -keysize 2048 -validity 10000 -storepass $Password -keypass $Password -dname "CN=AutoTech, OU=Development, O=AutoTech, L=Unknown, S=Unknown, C=US"

if ($LASTEXITCODE -eq 0) {
    Write-Host "¡Keystore generado con éxito en '$KeystoreName'!" -ForegroundColor Green
    
    # Crear archivo keystore.properties
    $PropertiesPath = "keystore.properties"
    $PropertiesContent = @"
# Archivo de configuración para firmar la aplicación Android (Release)
storeFile=$KeystoreName
storePassword=$Password
keyAlias=$Alias
keyPassword=$Password
"@
    Set-Content -Path $PropertiesPath -Value $PropertiesContent
    Write-Host "Archivo '$PropertiesPath' creado y configurado correctamente." -ForegroundColor Green
} else {
    Write-Host "ERROR: Ocurrió un error al ejecutar keytool." -ForegroundColor Red
}
