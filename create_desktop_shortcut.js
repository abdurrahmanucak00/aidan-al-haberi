const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const targetExe = 'C:\\Users\\Abdurrahman\\Desktop\\Projelerim\\Kendime Projeler\\DevRadar-Setup\\DevRadar\\dist\\win-unpacked\\AIdanAlHaberi.exe'
const workDir = 'C:\\Users\\Abdurrahman\\Desktop\\Projelerim\\Kendime Projeler\\DevRadar-Setup\\DevRadar\\dist\\win-unpacked'
const iconPath = 'C:\\Users\\Abdurrahman\\Desktop\\Projelerim\\Kendime Projeler\\DevRadar-Setup\\DevRadar\\build\\icon.ico'

const psCode = `
$wsh = New-Object -ComObject WScript.Shell

$s1 = $wsh.CreateShortcut("C:\\Users\\Abdurrahman\\Desktop\\AIdan Al Haberi.lnk")
$s1.TargetPath = "${targetExe.replace(/\\/g, '\\\\')}"
$s1.WorkingDirectory = "${workDir.replace(/\\/g, '\\\\')}"
$s1.IconLocation = "${iconPath.replace(/\\/g, '\\\\')},0"
$s1.Description = "AI'dan Al Haberi"
$s1.Save()

$s2 = $wsh.CreateShortcut("C:\\Users\\Public\\Desktop\\AIdan Al Haberi.lnk")
$s2.TargetPath = "${targetExe.replace(/\\/g, '\\\\')}"
$s2.WorkingDirectory = "${workDir.replace(/\\/g, '\\\\')}"
$s2.IconLocation = "${iconPath.replace(/\\/g, '\\\\')},0"
$s2.Save()

Write-Host "Created successfully!"
`

fs.writeFileSync('temp_sc.ps1', psCode, 'utf8')
try {
  execSync('powershell -ExecutionPolicy Bypass -File temp_sc.ps1', { stdio: 'inherit' })
} finally {
  if (fs.existsSync('temp_sc.ps1')) {
    fs.unlinkSync('temp_sc.ps1')
  }
}
