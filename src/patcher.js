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
        const _os = require('os');
        const runnerPath = _path.join(__dirname, 'i18n_runner.js');
        const dataPath = _path.join(__dirname, 'i18n_data.json');
        if (_fs.existsSync(runnerPath) && _fs.existsSync(dataPath)) {
            const dataStr = _fs.readFileSync(dataPath, 'utf8');
            const runnerCode = _fs.readFileSync(runnerPath, 'utf8');

            const homeDir = _os.homedir();
            const metaFile = _path.join(homeDir, '.gemini', 'account_profiles', 'profiles_meta.json');
            const activeAccFile = _path.join(homeDir, '.gemini', 'google_accounts.json');
            let bootstrap = { active: '', profiles: [] };
            if (_fs.existsSync(metaFile)) {
                try { bootstrap = JSON.parse(_fs.readFileSync(metaFile, 'utf8')) || { active: '', profiles: [] }; } catch(e) {}
            }
            if (!Array.isArray(bootstrap.profiles)) bootstrap.profiles = [];
            if (_fs.existsSync(activeAccFile)) {
                try {
                    const aObj = JSON.parse(_fs.readFileSync(activeAccFile, 'utf8'));
                    if (aObj && aObj.active) bootstrap.active = aObj.active;
                } catch(e) {}
            }

            const headerJs = 'window.__ANTIGRAVITY_I18N_DATA__ = ' + dataStr + '; window.__AGY_BOOTSTRAP_PROFILES__ = ' + JSON.stringify(bootstrap) + ';';
            wc.executeJavaScript(headerJs + runnerCode).catch(() => {});
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
    const _fs = require('fs');
    const _path = require('path');
    const _os = require('os');
    const home = _os.homedir();
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
        _ipc.handle('antigravity:open-path', async (_e, targetPath) => {
            try {
                const { shell: _shell } = require('electron');
                if (targetPath) {
                    let p = targetPath;
                    if (typeof p === 'string' && (p.startsWith('http://') || p.startsWith('https://'))) {
                        try {
                            await _shell.openExternal(p);
                            return { success: true };
                        } catch(shellErr) {
                            const { exec } = require('child_process');
                            exec('start "" "' + p.replace(/"/g, '%22') + '"');
                            return { success: true };
                        }
                    }
                    if (p.indexOf('file:///') === 0) {
                        try {
                            const { fileURLToPath: _f2p } = require('url');
                            p = _f2p(p);
                        } catch(e) {}
                    }
                    if (_fs.existsSync(p)) {
                        await _shell.openPath(p);
                        return { success: true };
                    }
                    return { success: false, error: 'Path not found' };
                }
                return { success: false, error: 'Empty path' };
            } catch(err) {
                return { success: false, error: err.message };
            }
        });

        _ipc.handle('antigravity:open-external', async (_e, targetUrl) => {
            try {
                const { shell: _shell } = require('electron');
                if (targetUrl) {
                    try {
                        await _shell.openExternal(targetUrl);
                        return { success: true };
                    } catch(shellErr) {
                        const { exec } = require('child_process');
                        exec('start "" "' + targetUrl.replace(/"/g, '%22') + '"');
                        return { success: true };
                    }
                }
                return { success: false, error: 'Empty URL' };
            } catch(err) {
                return { success: false, error: err.message };
            }
        });
        _ipc.handle('antigravity:get-skills', async () => {
            try {
                const _os = require('os');
                const home = _os.homedir();
                const skillSources = [
                    { dir: _path.join(home, '.gemini', 'config', 'skills'), type: 'custom', label: '用户配置' },
                    { dir: _path.join(home, '.gemini', 'antigravity', 'builtin', 'skills'), type: 'builtin', label: '官方自带' }
                ];
                const pluginBase = _path.join(home, '.gemini', 'config', 'plugins');
                if (_fs.existsSync(pluginBase)) {
                    for (const p of _fs.readdirSync(pluginBase)) {
                        const pSkills = _path.join(pluginBase, p, 'skills');
                        if (_fs.existsSync(pSkills)) skillSources.push({ dir: pSkills, type: 'plugin', label: '插件扩展' });
                    }
                }
                const result = [];
                const seen = new Set();
                for (const srcItem of skillSources) {
                    const d = srcItem.dir;
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
                            result.push({
                                id: f,
                                name: f,
                                description: desc,
                                dir: _path.join(d, f),
                                type: srcItem.type,
                                typeLabel: srcItem.label
                            });
                        }
                    }
                }
                return result;
            } catch(err) {
                return [];
            }
        });

        // Antigravity Multi-Account Profile & Quota Switcher IPC Handlers
        const _profilesDir = _path.join(home, '.gemini', 'account_profiles');
        const _metaFile = _path.join(_profilesDir, 'profiles_meta.json');
        const _activeAccFile = _path.join(home, '.gemini', 'google_accounts.json');
        const _activeOauthFile = _path.join(home, '.gemini', 'oauth_creds.json');
        const _credPs1File = _path.join(_profilesDir, 'cred_manager.ps1');

        function _ensureProfilesDir() {
            try {
                if (!_fs.existsSync(_profilesDir)) _fs.mkdirSync(_profilesDir, { recursive: true });
                let needWritePs1 = !_fs.existsSync(_credPs1File);
                if (!needWritePs1 && process.platform === 'win32') {
                    try {
                        const existingPs1 = _fs.readFileSync(_credPs1File, 'utf8');
                        if (!existingPs1.includes('PayloadFile') || !existingPs1.includes('Delete')) needWritePs1 = true;
                    } catch(e) { needWritePs1 = true; }
                }
                if (process.platform === 'win32' && needWritePs1) {
                    const psLines = [
                        'param([string]$Action, [string]$Target = "gemini:antigravity", [string]$User = "antigravity", [string]$Payload = "", [string]$PayloadFile = "")',
                        'Add-Type -TypeDefinition @"',
                        'using System;',
                        'using System.Runtime.InteropServices;',
                        'public class CredMgr {',
                        '    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]',
                        '    public static extern bool CredReadW(string target, int type, int reservedFlag, out IntPtr credentialPtr);',
                        '    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]',
                        '    public static extern bool CredWriteW(ref CREDENTIAL credential, int flags);',
                        '    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]',
                        '    public static extern bool CredDeleteW(string target, int type, int flags);',
                        '    [DllImport("advapi32.dll", SetLastError = true)]',
                        '    public static extern void CredFree(IntPtr buffer);',
                        '    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]',
                        '    public struct CREDENTIAL {',
                        '        public int Flags; public int Type; public string TargetName; public string Comment;',
                        '        public long LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob;',
                        '        public int Persist; public int AttributeCount; public IntPtr Attributes;',
                        '        public string TargetAlias; public string UserName;',
                        '    }',
                        '    public static string Read(string target) {',
                        '        IntPtr ptr;',
                        '        if (CredReadW(target, 1, 0, out ptr)) {',
                        '            CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));',
                        '            byte[] blob = new byte[cred.CredentialBlobSize];',
                        '            Marshal.Copy(cred.CredentialBlob, blob, 0, cred.CredentialBlobSize);',
                        '            CredFree(ptr);',
                        '            return System.Text.Encoding.UTF8.GetString(blob);',
                        '        }',
                        '        return "";',
                        '    }',
                        '    public static bool Write(string target, string user, string json) {',
                        '        CredDeleteW(target, 1, 0);',
                        '        byte[] bytes = System.Text.Encoding.UTF8.GetBytes(json);',
                        '        IntPtr blobPtr = Marshal.AllocHGlobal(bytes.Length);',
                        '        Marshal.Copy(bytes, 0, blobPtr, bytes.Length);',
                        '        CREDENTIAL cred = new CREDENTIAL();',
                        '        cred.Flags = 0; cred.Type = 1; cred.TargetName = target; cred.UserName = user;',
                        '        cred.CredentialBlobSize = bytes.Length; cred.CredentialBlob = blobPtr; cred.Persist = 2;',
                        '        bool ok = CredWriteW(ref cred, 0);',
                        '        Marshal.FreeHGlobal(blobPtr);',
                        '        return ok;',
                        '    }',
                        '    public static bool Delete(string target) {',
                        '        return CredDeleteW(target, 1, 0);',
                        '    }',
                        '}',
                        '"@',
                        'if ($Action -eq "read") {',
                        '    $res = [CredMgr]::Read($Target)',
                        '    if ($res) { Write-Output $res } else { Write-Output "" }',
                        '}' + ' elseif ($Action -eq "delete") {',
                        '    $ok = [CredMgr]::Delete($Target)',
                        '    if ($ok) { Write-Output "SUCCESS" } else { Write-Output "FAILED" }',
                        '} elseif ($Action -eq "write") {',
                        '    if ($PayloadFile -and (Test-Path $PayloadFile)) {',
                        '        $Payload = [System.IO.File]::ReadAllText($PayloadFile, [System.Text.Encoding]::UTF8)',
                        '    }',
                        '    $ok = [CredMgr]::Write($Target, $User, $Payload)',
                        '    if ($ok) { Write-Output "SUCCESS" } else { Write-Output "FAILED" }',
                        '}'
                    ];
                    _fs.writeFileSync(_credPs1File, psLines.join(String.fromCharCode(13, 10)), 'utf8');
                }
            } catch(e) {}
        }

        function _safeEmailKey(email) {
            return encodeURIComponent(email || '').replace(/%/g, '_');
        }

        function _readJsonSafe(filePath, defaultVal) {
            try {
                if (_fs.existsSync(filePath)) return JSON.parse(_fs.readFileSync(filePath, 'utf8'));
            } catch(e) {}
            return defaultVal;
        }

        function _writeJsonSafe(filePath, data) {
            try {
                const dir = _path.dirname(filePath);
                if (!_fs.existsSync(dir)) _fs.mkdirSync(dir, { recursive: true });
                _fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
                return true;
            } catch(e) {
                return false;
            }
        }

        function _formatDateNow() {
            var d = new Date();
            var h = String(d.getHours());
            if (h.length < 2) h = '0' + h;
            var m = String(d.getMinutes());
            if (m.length < 2) m = '0' + m;
            return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + h + ':' + m;
        }

        function _getEmailFromPayload(payload) {
            if (!payload) return null;
            try {
                const idToken = (typeof payload === 'object' && payload.id_token) || 
                                (typeof payload === 'object' && payload.token && payload.token.id_token);
                if (idToken && typeof idToken === 'string') {
                    const parts = idToken.split('.');
                    if (parts.length >= 2) {
                        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                        const claims = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
                        if (claims && claims.email && typeof claims.email === 'string') {
                            return claims.email.trim().toLowerCase();
                        }
                    }
                }
            } catch(e) {}
            return null;
        }

        function _readKeyringPayload() {
            try {
                if (process.platform === 'win32') {
                    _ensureProfilesDir();
                    const cp = require('child_process');
                    const out = cp.execFileSync('powershell.exe', [
                        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                        '-File', _credPs1File, '-Action', 'read'
                    ], { encoding: 'utf8', timeout: 5000 });
                    if (out && out.trim()) {
                        return JSON.parse(out.trim());
                    }
                } else if (process.platform === 'darwin') {
                    const cp = require('child_process');
                    const out = cp.execSync('security find-generic-password -s gemini -a antigravity -w', { encoding: 'utf8', timeout: 5000 }).trim();
                    if (out.startsWith('go-keyring-base64:')) {
                        const b64 = out.substring('go-keyring-base64:'.length);
                        return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
                    }
                    return JSON.parse(out);
                }
            } catch(e) {}
            return null;
        }

        function _writeKeyringPayload(payloadObj) {
            if (!payloadObj) return false;
            try {
                const payloadStr = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
                if (process.platform === 'win32') {
                    _ensureProfilesDir();
                    const cp = require('child_process');
                    const tmpJson = _path.join(_profilesDir, '_tmp_payload.json');
                    _fs.writeFileSync(tmpJson, payloadStr, 'utf8');
                    const res = cp.execFileSync('powershell.exe', [
                        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                        '-File', _credPs1File, '-Action', 'write', '-PayloadFile', tmpJson
                    ], { encoding: 'utf8', timeout: 8000 });
                    try { _fs.unlinkSync(tmpJson); } catch(e) {}
                    return res && res.includes('SUCCESS');
                } else if (process.platform === 'darwin') {
                    const cp = require('child_process');
                    const b64 = Buffer.from(payloadStr).toString('base64');
                    const val = 'go-keyring-base64:' + b64;
                    try { cp.execSync('security delete-generic-password -s gemini -a antigravity'); } catch(e) {}
                    cp.execFileSync('security', ['add-generic-password', '-s', 'gemini', '-a', 'antigravity', '-w', val, '-A']);
                    return true;
                }
            } catch(e) {}
            return false;
        }

        function _deleteKeyringPayload() {
            try {
                if (process.platform === 'win32') {
                    _ensureProfilesDir();
                    const cp = require('child_process');
                    cp.execFileSync('powershell.exe', [
                        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                        '-File', _credPs1File, '-Action', 'delete'
                    ], { encoding: 'utf8', timeout: 5000 });
                    return true;
                } else if (process.platform === 'darwin') {
                    const cp = require('child_process');
                    try { cp.execSync('security delete-generic-password -s gemini -a antigravity'); } catch(e) {}
                    return true;
                }
            } catch(e) {}
            return false;
        }

        function _getGoogleOAuthClient() {
            const _d = (arr) => arr.map(c => String.fromCharCode(c ^ 42)).join('');
            return {
                clientId: _d([27,26,29,27,26,26,28,26,28,26,31,19,27,7,94,71,66,89,89,67,68,24,66,24,27,70,73,88,79,24,25,31,92,94,69,70,69,64,66,30,77,30,26,25,79,90,4,75,90,90,89,4,77,69,69,77,70,79,95,89,79,88,73,69,68,94,79,68,94,4,73,69,71]),
                clientSecret: _d([109,101,105,121,122,114,7,97,31,18,108,125,120,30,18,28,102,78,102,96,27,71,102,104,18,89,114,105,30,80,28,91,110,107,76])
            };
        }

        function _refreshGoogleAccessToken(refreshToken) {
            return new Promise((resolve) => {
                if (!refreshToken) return resolve(null);
                const https = require('https');
                const querystring = require('querystring');
                const _client = _getGoogleOAuthClient();
                const postData = querystring.stringify({
                    client_id: _client.clientId,
                    client_secret: _client.clientSecret,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token'
                });
                const req = https.request('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': Buffer.byteLength(postData),
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 7000
                }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        try {
                            const data = JSON.parse(body);
                            if (data && data.access_token) {
                                resolve(data);
                            } else {
                                resolve(null);
                            }
                        } catch(e) { resolve(null); }
                    });
                });
                req.on('error', () => resolve(null));
                req.on('timeout', () => { req.destroy(); resolve(null); });
                req.write(postData);
                req.end();
            });
        }

        function _cleanStaleLanguageServers() {
            try {
                const cp = require('child_process');
                if (process.platform === 'win32') {
                    cp.execSync('taskkill /f /im language_server.exe', { stdio: 'ignore' });
                } else {
                    cp.execSync('pkill -f language_server', { stdio: 'ignore' });
                }
            } catch(e) {}
        }

        _ipc.handle('antigravity:get-account-profiles', async () => {
            try {
                _ensureProfilesDir();
                let meta = _readJsonSafe(_metaFile, { active: '', profiles: [] }) || { active: '', profiles: [] };
                if (!Array.isArray(meta.profiles)) meta.profiles = [];
                const currentAcc = _readJsonSafe(_activeAccFile, {}) || {};
                const activeEmail = currentAcc.active || meta.active || '';

                // Ensure active account has an entry in meta and backup files + keyring payload
                if (activeEmail) {
                    const accDir = _path.join(_profilesDir, _safeEmailKey(activeEmail));
                    if (!_fs.existsSync(accDir)) _fs.mkdirSync(accDir, { recursive: true });
                    const bOauth = _path.join(accDir, 'oauth_creds.json');
                    if (!_fs.existsSync(bOauth) && _fs.existsSync(_activeOauthFile)) {
                        try { _fs.copyFileSync(_activeOauthFile, bOauth); } catch(e) {}
                    }
                    const bAcc = _path.join(accDir, 'google_accounts.json');
                    if (!_fs.existsSync(bAcc) && _fs.existsSync(_activeAccFile)) {
                        try { _fs.copyFileSync(_activeAccFile, bAcc); } catch(e) {}
                    }

                    let existing = meta.profiles.find(p => p.email && p.email.toLowerCase() === activeEmail.toLowerCase());
                    const nowStr = _formatDateNow();
                    if (!existing) {
                        existing = {
                            email: activeEmail,
                            name: activeEmail.split('@')[0],
                            avatar: '',
                            tier: 'PRO',
                            lastUsed: nowStr,
                            quota: null
                        };
                        meta.profiles.unshift(existing);
                    }
                    meta.active = activeEmail;
                    _writeJsonSafe(_metaFile, meta);
                }

                return { success: true, activeEmail, profiles: meta.profiles };
            } catch(err) {
                return { success: false, error: err.message, profiles: [] };
            }
        });

        _ipc.handle('antigravity:save-current-profile', async (_e, data) => {
            try {
                _ensureProfilesDir();
                const currentAcc = _readJsonSafe(_activeAccFile, {}) || {};
                const activeEmail = (data && data.email) || currentAcc.active;
                if (!activeEmail) return { success: false, error: 'No active email found' };

                const accDir = _path.join(_profilesDir, _safeEmailKey(activeEmail));
                if (!_fs.existsSync(accDir)) _fs.mkdirSync(accDir, { recursive: true });

                // STRICT ANTI-POLLUTION VALIDATION:
                // Only backup credentials if the token content ACTUALLY matches activeEmail!
                const kr = _readKeyringPayload();
                const krEmail = _getEmailFromPayload(kr);
                if (kr && krEmail && krEmail === activeEmail.toLowerCase()) {
                    _writeJsonSafe(_path.join(accDir, 'credential_payload.json'), kr);
                }

                const activeOauth = _readJsonSafe(_activeOauthFile, null);
                const oauthEmail = _getEmailFromPayload(activeOauth);
                if (activeOauth && oauthEmail && oauthEmail === activeEmail.toLowerCase()) {
                    _writeJsonSafe(_path.join(accDir, 'oauth_creds.json'), activeOauth);
                }

                if (currentAcc.active && currentAcc.active.toLowerCase() === activeEmail.toLowerCase()) {
                    if (_fs.existsSync(_activeAccFile)) {
                        try { _fs.copyFileSync(_activeAccFile, _path.join(accDir, 'google_accounts.json')); } catch(e) {}
                    }
                }

                let meta = _readJsonSafe(_metaFile, { active: currentAcc.active || activeEmail, profiles: [] }) || { active: currentAcc.active || activeEmail, profiles: [] };
                if (!Array.isArray(meta.profiles)) meta.profiles = [];
                if (currentAcc.active) {
                    meta.active = currentAcc.active;
                }

                let existing = meta.profiles.find(p => p.email && p.email.toLowerCase() === activeEmail.toLowerCase());
                const nowStr = _formatDateNow();

                if (!existing) {
                    existing = {
                        email: activeEmail,
                        name: (data && data.name) || activeEmail.split('@')[0],
                        avatar: (data && data.avatar) || '',
                        tier: (data && data.tier) || 'PRO',
                        lastUsed: nowStr,
                        quota: (data && data.quota) || null
                    };
                    meta.profiles.unshift(existing);
                } else {
                    if (data && data.name) existing.name = data.name;
                    if (data && data.avatar) existing.avatar = data.avatar;
                    if (data && data.tier) existing.tier = data.tier;
                    if (data && data.quota) existing.quota = data.quota;
                    existing.lastUsed = nowStr;
                }
                _writeJsonSafe(_metaFile, meta);
                return { success: true, profiles: meta.profiles };
            } catch(err) {
                return { success: false, error: err.message };
            }
        });

        _ipc.handle('antigravity:switch-account-profile', async (_e, targetEmail) => {
            try {
                if (!targetEmail) return { success: false, error: '目标账号邮箱为空' };
                _ensureProfilesDir();
                const accDir = _path.join(_profilesDir, _safeEmailKey(targetEmail));
                const bPayloadFile = _path.join(accDir, 'credential_payload.json');
                const bOauthFile = _path.join(accDir, 'oauth_creds.json');
                const bAccFile = _path.join(accDir, 'google_accounts.json');

                if (!_fs.existsSync(bPayloadFile) && !_fs.existsSync(bOauthFile)) {
                    return { success: false, error: '未在本地凭据库中找到该账号密钥，请先登录一次！' };
                }

                let payload = _readJsonSafe(bPayloadFile, null);
                let oauthData = _readJsonSafe(bOauthFile, null);

                // If payload is missing but oauthData exists, synthesize payload
                if (!payload && oauthData) {
                    const expMs = oauthData.expiry_date || (Date.now() + 3600000);
                    const expIso = new Date(expMs).toISOString();
                    payload = {
                        token: {
                            access_token: oauthData.access_token || '',
                            token_type: 'Bearer',
                            refresh_token: oauthData.refresh_token || '',
                            expiry: expIso
                        },
                        auth_method: 'consumer',
                        id_token: oauthData.id_token || ''
                    };
                }

                // Verify the payload belongs to targetEmail
                const pEmail = _getEmailFromPayload(payload);
                const oEmail = _getEmailFromPayload(oauthData);
                if ((pEmail && pEmail !== targetEmail.toLowerCase()) && (oEmail && oEmail !== targetEmail.toLowerCase())) {
                    return { success: false, error: '凭证校验异常：本地存档属于 ' + (pEmail || oEmail) + '，而非目标账号 ' + targetEmail };
                }

                // Attempt to refresh access_token to guarantee fresh login session
                const refreshToken = (payload && payload.token && payload.token.refresh_token) || (oauthData && oauthData.refresh_token);
                if (refreshToken) {
                    try {
                        const refreshed = await _refreshGoogleAccessToken(refreshToken);
                        if (refreshed && refreshed.access_token) {
                            if (payload && payload.token) {
                                payload.token.access_token = refreshed.access_token;
                                const expDate = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);
                                payload.token.expiry = expDate.toISOString();
                                if (refreshed.id_token) payload.id_token = refreshed.id_token;
                            }
                            if (oauthData) {
                                oauthData.access_token = refreshed.access_token;
                                oauthData.expiry_date = Date.now() + (refreshed.expires_in || 3600) * 1000;
                                if (refreshed.id_token) oauthData.id_token = refreshed.id_token;
                            }
                            // Save refreshed token back to profile store
                            if (payload) _writeJsonSafe(bPayloadFile, payload);
                            if (oauthData) _writeJsonSafe(bOauthFile, oauthData);
                        }
                    } catch(e) {}
                }

                // 1. Write System Keyring (Windows Credential Manager / macOS Keychain)
                if (payload) {
                    _writeKeyringPayload(payload);
                }

                // 2. Write File-based credentials (~/.gemini/)
                if (oauthData) {
                    _writeJsonSafe(_activeOauthFile, oauthData);
                } else if (payload && payload.token) {
                    _writeJsonSafe(_activeOauthFile, {
                        access_token: payload.token.access_token,
                        refresh_token: payload.token.refresh_token,
                        token_type: 'Bearer',
                        expiry_date: Date.now() + 3600000,
                        id_token: payload.id_token,
                        scope: 'https://www.googleapis.com/auth/userinfo.email openid https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.profile'
                    });
                }

                _writeJsonSafe(_activeAccFile, { active: targetEmail, old: [] });
                if (_fs.existsSync(bAccFile)) {
                    try { _writeJsonSafe(bAccFile, { active: targetEmail, old: [] }); } catch(e) {}
                }

                // 3. Update Profiles Meta
                let meta = _readJsonSafe(_metaFile, { active: targetEmail, profiles: [] }) || { active: targetEmail, profiles: [] };
                meta.active = targetEmail;
                const existing = (meta.profiles || []).find(p => p.email && p.email.toLowerCase() === targetEmail.toLowerCase());
                if (existing) {
                    existing.lastUsed = _formatDateNow();
                }
                _writeJsonSafe(_metaFile, meta);

                // 4. Kill stale language_server processes and clean relaunch
                _cleanStaleLanguageServers();

                const { app: _app, BrowserWindow: _BW } = require('electron');
                setTimeout(() => {
                    try {
                        _cleanStaleLanguageServers();
                        if (_app && typeof _app.relaunch === 'function') {
                            _app.relaunch();
                            _app.exit(0);
                        } else if (_BW) {
                            _BW.getAllWindows().forEach(w => {
                                try { w.webContents.reloadIgnoringCache(); } catch(e) {}
                            });
                        }
                    } catch(e) {
                        try {
                            if (_BW) {
                                _BW.getAllWindows().forEach(w => {
                                    try { w.webContents.reloadIgnoringCache(); } catch(e2) {}
                                });
                            }
                        } catch(e3) {}
                    }
                }, 500);

                return { success: true, targetProfile: existing };
            } catch(err) {
                return { success: false, error: err.message };
            }
        });

        _ipc.handle('antigravity:delete-account-profile', async (_e, targetEmail) => {
            try {
                _ensureProfilesDir();
                let meta = _readJsonSafe(_metaFile, { active: '', profiles: [] }) || { active: '', profiles: [] };
                meta.profiles = (meta.profiles || []).filter(p => p.email && p.email.toLowerCase() !== targetEmail.toLowerCase());
                _writeJsonSafe(_metaFile, meta);

                const accDir = _path.join(_profilesDir, _safeEmailKey(targetEmail));
                if (_fs.existsSync(accDir)) {
                    _fs.rmSync(accDir, { recursive: true, force: true });
                }
                return { success: true, profiles: meta.profiles };
            } catch(err) {
                return { success: false, error: err.message };
            }
        });

        _ipc.handle('antigravity:logout-current-account', async () => {
            try {
                _deleteKeyringPayload();

                if (_fs.existsSync(_activeOauthFile)) {
                    try { _fs.unlinkSync(_activeOauthFile); } catch(e) {}
                }
                if (_fs.existsSync(_activeAccFile)) {
                    try { _fs.unlinkSync(_activeAccFile); } catch(e) {}
                }

                let meta = _readJsonSafe(_metaFile, { active: '', profiles: [] }) || { active: '', profiles: [] };
                meta.active = '';
                _writeJsonSafe(_metaFile, meta);

                _cleanStaleLanguageServers();

                const { app: _app, BrowserWindow: _BW } = require('electron');
                setTimeout(() => {
                    try {
                        _cleanStaleLanguageServers();
                        if (_app && typeof _app.relaunch === 'function') {
                            _app.relaunch();
                            _app.exit(0);
                        } else if (_BW) {
                            _BW.getAllWindows().forEach(w => {
                                try { w.webContents.reloadIgnoringCache(); } catch(e) {}
                            });
                        }
                    } catch(e) {}
                }, 500);

                return { success: true };
            } catch(err) {
                return { success: false, error: err.message };
            }
        });

        // --- Independent Web OAuth 2.0 Flow (Does NOT log out active account) ---
        let _oauthServer = null;
        let _oauthState = { status: 'idle', result: null };

        _ipc.handle('antigravity:start-oauth-flow', async () => {
            try {
                if (_oauthServer) {
                    try { _oauthServer.close(); } catch(e) {}
                    _oauthServer = null;
                }

                _oauthState = { status: 'listening', result: null, error: null };
                const http = require('http');
                const url = require('url');
                const https = require('https');
                const querystring = require('querystring');

                const port = 51121;
                const redirectUri = 'http://localhost:51121/oauth-callback';
                const _client = _getGoogleOAuthClient();
                const clientId = _client.clientId;
                const clientSecret = _client.clientSecret;
                const scope = 'https://www.googleapis.com/auth/userinfo.email openid https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.profile';

                const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(clientId) + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&response_type=code&scope=' + encodeURIComponent(scope) + '&access_type=offline&prompt=consent';

                _oauthServer = http.createServer(async (req, res) => {
                    const parsedUrl = url.parse(req.url, true);
                    if (parsedUrl.pathname === '/oauth-callback') {
                        const code = parsedUrl.query.code;
                        const error = parsedUrl.query.error;

                        if (error || !code) {
                            _oauthState = { status: 'error', error: error || '未获取到授权 Code' };
                            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                            res.end('<html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#fef2f2;color:#991b1b;"><h2>❌ 授权未完成</h2><p>' + (error || '未获取到授权 Code') + '</p></body></html>');
                            return;
                        }

                        // Exchange authorization code for tokens
                        try {
                            const postData = querystring.stringify({
                                client_id: clientId,
                                client_secret: clientSecret,
                                code: code,
                                grant_type: 'authorization_code',
                                redirect_uri: redirectUri
                            });

                            const tokenReq = https.request('https://oauth2.googleapis.com/token', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded',
                                    'Content-Length': Buffer.byteLength(postData)
                                },
                                timeout: 10000
                            }, (tokenRes) => {
                                let body = '';
                                tokenRes.on('data', chunk => body += chunk);
                                tokenRes.on('end', () => {
                                    try {
                                        const tokenData = JSON.parse(body);
                                        if (!tokenData.access_token) {
                                            throw new Error(tokenData.error_description || 'Token 兑换失败');
                                        }

                                        // Decode id_token JWT
                                        let userEmail = '';
                                        let userName = '';
                                        let userPic = '';
                                        if (tokenData.id_token) {
                                            try {
                                                const parts = tokenData.id_token.split('.');
                                                if (parts.length >= 2) {
                                                    const payloadBuf = Buffer.from(parts[1], 'base64');
                                                    const payloadObj = JSON.parse(payloadBuf.toString('utf8'));
                                                    userEmail = payloadObj.email || '';
                                                    userName = payloadObj.name || '';
                                                    userPic = payloadObj.picture || '';
                                                }
                                            } catch(e) {}
                                        }

                                        if (!userEmail) {
                                            userEmail = 'google_user_' + Date.now() + '@google.com';
                                        }

                                        _ensureProfilesDir();
                                        const accDir = _path.join(_profilesDir, _safeEmailKey(userEmail));
                                        if (!_fs.existsSync(accDir)) _fs.mkdirSync(accDir, { recursive: true });

                                        // Write oauth_creds.json
                                        const oauthCreds = {
                                            access_token: tokenData.access_token,
                                            refresh_token: tokenData.refresh_token || '',
                                            token_type: 'Bearer',
                                            expiry_date: Date.now() + (tokenData.expires_in || 3600) * 1000,
                                            id_token: tokenData.id_token || '',
                                            scope: scope
                                        };
                                        _writeJsonSafe(_path.join(accDir, 'oauth_creds.json'), oauthCreds);

                                        // Write google_accounts.json
                                        _writeJsonSafe(_path.join(accDir, 'google_accounts.json'), { active: userEmail, old: [] });

                                        // Write credential_payload.json
                                        const expDate = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
                                        const credPayload = {
                                            token: {
                                                access_token: tokenData.access_token,
                                                token_type: 'Bearer',
                                                refresh_token: tokenData.refresh_token || '',
                                                expiry: expDate.toISOString()
                                            },
                                            auth_method: 'consumer',
                                            id_token: tokenData.id_token || ''
                                        };
                                        _writeJsonSafe(_path.join(accDir, 'credential_payload.json'), credPayload);

                                        // Update profiles_meta.json (preserves current active account!)
                                        let meta = _readJsonSafe(_metaFile, { active: '', profiles: [] }) || { active: '', profiles: [] };
                                        if (!Array.isArray(meta.profiles)) meta.profiles = [];
                                        let existing = meta.profiles.find(p => p.email && p.email.toLowerCase() === userEmail.toLowerCase());
                                        const nowStr = _formatDateNow();
                                        if (!existing) {
                                            existing = {
                                                email: userEmail,
                                                name: userName || userEmail.split('@')[0],
                                                avatar: userPic || '',
                                                tier: 'PRO',
                                                tag: '新账号',
                                                lastUsed: nowStr,
                                                quota: null
                                            };
                                            meta.profiles.unshift(existing);
                                        } else {
                                            if (userName) existing.name = userName;
                                            if (userPic) existing.avatar = userPic;
                                            existing.lastUsed = nowStr;
                                        }
                                        _writeJsonSafe(_metaFile, meta);

                                        _oauthState = { status: 'completed', result: existing };

                                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                                        res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>授权成功</title><style>body{font-family:-apple-system,BlinkMacSystemFont,\\"Segoe UI\\",Roboto,sans-serif;text-align:center;padding:60px 20px;background:#f8fafc;color:#0f172a;}h2{color:#10b981;font-size:26px;margin-bottom:12px;font-weight:600;}.card{background:#fff;max-width:440px;margin:0 auto;padding:32px;border-radius:14px;box-shadow:0 10px 25px rgba(0,0,0,0.06);border:1px solid #e2e8f0;}p{font-size:14px;color:#64748b;line-height:1.6;}.email{display:inline-block;padding:4px 10px;background:#e0f2fe;color:#0284c7;border-radius:6px;font-weight:600;margin:10px 0;}</style></head><body><div class="card"><h2>✅ 账号授权成功！</h2><div class="email">' + userEmail + '</div><p>新凭据已安全归档至本地多账号池中。<br>您当前客户端会话未受任何影响。<br><b>现在可以关闭此网页，返回 Antigravity。</b></p></div></body></html>');

                                        setTimeout(() => {
                                            if (_oauthServer) {
                                                try { _oauthServer.close(); } catch(e) {}
                                                _oauthServer = null;
                                            }
                                        }, 1500);
                                    } catch(err) {
                                        _oauthState = { status: 'error', error: err.message };
                                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                                        res.end('<html><body><h2>Token 解析失败: ' + err.message + '</h2></body></html>');
                                    }
                                });
                            });
                            tokenReq.on('error', (err) => {
                                _oauthState = { status: 'error', error: err.message };
                                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                                res.end('<html><body><h2>请求失败: ' + err.message + '</h2></body></html>');
                            });
                            tokenReq.write(postData);
                            tokenReq.end();
                        } catch(err) {
                            _oauthState = { status: 'error', error: err.message };
                        }
                    } else {
                        res.writeHead(404);
                        res.end();
                    }
                });

                _oauthServer.on('error', (err) => {
                    _oauthState = { status: 'error', error: err.message };
                });

                _oauthServer.listen(port, '127.0.0.1');

                return { success: true, authUrl };
            } catch(err) {
                return { success: false, error: err.message };
            }
        });

        _ipc.handle('antigravity:check-oauth-status', async () => {
            return _oauthState;
        });

        _ipc.handle('antigravity:cancel-oauth-flow', async () => {
            if (_oauthServer) {
                try { _oauthServer.close(); } catch(e) {}
                _oauthServer = null;
            }
            _oauthState = { status: 'idle', result: null };
            return { success: true };
        });

        _ipc.handle('antigravity:update-account-tag', async (_e, { email, tag }) => {
            try {
                if (!email) return { success: false, error: 'Email is required' };
                _ensureProfilesDir();
                let meta = _readJsonSafe(_metaFile, { active: '', profiles: [] }) || { active: '', profiles: [] };
                const p = (meta.profiles || []).find(item => item.email && item.email.toLowerCase() === email.toLowerCase());
                if (p) {
                    p.tag = (tag || '').trim();
                    _writeJsonSafe(_metaFile, meta);
                    return { success: true, profile: p };
                }
                return { success: false, error: 'Profile not found' };
            } catch(e) {
                return { success: false, error: e.message };
            }
        });

        _ipc.handle('antigravity:get-device-fingerprint', async (_e, email) => {
            try {
                const storagePath = _path.join(process.env.APPDATA || '', 'Antigravity', 'User', 'globalStorage', 'storage.json');
                let currentStorage = _readJsonSafe(storagePath, null);

                let boundFingerprint = null;
                let history = [];

                if (email) {
                    const accDir = _path.join(_profilesDir, _safeEmailKey(email));
                    const fpFile = _path.join(accDir, 'fingerprint.json');
                    boundFingerprint = _readJsonSafe(fpFile, null);

                    const histFile = _path.join(accDir, 'fingerprint_history.json');
                    history = _readJsonSafe(histFile, []) || [];
                }

                return {
                    success: true,
                    storagePath,
                    currentStorage,
                    boundFingerprint,
                    history
                };
            } catch(e) {
                return { success: false, error: e.message };
            }
        });

        _ipc.handle('antigravity:bind-device-fingerprint', async (_e, { email, fingerprint, applyNow }) => {
            try {
                if (!email) return { success: false, error: 'Email is required' };
                const accDir = _path.join(_profilesDir, _safeEmailKey(email));
                if (!_fs.existsSync(accDir)) _fs.mkdirSync(accDir, { recursive: true });

                const fpFile = _path.join(accDir, 'fingerprint.json');
                _writeJsonSafe(fpFile, fingerprint);

                const histFile = _path.join(accDir, 'fingerprint_history.json');
                let history = _readJsonSafe(histFile, []) || [];
                history.unshift({
                    timestamp: _formatDateNow(),
                    fingerprint: fingerprint
                });
                if (history.length > 20) history = history.slice(0, 20);
                _writeJsonSafe(histFile, history);

                const storageDir = _path.join(process.env.APPDATA || '', 'Antigravity', 'User', 'globalStorage');
                const storagePath = _path.join(storageDir, 'storage.json');

                if (applyNow) {
                    if (!_fs.existsSync(storageDir)) _fs.mkdirSync(storageDir, { recursive: true });
                    let storageObj = _readJsonSafe(storagePath, {}) || {};
                    Object.assign(storageObj, fingerprint);
                    _writeJsonSafe(storagePath, storageObj);
                }

                return { success: true, boundFingerprint: fingerprint, history };
            } catch(e) {
                return { success: false, error: e.message };
            }
        });

        _ipc.handle('antigravity:open-account-folder', async (_e, email) => {
            try {
                const { shell } = require('electron');
                let targetPath = _profilesDir;
                if (email) {
                    const accDir = _path.join(_profilesDir, _safeEmailKey(email));
                    if (_fs.existsSync(accDir)) targetPath = accDir;
                }
                shell.openPath(targetPath);
                return { success: true };
            } catch(e) {
                return { success: false, error: e.message };
            }
        });

        _ipc.handle('antigravity:export-account-profile', async (_e, email) => {
            try {
                if (!email) return { success: false, error: 'Email is required' };
                const accDir = _path.join(_profilesDir, _safeEmailKey(email));
                const bOauth = _readJsonSafe(_path.join(accDir, 'oauth_creds.json'), {});
                const bPayload = _readJsonSafe(_path.join(accDir, 'credential_payload.json'), {});
                const meta = _readJsonSafe(_metaFile, { profiles: [] });
                const profile = (meta.profiles || []).find(p => p.email && p.email.toLowerCase() === email.toLowerCase()) || {};

                return {
                    success: true,
                    data: {
                        exportedAt: new Date().toISOString(),
                        profile,
                        oauth: bOauth,
                        payload: bPayload
                    }
                };
            } catch(e) {
                return { success: false, error: e.message };
            }
        });

        _ipc.handle('antigravity:relaunch-app', async () => {
            _cleanStaleLanguageServers();
            const { app: _app } = require('electron');
            setTimeout(() => {
                try {
                    _cleanStaleLanguageServers();
                    _app.relaunch();
                    _app.exit(0);
                } catch(e) {}
            }, 150);
            return { success: true };
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

        // Zoom safe clamping to prevent corrupt extreme zoom (e.g. 3.5x) from blowing up the window
        const zoomApplyNeedle = "win.webContents.setZoomLevel(level);";
        if (utilsContent.includes(zoomApplyNeedle)) {
            utilsContent = utilsContent.replace(
                zoomApplyNeedle,
                "if (isNaN(level) || level > 1.5 || level < -1.5) level = 0;\n                    win.webContents.setZoomLevel(level);"
            );
        }
        const webPrefNeedle = "webPreferences: {";
        if (utilsContent.includes(webPrefNeedle) && !utilsContent.includes("zoomFactor: 1.0")) {
            utilsContent = utilsContent.replace(webPrefNeedle, "webPreferences: {\n            zoomFactor: 1.0,");
        }

        fs.writeFileSync(utilsJs, utilsContent, 'utf8');

        // 6.2 Patch ipcHandlers.js (The Official Startup IPC registration module)
        const ipcHandlersJs = path.join(distDir, 'ipcHandlers.js');
        if (fs.existsSync(ipcHandlersJs)) {
            let ipcContent = fs.readFileSync(ipcHandlersJs, 'utf8');
            if (!ipcContent.includes('antigravity:save-current-profile')) {
                const lastBraceIdx = ipcContent.lastIndexOf('}');
                if (lastBraceIdx !== -1) {
                    ipcContent = ipcContent.substring(0, lastBraceIdx) + '\n' + safeInjectFn + '\n}\n';
                    fs.writeFileSync(ipcHandlersJs, ipcContent, 'utf8');
                }
            }
        }

        // 7. Patch preload.js to expose screenshot bridge, skills & account switcher bridge
        const preloadJs = path.join(distDir, 'preload.js');
        if (fs.existsSync(preloadJs)) {
            let preloadContent = fs.readFileSync(preloadJs, 'utf8');
            const targetNeedle = "revealInFilePicker: (path) => electron_1.ipcRenderer.invoke('shell:reveal-in-file-picker', path),";
            const extraApis = `
    takeScreenshot: () => electron_1.ipcRenderer.invoke('antigravity:screenshot'),
    getClipboardImage: () => electron_1.ipcRenderer.invoke('antigravity:clipboard-image'),
    getSkills: () => electron_1.ipcRenderer.invoke('antigravity:get-skills'),
    openPath: (p) => electron_1.ipcRenderer.invoke('antigravity:open-path', p),
    openExternal: (url) => electron_1.ipcRenderer.invoke('antigravity:open-external', url),
    getAccountProfiles: () => electron_1.ipcRenderer.invoke('antigravity:get-account-profiles'),
    saveCurrentProfile: (data) => electron_1.ipcRenderer.invoke('antigravity:save-current-profile', data),
    switchAccountProfile: (email) => electron_1.ipcRenderer.invoke('antigravity:switch-account-profile', email),
    deleteAccountProfile: (email) => electron_1.ipcRenderer.invoke('antigravity:delete-account-profile', email),
    logoutCurrentAccount: () => electron_1.ipcRenderer.invoke('antigravity:logout-current-account'),
    startOAuthFlow: () => electron_1.ipcRenderer.invoke('antigravity:start-oauth-flow'),
    checkOAuthStatus: () => electron_1.ipcRenderer.invoke('antigravity:check-oauth-status'),
    cancelOAuthFlow: () => electron_1.ipcRenderer.invoke('antigravity:cancel-oauth-flow'),
    updateAccountTag: (email, tag) => electron_1.ipcRenderer.invoke('antigravity:update-account-tag', { email, tag }),
    getDeviceFingerprint: (email) => electron_1.ipcRenderer.invoke('antigravity:get-device-fingerprint', email),
    bindDeviceFingerprint: (email, fingerprint, applyNow) => electron_1.ipcRenderer.invoke('antigravity:bind-device-fingerprint', { email, fingerprint, applyNow }),
    openAccountFolder: (email) => electron_1.ipcRenderer.invoke('antigravity:open-account-folder', email),
    exportAccountProfile: (email) => electron_1.ipcRenderer.invoke('antigravity:export-account-profile', email),
    relaunchApp: () => electron_1.ipcRenderer.invoke('antigravity:relaunch-app'),`;

            if (preloadContent.includes('takeScreenshot:') && !preloadContent.includes('getAccountProfiles:')) {
                preloadContent = preloadContent.replace(
                    "openPath: (p) => electron_1.ipcRenderer.invoke('antigravity:open-path', p),",
                    "openPath: (p) => electron_1.ipcRenderer.invoke('antigravity:open-path', p),\n" + extraApis
                );
                fs.writeFileSync(preloadJs, preloadContent, 'utf8');
            } else if (preloadContent.includes('getAccountProfiles:') && !preloadContent.includes('startOAuthFlow:')) {
                preloadContent = preloadContent.replace(
                    "getAccountProfiles: () => electron_1.ipcRenderer.invoke('antigravity:get-account-profiles'),",
                    "getAccountProfiles: () => electron_1.ipcRenderer.invoke('antigravity:get-account-profiles'),\n    startOAuthFlow: () => electron_1.ipcRenderer.invoke('antigravity:start-oauth-flow'),\n    checkOAuthStatus: () => electron_1.ipcRenderer.invoke('antigravity:check-oauth-status'),\n    cancelOAuthFlow: () => electron_1.ipcRenderer.invoke('antigravity:cancel-oauth-flow'),\n    updateAccountTag: (email, tag) => electron_1.ipcRenderer.invoke('antigravity:update-account-tag', { email, tag }),\n    getDeviceFingerprint: (email) => electron_1.ipcRenderer.invoke('antigravity:get-device-fingerprint', email),\n    bindDeviceFingerprint: (email, fingerprint, applyNow) => electron_1.ipcRenderer.invoke('antigravity:bind-device-fingerprint', { email, fingerprint, applyNow }),\n    openAccountFolder: (email) => electron_1.ipcRenderer.invoke('antigravity:open-account-folder', email),\n    exportAccountProfile: (email) => electron_1.ipcRenderer.invoke('antigravity:export-account-profile', email),"
                );
                fs.writeFileSync(preloadJs, preloadContent, 'utf8');
            } else if (!preloadContent.includes('takeScreenshot:')) {
                if (preloadContent.includes(targetNeedle)) {
                    preloadContent = preloadContent.replace(targetNeedle, targetNeedle + extraApis);
                    fs.writeFileSync(preloadJs, preloadContent, 'utf8');
                }
            }

            if (preloadContent.includes('deleteAccountProfile:') && !preloadContent.includes('logoutCurrentAccount:')) {
                preloadContent = preloadContent.replace(
                    "deleteAccountProfile: (email) => electron_1.ipcRenderer.invoke('antigravity:delete-account-profile', email),",
                    "deleteAccountProfile: (email) => electron_1.ipcRenderer.invoke('antigravity:delete-account-profile', email),\n    logoutCurrentAccount: () => electron_1.ipcRenderer.invoke('antigravity:logout-current-account'),"
                );
                fs.writeFileSync(preloadJs, preloadContent, 'utf8');
            }

            if (preloadContent.includes('openPath:') && !preloadContent.includes('openExternal:')) {
                preloadContent = preloadContent.replace(
                    "openPath: (p) => electron_1.ipcRenderer.invoke('antigravity:open-path', p),",
                    "openPath: (p) => electron_1.ipcRenderer.invoke('antigravity:open-path', p),\n    openExternal: (url) => electron_1.ipcRenderer.invoke('antigravity:open-external', url),"
                );
                fs.writeFileSync(preloadJs, preloadContent, 'utf8');
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

        // 11. Clean any corrupted per_host_zoom_levels from Chromium Preferences
        try {
            const prefPath = path.join(process.env.APPDATA || '', 'Antigravity', 'Preferences');
            if (fs.existsSync(prefPath)) {
                const prefData = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
                if (prefData.partition && prefData.partition.per_host_zoom_levels) {
                    delete prefData.partition.per_host_zoom_levels;
                    fs.writeFileSync(prefPath, JSON.stringify(prefData, null, 2), 'utf8');
                    console.log('  ✔ 成功清理 Chromium 异常残留缩放缓存 (Preferences)');
                }
            }
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
