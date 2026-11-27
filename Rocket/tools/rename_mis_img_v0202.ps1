# v0.20.2 ミッションの 絵の ファイル名を いまの ミッション番号に そろえる（1回だけ 実行）
# 置き場所: <AI Games>\Rocket\tools\rename_mis_img_v0202.ps1
# v0.18（4章の ならびかえ）・v0.18.1（5章を 4こに）で、絵は まえの 番号の まま missions.js の img で ひいていた。それを やめる
$ErrorActionPreference = 'Stop'
$root = if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { Join-Path $env:OneDrive 'ドキュメント\Copilot\Created 1\AI Games\Rocket' }
$dir = Join-Path $root 'img\mis'
$mark = Join-Path $dir '.renamed_v0202'
if (-not (Test-Path $dir)) { Write-Host "NG: $dir がない" -ForegroundColor Red; exit 1 }
if (Test-Path $mark) { Write-Host 'もう 実行ずみ です（なにも しません）' -ForegroundColor Yellow; exit 0 }
# まえの 番号 → いまの 番号
$map = [ordered]@{ '4-7'='4-2'; '4-2'='4-3'; '4-3'='4-4'; '4-4'='4-5'; '4-5'='4-6'; '4-6'='4-7'; '5-2'='5-1'; '5-3'='5-2'; '5-4'='5-3'; '5-5'='5-4' }
$miss = $map.Keys + '5-1' | Where-Object { -not (Test-Path (Join-Path $dir "$_.webp")) }
if ($miss) { Write-Host "NG: 見つからない 絵: $($miss -join ', ')" -ForegroundColor Red; exit 1 }
# つかわなく なった まえの 5-1（▼を さげる。いまの 5-3 に まとめた）は _old へ
$old = Join-Path $dir '_old'; New-Item -ItemType Directory -Force $old | Out-Null
Move-Item (Join-Path $dir '5-1.webp') (Join-Path $old '5-1_v0.17.webp')
# いったん 仮の 名前に してから（名前が ぶつからない ように）
foreach ($k in $map.Keys) { Rename-Item (Join-Path $dir "$k.webp") "tmp_$($map[$k]).webp" }
foreach ($k in $map.Keys) { $n = $map[$k]; Rename-Item (Join-Path $dir "tmp_$n.webp") "$n.webp"; Write-Host "  $k.webp -> $n.webp" }
Set-Content $mark (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Write-Host 'OK: 絵の 名前を そろえました。つぎに v0.20.2 の js/missions.js を コピーしてください。' -ForegroundColor Green
