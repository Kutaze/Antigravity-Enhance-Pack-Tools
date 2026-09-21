process.noAsar = true;

const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('   Antigravity 深度汉化与原生 UI 交互增强扩展补丁   ');
console.log('====================================================\n');

// 1. Resolve dependencies
const asarLibPath = path.join(__dirname, 'core', 'node_modules', '@electron', 'asar');
if (!fs.existsSync(asarLibPath)) {
    console.error('[错误] 未在 core/node_modules 下找到 asar 依赖，请确认安装包完整。');
    process.exit(1);
}
const asar = require(asarLibPath);

const coreRunnerPath = path.join(__dirname, 'core', 'i18n_runner.js');
const coreDataPath = path.join(__dirname, 'core', 'i18n_data.json');

if (!fs.existsSync(coreRunnerPath) || !fs.existsSync(coreDataPath)) {
    console.error('[错误] 核心资源文件 (i18n_runner.js / i18n_data.json) 缺失！');
    process.exit(1);
}

// 2. Locate Antigravity Installation
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
    console.error('[错误] 未能自动定位 Antigravity 安装目录！');
    console.error('请通过命令行传入 Antigravity 安装根目录，例如:');
    console.error('  patcher.exe "C:\\Users\\<用户名>\\AppData\\Local\\Programs\\antigravity"');
    process.exit(1);
}

console.log('[1/6] 成功定位 Antigravity 安装目录:');
console.log('      ' + installDir);

const resourcesDir = path.join(installDir, 'resources');
const asarPath = path.join(resourcesDir, 'app.asar');
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
            console.log('\n[2/6] 检测到官方备份 app.asar.bak，跳过备份。');
        }

        // 4. Clean & Extract asar into sandbox
        console.log('\n[3/6] 正在解包 app.asar 核心资源...');
        if (fs.existsSync(tempSandbox)) {
            fs.rmSync(tempSandbox, { recursive: true, force: true });
        }
        process.noAsar = false;
        asar.extractAll(asarPath, tempSandbox);
        process.noAsar = true;

        const distDir = path.join(tempSandbox, 'dist');
        const targetRunner = path.join(distDir, 'i18n_runner.js');
        const targetData = path.join(distDir, 'i18n_data.json');
        const utilsJs = path.join(distDir, 'utils.js');
        const mainJs = path.join(distDir, 'main.js');

        if (!fs.existsSync(distDir) || !fs.existsSync(utilsJs) || !fs.existsSync(mainJs)) {
            throw new Error('解包后未在 dist/ 下找到 utils.js 或 main.js，客户端版本可能不兼容！');
        }

        // 5. Copy enhancement scripts into dist & fusion logo
        console.log('\n[4/6] 正在植入深度汉化、Antigravity & Gemini 聚变 Logo 与原生 UI 增强引擎...');
        fs.copyFileSync(coreRunnerPath, targetRunner);
        fs.copyFileSync(coreDataPath, targetData);

        const coreIconPng = path.join(__dirname, 'core', 'icon.png');
        const targetIconPng = path.join(tempSandbox, 'icon.png');
        if (fs.existsSync(coreIconPng)) {
            fs.copyFileSync(coreIconPng, targetIconPng);
            console.log('      已替换客户端原生窗口与任务栏 Logo (Antigravity & Gemini 聚变版)');
        }

        const coreAppIco = path.join(__dirname, 'core', 'app.ico');
        const targetAppIco = path.join(installDir, 'app.ico');
        if (fs.existsSync(coreAppIco)) {
            try {
                fs.copyFileSync(coreAppIco, targetAppIco);
            } catch(e) {}
        }

        // 6. Patch utils.js
        let utilsContent = fs.readFileSync(utilsJs, 'utf8');

        // Remove old injectAntigravityI18n if exists
        const topFuncRegex = /const injectAntigravityI18n =[\s\S]*?exports\.injectAntigravityI18n = injectAntigravityI18n;\s*/;
        utilsContent = utilsContent.replace(topFuncRegex, '');

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
            const script = '(function(){\n try {\n window.__ANTIGRAVITY_I18N_DATA__ = ' + dataStr + ';\n' + runnerCode + '\n } catch(e){ console.error("[Antigravity i18n] Error:", e); }\n})();';
            wc.executeJavaScript(script).catch(() => {});
        }
    } catch (e) {
        console.error('[Antigravity i18n] Injection error:', e);
    }
};
exports.injectAntigravityI18n = injectAntigravityI18n;
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

        // 7. Patch main.js
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
        fs.copyFileSync(tempOutAsar, asarPath);

        // Update Desktop Shortcut icon if exists
        try {
            const cp = require('child_process');
            const psCmd = `powershell -NoProfile -Command "$wsh=New-Object -ComObject WScript.Shell; @([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Antigravity.lnk'), 'D:\\\\desk\\\\Antigravity.lnk') | ForEach-Object { if(Test-Path $_){ $sc=$wsh.CreateShortcut($_); $sc.IconLocation='${targetAppIco.replace(/\\/g, '\\\\')},0'; $sc.Save(); } }"`;
            cp.execSync(psCmd, { stdio: 'ignore' });
        } catch(e) {}

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
        console.log('  ✔ Antigravity × Google Gemini 品牌聚变 Logo (任务栏/视窗/侧边栏/桌面图标)');
        console.log('  ✔ 侧边栏实时额度面板 (Gemini / Claude 多周期额度与刷新)');
        console.log('  ✔ 个人中心与淡色极简 PRO 徽标');
        console.log('  ✔ 底部紧凑设置按钮交互对齐');
        console.log('  ✔ 真实上下文用量监测、精准分段占比条与居中压缩功能');
        console.log('  ✔ 模型思考能力 4 挡动态滑块 (最高挡专属紫粉渐变，动静态模型绑定)');
        console.log('  ✔ 自定义插件中心扩展');
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
