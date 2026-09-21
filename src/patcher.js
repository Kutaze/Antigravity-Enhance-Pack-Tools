process.noAsar = true;

const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('   Antigravity 深度汉化与原生 UI 交互增强扩展补丁   ');
console.log('====================================================\n');

// 1. Resolve dependencies
const coreDir = fs.existsSync(path.join(__dirname, 'core'))
    ? path.join(__dirname, 'core')
    : path.join(__dirname, '..', 'core');

const asarLibPath = path.join(coreDir, 'node_modules', '@electron', 'asar');
if (!fs.existsSync(asarLibPath)) {
    console.error('[错误] 未在 core/node_modules 下找到 asar 依赖，请确认安装包完整。');
    process.exit(1);
}
const asar = require(asarLibPath);

const coreRunnerPath = path.join(coreDir, 'i18n_runner.js');
const coreDataPath = path.join(coreDir, 'i18n_data.json');

if (!fs.existsSync(coreRunnerPath) || !fs.existsSync(coreDataPath)) {
    console.error('[错误] 核心资源文件 (i18n_runner.js / i18n_data.json) 缺失！');
    process.exit(1);
}

// 2. Locate Antigravity Installation (Cross-Platform)
function findAsarLocation() {
    // Check command line arg
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
    console.error('[错误] 未能自动定位 Antigravity 安装目录！');
    console.error('请通过命令行传入 Antigravity 安装根目录或 app.asar 路径，例如:');
    if (process.platform === 'darwin') {
        console.error('  node patcher.js "/Applications/Antigravity.app"');
    } else if (process.platform === 'linux') {
        console.error('  node patcher.js "/opt/Antigravity"');
    } else {
        console.error('  patcher.exe "C:\\Users\\<用户名>\\AppData\\Local\\Programs\\antigravity"');
    }
    process.exit(1);
}

const { asarPath, resourcesDir, installDir } = loc;
console.log('[1/6] 成功定位 Antigravity 核心路径:');
console.log('      ' + asarPath);

const backupPath = path.join(resourcesDir, 'app.asar.bak');
const tempSandbox = path.join(__dirname, '.temp_patch_sandbox');
const tempOutAsar = path.join(__dirname, '.temp_patched.asar');

