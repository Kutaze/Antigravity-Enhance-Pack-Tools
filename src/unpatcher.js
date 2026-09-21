process.noAsar = true;

const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('       Antigravity 还原官方纯净版工具               ');
console.log('====================================================\n');

function findAsarLocation() {
    if (process.argv[2]) {
        const arg = path.resolve(process.argv[2]);
        if (fs.existsSync(arg) && fs.statSync(arg).isFile() && arg.endsWith('app.asar')) {
            return { asarPath: arg, resourcesDir: path.dirname(arg), installDir: path.dirname(path.dirname(arg)) };
        }
        if (fs.existsSync(path.join(arg, 'app.asar'))) {
            return { asarPath: path.join(arg, 'app.asar'), resourcesDir: arg, installDir: path.dirname(arg) };
        }
        if (fs.existsSync(path.join(arg, 'resources', 'app.asar'))) {
            return { asarPath: path.join(arg, 'resources', 'app.asar'), resourcesDir: path.join(arg, 'resources'), installDir: arg };
        }
        if (fs.existsSync(path.join(arg, 'Contents', 'Resources', 'app.asar'))) {
            return { asarPath: path.join(arg, 'Contents', 'Resources', 'app.asar'), resourcesDir: path.join(arg, 'Contents', 'Resources'), installDir: arg };
        }
    }

    const isMac = process.platform === 'darwin';
    const isLinux = process.platform === 'linux';
    const home = process.env.HOME || '';

    const candidates = [];
    if (isMac) {
        candidates.push(
            '/Applications/Antigravity.app/Contents/Resources',
            path.join(home, 'Applications/Antigravity.app/Contents/Resources'),
            '/Applications/Google Antigravity.app/Contents/Resources',
            path.join(home, 'Applications/Google Antigravity.app/Contents/Resources')
        );
    } else if (isLinux) {
        candidates.push(
            '/opt/Antigravity/resources',
            '/opt/antigravity/resources',
            '/usr/share/antigravity/resources',
            '/usr/lib/antigravity/resources',
            path.join(home, '.local/share/antigravity/resources')
        );
    } else {
        // Windows
        candidates.push(
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'antigravity', 'resources'),
            path.join(process.env.ProgramFiles || '', 'Antigravity', 'resources'),
            path.join(process.env['ProgramFiles(x86)'] || '', 'Antigravity', 'resources')
        );
    }

    for (const c of candidates) {
        if (c && fs.existsSync(path.join(c, 'app.asar'))) {
            return {
                asarPath: path.join(c, 'app.asar'),
                resourcesDir: c,
                installDir: isMac ? path.dirname(path.dirname(c)) : path.dirname(c)
            };
        }
    }
    return null;
}

const loc = findAsarLocation();
if (!loc) {
    console.error('[错误] 未能定位 Antigravity 安装目录！');
    process.exit(1);
}

const { asarPath, resourcesDir, installDir } = loc;
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
