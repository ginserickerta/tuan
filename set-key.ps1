# วิธีใช้: เปิด PowerShell ที่โฟลเดอร์นี้แล้วรัน  .\set-key.ps1
# สคริปต์จะถามหา API key แบบไม่แสดงบนจอ (ไม่ค้างใน history) แล้วเขียนลง .env.local
# .env.local อยู่ใน .gitignore แล้ว — key ไม่มีทางหลุดขึ้น git

$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '.env.local'

if (Test-Path $envPath) {
    Write-Host "มีไฟล์ .env.local อยู่แล้ว" -ForegroundColor Yellow
    $ans = Read-Host "เขียนทับ? (y/N)"
    if ($ans -ne 'y') { Write-Host "ยกเลิก"; exit 0 }
}

Write-Host ""
Write-Host "วาง API key แล้วกด Enter (ตัวอักษรจะไม่แสดงบนจอ — ปกติ)" -ForegroundColor Cyan
$secure = Read-Host "ANTHROPIC_API_KEY" -AsSecureString
$key = [System.Net.NetworkCredential]::new("", $secure).Password.Trim()

if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Host "ไม่ได้ใส่อะไรมา — ยกเลิก" -ForegroundColor Red; exit 1
}
if (-not $key.StartsWith('sk-ant-')) {
    Write-Host "key ควรขึ้นต้นด้วย sk-ant- (ที่ใส่มาขึ้นต้นด้วย '$($key.Substring(0,[Math]::Min(7,$key.Length)))')" -ForegroundColor Red
    $ans = Read-Host "ใส่ต่อไปเลยไหม? (y/N)"
    if ($ans -ne 'y') { exit 1 }
}

# UTF-8 ไม่มี BOM — BOM จะทำให้ Next.js อ่านชื่อตัวแปรผิด
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envPath, "ANTHROPIC_API_KEY=$key`n", $utf8NoBom)

Write-Host ""
Write-Host "เขียน .env.local เรียบร้อย (key ยาว $($key.Length) ตัว)" -ForegroundColor Green
Write-Host "ขั้นต่อไป: รีสตาร์ต dev server แล้วลองสร้างควิซดู" -ForegroundColor Green
