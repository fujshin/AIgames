# Rocket フォルダの中身を 1つのテキストにまとめる（Copilot が検索1回で全ファイルを読めるようにする）
# 置き場所: <AI Games>\Rocket\tools\make_rocket_bundle.ps1
# 出力   : <AI Games>\Rocket\_bundle\rocket_bundle_rklbzq.txt （実行のたびに上書き）
# 合言葉 : rklbzq （ファイル名と先頭行に入れる。Copilot はこの語で検索する）

$ErrorActionPreference = 'Stop'

# --- Rocket フォルダの場所を決める ---
if ($PSScriptRoot) {
  $root = Split-Path $PSScriptRoot -Parent          # tools の1つ上 = Rocket
} else {
  # 画面に貼り付けて実行したとき
  $root = Join-Path $env:OneDrive 'ドキュメント\Copilot\Created 1\AI Games\Rocket'
}
if (-not (Test-Path (Join-Path $root 'index.html'))) {
  Write-Host "NG: Rocket フォルダが見つかりません: $root" -ForegroundColor Red
  Write-Host "    tools フォルダに置いて、ファイルとして実行してください。"
  exit 1
}

$outDir = Join-Path $root '_bundle'
New-Item -ItemType Directory -Force $outDir | Out-Null
$out = Join-Path $outDir 'rocket_bundle_rklbzq.txt'

# --- 対象：テキストのファイルだけ。_bundle と画像などは除く ---
$exts = '.html', '.css', '.js', '.md', '.txt', '.json', '.ps1'
$files = Get-ChildItem $root -Recurse -File |
  Where-Object {
    $exts -contains $_.Extension.ToLower() -and
    $_.FullName -notmatch '\\_bundle\\' -and
    $_.FullName -notmatch '\\\.git\\'
  } | Sort-Object FullName

$enc = New-Object System.Text.UTF8Encoding($false)   # BOMなし UTF-8
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("rklbzq ROCKET LAB BUNDLE")
[void]$sb.AppendLine("created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sb.AppendLine("root: Rocket")
[void]$sb.AppendLine("files: $($files.Count)")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## INDEX (path / lines / bytes / modified)")
$bodies = @()
foreach ($f in $files) {
  $rel = $f.FullName.Substring($root.Length).TrimStart('\').Replace('\', '/')
  $text = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
  $text = $text -replace "`r`n", "`n"                  # 改行を LF にそろえる
  $text = $text.TrimStart([char]0xFEFF)                # 先頭の BOM を取る
  $lines = ($text -split "`n").Count
  [void]$sb.AppendLine("- $rel / $lines / $($f.Length) / $($f.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))")
  $bodies += ,@($rel, $text)
}
[void]$sb.AppendLine("")
foreach ($b in $bodies) {
  [void]$sb.AppendLine("===FILE: $($b[0])===")
  [void]$sb.Append($b[1])
  if (-not $b[1].EndsWith("`n")) { [void]$sb.AppendLine("") }
  [void]$sb.AppendLine("===END: $($b[0])===")
}
[System.IO.File]::WriteAllText($out, $sb.ToString().Replace("`r`n", "`n"), $enc)
Write-Host "OK: $($files.Count) files -> $out" -ForegroundColor Green