(async () => {
    try {
        // 3. Backup official app.asar if not already backed up
        if (!fs.existsSync(backupPath)) {
            console.log('\n[2/6] 首次安装，正在备份官方原生 app.asar...');
            fs.copyFileSync(asarPath, backupPath);
            console.log('      官方备份已保存至: app.asar.bak');
        } else {
            console.log('\n[2/6] 检测到官方备份 app.asar.bak，正在基于官方底包进行注入...');
        }

        // 4. Clean & Extract asar into sandbox
        console.log('\n[3/6] 正在解包 app.asar 核心资源...');
        if (fs.existsSync(tempSandbox)) {
            fs.rmSync(tempSandbox, { recursive: true, force: true });
        }
        process.noAsar = false;
        // Always extract from official backup to avoid layering patches on top of each other
        if (fs.existsSync(backupPath)) {
            try {
                asar.extractAll(backupPath, tempSandbox);
            } catch(e) {
                // bak.unpacked may be missing; fall back to live asar
                if (fs.existsSync(tempSandbox)) fs.rmSync(tempSandbox, { recursive: true, force: true });
                asar.extractAll(asarPath, tempSandbox);
            }
            // Copy the live unpacked dir into sandbox to supplement any missing native modules
            const liveUnpacked = asarPath + '.unpacked';
            const sandboxUnpacked = path.join(tempSandbox, 'node_modules');
            if (fs.existsSync(liveUnpacked)) {
                const copyDirSync = (src, dst) => {
                    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
                    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
                        const s = path.join(src, entry.name), d = path.join(dst, entry.name);
                        if (entry.isDirectory()) copyDirSync(s, d);
                        else if (!fs.existsSync(d)) try { fs.copyFileSync(s, d); } catch(e) {}
                    }
                };
                // liveUnpacked contains node_modules subfolders - merge into sandbox node_modules
                try {
                    const nodeModsInUnpacked = path.join(liveUnpacked, 'node_modules');
                    if (fs.existsSync(nodeModsInUnpacked)) copyDirSync(nodeModsInUnpacked, sandboxUnpacked);
                    else copyDirSync(liveUnpacked, path.join(tempSandbox, 'unpacked_modules'));
                } catch(e) {}
            }
        } else {
            asar.extractAll(asarPath, tempSandbox);
        }
        process.noAsar = true;

        // Ensure client official icon is always preserved (never replaced by custom project logo)
        if (fs.existsSync(backupPath)) {
            try {
                const officialIconBuf = asar.extractFile(backupPath, 'icon.png');
                if (officialIconBuf && officialIconBuf.length > 0) {
                    fs.writeFileSync(path.join(tempSandbox, 'icon.png'), officialIconBuf);
                }
            } catch (e) {}
        }

        const distDir = path.join(tempSandbox, 'dist');
        const targetRunner = path.join(distDir, 'i18n_runner.js');
        const targetData = path.join(distDir, 'i18n_data.json');
        const utilsJs = path.join(distDir, 'utils.js');
        const mainJs = path.join(distDir, 'main.js');

        if (!fs.existsSync(distDir) || !fs.existsSync(utilsJs) || !fs.existsSync(mainJs)) {
            throw new Error('解包后未在 dist/ 下找到 utils.js 或 main.js，客户端版本可能不兼容！');
        }

        // 5. Copy enhancement scripts into dist (preserving official client logo)
        console.log('\n[4/6] 正在植入深度汉化与原生 UI 增强引擎...');
        fs.copyFileSync(coreRunnerPath, targetRunner);
        fs.copyFileSync(coreDataPath, targetData);

        // 6. Patch utils.js
        let utilsContent = fs.readFileSync(utilsJs, 'utf8');

        // Remove ALL previous AGY injection blocks to prevent stacking (use global replace)
        const topFuncRegex = /const injectAntigravityI18n =[\s\S]*?exports\.injectAntigravityI18n = injectAntigravityI18n;\s*/g;
        utilsContent = utilsContent.replace(topFuncRegex, '');
        // Also remove the IPC bridge block if present (global replace to catch all copies)
        const ipcBridgeRegex = /\/\/ Antigravity Native Screenshot[\s\S]*?} catch\(e\) \{\}\s*/g;
        utilsContent = utilsContent.replace(ipcBridgeRegex, '');


        const safeInjectFn = `
const injectAntigravityI18n = (wc) => {
    try {
        if (!wc || typeof wc.executeJavaScript !== 'function' || (typeof wc.isDestroyed === 'function' && wc.isDestroyed())) return;
        const _fs = require('fs');
        const _path = require('path');
        const runnerPath = _path.join(__dirname, 'i18n_runner.js');
        const dataPath = _path.join(__dirname, 'i18n_data.json');
        if (_fs.existsSync(runnerPath) && _fs.existsSync(dataPath)) {
            const dataStr = _fs.readFileSync(dataPath, 'utf8');
            const runnerCode = _fs.readFileSync(runnerPath, 'utf8');
            wc.executeJavaScript('window.__ANTIGRAVITY_I18N_DATA__ = ' + dataStr + ';' + runnerCode).catch(() => {});
        }
    } catch (e) {
        console.error('[Antigravity i18n] Injection error:', e);
    }
};
exports.injectAntigravityI18n = injectAntigravityI18n;

// Antigravity Native Screenshot & Clipboard Bridge
try {
    const { ipcMain: _ipc, clipboard: _clip } = require('electron');
    const { exec: _exec } = require('child_process');
    if (!global.__agy_screenshot_bound) {
        global.__agy_screenshot_bound = true;
        _ipc.handle('antigravity:screenshot', async () => {
            try {
                if (process.platform === 'win32') {
                    _exec('start ms-screenclip:');
                } else if (process.platform === 'darwin') {
                    _exec('screencapture -i -c');
                } else {
                    _exec('gnome-screenshot -a -c || flameshot gui');
                }
                return { success: true };
            } catch(err) {
                return { success: false, error: err.message };
            }
        });
        _ipc.handle('antigravity:clipboard-image', async () => {
            try {
                const img = _clip.readImage();
                if (!img || img.isEmpty()) return null;
                return img.toDataURL();
            } catch(err) {
                return null;
            }
        });
        _ipc.handle('antigravity:get-skills', async () => {
            try {
                const _os = require('os');
                const home = _os.homedir();
                const skillDirs = [
                    _path.join(home, '.gemini', 'config', 'skills'),
                    _path.join(home, '.gemini', 'antigravity', 'builtin', 'skills')
                ];
                const pluginBase = _path.join(home, '.gemini', 'config', 'plugins');
                if (_fs.existsSync(pluginBase)) {
                    for (const p of _fs.readdirSync(pluginBase)) {
                        const pSkills = _path.join(pluginBase, p, 'skills');
                        if (_fs.existsSync(pSkills)) skillDirs.push(pSkills);
                    }
                }
                const result = [];
                const seen = new Set();
                for (const d of skillDirs) {
                    if (!_fs.existsSync(d)) continue;
                    for (const f of _fs.readdirSync(d)) {
                        const skillPath = _path.join(d, f, 'SKILL.md');
                        if (_fs.existsSync(skillPath) && !seen.has(f)) {
                            seen.add(f);
                            const content = _fs.readFileSync(skillPath, 'utf8');
                            let desc = '';
                            const lines = content.split(String.fromCharCode(10));
                            for (let li = 0; li < lines.length; li++) {
                                const tr = lines[li].trim();
                                if (tr.toLowerCase().indexOf('description:') === 0) {
                                    desc = tr.substring(12).trim();
                                    if ((desc.startsWith('"') && desc.endsWith('"')) || (desc.startsWith("'") && desc.endsWith("'"))) {
                                        desc = desc.substring(1, desc.length - 1).trim();
                                    }
                                    break;
                                }
                            }
                            result.push({ id: f, name: f, description: desc });
                        }
                    }
                }
                return result;
            } catch(err) {
                return [];
            }
        });
    }
} catch(e) {}
`;

        const exportMarker = 'exports.setupNodeWrapper = setupNodeWrapper;';
        if (utilsContent.includes(exportMarker)) {
            utilsContent = utilsContent.replace(exportMarker, exportMarker + '\n' + safeInjectFn);
        } else {
            utilsContent = safeInjectFn + '\n' + utilsContent;
        }

        if (!utilsContent.includes("win.webContents.on('dom-ready'")) {
            const createWinNeedle = "win.webContents.setWindowOpenHandler";
            if (utilsContent.includes(createWinNeedle)) {
                const winListeners = `
    win.webContents.on('dom-ready', () => injectAntigravityI18n(win.webContents));
    win.webContents.on('did-finish-load', () => injectAntigravityI18n(win.webContents));
    win.webContents.on('did-navigate-in-page', () => injectAntigravityI18n(win.webContents));
    `;
                utilsContent = utilsContent.replace(createWinNeedle, winListeners + '\n    ' + createWinNeedle);
            }
        }
        fs.writeFileSync(utilsJs, utilsContent, 'utf8');

        // 7. Patch preload.js to expose screenshot bridge & skills bridge
        const preloadJs = path.join(distDir, 'preload.js');
        if (fs.existsSync(preloadJs)) {
            let preloadContent = fs.readFileSync(preloadJs, 'utf8');
            if (preloadContent.includes('takeScreenshot:') && !preloadContent.includes('getSkills:')) {
                preloadContent = preloadContent.replace(
                    "getClipboardImage: () => electron_1.ipcRenderer.invoke('antigravity:clipboard-image'),",
                    "getClipboardImage: () => electron_1.ipcRenderer.invoke('antigravity:clipboard-image'),\n    getSkills: () => electron_1.ipcRenderer.invoke('antigravity:get-skills'),"
                );
                fs.writeFileSync(preloadJs, preloadContent, 'utf8');
            } else if (!preloadContent.includes('takeScreenshot:')) {
                const targetNeedle = "revealInFilePicker: (path) => electron_1.ipcRenderer.invoke('shell:reveal-in-file-picker', path),";
                if (preloadContent.includes(targetNeedle)) {
                    const extraApis = `
    takeScreenshot: () => electron_1.ipcRenderer.invoke('antigravity:screenshot'),
    getClipboardImage: () => electron_1.ipcRenderer.invoke('antigravity:clipboard-image'),
    getSkills: () => electron_1.ipcRenderer.invoke('antigravity:get-skills'),`;
                    preloadContent = preloadContent.replace(targetNeedle, targetNeedle + extraApis);
                    fs.writeFileSync(preloadJs, preloadContent, 'utf8');
                }
            }
        }

        // 8. Patch main.js
        let mainContent = fs.readFileSync(mainJs, 'utf8');
        if (!mainContent.includes("web-contents-created")) {
            const whenReadyNeedle = "electron_1.app\n    .whenReady()\n    .then(async () => {";
            const altWhenReadyNeedle = "electron_1.app.whenReady().then(async () => {";
            const mainHook = `
    // Antigravity global WebContents lifecycle injection hook
    electron_1.app.on('web-contents-created', (_event, wc) => {
        wc.on('dom-ready', () => { if (utils_1.injectAntigravityI18n) (0, utils_1.injectAntigravityI18n)(wc); });
        wc.on('did-finish-load', () => { if (utils_1.injectAntigravityI18n) (0, utils_1.injectAntigravityI18n)(wc); });
        wc.on('did-navigate-in-page', () => { if (utils_1.injectAntigravityI18n) (0, utils_1.injectAntigravityI18n)(wc); });
    });
`;
            if (mainContent.includes(whenReadyNeedle)) {
                mainContent = mainContent.replace(whenReadyNeedle, whenReadyNeedle + mainHook);
            } else if (mainContent.includes(altWhenReadyNeedle)) {
                mainContent = mainContent.replace(altWhenReadyNeedle, altWhenReadyNeedle + mainHook);
            }
            fs.writeFileSync(mainJs, mainContent, 'utf8');
        }

        // 8. Re-pack asar
        console.log('\n[5/6] 正在重新封包 app.asar...');
        if (fs.existsSync(tempOutAsar)) {
            fs.unlinkSync(tempOutAsar);
        }
        process.noAsar = false;
        await asar.createPackageWithOptions(tempSandbox, tempOutAsar, {
            unpackDir: 'node_modules/chrome-devtools-mcp'
        });
        process.noAsar = true;

        const newSize = fs.statSync(tempOutAsar).size;
        if (newSize < 1000000) {
            throw new Error('打包生成的 asar 文件体积异常 (' + newSize + ' bytes)');
        }

        // 9. Deploy to resources/app.asar
        console.log('\n[6/6] 正在部署增强包至客户端目录...');
        // Use rename-swap to bypass Windows file locking (Electron may have app.asar open)
        const oldAsarTmp = asarPath + '.old_deploy';
        try { if (fs.existsSync(oldAsarTmp)) fs.unlinkSync(oldAsarTmp); } catch(e) {}
        try {
            // Try atomic rename swap: rename old -> .old_deploy, rename new -> app.asar
            fs.renameSync(asarPath, oldAsarTmp);
            fs.renameSync(tempOutAsar, asarPath);
            try { fs.unlinkSync(oldAsarTmp); } catch(e) {}
        } catch (renameErr) {
            // Fallback: direct copy
            try { if (fs.existsSync(oldAsarTmp)) fs.renameSync(oldAsarTmp, asarPath); } catch(e) {}
            fs.copyFileSync(tempOutAsar, asarPath);
        }

        // 10. Cleanup
        try {
            if (fs.existsSync(tempSandbox)) fs.rmSync(tempSandbox, { recursive: true, force: true });
            if (fs.existsSync(tempOutAsar)) fs.unlinkSync(tempOutAsar);
        } catch(e) {}

        console.log('\n====================================================');
        console.log('   🎉 恭喜！Antigravity 增强与汉化扩展包安装成功！  ');
        console.log('====================================================');
        console.log('包含功能:');
        console.log('  ✔ 全界面深度汉化与文本对照覆盖');
        console.log('  ✔ 保留官方原生客户端视窗与系统托盘 Logo');
        console.log('  ✔ 侧边栏实时额度面板 (Gemini / Claude 多周期额度与刷新)');
        console.log('  ✔ 个人中心与淡色极简 PRO 徽标');
        console.log('  ✔ 底部紧凑设置按钮交互对齐');
        console.log('  ✔ 真实上下文用量监测、精准分段占比条与居中压缩功能');
        console.log('  ✔ 模型思考能力 4 挡动态滑块 (最高挡专属紫粉渐变，动静态模型绑定)');
        console.log('  ✔ 自定义插件中心扩展');
        console.log('  ✔ 聊天输入框原生截图工具唤起与剪贴板图像自动填入');
        console.log('  ✔ 防死循环与防卡死主控协调器 (Master Coordinator)');
        console.log('====================================================\n');
        process.exit(0);

    } catch (err) {
        console.error('\n[安装失败]', err.message);
        try {
            if (fs.existsSync(tempSandbox)) fs.rmSync(tempSandbox, { recursive: true, force: true });
            if (fs.existsSync(tempOutAsar)) fs.unlinkSync(tempOutAsar);
        } catch(e) {}
        process.exit(1);
    }
})();
