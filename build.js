const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = __dirname;
console.log('=== Step 1: Stage files for payload.zip ===');
const staging = path.join(repoRoot, '.payload_staging');
if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

fs.copyFileSync(path.join(repoRoot, 'src', 'patcher.js'), path.join(staging, 'patcher.js'));
fs.copyFileSync(path.join(repoRoot, 'src', 'unpatcher.js'), path.join(staging, 'unpatcher.js'));
fs.copyFileSync(path.join(repoRoot, 'README.md'), path.join(staging, 'README.md'));

function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const sPath = path.join(src, entry.name);
        const dPath = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDirSync(sPath, dPath);
        else fs.copyFileSync(sPath, dPath);
    }
}
copyDirSync(path.join(repoRoot, 'core'), path.join(staging, 'core'));

const payloadZip = path.join(repoRoot, '.payload.zip');
if (fs.existsSync(payloadZip)) fs.unlinkSync(payloadZip);

execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${staging.replace(/\\/g, '\\\\')}', '${payloadZip.replace(/\\/g, '\\\\')}')"`);
console.log('payload.zip created, size:', fs.statSync(payloadZip).size);

console.log('=== Step 2: Compile modern GUI installer .exe with csc.exe ===');
const csc = 'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe';
const installerCs = path.join(repoRoot, 'src', 'InstallerApp.cs');
const icoPath = path.join(repoRoot, 'core', 'app.ico');
const iconPng = path.join(repoRoot, 'core', 'icon.png');

const targets = [
    path.join(repoRoot, 'Antigravity增强与汉化工具.exe')
];

for (const t of targets) {
    if (fs.existsSync(t)) {
        try { fs.unlinkSync(t); } catch(e) {}
    }
    const cscCmd = `"${csc}" /target:winexe /optimize+ /platform:anycpu /r:System.Xaml.dll /r:System.IO.Compression.FileSystem.dll /r:System.IO.Compression.dll /r:"C:/Windows/Microsoft.NET/Framework64/v4.0.30319/WPF/PresentationCore.dll" /r:"C:/Windows/Microsoft.NET/Framework64/v4.0.30319/WPF/PresentationFramework.dll" /r:"C:/Windows/Microsoft.NET/Framework64/v4.0.30319/WPF/WindowsBase.dll" /win32icon:"${icoPath}" /resource:"${payloadZip}",payload.zip /resource:"${iconPng}",icon.png /out:"${t}" "${installerCs}"`;
    try {
        execSync(cscCmd);
        console.log('Compiled GUI Installer:', t, 'Size:', fs.statSync(t).size);
    } catch(err) {
        console.error('CSC Error for ' + t + ':\n', err.stdout ? err.stdout.toString() : err.message);
        throw err;
    }
}

// Clean up staging and temp zip
try { fs.rmSync(staging, { recursive: true, force: true }); } catch(e) {}
try { if (fs.existsSync(payloadZip)) fs.unlinkSync(payloadZip); } catch(e) {}

console.log('✔ Portable build completed successfully!');
