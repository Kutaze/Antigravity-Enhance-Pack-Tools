process.noAsar = true;

const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('       Antigravity 还原官方纯净版工具               ');
console.log('====================================================\n');

function findInstallDir() {
    if (process.argv[2] && fs.existsSync(path.join(process.argv[2], 'resources', 'app.asar'))) {
        return process.argv[2];
    }
    const candidates = [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'antigravity'),
        path.join(process.env.ProgramFiles || '', 'Antigravity'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'Antigravity'),
        'C:\\Users\\Lynan\\AppData\\Local\\Programs\\antigravity'
    ];
    for (const c of candidates) {
        if (c && fs.existsSync(path.join(c, 'resources', 'app.asar'))) {
            return c;
        }
    }
    return null;
}

const installDir = findInstallDir();
if (!installDir) {
    console.error('[错误] 未能定位 Antigravity 安装目录！');
    process.exit(1);
}

const resourcesDir = path.join(installDir, 'resources');
const asarPath = path.join(resourcesDir, 'app.asar');
const backupPath = path.join(resourcesDir, 'app.asar.bak');

if (!fs.existsSync(backupPath)) {
    console.log('[提示] 未找到官方备份文件 (resources/app.asar.bak)。');
    console.log('可能当前已经是官方原版，或从未通过本工具安装过补丁。');
    process.exit(0);
}

try {
    console.log('[1/2] 正在从备份恢复官方原生 app.asar...');
    fs.copyFileSync(backupPath, asarPath);
    console.log('      恢复完成: ' + asarPath);

    // Prompt user whether to keep or remove backup, or keep it safe
    console.log('\n[2/2] 官方原生内核已成功还原！');
    console.log('====================================================');
    console.log('   ✔ 客户端已恢复至官方默认英文状态与原生 UI       ');
    console.log('====================================================\n');
    process.exit(0);
} catch (err) {
    console.error('[还原失败]', err.message);
    process.exit(1);
}
