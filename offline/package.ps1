param(
    [string]$Go = 'go',
    [string]$OutputZip = (Join-Path $PSScriptRoot '../../campus-flora-windows-x64.zip')
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$output = [IO.Path]::GetFullPath($OutputZip)
$stage = Join-Path ([IO.Path]::GetTempPath()) ('flora-package-' + [guid]::NewGuid().ToString('N'))
$app = New-Item -ItemType Directory -Path (Join-Path $stage 'app') -Force
$oldOS, $oldArch, $oldCGO = $env:GOOS, $env:GOARCH, $env:CGO_ENABLED
Push-Location $repo
try {
    node build.mjs offline/campus-flora-offline.html
    if ($LASTEXITCODE) { throw 'HTML build failed' }
    $env:GOOS = 'windows'
    $env:GOARCH = 'amd64'
    $env:CGO_ENABLED = '0'
    & $Go build -trimpath -ldflags '-s -w' -o (Join-Path $app.FullName 'campus-flora.exe') ./offline/main.go
    if ($LASTEXITCODE) { throw 'Launcher build failed' }
    $toolchain = & $Go env GOROOT
    Copy-Item -LiteralPath (Join-Path $toolchain 'LICENSE') -Destination (Join-Path $app.FullName 'Go-LICENSE.txt')
    foreach ($name in '一键启动植迹.cmd','作品介绍.txt','使用说明.txt') {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $stage
    }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'campus-flora-offline.html') -Destination (Join-Path $stage '纯离线图鉴.html')
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $output -CompressionLevel Optimal -Force
    Get-Item -LiteralPath $output
} finally {
    $env:GOOS, $env:GOARCH, $env:CGO_ENABLED = $oldOS, $oldArch, $oldCGO
    Pop-Location
    # The staging directory contains only files created above.
    foreach ($name in 'app/campus-flora.exe','app/Go-LICENSE.txt','一键启动植迹.cmd','作品介绍.txt','使用说明.txt','纯离线图鉴.html') {
        $file = Join-Path $stage $name
        if ([IO.File]::Exists($file)) { [IO.File]::Delete($file) }
    }
    [IO.Directory]::Delete($app.FullName)
    [IO.Directory]::Delete($stage)
}
