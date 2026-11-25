<#
  Pubblica su GitHub (MrsKugla/TaskPrio) la release dell'ultimo commit, per l'aggiornamento automatico.

  Prima di lanciarlo:
    1. release.bat -Version X.Y.Z   (versione semver in package.json + installer firmato);
    2. git commit con messaggio "X.Y.Z: cosa cambia"  (git status pulito).

  Cosa fa:
    1. controlla GitHub CLI, git pulito, messaggio del commit, installer e firma .sig di quella versione;
    2. scrive latest.json, il file che le app installate leggono all'avvio;
    3. crea il tag vX.Y.Z sul commit, fa push di commit e tag;
    4. crea la release con installer, .sig e latest.json; le note sono il messaggio del commit.
  Una versione con trattino (es. 1.3.0-beta.1) diventa "pre-release": le app installate non la ricevono.

  Chiave dell'updater: %USERPROFILE%\.tauri\taskprio-updater.key. Se si perde, se ne genera una nuova
  (vedi release.bat) e si aggiorna "pubkey" in src-tauri\tauri.conf.json: le app gia' installate vanno
  reinstallate a mano una volta, poi riprendono ad aggiornarsi da sole.

  Uso: pubblica_github.bat
#>
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$Repo = 'MrsKugla/TaskPrio'

function Stop-Pubblicazione([string]$Motivo) {
    Write-Host ''
    Write-Host ('=' * 70) -ForegroundColor Red
    Write-Host "  RELEASE NON PUBBLICATA: $Motivo" -ForegroundColor Red
    Write-Host ('=' * 70) -ForegroundColor Red
    exit 1
}

# 1. Controlli
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Stop-Pubblicazione 'manca GitHub CLI. ESEGUI: winget install GitHub.cli' }
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) { Stop-Pubblicazione 'GitHub CLI non ha fatto l''accesso. ESEGUI una volta: gh auth login' }

$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
# Espressione regolare ufficiale di https://semver.org
$semver = '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$'
if ($version -notmatch $semver) { Stop-Pubblicazione "la versione in package.json ($version) non segue semver" }
$preRelease = $version.Contains('-')

$sporco = & git status --porcelain
if ($sporco) { Stop-Pubblicazione 'ci sono modifiche non committate: fai prima il commit' }

$oggetto = (& git log -1 --format=%s) -join ''
$prefisso = "${version}: "
if (-not $oggetto.StartsWith($prefisso)) { Stop-Pubblicazione "l'ultimo commit non inizia con ""$prefisso"" (e' ""$oggetto"")" }
$corpo = (& git log -1 --format=%b) -join "`n"
$note = ($oggetto.Substring($prefisso.Length) + "`n`n" + $corpo).Trim()

$tag = "v$version"
& gh release view $tag --repo $Repo *> $null
if ($LASTEXITCODE -eq 0) { Stop-Pubblicazione "la release $tag esiste gia' su GitHub: aumenta la versione con release.bat" }
# Un tag sullo stesso commit resta da un tentativo interrotto: si riprende da li'.
$tagEsistente = [bool](& git tag -l $tag)
if ($tagEsistente -and (& git rev-list -n 1 $tag) -ne (& git rev-parse HEAD)) {
    Stop-Pubblicazione "il tag $tag esiste gia' su un altro commit: aumenta la versione con release.bat"
}

$nomeSetup = "TaskPrio_${version}_x64-setup.exe"
$setup = "src-tauri\target\release\bundle\nsis\$nomeSetup"
if (-not (Test-Path $setup)) { Stop-Pubblicazione "installer mancante: $setup. ESEGUI prima release.bat -Version $version" }
if (-not (Test-Path "$setup.sig")) { Stop-Pubblicazione "firma per l'aggiornamento mancante: $setup.sig (la chiave dell'updater c'era durante release.bat?)" }

# 2. latest.json
$latest = Join-Path $env:TEMP 'latest.json'
[ordered]@{
    version   = $version
    notes     = $note
    pub_date  = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    platforms = [ordered]@{
        'windows-x86_64' = [ordered]@{
            signature = (Get-Content "$setup.sig" -Raw).Trim()
            url       = "https://github.com/$Repo/releases/download/$tag/$nomeSetup"
        }
    }
} | ConvertTo-Json -Depth 5 | ForEach-Object { [IO.File]::WriteAllText($latest, $_, (New-Object Text.UTF8Encoding $false)) }

# 3. Tag e push
Write-Host "==> Tag $tag e push" -ForegroundColor Cyan
if (-not $tagEsistente) { & git tag -a $tag -m "TaskPrio $version" }
& git push origin HEAD
if ($LASTEXITCODE -ne 0) { if (-not $tagEsistente) { & git tag -d $tag | Out-Null }; Stop-Pubblicazione 'push del commit non riuscito' }
& git push origin $tag
if ($LASTEXITCODE -ne 0) { Stop-Pubblicazione "push del tag $tag non riuscito" }

# 4. Release
Write-Host "==> Release $tag su GitHub" -ForegroundColor Cyan
$fileNote = Join-Path $env:TEMP "taskprio-note-$version.md"
[IO.File]::WriteAllText($fileNote, $note, (New-Object Text.UTF8Encoding $false))
$tipo = if ($preRelease) { '--prerelease' } else { '--latest' }
& gh release create $tag $setup "$setup.sig" $latest --repo $Repo --verify-tag --title "TaskPrio $version" --notes-file $fileNote $tipo
if ($LASTEXITCODE -ne 0) { Stop-Pubblicazione "creazione della release non riuscita (il tag $tag e' gia' su GitHub: rilancia pubblica_github)" }

Write-Host ''
Write-Host ('=' * 70) -ForegroundColor Green
Write-Host "  RELEASE $tag PUBBLICATA" -ForegroundColor Green
Write-Host "  https://github.com/$Repo/releases/tag/$tag" -ForegroundColor Green
if ($preRelease) { Write-Host '  Pre-release: le app installate NON la ricevono.' -ForegroundColor Yellow }
else { Write-Host '  Le app installate la vedranno al prossimo avvio.' -ForegroundColor Green }
Write-Host ('=' * 70) -ForegroundColor Green
