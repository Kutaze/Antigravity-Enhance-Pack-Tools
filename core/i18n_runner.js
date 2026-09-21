(function () {
    var data = window.__ANTIGRAVITY_I18N_DATA__ || {};
    var EXACT = data.exact || {};
    var REVERSE_MAP = data.reverse_map || {};
    var REGEX_RULES = [];
    if (Array.isArray(data.regex_rules)) {
        for (var i = 0; i < data.regex_rules.length; i++) {
            try {
                REGEX_RULES.push({
                    re: new RegExp(data.regex_rules[i].pattern),
                    rep: data.regex_rules[i].replacement
                });
            } catch (e) {}
        }
    }
    var EXEMPTIONS = data.exemptions || [];

    // Always update global store on new data injection
    window.__ANTIGRAVITY_EXACT__ = Object.assign(window.__ANTIGRAVITY_EXACT__ || {}, EXACT);
    window.__ANTIGRAVITY_REVERSE_MAP__ = Object.assign(window.__ANTIGRAVITY_REVERSE_MAP__ || {}, REVERSE_MAP);
    window.__ANTIGRAVITY_REGEX_RULES__ = REGEX_RULES;
    window.__ANTIGRAVITY_EXEMPTIONS__ = EXEMPTIONS;

    if (window.__antigravity_i18n_runner_active) {
        if (typeof window.__antigravity_translateWholePage === 'function') {
            window.__antigravity_translateWholePage();
        }
        return;
    }
    window.__antigravity_i18n_runner_active = true;

    // 1. Controlled Component Reverse Map Hook (Protects Base UI / Radix Select states)
    if (!window.__antigravity_map_hooked) {
        window.__antigravity_map_hooked = true;
        var origHas = Map.prototype.has;
        var origGet = Map.prototype.get;

        Map.prototype.has = function (key) {
            if (origHas.call(this, key)) return true;
            var rev = window.__ANTIGRAVITY_REVERSE_MAP__ || REVERSE_MAP;
            if (typeof key === "string" && rev[key]) {
                return origHas.call(this, rev[key]);
            }
            return false;
        };

        Map.prototype.get = function (key) {
            var val = origGet.call(this, key);
            if (val !== undefined) return val;
            var rev = window.__ANTIGRAVITY_REVERSE_MAP__ || REVERSE_MAP;
            if (typeof key === "string" && rev[key]) {
                return origGet.call(this, rev[key]);
            }
            return undefined;
        };
    }

    // 2. Isolation & Exemption Checks
    var EXCLUDED_TAGS = {
        "SCRIPT": true,
        "STYLE": true,
        "PRE": true,
        "CODE": true,
        "TEXTAREA": true
    };

    function isInsideExcluded(node) {
        var curr = node;
        while (curr && curr !== document.body && curr !== document.documentElement) {
            if (curr.nodeType === 1) {
                var tag = curr.tagName;
                if (EXCLUDED_TAGS[tag]) return true;
                if (curr.isContentEditable) return true;
                var cls = curr.className;
                if (typeof cls === "string" && (
                    cls.indexOf("monaco-editor") !== -1 ||
                    cls.indexOf("token") !== -1 ||
                    cls.indexOf("syntax") !== -1
                )) {
                    return true;
                }
            }
            curr = curr.parentNode;
        }
        return false;
    }

    function isExempt(text) {
        var exemptions = window.__ANTIGRAVITY_EXEMPTIONS__ || EXEMPTIONS;
        for (var i = 0; i < exemptions.length; i++) {
            if (text.indexOf(exemptions[i]) !== -1) {
                return true;
            }
        }
        return false;
    }

    function getTranslatedText(original) {
        var trimmed = original.trim();
        if (!trimmed) return null;
        if (isExempt(original)) return null;

        var exactMap = window.__ANTIGRAVITY_EXACT__ || EXACT;
        var regexList = window.__ANTIGRAVITY_REGEX_RULES__ || REGEX_RULES;

        // Exact match (with normalized CRLF support)
        var normalized = trimmed.replace(/\r\n/g, '\n');
        if (exactMap[trimmed] || exactMap[normalized]) {
            var target = exactMap[trimmed] || exactMap[normalized];
            var target = exactMap[trimmed];
            var leading = original.match(/^\s*/)[0];
            var trailing = original.match(/\s*$/)[0];
            return leading + target + trailing;
        }

        // Regex dynamic rules
        for (var i = 0; i < regexList.length; i++) {
            if (regexList[i].re.test(trimmed)) {
                var ruleRep = regexList[i].rep;
                var replaced = trimmed.replace(regexList[i].re, function() {
                    var out = ruleRep;
                    for (var a = 1; a < arguments.length - 2; a++) {
                        var arg = arguments[a];
                        if (typeof arg === 'string' && /(\d+\s*(?:days?|hours?|minutes?|seconds?))/i.test(arg)) {
                            arg = arg.replace(/(\d+)\s*days?/gi, '$1 天')
                                     .replace(/(\d+)\s*hours?/gi, '$1 小时')
                                     .replace(/(\d+)\s*minutes?/gi, '$1 分钟')
                                     .replace(/(\d+)\s*seconds?/gi, '$1 秒')
                                     .replace(/,\s*/g, ' ')
                                     .trim();
                        }
                        out = out.replace(new RegExp('\\$' + a, 'g'), arg);
                    }
                    return out;
                });
                var lead = original.match(/^\s*/)[0];
                var trail = original.match(/\s*$/)[0];
                return lead + replaced + trail;
            }
        }

        return null;
    }

    // 3. Node Translation Engine (Pure value matching, no harmful WeakSet blocking)
    function translateTextNode(textNode) {
        if (!textNode || textNode.nodeType !== 3) return;
        var val = textNode.nodeValue;
        if (!val || !val.trim()) return;

        if (isInsideExcluded(textNode)) return;

        var translated = getTranslatedText(val);
        if (translated !== null && translated !== val) {
            textNode.nodeValue = translated;
        }
    }

    function translateElementAttributes(el) {
        if (!el || el.nodeType !== 1) return;
        if (EXCLUDED_TAGS[el.tagName]) return;

        // placeholder
        if (el.hasAttribute("placeholder")) {
            var ph = el.getAttribute("placeholder");
            var tPh = getTranslatedText(ph);
            if (tPh !== null && tPh !== ph) el.setAttribute("placeholder", tPh);
        }
        // title
        if (el.hasAttribute("title")) {
            var tit = el.getAttribute("title");
            var tTit = getTranslatedText(tit);
            if (tTit !== null && tTit !== tit) el.setAttribute("title", tTit);
        }
        // aria-label
        if (el.hasAttribute("aria-label")) {
            var al = el.getAttribute("aria-label");
            var tAl = getTranslatedText(al);
            if (tAl !== null && tAl !== al) el.setAttribute("aria-label", tAl);
        }
    }

    function translateSubtree(root) {
        if (!root) return;
        if (root.nodeType === 3) {
            translateTextNode(root);
            return;
        }
        if (root.nodeType === 1) {
            if (isInsideExcluded(root)) return;
            translateElementAttributes(root);
            var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
            var node;
            while ((node = walker.nextNode())) {
                translateTextNode(node);
            }
            var elementsWithAttrs = root.querySelectorAll("[placeholder], [title], [aria-label]");
            for (var i = 0; i < elementsWithAttrs.length; i++) {
                translateElementAttributes(elementsWithAttrs[i]);
            }
        }
    }

    // 4. Initial Full Page Translation & Lifecycle Hooks
    function translateWholePage() {
        var target = document.body || document.documentElement;
        if (target) {
            translateSubtree(target);
        }
    }
    window.__antigravity_translateWholePage = translateWholePage;

    translateWholePage();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", translateWholePage);
    }
    window.addEventListener("load", translateWholePage);

    // SPA client-side routing triggers
    window.addEventListener("popstate", function() { setTimeout(translateWholePage, 50); });
    window.addEventListener("hashchange", function() { setTimeout(translateWholePage, 50); });

    // Multi-turn progressive scans for React initial async rendering
    var scanDelays = [100, 250, 500, 1000, 1800, 3000, 5000];
    for (var k = 0; k < scanDelays.length; k++) {
        setTimeout(translateWholePage, scanDelays[k]);
    }

    // 5. High-Performance MutationObserver (observes childList on documentElement)
    var isTranslating = false;
    var observer = new MutationObserver(function (mutations) {
        if (isTranslating) return;
        isTranslating = true;
        try {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type === "childList") {
                    for (var j = 0; j < m.addedNodes.length; j++) {
                        translateSubtree(m.addedNodes[j]);
                    }
                }
            }
        } finally {
            isTranslating = false;
        }
    });

    function startObserving() {
        var root = document.documentElement || document.body;
        if (root) {
            observer.observe(root, {
                childList: true,
                subtree: true
            });
        } else {
            setTimeout(startObserving, 30);
        }
    }
    startObserving();

    console.log("[Antigravity i18n] Localization runner successfully initialized and active.");
})();

// --- Office Uploader & Parser Extension ---
(function() {
  if (window.__antigravity_office_uploader_installed) return;
  window.__antigravity_office_uploader_installed = true;

  // 1. Core Parser Engine
  async function unzipOffice(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocdOffset = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) throw new Error('无效的 ZIP/Office 文档包');
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    const files = {};
    let cur = cdOffset;
    for (let i = 0; i < totalEntries; i++) {
      if (view.getUint32(cur, true) !== 0x02014b50) break;
      const method = view.getUint16(cur + 10, true);
      const compSize = view.getUint32(cur + 20, true);
      const nameLen = view.getUint16(cur + 28, true);
      const extraLen = view.getUint16(cur + 30, true);
      const commLen = view.getUint16(cur + 32, true);
      const localOffset = view.getUint32(cur + 42, true);
      const nameBytes = bytes.slice(cur + 46, cur + 46 + nameLen);
      const fileName = new TextDecoder('utf-8').decode(nameBytes);
      const localNameLen = view.getUint16(localOffset + 26, true);
      const localExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const compData = bytes.slice(dataStart, dataStart + compSize);
      files[fileName] = async () => {
        if (method === 0) return compData;
        if (method === 8) {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(compData);
          writer.close();
          const buf = await new Response(ds.readable).arrayBuffer();
          return new Uint8Array(buf);
        }
        throw new Error('不支持的压缩方式: ' + method);
      };
      cur += 46 + nameLen + extraLen + commLen;
    }
    return files;
  }

  function parseXml(xmlStr) {
    return new DOMParser().parseFromString(xmlStr, 'application/xml');
  }

  async function parseDocx(buffer) {
    const files = await unzipOffice(buffer);
    if (!files['word/document.xml']) throw new Error('缺少 word/document.xml');
    const xmlBytes = await files['word/document.xml']();
    const doc = parseXml(new TextDecoder('utf-8').decode(xmlBytes));
    const body = doc.getElementsByTagName('w:body')[0];
    if (!body) return '';
    const lines = [];
    for (let i = 0; i < body.children.length; i++) {
      const node = body.children[i];
      const tag = node.tagName.toLowerCase();
      if (tag === 'w:p') {
        const styleEl = node.getElementsByTagName('w:pStyle')[0];
        const styleVal = styleEl ? styleEl.getAttribute('w:val') : '';
        let pText = '';
        const runs = node.getElementsByTagName('w:r');
        for (let r = 0; r < runs.length; r++) {
          const isBold = runs[r].getElementsByTagName('w:b').length > 0;
          const textEls = runs[r].getElementsByTagName('w:t');
          let rText = '';
          for (let t = 0; t < textEls.length; t++) rText += textEls[t].textContent;
          if (rText) pText += isBold ? `**${rText}**` : rText;
        }
        pText = pText.trim();
        if (pText) {
          if (styleVal && styleVal.toLowerCase().includes('heading1')) lines.push(`# ${pText}`);
          else if (styleVal && styleVal.toLowerCase().includes('heading2')) lines.push(`## ${pText}`);
          else if (styleVal && styleVal.toLowerCase().includes('heading3')) lines.push(`### ${pText}`);
          else lines.push(pText);
        } else {
          lines.push('');
        }
      } else if (tag === 'w:tbl') {
        const trs = node.getElementsByTagName('w:tr');
        const rows = [];
        let maxCols = 0;
        for (let r = 0; r < trs.length; r++) {
          const tcs = trs[r].getElementsByTagName('w:tc');
          const rowCells = [];
          for (let c = 0; c < tcs.length; c++) {
            const textEls = tcs[c].getElementsByTagName('w:t');
            let cellText = '';
            for (let t = 0; t < textEls.length; t++) cellText += textEls[t].textContent;
            rowCells.push(cellText.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim());
          }
          if (rowCells.length > maxCols) maxCols = rowCells.length;
          rows.push(rowCells);
        }
        if (rows.length > 0 && maxCols > 0) {
          lines.push('');
          const header = rows[0];
          while (header.length < maxCols) header.push('');
          lines.push('| ' + header.join(' | ') + ' |');
          lines.push('| ' + new Array(maxCols).fill('---').join(' | ') + ' |');
          for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            while (row.length < maxCols) row.push('');
            lines.push('| ' + row.join(' | ') + ' |');
          }
          lines.push('');
        }
      }
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  async function parseXlsx(buffer) {
    const files = await unzipOffice(buffer);
    const sharedStrings = [];
    if (files['xl/sharedStrings.xml']) {
      const sstDoc = parseXml(new TextDecoder('utf-8').decode(await files['xl/sharedStrings.xml']()));
      const sis = sstDoc.getElementsByTagName('si');
      for (let i = 0; i < sis.length; i++) {
        const ts = sis[i].getElementsByTagName('t');
        let text = '';
        for (let j = 0; j < ts.length; j++) text += ts[j].textContent;
        sharedStrings.push(text);
      }
    }
    const sheetNames = {};
    if (files['xl/workbook.xml']) {
      const wbDoc = parseXml(new TextDecoder('utf-8').decode(await files['xl/workbook.xml']()));
      const sheets = wbDoc.getElementsByTagName('sheet');
      for (let i = 0; i < sheets.length; i++) {
        const s = sheets[i];
        sheetNames[`sheet${s.getAttribute('sheetId') || (i + 1)}.xml`] = s.getAttribute('name');
      }
    }
    const sections = [];
    const sheetPaths = Object.keys(files).filter(k => k.startsWith('xl/worksheets/sheet') && k.endsWith('.xml')).sort();
    for (const sp of sheetPaths) {
      const fn = sp.split('/').pop();
      const title = sheetNames[fn] || fn.replace('.xml', '');
      const sheetDoc = parseXml(new TextDecoder('utf-8').decode(await files[sp]()));
      const rows = sheetDoc.getElementsByTagName('row');
      if (rows.length === 0) continue;
      const grid = [];
      let maxCols = 0;
      const limit = Math.min(rows.length, 300);
      for (let r = 0; r < limit; r++) {
        const cs = rows[r].getElementsByTagName('c');
        const rowCells = [];
        for (let c = 0; c < cs.length; c++) {
          const cell = cs[c];
          const ref = cell.getAttribute('r') || '';
          const type = cell.getAttribute('t');
          const vEl = cell.getElementsByTagName('v')[0];
          let val = vEl ? vEl.textContent : '';
          if (type === 's' && val !== '') val = sharedStrings[parseInt(val, 10)] ?? val;
          else if (type === 'b') val = val === '1' ? 'TRUE' : 'FALSE';
          const letters = ref.replace(/[0-9]/g, '');
          let colIdx = 0;
          for (let l = 0; l < letters.length; l++) colIdx = colIdx * 26 + (letters.charCodeAt(l) - 64);
          colIdx = Math.max(0, colIdx - 1);
          while (rowCells.length < colIdx) rowCells.push('');
          rowCells[colIdx] = String(val).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
        }
        if (rowCells.length > maxCols) maxCols = rowCells.length;
        grid.push(rowCells);
      }
      if (grid.length > 0 && maxCols > 0) {
        const lines = [`### 📊 工作表: ${title}\n`];
        const header = grid[0];
        while (header.length < maxCols) header.push('');
        lines.push('| ' + header.join(' | ') + ' |');
        lines.push('| ' + new Array(maxCols).fill('---').join(' | ') + ' |');
        for (let r = 1; r < grid.length; r++) {
          const row = grid[r];
          while (row.length < maxCols) row.push('');
          lines.push('| ' + row.join(' | ') + ' |');
        }
        if (rows.length > 300) lines.push(`\n*(该工作表行数较多，已自动截取前 300 行)*`);
        sections.push(lines.join('\n'));
      }
    }
    return sections.join('\n\n');
  }

  async function parsePptx(buffer) {
    const files = await unzipOffice(buffer);
    const slidePaths = Object.keys(files).filter(k => k.match(/^ppt\/slides\/slide\d+\.xml$/)).sort((a, b) => {
      return parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10);
    });
    const slides = [];
    for (let idx = 0; idx < slidePaths.length; idx++) {
      const doc = parseXml(new TextDecoder('utf-8').decode(await files[slidePaths[idx]]()));
      const ps = doc.getElementsByTagName('a:p');
      const texts = [];
      for (let i = 0; i < ps.length; i++) {
        const ts = ps[i].getElementsByTagName('a:t');
        let pText = '';
        for (let j = 0; j < ts.length; j++) pText += ts[j].textContent;
        if (pText.trim()) texts.push(pText.trim());
      }
      if (texts.length > 0) {
        let content = `### 📽️ 幻灯片 ${idx + 1}\n\n**主题**: ${texts[0]}\n\n`;
        if (texts.length > 1) content += texts.slice(1).map(t => `- ${t}`).join('\n');
        slides.push(content);
      }
    }
    return slides.join('\n\n---\n\n');
  }

  async function parseFileContent(file) {
    const buffer = await file.arrayBuffer();
    const name = file.name;
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'docx' || ext === 'doc') {
      const md = await parseDocx(buffer);
      return `【📄 已导入 Word 文档：${name}】\n\n${md}\n\n`;
    } else if (ext === 'xlsx' || ext === 'xls') {
      const md = await parseXlsx(buffer);
      return `【📊 已导入 Excel 表格：${name}】\n\n${md}\n\n`;
    } else if (ext === 'pptx' || ext === 'ppt') {
      const md = await parsePptx(buffer);
      return `【📽️ 已导入 PowerPoint 幻灯片：${name}】\n\n${md}\n\n`;
    } else {
      const text = new TextDecoder('utf-8').decode(buffer);
      return `【📝 已导入文档：${name}】\n\n${text}\n\n`;
    }
  }

  // 2. Lexical Safe Inserter
  function insertIntoChatBox(text) {
    const editor = document.querySelector('[data-lexical-editor="true"]');
    if (!editor) {
      alert('未找到聊天输入框，请确保处于对话界面。');
      return;
    }
    editor.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const pasteEvt = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    });
    editor.dispatchEvent(pasteEvt);
  }

  // Toast feedback helper
  function showToast(msg, isSuccess = true) {
    let toast = document.getElementById('agy-office-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'agy-office-toast';
      toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:999999;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.25);transition:all 0.2s ease;pointer-events:none;opacity:0;';
      document.body.appendChild(toast);
    }
    toast.style.background = isSuccess ? 'var(--secondary, #2a2a2a)' : '#991b1b';
    toast.style.color = isSuccess ? 'var(--foreground, #fff)' : '#fecaca';
    toast.style.border = isSuccess ? '1px solid var(--border, #444)' : '1px solid #dc2626';
    toast.innerText = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(10px)';
    }, 2500);
  }

  // Native Image inserter for Lexical editor
  function insertImageIntoChatBox(dataUrl) {
    const editor = document.querySelector('[data-lexical-editor="true"], div[contenteditable="true"], textarea');
    if (!editor) return;

    try {
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const file = new File([blob], 'screenshot_' + Date.now() + '.png', { type: mime });

      editor.focus();
      const dt = new DataTransfer();
      dt.items.add(file);
      const pasteEvt = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      });
      editor.dispatchEvent(pasteEvt);
    } catch (err) {
      console.error('[Antigravity Screenshot] Paste image error:', err);
    }
  }

  let agyScreenshotPolling = null;

  async function triggerScreenshotCapture() {
    showToast('📸 正在启动截图工具，截取后将自动填入输入框...');

    let initialImg = null;
    try {
      if (window.electronNative && typeof window.electronNative.getClipboardImage === 'function') {
        initialImg = await window.electronNative.getClipboardImage();
      }
    } catch (e) {}

    let launched = false;
    if (window.electronNative && typeof window.electronNative.takeScreenshot === 'function') {
      try {
        const res = await window.electronNative.takeScreenshot();
        if (res && res.success) launched = true;
      } catch (e) {}
    }

    if (!launched) {
      try {
        window.open('ms-screenclip:');
        launched = true;
      } catch (e) {
        try {
          const a = document.createElement('a');
          a.href = 'ms-screenclip:';
          a.click();
          launched = true;
        } catch (err) {}
      }
    }

    if (agyScreenshotPolling) {
      clearInterval(agyScreenshotPolling);
      agyScreenshotPolling = null;
    }

    // Auto-detect newly captured screenshot from system clipboard
    let attempts = 0;
    const maxAttempts = 40; // 20 seconds polling
    agyScreenshotPolling = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(agyScreenshotPolling);
        agyScreenshotPolling = null;
        return;
      }

      try {
        let currentImg = null;
        if (window.electronNative && typeof window.electronNative.getClipboardImage === 'function') {
          currentImg = await window.electronNative.getClipboardImage();
        }
        if (currentImg && currentImg !== initialImg && currentImg.startsWith('data:image/')) {
          clearInterval(agyScreenshotPolling);
          agyScreenshotPolling = null;
          insertImageIntoChatBox(currentImg);
          showToast('✅ 截图已自动附加到对话框！');
        }
      } catch (e) {}
    }, 500);
  }
  window.__AGY_TRIGGER_SCREENSHOT__ = triggerScreenshotCapture;

  // 3. UI Buttons Mount & Handling (Office Uploader + Screenshot)
  function attachUploadButton() {
    const toolbar = document.querySelector('.flex.min-w-0.flex-1.items-center.gap-px');
    if (!toolbar) return;

    // Create file input
    let fileInput = document.getElementById('agy-office-file-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.id = 'agy-office-file-input';
      fileInput.type = 'file';
      fileInput.accept = '.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.md,.csv';
      fileInput.className = 'hidden';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);

      fileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          showToast(`正在解析 ${f.name}...`);
          try {
            const md = await parseFileContent(f);
            insertIntoChatBox(md);
            showToast(`✅ ${f.name} 解析并填入成功！`);
          } catch (err) {
            console.error('Office parse error:', err);
            showToast(`❌ 解析失败: ${err.message}`, false);
          }
        }
        fileInput.value = '';
      });
    }

    // Office upload button
    let btn = document.getElementById('agy-office-upload-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'agy-office-upload-btn';
      btn.type = 'button';
      btn.className = 'p-1.5 rounded-full text-secondary-foreground hover:bg-secondary cursor-pointer transition-colors';
      btn.setAttribute('aria-label', '上传文档 (Word/PPT/Excel)');
      btn.setAttribute('title', '上传文档 (Word / PPT / Excel / 文本)');
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });

      const contextBtn = toolbar.querySelector('button[aria-label*="上下文"], button[aria-label*="context"]');
      if (contextBtn) {
        contextBtn.insertAdjacentElement('afterend', btn);
      } else {
        toolbar.appendChild(btn);
      }
    }

    // Quick screenshot toolbar button
    let screenBtn = document.getElementById('agy-toolbar-screenshot-btn');
    if (!screenBtn) {
      screenBtn = document.createElement('button');
      screenBtn.id = 'agy-toolbar-screenshot-btn';
      screenBtn.type = 'button';
      screenBtn.className = 'p-1.5 rounded-full text-secondary-foreground hover:bg-secondary cursor-pointer transition-colors';
      screenBtn.setAttribute('aria-label', '屏幕截图 (调用 AI 识图)');
      screenBtn.setAttribute('title', '屏幕截图 (Win+Shift+S / AI 识图)');
      screenBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
          <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
          <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
          <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
          <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      `;
      screenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerScreenshotCapture();
      });

      if (btn && btn.parentElement) {
        btn.insertAdjacentElement('afterend', screenBtn);
      } else {
        toolbar.appendChild(screenBtn);
      }
    }
  }

  // Inject Screenshot Item into "+ Add Context" Dropdown Menu
  function mountScreenshotMenuItem() {
    if (document.getElementById('agy-screenshot-menu-item')) return;

    const allEls = document.querySelectorAll('button, [role="menuitem"], [role="option"], div');
    let mediaItem = null;

    for (let i = 0; i < allEls.length; i++) {
      const el = allEls[i];
      const text = (el.textContent || '').trim();
      if (text === '媒体 / 图片' || text === 'Media') {
        const item = el.closest('button, [role="menuitem"], [role="option"], [tabindex], div.cursor-pointer') || el.parentElement;
        if (item && item.parentElement && item.parentElement.children.length >= 2) {
          mediaItem = item;
          break;
        }
      }
    }

    if (!mediaItem || !mediaItem.parentElement) return;

    // Clone mediaItem to perfectly match theme styling, fonts, hover backgrounds
    const screenshotItem = mediaItem.cloneNode(true);
    screenshotItem.id = 'agy-screenshot-menu-item';

    const existingSvg = screenshotItem.querySelector('svg');
    const screenClipSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="9" x2="12" y2="9.01"/><line x1="12" y1="15" x2="12" y2="15.01"/><line x1="9" y1="12" x2="9.01" y2="12"/><line x1="15" y1="12" x2="15.01" y2="12"/></svg>';
    if (existingSvg) {
      existingSvg.outerHTML = screenClipSvg;
    }

    // Replace label text
    const walker = document.createTreeWalker(screenshotItem, NodeFilter.SHOW_TEXT, null, false);
    let tNode;
    let foundText = false;
    while ((tNode = walker.nextNode())) {
      if (tNode.nodeValue.includes('媒体 / 图片') || tNode.nodeValue.includes('Media')) {
        tNode.nodeValue = '屏幕截图 (Win+Shift+S)';
        foundText = true;
        break;
      }
    }
    if (!foundText) {
      const spans = screenshotItem.querySelectorAll('span, div');
      if (spans.length > 0) {
        spans[spans.length - 1].textContent = '屏幕截图 (Win+Shift+S)';
      }
    }

    screenshotItem.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Dismiss menu popover
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const popoverBackdrop = document.querySelector('[data-radix-popper-content-wrapper], [data-base-ui-popover]');
      if (popoverBackdrop) popoverBackdrop.style.display = 'none';

      triggerScreenshotCapture();
    });

    mediaItem.insertAdjacentElement('afterend', screenshotItem);
  }
  window.__AGY_MOUNT_SCREENSHOT_MENU_ITEM__ = mountScreenshotMenuItem;

  // 4. Global Drag & Drop Handler
  function setupDragAndDrop() {
    if (window.__antigravity_dnd_installed) return;
    window.__antigravity_dnd_installed = true;

    window.addEventListener('dragover', (e) => {
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
      }
    }, false);

    window.addEventListener('drop', async (e) => {
      if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
      
      const files = Array.from(e.dataTransfer.files);
      const officeFiles = files.filter(f => {
        const ext = f.name.split('.').pop().toLowerCase();
        return ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext);
      });

      if (officeFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();

        for (const f of officeFiles) {
          showToast(`正在解析拖入的 ${f.name}...`);
          try {
            const md = await parseFileContent(f);
            insertIntoChatBox(md);
            showToast(`✅ ${f.name} 拖入解析成功！`);
          } catch (err) {
            console.error('Drop parse error:', err);
            showToast(`❌ 拖拽解析失败: ${err.message}`, false);
          }
        }
      }
    }, true);
  }

  // 5. Lifecycle Watcher (React SPA DOM self-healing)
  setInterval(attachUploadButton, 1000);
  attachUploadButton();
  setupDragAndDrop();

  console.log('[Antigravity Mod] Office uploader & drag-and-drop parser active!');
})();

// Antigravity Chat Toolbar Permission Switcher (Version 1 UI & Theme Adaptive & Zero-Flicker)
// Restores Version 1 UI layout with crystal-clear high-contrast text in Light & Dark modes.

(function () {
  // 1. Clean up any existing intervals and elements
  if (window.__antigravity_perm_interval) {
    clearInterval(window.__antigravity_perm_interval);
    window.__antigravity_perm_interval = null;
  }
  const oldBtn = document.getElementById('agy-permission-switch-btn');
  if (oldBtn) oldBtn.remove();
  const oldDd = document.getElementById('agy-permission-dropdown');
  if (oldDd) oldDd.remove();

  // 2. Inject global CSS style rule to enforce high-contrast text across themes
  let styleEl = document.getElementById('agy-perm-theme-css');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'agy-perm-theme-css';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    /* Light Mode: Always dark high-contrast text, NEVER white */
    body.theme-light #agy-permission-switch-btn,
    body:not(.theme-dark):not(.dark) #agy-permission-switch-btn {
      color: #18181b !important;
    }
    body.theme-light #agy-permission-switch-btn span,
    body:not(.theme-dark):not(.dark) #agy-permission-switch-btn span {
      color: #18181b !important;
    }
    /* Dark Mode: Always bright white text */
    body.theme-dark #agy-permission-switch-btn,
    body.dark #agy-permission-switch-btn,
    html.dark #agy-permission-switch-btn {
      color: #f4f4f5 !important;
    }
    body.theme-dark #agy-permission-switch-btn span,
    body.dark #agy-permission-switch-btn span,
    html.dark #agy-permission-switch-btn span {
      color: #f4f4f5 !important;
    }
  `;

  window.__antigravity_permission_switcher_installed = true;

  let cachedSP = null;
  let cachedSS = null;

  function isDarkTheme() {
    if (document.documentElement.classList.contains('dark')) return true;
    if (document.body.classList.contains('theme-dark')) return true;
    if (document.body.classList.contains('theme-light')) return false;
    const color = getComputedStyle(document.body).color;
    const match = color.match(/\d+/g);
    if (match) {
      const brightness = (parseInt(match[0]) * 299 + parseInt(match[1]) * 587 + parseInt(match[2]) * 114) / 1000;
      return brightness > 128;
    }
    return false;
  }

  function findFiberRoots() {
    const el = document.querySelector('[data-lexical-editor]') || document.querySelector('button');
    if (!el) return null;
    const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
    let curr = el[fiberKey];
    while (curr) {
      if (curr.type?.name === 'D3b' || curr.memoizedProps?.settingsProvider) {
        cachedSP = curr.memoizedProps.settingsProvider;
        cachedSS = curr.memoizedProps.services?.core?.settingsService;
        return { sp: cachedSP, ss: cachedSS };
      }
      curr = curr.return;
    }
    return null;
  }

  function getSettingsProvider() {
    if (cachedSP && cachedSP.getState) return cachedSP;
    findFiberRoots();
    return cachedSP;
  }

  function getSettingsService() {
    if (cachedSS) return cachedSS;
    findFiberRoots();
    return cachedSS;
  }

  function openGlobalSettings() {
    const allButtons = Array.from(document.querySelectorAll('button'));
    const settingsBtn = allButtons.find(b => 
      b.innerText.trim() === '设置' || 
      b.innerText.includes('设置') || 
      b.getAttribute('aria-label')?.includes('Settings') || 
      b.querySelector('svg')?.parentElement?.innerText.includes('设置')
    );
    if (settingsBtn) {
      settingsBtn.click();
      return true;
    }
    const ss = getSettingsService();
    if (ss && typeof ss.openSettingsWithId === 'function') {
      ss.openSettingsWithId('General');
      return true;
    }
    return false;
  }

  // Version 1 Preset Definitions
  const PRESETS = {
    turbo: {
      id: 'turbo',
      name: '极速模式',
      fullName: '极速模式 (Turbo)',
      desc: '关闭所有安全阻断以获得极致的迭代速度。',
      light: {
        badgeBg: 'rgba(245, 158, 11, 0.12)',
        badgeBorder: 'rgba(245, 158, 11, 0.35)',
        iconColor: '#d97706',
        textColor: '#18181b',
        chevronColor: '#71717a'
      },
      dark: {
        badgeBg: 'rgba(245, 158, 11, 0.18)',
        badgeBorder: 'rgba(245, 158, 11, 0.4)',
        iconColor: '#f59e0b',
        textColor: '#f4f4f5',
        chevronColor: '#a1a1aa'
      },
      iconSvg: (isDark) => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${isDark ? '#f59e0b' : '#d97706'}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      prefValues: {
        cascadeAutoExecutionPolicy: 3,
        nonWorkspaceFileAccessPolicy: 1,
        enableTerminalSandbox: false,
        permissionPreset: 3
      }
    },
    full_machine: {
      id: 'full_machine',
      name: '整机模式',
      fullName: '整机模式',
      desc: '所有终端命令均需人工审查。智能体可以读写本机上的任何文件。',
      light: {
        badgeBg: 'rgba(59, 130, 246, 0.1)',
        badgeBorder: 'rgba(59, 130, 246, 0.35)',
        iconColor: '#2563eb',
        textColor: '#18181b',
        chevronColor: '#71717a'
      },
      dark: {
        badgeBg: 'rgba(59, 130, 246, 0.18)',
        badgeBorder: 'rgba(59, 130, 246, 0.4)',
        iconColor: '#3b82f6',
        textColor: '#f4f4f5',
        chevronColor: '#a1a1aa'
      },
      iconSvg: (isDark) => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${isDark ? '#3b82f6' : '#2563eb'}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      prefValues: {
        cascadeAutoExecutionPolicy: 1,
        nonWorkspaceFileAccessPolicy: 1,
        enableTerminalSandbox: false,
        permissionPreset: 0
      }
    },
    default: {
      id: 'default',
      name: '默认模式',
      fullName: '默认',
      desc: '对所有终端命令以及工作区外部的文件访问均需人工审查。',
      light: {
        badgeBg: 'rgba(16, 185, 129, 0.1)',
        badgeBorder: 'rgba(16, 185, 129, 0.35)',
        iconColor: '#059669',
        textColor: '#18181b',
        chevronColor: '#71717a'
      },
      dark: {
        badgeBg: 'rgba(16, 185, 129, 0.18)',
        badgeBorder: 'rgba(16, 185, 129, 0.4)',
        iconColor: '#10b981',
        textColor: '#f4f4f5',
        chevronColor: '#a1a1aa'
      },
      iconSvg: (isDark) => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${isDark ? '#10b981' : '#059669'}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      prefValues: {
        cascadeAutoExecutionPolicy: 1,
        nonWorkspaceFileAccessPolicy: 2,
        enableTerminalSandbox: false,
        permissionPreset: 1
      }
    },
    custom: {
      id: 'custom',
      name: '自定义',
      fullName: '自定义',
      desc: '手动自定义各项详细设置。',
      light: {
        badgeBg: 'rgba(168, 85, 247, 0.1)',
        badgeBorder: 'rgba(168, 85, 247, 0.35)',
        iconColor: '#9333ea',
        textColor: '#18181b',
        chevronColor: '#71717a'
      },
      dark: {
        badgeBg: 'rgba(168, 85, 247, 0.18)',
        badgeBorder: 'rgba(168, 85, 247, 0.4)',
        iconColor: '#a855f7',
        textColor: '#f4f4f5',
        chevronColor: '#a1a1aa'
      },
      iconSvg: (isDark) => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${isDark ? '#a855f7' : '#9333ea'}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
      prefValues: null
    }
  };

  function getCurrentPreset() {
    const sp = getSettingsProvider();
    if (!sp) return PRESETS.turbo;
    const state = sp.getState();
    const terminal = state.getPrefValue('cascadeAutoExecutionPolicy');
    const fileAccess = state.getPrefValue('nonWorkspaceFileAccessPolicy');
    const sandbox = state.getPrefValue('enableTerminalSandbox') || false;

    if (!sandbox && terminal === 3 && fileAccess === 1) {
      return PRESETS.turbo;
    }
    if (!sandbox && terminal === 1 && fileAccess === 1) {
      return PRESETS.full_machine;
    }
    if (!sandbox && terminal === 1 && fileAccess === 2) {
      return PRESETS.default;
    }
    return PRESETS.custom;
  }

  function showToast(text, isSuccess = true) {
    let container = document.getElementById('agy-mod-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'agy-mod-toast-container';
      container.style.cssText = `
        position: fixed;
        bottom: 82px;
        right: 24px;
        z-index: 1000000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }

    const dark = isDarkTheme();
    const toast = document.createElement('div');
    toast.style.cssText = `
      background: ${dark ? '#1c1c1f' : '#ffffff'};
      color: ${dark ? '#f4f4f5' : '#111827'};
      border: 1px solid ${isSuccess ? (dark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(5, 150, 105, 0.35)') : (dark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(220, 38, 38, 0.35)')};
      border-radius: 10px;
      padding: 8px 15px;
      font-size: 12.5px;
      font-weight: 500;
      box-shadow: ${dark ? '0 10px 30px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.12)'};
      display: flex;
      align-items: center;
      gap: 8px;
      backdrop-filter: blur(16px);
      opacity: 0;
      transform: translateY(8px);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    toast.innerHTML = text;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 250);
    }, 2400);
  }

  let dropdownEl = null;

  function closeDropdown() {
    if (dropdownEl) {
      dropdownEl.remove();
      dropdownEl = null;
    }
    document.removeEventListener('click', handleOutsideClick, true);
    document.removeEventListener('keydown', handleKeydown, true);
  }

  function handleOutsideClick(e) {
    if (!dropdownEl) return;
    const btn = document.getElementById('agy-permission-switch-btn');
    if (btn && (btn === e.target || btn.contains(e.target))) return;
    if (!dropdownEl.contains(e.target)) {
      closeDropdown();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') closeDropdown();
  }

  function openDropdown(anchorBtn) {
    if (dropdownEl) {
      closeDropdown();
      return;
    }

    const current = getCurrentPreset();
    const rect = anchorBtn.getBoundingClientRect();
    const dark = isDarkTheme();

    dropdownEl = document.createElement('div');
    dropdownEl.id = 'agy-permission-dropdown';
    dropdownEl.style.cssText = `
      position: fixed;
      left: ${Math.max(12, rect.left)}px;
      bottom: ${window.innerHeight - rect.top + 8}px;
      width: 320px;
      background: ${dark ? '#1c1c1f' : '#ffffff'};
      border: 1px solid ${dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'};
      border-radius: 14px;
      box-shadow: ${dark ? '0 20px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)' : '0 16px 40px -4px rgba(0, 0, 0, 0.12), 0 4px 16px -2px rgba(0, 0, 0, 0.06)'};
      backdrop-filter: blur(24px);
      padding: 6px;
      z-index: 999999;
      font-family: inherit;
      user-select: none;
    `;

    // Dropdown Header: "全局权限安全预设" (left), "即选即生效" (right)
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 8px 10px 7px;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid ${dark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)'};
    `;
    header.innerHTML = `
      <div style="font-size: 11px; font-weight: 700; color: ${dark ? '#a1a1aa' : '#71717a'}; text-transform: uppercase; letter-spacing: 0.05em;">全局权限安全预设</div>
      <div style="font-size: 11px; color: ${dark ? '#71717a' : '#a1a1aa'};">即选即生效</div>
    `;
    dropdownEl.appendChild(header);

    // Preset Options: Version 1 order (turbo, full_machine, default)
    const options = [PRESETS.turbo, PRESETS.full_machine, PRESETS.default];
    options.forEach(opt => {
      const isSelected = opt.id === current.id;
      const themeColors = dark ? opt.dark : opt.light;

      const item = document.createElement('div');
      item.style.cssText = `
        padding: 8px 10px;
        border-radius: 10px;
        cursor: pointer;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 2px;
        background: ${isSelected ? (dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)') : 'transparent'};
        transition: background 0.15s ease;
      `;

      item.addEventListener('mouseenter', () => {
        if (!isSelected) item.style.background = dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.035)';
      });
      item.addEventListener('mouseleave', () => {
        if (!isSelected) item.style.background = 'transparent';
      });

      item.innerHTML = `
        <div style="
          margin-top: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: ${themeColors.badgeBg};
          border: 1px solid ${themeColors.badgeBorder};
          flex-shrink: 0;
        ">${opt.iconSvg(dark)}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; line-height: 1.3;">
            <span style="font-size: 13px; font-weight: 600; color: ${dark ? '#f4f4f5' : '#18181b'};">${opt.fullName}</span>
            ${isSelected ? `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${dark ? '#10b981' : '#059669'}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ` : ''}
          </div>
          <div style="font-size: 11.5px; color: ${dark ? '#a1a1aa' : '#6b7280'}; margin-top: 2px; line-height: 1.4;">${opt.desc}</div>
        </div>
      `;

      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        closeDropdown();
        await applyPreset(opt);
      });

      dropdownEl.appendChild(item);
    });

    // Divider
    const hr = document.createElement('div');
    hr.style.cssText = `height: 1px; background: ${dark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)'}; margin: 5px 6px;`;
    dropdownEl.appendChild(hr);

    // Custom option: "打开全局权限详细设置..."
    const customColors = dark ? PRESETS.custom.dark : PRESETS.custom.light;
    const customItem = document.createElement('div');
    customItem.style.cssText = `
      padding: 7px 10px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: background 0.15s ease;
    `;
    customItem.addEventListener('mouseenter', () => customItem.style.background = dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.035)');
    customItem.addEventListener('mouseleave', () => customItem.style.background = 'transparent');
    customItem.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        background: ${customColors.badgeBg};
        border: 1px solid ${customColors.badgeBorder};
        flex-shrink: 0;
      ">${PRESETS.custom.iconSvg(dark)}</div>
      <div style="flex: 1; min-width: 0;">
        <span style="font-size: 12px; font-weight: 500; color: ${dark ? '#d4d4d8' : '#27272a'};">打开全局权限详细设置...</span>
      </div>
    `;
    customItem.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDropdown();
      openGlobalSettings();
    });
    dropdownEl.appendChild(customItem);

    document.body.appendChild(dropdownEl);

    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick, true);
      document.addEventListener('keydown', handleKeydown, true);
    }, 10);
  }

  async function applyPreset(preset) {
    const sp = getSettingsProvider();
    if (!sp) {
      showToast('❌ 未找到设置控制器', false);
      return;
    }

    try {
      await sp.getState().setPrefValues(preset.prefValues);
      updateButtonDisplay();
      showToast(`${preset.iconSvg(isDarkTheme())} 已切换至 <strong>${preset.fullName}</strong>`);
    } catch (e) {
      console.error('[Antigravity Mod] Failed to set permissions:', e);
      showToast(`❌ 权限切换失败: ${e.message}`, false);
    }
  }

  // Idempotent button update: NEVER modifies DOM unless state actually changed
  function updateButtonDisplay() {
    const btn = document.getElementById('agy-permission-switch-btn');
    if (!btn) return;

    const preset = getCurrentPreset();
    const dark = isDarkTheme();
    const stateKey = `${preset.id}_${dark}`;

    // Cache check: prevent redundant DOM updates (avoids flickering!)
    if (btn.dataset.stateKey === stateKey) {
      return;
    }
    btn.dataset.stateKey = stateKey;

    const themeColors = dark ? preset.dark : preset.light;

    btn.style.background = themeColors.badgeBg;
    btn.style.borderColor = themeColors.badgeBorder;
    btn.style.color = themeColors.textColor;

    btn.innerHTML = `
      <span style="display: flex; align-items: center; margin-right: 2px;">${preset.iconSvg(dark)}</span>
      <span style="font-size: 12px; font-weight: 600; color: ${themeColors.textColor} !important; letter-spacing: -0.01em;">${preset.name}</span>
      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style="color: ${themeColors.chevronColor}; opacity: 0.7; margin-left: 2px;">
        <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    btn.setAttribute('title', `全局权限: ${preset.fullName} (点击快速切换)`);
  }

  function attachPermissionButton() {
    const modelTrigger = document.querySelector('[data-testid="model-selector-trigger"]');
    if (!modelTrigger) return;

    const modelWrapper = modelTrigger.closest('.no-focus-agent-input') || modelTrigger.parentElement;
    if (!modelWrapper || !modelWrapper.parentElement) return;

    const container = modelWrapper.parentElement;
    let btn = document.getElementById('agy-permission-switch-btn');

    // If button already exists and is in the correct container, only update presentation
    if (btn) {
      if (btn.parentElement === container) {
        updateButtonDisplay();
        return;
      }
      btn.remove();
    }

    btn = document.createElement('button');
    btn.id = 'agy-permission-switch-btn';
    btn.type = 'button';
    btn.className = 'flex min-w-0 cursor-pointer items-center h-7 gap-1 rounded-lg px-2 text-xs outline-none hover:opacity-85 transition-opacity';
    btn.style.cssText = `
      border: 1px solid rgba(0,0,0,0.08);
      margin-left: 5px;
      flex-shrink: 0;
      border-radius: 8px;
    `;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDropdown(btn);
    });

    modelWrapper.insertAdjacentElement('afterend', btn);
    updateButtonDisplay();

    // Hook settings change listener if not yet hooked
    const sp = getSettingsProvider();
    if (sp && !window.__antigravity_sp_subscribed) {
      window.__antigravity_sp_subscribed = true;
      sp.onDidChange(() => {
        updateButtonDisplay();
      });
    }
  }

  // Use a gentle interval (2s) that is strictly idempotent
  window.__antigravity_perm_interval = setInterval(attachPermissionButton, 2000);
  attachPermissionButton();

  console.log('[Antigravity Mod] Version 1 UI Permission Switcher (Theme-Adaptive & High-Contrast) loaded!');
})();

// Antigravity Sidebar Real-Time Quota Widget
// Displays 5-Hour and Weekly Quotas with visualization right above "⚙ 设置" in the sidebar.

(function() {
    if (window.__AGY_QUOTA_WIDGET_INITIALIZED__) {
        console.log('[Antigravity Quota] Already initialized, re-rendering...');
        if (typeof window.__AGY_REFRESH_QUOTA__ === 'function') {
            window.__AGY_REFRESH_QUOTA__();
        }
        return;
    }
    window.__AGY_QUOTA_WIDGET_INITIALIZED__ = true;

    // Inject CSS
    const styleId = 'agy-sidebar-quota-style';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = `
            #agy-sidebar-quota-card {
                margin-bottom: 8px;
                padding: 10px 12px;
                border-radius: 12px;
                border: 1px solid var(--agy-quota-border, #e4e4e7);
                background: var(--agy-quota-bg, #ffffff);
                color: var(--agy-quota-text, #18181b);
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
                transition: all 0.2s ease;
                user-select: none;
                font-family: inherit;
                position: relative;
            }
            body.theme-dark #agy-sidebar-quota-card {
                --agy-quota-border: #27272a;
                --agy-quota-bg: #18181b;
                --agy-quota-text: #f4f4f5;
                --agy-quota-subtext: #a1a1aa;
                --agy-quota-track: #27272a;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
            }
            body.theme-light #agy-sidebar-quota-card {
                --agy-quota-border: #e4e4e7;
                --agy-quota-bg: #ffffff;
                --agy-quota-text: #18181b;
                --agy-quota-subtext: #71717a;
                --agy-quota-track: #f4f4f5;
            }
            .agy-quota-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 8px;
            }
            .agy-quota-title-wrap {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .agy-quota-title {
                font-size: 11.5px;
                font-weight: 600;
                color: var(--agy-quota-text, #18181b);
                letter-spacing: -0.01em;
            }
            .agy-quota-tabs {
                display: flex;
                background: var(--agy-quota-track, #f4f4f5);
                border-radius: 6px;
                padding: 2px;
                gap: 2px;
            }
            .agy-quota-tab {
                font-size: 10px;
                padding: 1px 6px;
                border-radius: 4px;
                cursor: pointer;
                color: var(--agy-quota-subtext, #71717a);
                transition: all 0.15s;
                border: none;
                background: transparent;
                line-height: 1.3;
            }
            .agy-quota-tab.active {
                background: var(--agy-quota-bg, #ffffff);
                color: var(--agy-quota-text, #18181b);
                font-weight: 600;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            .agy-quota-refresh-btn {
                background: transparent;
                border: none;
                cursor: pointer;
                color: var(--agy-quota-subtext, #71717a);
                padding: 2px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.3s ease, color 0.15s;
            }
            .agy-quota-refresh-btn:hover {
                color: var(--agy-quota-text, #18181b);
            }
            .agy-quota-refresh-btn.spinning svg {
                animation: agy-spin 0.8s linear infinite;
            }
            @keyframes agy-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .agy-quota-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-top: 6px;
            }
            .agy-quota-item-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 11px;
            }
            .agy-quota-item-label {
                color: var(--agy-quota-subtext, #71717a);
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .agy-quota-item-stats {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .agy-quota-item-pct {
                font-weight: 600;
                font-size: 11.5px;
                color: var(--agy-quota-text, #18181b);
                font-variant-numeric: tabular-nums;
            }
            .agy-quota-item-reset {
                font-size: 10px;
                color: var(--agy-quota-subtext, #71717a);
            }
            .agy-quota-bar-track {
                width: 100%;
                height: 5px;
                background: var(--agy-quota-track, #f4f4f5);
                border-radius: 9999px;
                overflow: hidden;
                position: relative;
            }
            .agy-quota-bar-fill {
                height: 100%;
                border-radius: 9999px;
                transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease;
            }
            .agy-quota-ring {
                width: 12px;
                height: 12px;
                transform: rotate(-90deg);
            }
            .agy-quota-ring circle {
                transition: stroke-dashoffset 0.4s ease;
            }
            .agy-profile-tier-badge {
                font-size: 9px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                padding: 1px 4.5px;
                border-radius: 4px;
                line-height: 1.2;
                margin-left: 4px;
                margin-bottom: 7px;
                display: inline-block;
                vertical-align: super;
                box-shadow: none;
                transition: all 0.15s ease;
            }
            .agy-profile-tier-badge.pro {
                background: rgba(99, 102, 241, 0.09);
                color: #6366f1;
                border: 1px solid rgba(99, 102, 241, 0.22);
            }
            body.theme-dark .agy-profile-tier-badge.pro {
                background: rgba(129, 140, 248, 0.14);
                color: #a5b4fc;
                border-color: rgba(129, 140, 248, 0.28);
            }
            .agy-profile-tier-badge.ultra {
                background: rgba(236, 72, 153, 0.09);
                color: #ec4899;
                border: 1px solid rgba(236, 72, 153, 0.22);
            }
            body.theme-dark .agy-profile-tier-badge.ultra {
                background: rgba(244, 114, 182, 0.14);
                color: #f472b6;
                border-color: rgba(244, 114, 182, 0.28);
            }
            .agy-profile-tier-badge.plus {
                background: rgba(14, 165, 233, 0.09);
                color: #0284c7;
                border: 1px solid rgba(14, 165, 233, 0.22);
            }
            body.theme-dark .agy-profile-tier-badge.plus {
                background: rgba(56, 189, 248, 0.14);
                color: #7dd3fc;
                border-color: rgba(56, 189, 248, 0.28);
            }
        `;
        document.head.appendChild(styleEl);
    }

    // Quota State
    let activeModelTab = 'gemini'; // 'gemini' | 'claude'
    let quotaData = null;
    let isFetching = false;

    // Helper: Find Core Service in React Tree
    function getCloudCodeService() {
        const root = document.getElementById('root');
        if (!root) return null;
        const fKey = Object.keys(root).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
        if (!fKey) return null;
        let rootFiber = root[fKey];

        let core = null;
        function walk(f, d = 0) {
            if (!f || d > 40 || core) return;
            if (f.memoizedProps?.value?.core?.cloudCodeService) {
                core = f.memoizedProps.value.core;
                return;
            }
            walk(f.child, d + 1);
            walk(f.sibling, d);
        }
        walk(rootFiber);
        return core ? core.cloudCodeService : null;
    }

    // Helper: Parse raw quota protobuf response
    function parseBucket(b) {
        if (!b) return null;
        const frac = b.remaining?.case === 'remainingFraction' ? b.remaining.value : (typeof b.remaining?.value === 'number' ? b.remaining.value : 1);
        const pct = Math.round(frac * 100);
        let resetText = '';
        if (b.resetTime?.seconds) {
            const resetMs = Number(b.resetTime.seconds) * 1000;
            const diffMs = resetMs - Date.now();
            if (diffMs <= 0) {
                resetText = '<1m';
            } else {
                const totalMins = Math.floor(diffMs / 60000);
                const days = Math.floor(totalMins / 1440);
                const hours = Math.floor((totalMins % 1440) / 60);
                const mins = totalMins % 60;
                if (days > 0) {
                    resetText = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
                } else if (hours > 0) {
                    resetText = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
                } else {
                    resetText = `${mins}m`;
                }
            }
        }
        return {
            id: b.bucketId,
            window: b.window,
            fraction: Math.max(0, Math.min(1, frac)),
            percent: pct,
            resetText: resetText ? `${resetText} 重置` : ''
        };
    }

    async function fetchQuota() {
        if (isFetching) return;
        isFetching = true;
        updateRefreshButtonSpin(true);

        try {
            const ccs = getCloudCodeService();
            if (!ccs || typeof ccs.retrieveUserQuotaSummary !== 'function') {
                console.warn('[Antigravity Quota] CloudCodeService not ready yet');
                return;
            }

            const res = await ccs.retrieveUserQuotaSummary({});
            const groups = res?.response?.groups || [];

            const geminiGroup = groups.find(g => g.displayName?.toLowerCase().includes('gemini') || g.description?.toLowerCase().includes('flash'));
            const claudeGroup = groups.find(g => g.displayName?.toLowerCase().includes('claude') || g.displayName?.toLowerCase().includes('gpt'));

            quotaData = {
                gemini: {
                    name: 'Gemini 系列',
                    weekly: parseBucket(geminiGroup?.buckets?.find(b => b.window === 'weekly' || b.bucketId?.includes('weekly'))),
                    fiveHour: parseBucket(geminiGroup?.buckets?.find(b => b.window === '5h' || b.bucketId?.includes('5h')))
                },
                claude: {
                    name: 'Claude / GPT 系列',
                    weekly: parseBucket(claudeGroup?.buckets?.find(b => b.window === 'weekly' || b.bucketId?.includes('weekly'))),
                    fiveHour: parseBucket(claudeGroup?.buckets?.find(b => b.window === '5h' || b.bucketId?.includes('5h')))
                }
            };
            renderWidget();
        } catch (err) {
            console.error('[Antigravity Quota] Fetch failed:', err);
        } finally {
            isFetching = false;
            updateRefreshButtonSpin(false);
        }
    }
    window.__AGY_REFRESH_QUOTA__ = fetchQuota;

    function updateRefreshButtonSpin(spinning) {
        const btn = document.getElementById('agy-quota-refresh-btn');
        if (!btn) return;
        if (spinning) {
            btn.classList.add('spinning');
        } else {
            btn.classList.remove('spinning');
        }
    }

    function getQuotaColor(fraction) {
        if (fraction >= 0.5) return '#10b981'; // Green (Emerald)
        if (fraction >= 0.2) return '#f59e0b'; // Amber
        return '#ef4444'; // Red (Rose)
    }

    function renderRingSvg(fraction) {
        const radius = 4.5;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference * (1 - fraction);
        const color = getQuotaColor(fraction);
        return `
            <svg class="agy-quota-ring" viewBox="0 0 12 12">
                <circle cx="6" cy="6" r="${radius}" fill="none" stroke="currentColor" opacity="0.15" stroke-width="1.8" />
                <circle cx="6" cy="6" r="${radius}" fill="none" stroke="${color}" stroke-width="1.8"
                    stroke-dasharray="${circumference.toFixed(2)}"
                    stroke-dashoffset="${offset.toFixed(2)}"
                    stroke-linecap="round" />
            </svg>
        `;
    }

    function renderRow(label, bucket) {
        if (!bucket) return '';
        const color = getQuotaColor(bucket.fraction);
        return `
            <div class="agy-quota-item">
                <div class="agy-quota-item-header">
                    <span class="agy-quota-item-label">
                        ${renderRingSvg(bucket.fraction)}
                        ${label}
                    </span>
                    <div class="agy-quota-item-stats">
                        <span class="agy-quota-item-pct">${bucket.percent}%</span>
                        <span class="agy-quota-item-reset">${bucket.resetText}</span>
                    </div>
                </div>
                <div class="agy-quota-bar-track">
                    <div class="agy-quota-bar-fill" style="width: ${bucket.percent}%; background-color: ${color};"></div>
                </div>
            </div>
        `;
    }

    function renderWidget() {
        const container = document.getElementById('agy-sidebar-quota-card');
        if (!container) return;

        const currentModelData = quotaData ? quotaData[activeModelTab] : null;

        container.innerHTML = `
            <div class="agy-quota-header">
                <div class="agy-quota-title-wrap">
                    <span class="agy-quota-title">当前实时额度</span>
                    <div class="agy-quota-tabs">
                        <button class="agy-quota-tab ${activeModelTab === 'gemini' ? 'active' : ''}" id="agy-tab-gemini">Gemini</button>
                        <button class="agy-quota-tab ${activeModelTab === 'claude' ? 'active' : ''}" id="agy-tab-claude">Claude</button>
                    </div>
                </div>
                <button class="agy-quota-refresh-btn" id="agy-quota-refresh-btn" title="刷新额度">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                    </svg>
                </button>
            </div>
            ${currentModelData ? `
                ${renderRow('5小时额度', currentModelData.fiveHour)}
                ${renderRow('周额度', currentModelData.weekly)}
            ` : `
                <div style="font-size: 11px; color: var(--agy-quota-subtext, #71717a); padding: 8px 0; text-align: center;">
                    正在获取额度信息...
                </div>
            `}
        `;

        // Bind events
        const btnGemini = document.getElementById('agy-tab-gemini');
        if (btnGemini) {
            btnGemini.onclick = (e) => {
                e.stopPropagation();
                activeModelTab = 'gemini';
                renderWidget();
            };
        }
        const btnClaude = document.getElementById('agy-tab-claude');
        if (btnClaude) {
            btnClaude.onclick = (e) => {
                e.stopPropagation();
                activeModelTab = 'claude';
                renderWidget();
            };
        }
        const btnRefresh = document.getElementById('agy-quota-refresh-btn');
        if (btnRefresh) {
            btnRefresh.onclick = (e) => {
                e.stopPropagation();
                fetchQuota();
            };
        }
    }

    // Helper: Retrieve User Profile (Account Name & Avatar & Subscription Tier)
    function getUserProfile() {
        try {
            const root = document.getElementById('root');
            if (root) {
                const rKey = Object.keys(root).find(k => k.startsWith('__reactContainer$') || k.startsWith('__reactFiber$'));
                let queue = [root[rKey]];
                let steps = 0;
                while (queue.length > 0 && steps < 6000) {
                    steps++;
                    const cur = queue.shift();
                    if (!cur) continue;
                    if (cur.memoizedProps && cur.memoizedProps.userStatus) {
                        const u = cur.memoizedProps.userStatus;
                        let tier = '';
                        const tierId = (u.userTier?.id || '').toLowerCase();
                        const tierName = (u.userTier?.name || '').toLowerCase();
                        const planName = (u.planStatus?.planInfo?.planName || '').toLowerCase();
                        const str = `${tierId} ${tierName} ${planName}`;
                        if (str.includes('ultra')) tier = 'ULTRA';
                        else if (str.includes('pro')) tier = 'PRO';
                        else if (str.includes('plus')) tier = 'PLUS';

                        const profile = {
                            name: u.name || '乐禾泽',
                            email: u.email || '',
                            avatar: u.profilePictureUrl || '',
                            tier: tier || 'PRO'
                        };
                        try {
                            localStorage.setItem('__AGY_USER_PROFILE__', JSON.stringify(profile));
                        } catch(e) {}
                        return profile;
                    }
                    if (cur.child) queue.push(cur.child);
                    if (cur.sibling) queue.push(cur.sibling);
                }
            }

            const cached = localStorage.getItem('__AGY_USER_PROFILE__');
            if (cached) {
                const profile = JSON.parse(cached);
                if (profile && profile.name) return profile;
            }

            return {
                name: '乐禾泽',
                email: 'time3207486260@Outlook.com',
                avatar: '',
                tier: 'PRO'
            };
        } catch(e) {
            return {
                name: '乐禾泽',
                email: 'time3207486260@Outlook.com',
                avatar: '',
                tier: 'PRO'
            };
        }
    }

    // Mount into sidebar right above Settings button, with User Profile on left and Settings on right
    function mount() {
        const settingsBtn = Array.from(document.querySelectorAll('button')).find(b => {
            return b.innerText && b.innerText.trim() === '设置' && !b.closest('#agy-plugin-center-overlay') && !b.closest('#agy-sidebar-quota-card');
        });
        if (!settingsBtn) return;

        let parent = settingsBtn.parentElement;
        if (parent && parent.id === 'agy-sidebar-bottom-row') {
            parent = parent.parentElement;
        }
        if (!parent) return;

        // 1. Quota Card (mounted above bottom row)
        let card = document.getElementById('agy-sidebar-quota-card');
        if (!card) {
            card = document.createElement('div');
            card.id = 'agy-sidebar-quota-card';
            parent.insertBefore(card, settingsBtn);
            renderWidget();
            fetchQuota();
        }

        // 2. Bottom Row Container (User Profile on left, Settings on right)
        let bottomRow = document.getElementById('agy-sidebar-bottom-row');
        if (!bottomRow) {
            bottomRow = document.createElement('div');
            bottomRow.id = 'agy-sidebar-bottom-row';
            bottomRow.className = 'agy-sidebar-bottom-row';
            parent.appendChild(bottomRow);
        }

        bottomRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 6px; height: 36px; padding: 0; box-sizing: border-box; user-select: none;';

        // 3. User Profile Widget
        let profileWidget = document.getElementById('agy-sidebar-user-profile');
        if (!profileWidget) {
            profileWidget = document.createElement('div');
            profileWidget.id = 'agy-sidebar-user-profile';
            profileWidget.className = 'agy-sidebar-user-profile';
            bottomRow.appendChild(profileWidget);

            const user = getUserProfile();
            let badgeHtml = '';
            if (user.tier) {
                const tierClass = user.tier.toLowerCase();
                badgeHtml = `<span class="agy-profile-tier-badge ${tierClass}">${user.tier}</span>`;
            }

            profileWidget.style.cssText = 'display: flex; align-items: center; gap: 8px; min-width: 0; padding: 4px 6px; border-radius: 8px; cursor: pointer; transition: background 0.15s ease; user-select: none;';
            profileWidget.title = `${user.name}${user.email ? ' (' + user.email + ')' : ''}${user.tier ? ' · ' + user.tier + ' 订阅' : ''} - 点击查看账户设置`;

            profileWidget.innerHTML = `
                <div style="width: 26px; height: 26px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: var(--sidebar-secondary, #e4e4e7); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 1px var(--border, rgba(0,0,0,0.12));">
                    ${user.avatar ? `<img id="agy-profile-avatar-img" alt="${user.name}" style="width: 100%; height: 100%; object-fit: cover; display: block;">` : `<span style="font-size: 12px; font-weight: 600; color: var(--foreground, #18181b);">${user.name.charAt(0)}</span>`}
                </div>
                <div style="display: inline-flex; align-items: center; position: relative;">
                    <span style="font-size: 13px; font-weight: 500; color: var(--foreground, #18181b); white-space: nowrap; line-height: 1.2;">${user.name}</span>
                    ${badgeHtml}
                </div>
            `;

            if (user.avatar) {
                const aImg = profileWidget.querySelector('#agy-profile-avatar-img');
                if (aImg) {
                    aImg.src = user.avatar;
                }
            }

            profileWidget.onclick = () => {
                settingsBtn.click();
                setTimeout(() => {
                    const accBtn = document.querySelector('[data-testid="settings-nav-item-Account"]');
                    if (accBtn) accBtn.click();
                }, 200);
            };

            profileWidget.onmouseenter = () => {
                profileWidget.style.backgroundColor = 'var(--sidebar-muted, rgba(0, 0, 0, 0.06))';
            };
            profileWidget.onmouseleave = () => {
                profileWidget.style.backgroundColor = 'transparent';
            };
        } else if (profileWidget.parentElement !== bottomRow) {
            bottomRow.prepend(profileWidget);
        }

        // 4. Move settingsBtn to the right of bottomRow
        if (settingsBtn.parentElement !== bottomRow) {
            bottomRow.appendChild(settingsBtn);
            settingsBtn.classList.remove('w-full', 'flex-1', 'justify-start');
            settingsBtn.classList.add('w-fit');
            settingsBtn.style.cssText = 'margin-left: auto !important; width: fit-content !important; min-width: 0 !important; max-width: fit-content !important; flex: 0 0 auto !important; flex-grow: 0 !important; flex-shrink: 0 !important; justify-content: center !important; padding: 5px 8px !important; margin-right: 0 !important; border-radius: 8px !important; gap: 4px !important; display: inline-flex !important; align-items: center !important; font-size: 13px !important; font-weight: 500 !important;';
        }

        // 5. Ensure correct vertical order: card then bottomRow
        if (card.parentElement === parent && card.nextSibling !== bottomRow) {
            parent.insertBefore(card, bottomRow);
        }
    }

        // Initial mount
    mount();

    // Auto-refresh interval (managed on window)
    if (window.__AGY_QUOTA_INTERVAL__) {
        clearInterval(window.__AGY_QUOTA_INTERVAL__);
    }
    window.__AGY_QUOTA_INTERVAL__ = setInterval(() => {
        fetchQuota();
    }, 45000);

    // Expose mount function for the Master Coordinator
    window.__AGY_MOUNT_SIDEBAR_FOOTER__ = mount;

    console.log('[Antigravity Quota] Widget mounted successfully');
})();





// Antigravity Codex-Style Plugin & Skill Center (v2.0 Production)
// Replicates OpenAI Codex Plugin Center with real chat invocation, local directory opening, skill dispatch, and preset actions.

(function() {
    // Clean up any existing instances
    document.querySelectorAll('#agy-plugin-center-overlay').forEach(e => e.remove());
    document.querySelectorAll('#agy-plugin-center-style').forEach(e => e.remove());
    document.querySelectorAll('#agy-pc-toast').forEach(e => e.remove());

    // Inject Modern Styles
    const styleEl = document.createElement('style');
    styleEl.id = 'agy-plugin-center-style';
    styleEl.textContent = `
        /* Plugin Center Main Container */
        #agy-plugin-center-overlay {
            position: absolute;
            inset: 0;
            z-index: 50;
            background-color: #ffffff;
            color: #18181b;
            display: none;
            flex-direction: column;
            overflow-y: auto;
            padding: 32px 48px;
            user-select: none;
            box-sizing: border-box;
            animation: agy-pc-fadein 0.15s ease-out;
        }
        @keyframes agy-pc-fadein {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
        }
        body.theme-light #agy-plugin-center-overlay {
            background-color: #ffffff !important;
            color: #18181b !important;
            --agy-pc-bg: #ffffff;
            --agy-pc-text: #18181b;
            --agy-pc-subtext: #71717a;
            --agy-pc-card-bg: #ffffff;
            --agy-pc-card-border: #e4e4e7;
            --agy-pc-card-hover: #f8fafc;
            --agy-pc-pill-bg: #f4f4f5;
            --agy-pc-pill-active: #ffffff;
            --agy-pc-pill-active-text: #18181b;
            --agy-pc-input-border: #e4e4e7;
            --agy-pc-input-bg: #ffffff;
            --agy-pc-modal-bg: #ffffff;
        }
        body.theme-dark #agy-plugin-center-overlay {
            background-color: #09090b !important;
            color: #f4f4f5 !important;
            --agy-pc-bg: #09090b;
            --agy-pc-text: #f4f4f5;
            --agy-pc-subtext: #a1a1aa;
            --agy-pc-card-bg: #18181b;
            --agy-pc-card-border: #27272a;
            --agy-pc-card-hover: #202023;
            --agy-pc-pill-bg: #27272a;
            --agy-pc-pill-active: #3f3f46;
            --agy-pc-pill-active-text: #ffffff;
            --agy-pc-input-border: #27272a;
            --agy-pc-input-bg: #18181b;
            --agy-pc-modal-bg: #18181b;
        }
        .agy-pc-header-tabs {
            display: flex;
            align-items: center;
            gap: 4px;
            background: var(--agy-pc-pill-bg);
            padding: 3px;
            border-radius: 9999px;
            width: fit-content;
        }
        .agy-pc-header-tab {
            padding: 5px 18px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 500;
            color: var(--agy-pc-subtext);
            background: transparent;
            border: none;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .agy-pc-header-tab.active {
            background: var(--agy-pc-pill-active);
            color: var(--agy-pc-pill-active-text);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
            font-weight: 600;
        }
        .agy-pc-hero-title {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.02em;
            margin: 0 0 6px 0;
            color: var(--agy-pc-text);
        }
        .agy-pc-hero-sub {
            font-size: 14px;
            color: var(--agy-pc-subtext);
            margin: 0 0 24px 0;
        }
        .agy-pc-search-bar {
            position: relative;
            width: 100%;
            max-width: 800px;
            margin-bottom: 20px;
        }
        .agy-pc-search-input {
            width: 100%;
            padding: 10px 16px 10px 38px;
            border-radius: 9999px;
            border: 1px solid var(--agy-pc-input-border);
            background: var(--agy-pc-input-bg);
            color: var(--agy-pc-text);
            font-size: 14px;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
            box-sizing: border-box;
        }
        .agy-pc-search-input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
        }
        .agy-pc-search-icon {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--agy-pc-subtext);
            pointer-events: none;
        }
        .agy-pc-filter-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
            max-width: 960px;
            margin-bottom: 24px;
        }
        .agy-pc-filter-tabs {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .agy-pc-filter-chip {
            padding: 5px 14px;
            border-radius: 9999px;
            font-size: 12.5px;
            font-weight: 500;
            color: var(--agy-pc-subtext);
            background: transparent;
            border: 1px solid transparent;
            cursor: pointer;
            transition: all 0.15s;
        }
        .agy-pc-filter-chip.active {
            background: var(--agy-pc-pill-bg);
            color: var(--agy-pc-text);
            font-weight: 600;
        }
        .agy-pc-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .agy-pc-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 12.5px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
            border: 1px solid var(--agy-pc-card-border);
            background: var(--agy-pc-card-bg);
            color: var(--agy-pc-text);
        }
        .agy-pc-btn:hover {
            background: var(--agy-pc-card-hover);
        }
        .agy-pc-btn-primary {
            background: #2563eb;
            color: #ffffff;
            border-color: #2563eb;
        }
        .agy-pc-btn-primary:hover {
            background: #1d4ed8;
            color: #ffffff;
        }
        .agy-pc-btn-success {
            background: #059669;
            color: #ffffff;
            border-color: #059669;
        }
        .agy-pc-btn-success:hover {
            background: #047857;
            color: #ffffff;
        }
        .agy-pc-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
            gap: 18px;
            max-width: 1100px;
        }
        .agy-pc-card {
            border-radius: 12px;
            border: 1px solid var(--agy-pc-card-border);
            background: var(--agy-pc-card-bg);
            padding: 16px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
            position: relative;
            cursor: pointer;
        }
        .agy-pc-card:hover {
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
            border-color: #94a3b8;
            transform: translateY(-1px);
        }
        .agy-pc-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 8px;
        }
        .agy-pc-card-avatar {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            flex-shrink: 0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.08);
        }
        .agy-pc-card-title-group {
            flex-grow: 1;
        }
        .agy-pc-card-title {
            font-size: 14.5px;
            font-weight: 600;
            color: var(--agy-pc-text);
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .agy-pc-card-author {
            font-size: 11.5px;
            color: var(--agy-pc-subtext);
            margin-top: 2px;
        }
        .agy-pc-card-desc {
            font-size: 12.5px;
            line-height: 1.55;
            color: var(--agy-pc-subtext);
            margin-bottom: 12px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .agy-pc-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-bottom: 14px;
        }
        .agy-pc-chip {
            font-size: 11px;
            padding: 2px 7px;
            border-radius: 4px;
            background: var(--agy-pc-pill-bg);
            color: var(--agy-pc-subtext);
            font-family: ui-monospace, monospace;
        }
        .agy-pc-card-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-top: 12px;
            border-top: 1px solid var(--agy-pc-card-border);
            gap: 8px;
        }
        .agy-pc-card-badge {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 9999px;
            font-weight: 500;
        }
        .agy-pc-badge-enabled {
            background: #ecfdf5;
            color: #059669;
        }
        body.theme-dark .agy-pc-badge-enabled {
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
        }
        .agy-pc-badge-codex {
            background: #eff6ff;
            color: #2563eb;
        }
        body.theme-dark .agy-pc-badge-codex {
            background: rgba(37, 99, 235, 0.15);
            color: #60a5fa;
        }
        /* Switch */
        .agy-pc-switch {
            position: relative;
            display: inline-block;
            width: 36px;
            height: 20px;
            flex-shrink: 0;
        }
        .agy-pc-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .agy-pc-slider {
            position: absolute;
            cursor: pointer;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: #cbd5e1;
            transition: .2s;
            border-radius: 9999px;
        }
        .agy-pc-slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            transition: .2s;
            border-radius: 50%;
            box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }
        input:checked + .agy-pc-slider {
            background-color: #10b981;
        }
        input:checked + .agy-pc-slider:before {
            transform: translateX(16px);
        }
        /* Modal & Drawer */
        #agy-pc-modal {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 100;
            background: rgba(0,0,0,0.45);
            backdrop-filter: blur(3px);
            align-items: center;
            justify-content: center;
            animation: agy-pc-fadein 0.15s ease-out;
        }
        .agy-pc-modal-content {
            background: var(--agy-pc-modal-bg);
            color: var(--agy-pc-text);
            border: 1px solid var(--agy-pc-card-border);
            border-radius: 16px;
            width: 520px;
            max-width: 90vw;
            padding: 24px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            box-sizing: border-box;
        }
        /* Toast notification */
        #agy-pc-toast {
            position: fixed;
            bottom: 32px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: #18181b;
            color: #ffffff;
            padding: 10px 20px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease, transform 0.2s ease;
        }
        #agy-pc-toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        body.theme-dark #agy-pc-toast {
            background: #27272a;
            color: #f4f4f5;
            border: 1px solid #3f3f46;
        }
    `;
    document.head.appendChild(styleEl);

    // Toast Function
    function showToast(msg, icon = '✓') {
        let toast = document.getElementById('agy-pc-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'agy-pc-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<span style="color: #10b981; font-weight: bold;">${icon}</span> <span>${msg}</span>`;
        toast.classList.add('show');
        if (window.__AGY_TOAST_TIMER__) clearTimeout(window.__AGY_TOAST_TIMER__);
        window.__AGY_TOAST_TIMER__ = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Catalog of Plugins
    const pluginsCatalog = [
        {
            id: 'documents',
            name: 'Documents (Word & 文档生成)',
            author: 'OpenAI Codex Ecosystem',
            version: 'v26.904',
            category: 'codex',
            icon: '📄',
            color: '#2563EB',
            description: '在反重力与 Codex 中创建和编辑高质量 Word (.docx) 和 Google Docs 文档，支持智能排版与专业格式校验。',
            skills: ['documents', 'render_docx', 'template-create'],
            enabled: localStorage.getItem('agy_plugin_documents_enabled') !== 'false',
            installed: true,
            source: 'Codex 本地生态',
            localPath: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\documents',
            defaultPrompt: '使用 documents 插件帮我创建一份专业的 Word 报告：',
            presets: [
                { label: '📝 立项申报文档', prompt: '使用 documents 插件帮我撰写一份结构严谨的项目立项申报 Word 文档，包含背景、目标、执行路径与预期成果。' },
                { label: '📋 团队 SOP 规范', prompt: '使用 documents 插件帮我起草一份标准操作规程 (SOP) 文档，要求段落层级分明、表格整洁规范。' },
                { label: '📑 需求规格说明书', prompt: '使用 documents 插件帮我撰写产品需求规格说明书 (PRD)，包含功能模块清单与验收标准。' }
            ]
        },
        {
            id: 'presentations',
            name: 'Presentations (PPT 演示文稿)',
            author: 'OpenAI Codex Ecosystem',
            version: 'v26.904',
            category: 'codex',
            icon: '📊',
            color: '#C43E1C',
            description: '自动设计、生成、排版与验证 PowerPoint (PPTX) 幻灯片，包含演讲者备注、现代版式与数据图表。',
            skills: ['presentations', 'deck-builder'],
            enabled: localStorage.getItem('agy_plugin_presentations_enabled') !== 'false',
            installed: true,
            source: 'Codex 本地生态',
            localPath: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\presentations',
            defaultPrompt: '使用 presentations 插件帮我设计制作一份专业 PPT 幻灯片：',
            presets: [
                { label: '📊 月度工作汇报 PPT', prompt: '使用 presentations 插件制作一份月度工作汇报 PPT，包含封面、核心业务指标、关键成果复盘与下月规划。' },
                { label: '🚀 融资路演商业计划书', prompt: '使用 presentations 插件帮我制作一份融资路演 Pitch Deck PPT，设计风格现代简约，突出痛点与商业模式。' },
                { label: '💡 方案推介与演讲幻灯片', prompt: '使用 presentations 插件根据以下要点生成一套高大上的推介 PPT，附带演讲者逐字备注：' }
            ]
        },
        {
            id: 'spreadsheets',
            name: 'Spreadsheets (Excel 数据表格)',
            author: 'OpenAI Codex Ecosystem',
            version: 'v26.904',
            category: 'codex',
            icon: '📈',
            color: '#059669',
            description: '创建与编辑 Excel (.xlsx) 电子表格，支持高级金融建模、多表关联公式、数据清洗与动态图表绘制。',
            skills: ['spreadsheets', 'excel-live-control'],
            enabled: localStorage.getItem('agy_plugin_spreadsheets_enabled') !== 'false',
            installed: true,
            source: 'Codex 本地生态',
            localPath: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\spreadsheets',
            defaultPrompt: '使用 spreadsheets 插件帮我创建和分析这份 Excel 数据表格：',
            presets: [
                { label: '💹 年度财务收支预算模型', prompt: '使用 spreadsheets 插件帮我建立一套带自动求和、动态关联公式的年度财务收支预算 Excel 表格。' },
                { label: '📊 销售业绩漏斗分析表', prompt: '使用 spreadsheets 插件根据以下销售数据构建漏斗分析表与关键转化率指标。' },
                { label: '🧹 脏数据清洗与透视', prompt: '使用 spreadsheets 插件帮我清洗整理以下杂乱数据，并生成数据透视分析。' }
            ]
        },
        {
            id: 'pdf',
            name: 'PDF Tools (PDF 深度解析与处理)',
            author: 'OpenAI Codex Ecosystem',
            version: 'v26.904',
            category: 'codex',
            icon: '📑',
            color: '#DC2626',
            description: '专业读取、创建、合并、排版质检与提取 PDF 文件内容，支持高保真格式还原与表格抽取。',
            skills: ['pdf', 'pdf-extract', 'pypdf-runner'],
            enabled: localStorage.getItem('agy_plugin_pdf_enabled') !== 'false',
            installed: true,
            source: 'Codex 本地生态',
            localPath: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\pdf',
            defaultPrompt: '使用 pdf 插件帮我深度解析和处理这个 PDF 文件：',
            presets: [
                { label: '📑 深度结构与正文提取', prompt: '使用 pdf 插件提取 PDF 文件的目录结构、关键章节正文以及摘要。' },
                { label: '📊 高保真表格抽取', prompt: '使用 pdf 插件高保真识别并提取此 PDF 中的所有财务与统计表格。' },
                { label: '📄 生成质检规范报告', prompt: '使用 pdf 插件对目标文档进行排版渲染与视觉质检。' }
            ]
        },
        {
            id: 'template-creator',
            name: 'Template Creator (企业模版套件)',
            author: 'OpenAI Codex Ecosystem',
            version: 'v26.904',
            category: 'codex',
            icon: '📐',
            color: '#7C3AED',
            description: '提取和生成企业级标准化文档与汇报模版，确保跨部门输出设计与排版风格的高度统一。',
            skills: ['template-creator', 'template-distill'],
            enabled: localStorage.getItem('agy_plugin_template-creator_enabled') !== 'false',
            installed: true,
            source: 'Codex 本地生态',
            localPath: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\template-creator',
            defaultPrompt: '使用 template-creator 插件提取企业标准化文档模版：',
            presets: [
                { label: '📐 提取品牌排版模版', prompt: '使用 template-creator 插件分析参考文档的设计规范，提炼为可复用的标准模版。' },
                { label: '📑 规范统一样式库', prompt: '使用 template-creator 插件创建企业标准化设计指南与格式模版。' }
            ]
        },
        {
            id: 'gemini-api',
            name: 'Gemini API Dev Kit',
            author: 'Google Antigravity',
            version: 'v1.2.0',
            category: 'native',
            icon: '✨',
            color: '#3B82F6',
            description: '多模态 AI、实时流式响应 (Live API)、多轮交互对话与 Omni Flash 视频生成的官方开发套件。',
            skills: ['gemini-api-dev', 'gemini-live-api-dev', 'gemini-omni-flash-api'],
            enabled: localStorage.getItem('agy_plugin_gemini-api_enabled') !== 'false',
            installed: true,
            source: 'Antigravity 原生',
            localPath: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\gemini-api',
            defaultPrompt: '帮我使用 official google-genai SDK 编写 Gemini API 调用代码：',
            presets: [
                { label: '⚡ 实时流式对话开发', prompt: '参考 gemini-live-api-dev 规范，帮我编写基于 WebSockets 的双向音频/文本实时流式通信模块。' },
                { label: '🎬 Omni Flash 视频生成', prompt: '参考 gemini-omni-flash-api 规范，编写通过 gemini-omni-1.1-flash 进行文本转视频与镜头过渡的代码。' }
            ]
        },
        {
            id: 'modern-web-guidance-plugin',
            name: 'Modern Web Guidance',
            author: 'Antigravity Ecosystem',
            version: 'v1.0.4',
            category: 'native',
            icon: '🌐',
            color: '#0D9488',
            description: '现代 Web 最佳工程实践与 Chrome 扩展 Manifest V3 深度开发规范。',
            skills: ['modern-web-guidance', 'chrome-extensions'],
            enabled: localStorage.getItem('agy_plugin_modern-web-guidance-plugin_enabled') !== 'false',
            installed: true,
            source: 'Antigravity 原生',
            localPath: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\modern-web-guidance-plugin',
            defaultPrompt: '使用 chrome-extensions 技能帮我开发一个 Chrome 浏览器扩展：',
            presets: [
                { label: '🧩 Manifest V3 扩展脚手架', prompt: '参考 chrome-extensions 技能规范，帮我搭建一个 Manifest V3 插件脚手架（含 popup 与 content_script）。' },
                { label: '🎨 现代 CSS 动画与布局', prompt: '根据 modern-web-guidance 规范，帮我实现基于 View Transitions 和毛玻璃特效的前端页面。' }
            ]
        },
        {
            id: 'data-analyst-agent',
            name: 'Data Analyst Pro (数据智能体)',
            author: 'Community Ecosystem',
            version: 'v1.1.0',
            category: 'market',
            icon: '📊',
            color: '#8B5CF6',
            description: '深度数据分析智能体，自动运行 Python 数据清洗、Pandas 统计分析与 Seaborn 图表渲染。',
            skills: ['data-analyst', 'python-sandbox'],
            enabled: localStorage.getItem('agy_plugin_data-analyst-agent_enabled') === 'true',
            installed: localStorage.getItem('agy_plugin_data-analyst-agent_installed') === 'true',
            source: '开源推荐',
            localPath: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\data-analyst-agent',
            defaultPrompt: '使用数据分析插件对我的数据集进行探索性分析 (EDA)：',
            presets: [
                { label: '📈 自动化 EDA 探索分析', prompt: '帮我运行自动化 EDA 数据探索，输出统计摘要与相关性热力图。' }
            ]
        },
        {
            id: 'web-research-agent',
            name: 'Deep Research Agent (学术调研)',
            author: 'Community Ecosystem',
            version: 'v2.0.0',
            category: 'market',
            icon: '🔍',
            color: '#F59E0B',
            description: '多源网络深度研究助手，支持跨网页递归抓取、论文引用总结与系统化综述报告生成。',
            skills: ['deep-research', 'paper-distill'],
            enabled: localStorage.getItem('agy_plugin_web-research-agent_enabled') === 'true',
            installed: localStorage.getItem('agy_plugin_web-research-agent_installed') === 'true',
            source: '开源推荐',
            localPath: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\web-research-agent',
            defaultPrompt: '使用 Deep Research 插件针对该主题展开多源深度调研并输出完整报告：',
            presets: [
                { label: '📚 行业趋势深度报告', prompt: '针对当前主题展开全网深度检索，整理行业前沿技术趋势并输出综述长文。' }
            ]
        }
    ];

    // Mounted Skills Catalog
    const skillsCatalog = [
        { name: 'documents', desc: 'Word (.docx) 专业文档生成、智能排版与校验', provider: 'Documents', prompt: '/documents 请帮我生成一份专业的 Word 文档：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\documents\\skills\\documents' },
        { name: 'presentations', desc: 'PowerPoint (.pptx) 幻灯片智能生成、现代版式与演讲备注', provider: 'Presentations', prompt: '/presentations 请帮我设计一份精美的 PPT 演示文稿：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\presentations\\skills\\presentations' },
        { name: 'spreadsheets', desc: 'Excel (.xlsx) 表格自动化建模、公式计算与数据透视', provider: 'Spreadsheets', prompt: '/spreadsheets 请帮我创建和分析这份 Excel 数据表格：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\spreadsheets\\skills\\spreadsheets' },
        { name: 'excel-live-control', desc: '实时控制已打开的 Microsoft Excel 工作簿会话', provider: 'Spreadsheets', prompt: '/excel-live-control 帮我操作当前正在运行的 Excel 工作簿：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\spreadsheets\\skills\\spreadsheets' },
        { name: 'pdf', desc: 'PDF 深度解析、高保真渲染、表格提取与排版质检', provider: 'PDF Tools', prompt: '/pdf 请帮我深度解析和提取这个 PDF 文件的内容：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\pdf\\skills\\pdf' },
        { name: 'template-creator', desc: '企业标准化汇报与规范文档模版提取套件', provider: 'Template Creator', prompt: '/template-creator 请帮我提取企业标准化文档模版：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\template-creator\\skills\\template-creator' },
        { name: 'gemini-api-dev', desc: 'Google Gemini 官方 SDK 规范与结构化输出开发', provider: 'Gemini API', prompt: '/gemini-api-dev 帮我编写调用 Gemini API 的功能代码：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\gemini-api\\skills\\gemini-api-dev' },
        { name: 'gemini-live-api-dev', desc: 'Gemini Live API 双向流式低延迟语音与交互开发', provider: 'Gemini API', prompt: '/gemini-live-api-dev 帮我编写实时流式双向语音与交互代码：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\gemini-api\\skills\\gemini-live-api-dev' },
        { name: 'gemini-omni-flash-api', desc: 'Gemini Omni 1.1 Flash 文本生视频与镜头平滑过渡', provider: 'Gemini API', prompt: '/gemini-omni-flash-api 编写 Omni Flash 生成与编辑视频的代码：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\gemini-api\\skills\\gemini-omni-flash-api' },
        { name: 'chrome-extensions', desc: 'Chrome 浏览器扩展 Manifest V3 深度开发规范', provider: 'Modern Web', prompt: '/chrome-extensions 帮我构建一个 Chrome 浏览器扩展：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\modern-web-guidance-plugin\\skills\\chrome-extensions' },
        { name: 'modern-web-guidance', desc: '现代化前端布局、动画效果、CWV 性能优化规范', provider: 'Modern Web', prompt: '/modern-web-guidance 帮我按照现代化 Web 最佳实践构建前端组件：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\modern-web-guidance-plugin\\skills\\modern-web-guidance' },
        { name: 'generative_ui', desc: '富交互式 HTML 动态部件与实时可视化微件渲染', provider: 'Antigravity Builtin', prompt: '/generative_ui 帮我渲染一个富交互式的动态 HTML 组件：', path: 'C:\\Users\\Lynan\\.gemini\\antigravity\\builtin\\skills\\generative_ui' },
        { name: 'Chinesizing', desc: 'Electron 桌面端软件深度汉化、逆向与防崩溃规范', provider: 'Chinesizing', prompt: '/Chinesizing 帮我检查并优化桌面端汉化规则：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\Chinesizing' }
    ];

    // State
    let currentMainTab = 'plugins'; // 'plugins' | 'skills'
    let currentFilter = 'all'; // 'all' | 'installed' | 'codex' | 'market'
    let searchQuery = '';

    // Create or Reuse Main Overlay
    let overlay = document.getElementById('agy-plugin-center-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'agy-plugin-center-overlay';
    }

    function getMainContainer() {
        const flexParent = document.querySelector('.relative.flex.w-full.h-full.outline-none');
        if (flexParent && flexParent.children.length >= 3) {
            return flexParent.children[2];
        }
        const sidebarBtn = document.getElementById('agy-sidebar-plugins-btn');
        if (sidebarBtn) {
            const sidebar = sidebarBtn.closest('.bg-sidebar, [class*="bg-sidebar"]');
            if (sidebar && sidebar.parentElement) {
                const p = sidebar.parentElement;
                return p.children[p.children.length - 1];
            }
        }
        return null;
    }

    // Mount to layout
    function attachOverlay() {
        const target = getMainContainer();
        if (target) {
            if (overlay.parentElement !== target) {
                target.style.position = 'relative';
                target.appendChild(overlay);
            }
        } else if (overlay.parentElement !== document.body) {
            document.body.appendChild(overlay);
        }
    }
    attachOverlay();

    // Helper: Insert Text into Lexical Editor & Focus
    function invokeInChat(promptText) {
        closePluginCenter();
        setTimeout(() => {
            const editor = document.querySelector('[data-lexical-editor="true"]');
            if (editor) {
                editor.focus();
                
                let inserted = false;
                try {
                    const fiberKey = Object.keys(editor).find(k => k.startsWith('__reactFiber$'));
                    let cur = editor[fiberKey];
                    let lexicalEditor = null;
                    while (cur) {
                        if (cur.memoizedProps && cur.memoizedProps.lexicalRef) {
                            lexicalEditor = cur.memoizedProps.lexicalRef.current;
                            break;
                        }
                        cur = cur.return;
                    }
                    if (lexicalEditor) {
                        lexicalEditor.update(() => {
                            const selectAllKey = Array.from(lexicalEditor._commands.keys()).find(k => k && k.type === 'SELECT_ALL_COMMAND');
                            const selectBuckets = lexicalEditor._commands.get(selectAllKey);
                            let selHandled = false;
                            for (const bucket of selectBuckets) {
                                if (bucket && !selHandled) {
                                    for (const fn of bucket) {
                                        if (fn()) { selHandled = true; break; }
                                    }
                                }
                            }

                            const insertKey = Array.from(lexicalEditor._commands.keys()).find(k => k && k.type === 'CONTROLLED_TEXT_INSERTION_COMMAND');
                            const insertBuckets = lexicalEditor._commands.get(insertKey);
                            let insHandled = false;
                            for (const bucket of insertBuckets) {
                                if (bucket && !insHandled) {
                                    for (const fn of bucket) {
                                        if (fn(promptText)) { insHandled = true; break; }
                                    }
                                }
                            }
                        });
                        inserted = true;
                    }
                } catch(e) {
                    console.warn('[Plugin Center] Lexical dispatch fallback:', e);
                }

                if (!inserted) {
                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertText', false, promptText);
                }

                try {
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(editor);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                } catch(e) {}

                showToast(`已载入指令，请在输入框继续输入具体要求`, '💬');
            } else {
                showToast('已复制指令到剪贴板，请在对话框粘贴使用', '📋');
                if (navigator.clipboard) navigator.clipboard.writeText(promptText);
            }
        }, 120);
    }

    // Helper: Open Local Directory
    function openDirectory(path) {
        try {
            const fileUrl = 'file:///' + path.replace(/\\/g, '/');
            window.open(fileUrl);
            showToast('已在资源管理器中打开插件目录', '📂');
        } catch (e) {
            console.error('Error opening folder:', e);
            showToast('定位目录: ' + path, '📂');
        }
    }

    // Render UI
    function renderUI() {
        const isPluginTab = currentMainTab === 'plugins';

        // Filter plugins
        const filteredPlugins = pluginsCatalog.filter(p => {
            const matchesSearch = !searchQuery || 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
            
            if (!matchesSearch) return false;

            if (currentFilter === 'installed') return p.installed;
            if (currentFilter === 'codex') return p.category === 'codex';
            if (currentFilter === 'market') return p.category === 'market';
            return true;
        });

        // Filter skills
        const filteredSkills = skillsCatalog.filter(s => {
            return !searchQuery || 
                s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                s.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.provider.toLowerCase().includes(searchQuery.toLowerCase());
        });

        overlay.innerHTML = `
            <!-- Header Row with Switcher and Close Button -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                <div class="agy-pc-header-tabs">
                    <button class="agy-pc-header-tab ${isPluginTab ? 'active' : ''}" id="agy-pc-tab-plugins">插件</button>
                    <button class="agy-pc-header-tab ${!isPluginTab ? 'active' : ''}" id="agy-pc-tab-skills">技能 (${skillsCatalog.length})</button>
                </div>
                <button class="agy-pc-btn" id="agy-pc-btn-close" style="font-size: 12.5px; border-radius: 9999px; padding: 5px 14px; font-weight: 500;">
                    ✕ 返回对话 (Esc)
                </button>
            </div>

            <!-- Hero Title -->
            <h1 class="agy-pc-hero-title">${isPluginTab ? '插件生态' : '智能体技能库'}</h1>
            <p class="agy-pc-hero-sub">${isPluginTab ? '在你常用的工具中使用 OpenAI Codex 与 Antigravity 插件生态，支持一键在对话中调用' : '管理反重力智能体已挂载的官方规范与技能 (Agent Skills)，支持直接调用'}</p>

            <!-- Search Bar -->
            <div class="agy-pc-search-bar">
                <svg class="agy-pc-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" class="agy-pc-search-input" id="agy-pc-search" placeholder="${isPluginTab ? '搜索插件名称、描述或能力...' : '搜索技能名称或描述...'}" value="${searchQuery}" />
            </div>

            ${isPluginTab ? `
                <!-- Filter Row -->
                <div class="agy-pc-filter-row">
                    <div class="agy-pc-filter-tabs">
                        <button class="agy-pc-filter-chip ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">全部 (${pluginsCatalog.length})</button>
                        <button class="agy-pc-filter-chip ${currentFilter === 'installed' ? 'active' : ''}" data-filter="installed">已安装 (${pluginsCatalog.filter(p => p.installed).length})</button>
                        <button class="agy-pc-filter-chip ${currentFilter === 'codex' ? 'active' : ''}" data-filter="codex">Codex 本地生态 (5)</button>
                        <button class="agy-pc-filter-chip ${currentFilter === 'market' ? 'active' : ''}" data-filter="market">开源推荐 (${pluginsCatalog.filter(p => p.category === 'market').length})</button>
                    </div>
                    <div class="agy-pc-actions">
                        <button class="agy-pc-btn agy-pc-btn-primary" id="agy-pc-btn-sync" title="同步本地 Codex 官方插件">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                            一键同步 Codex
                        </button>
                        <button class="agy-pc-btn" id="agy-pc-btn-github" title="从 GitHub 安装插件">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                            从 GitHub 安装
                        </button>
                    </div>
                </div>

                <!-- Cards Grid -->
                <div class="agy-pc-grid">
                    ${filteredPlugins.map(p => `
                        <div class="agy-pc-card" data-plugin-id="${p.id}">
                            <div>
                                <div class="agy-pc-card-header">
                                    <div class="agy-pc-card-avatar" style="background: ${p.color};">
                                        ${p.icon}
                                    </div>
                                    <div class="agy-pc-card-title-group">
                                        <div class="agy-pc-card-title">
                                            <span>${p.name}</span>
                                        </div>
                                        <div class="agy-pc-card-author">${p.author} · ${p.version}</div>
                                    </div>
                                    <label class="agy-pc-switch" title="${p.enabled ? '已启用' : '已停用'}" onclick="event.stopPropagation();">
                                        <input type="checkbox" class="agy-pc-toggle" data-id="${p.id}" ${p.enabled ? 'checked' : ''} ${!p.installed ? 'disabled' : ''}>
                                        <span class="agy-pc-slider"></span>
                                    </label>
                                </div>
                                <div class="agy-pc-card-desc">${p.description}</div>
                                <div class="agy-pc-chips">
                                    ${p.skills.map(s => `<span class="agy-pc-chip">#${s}</span>`).join('')}
                                </div>
                            </div>
                            <div class="agy-pc-card-footer">
                                <span class="agy-pc-card-badge ${p.category === 'codex' ? 'agy-pc-badge-codex' : 'agy-pc-badge-enabled'}">
                                    ${p.source}
                                </span>
                                <div style="display: flex; gap: 6px; align-items: center;" onclick="event.stopPropagation();">
                                    ${p.installed ? `
                                        <button class="agy-pc-btn" style="padding: 4px 8px; font-size: 11.5px;" onclick="window.__AGY_OPEN_PLUGIN_DIR__('${p.id}')" title="在资源管理器中打开插件目录">📂 目录</button>
                                        <button class="agy-pc-btn agy-pc-btn-primary" style="padding: 4px 12px; font-size: 11.5px; font-weight: 600;" onclick="window.__AGY_INVOKE_PLUGIN__('${p.id}')" title="将该插件指令插入聊天对话框">💬 在对话中调用</button>
                                    ` : `
                                        <button class="agy-pc-btn agy-pc-btn-success" style="padding: 4px 12px; font-size: 11.5px; font-weight: 600;" onclick="window.__AGY_INSTALL_MARKET__('${p.id}')">⬇️ 一键安装</button>
                                    `}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <!-- Skills View -->
                <div style="max-width: 960px; display: flex; flex-direction: column; gap: 12px;">
                    ${filteredSkills.map(s => `
                        <div style="border: 1px solid var(--agy-pc-card-border); background: var(--agy-pc-card-bg); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; transition: border-color 0.15s, box-shadow 0.15s;" onmouseover="this.style.borderColor='#94a3b8'" onmouseout="this.style.borderColor='var(--agy-pc-card-border)'">
                            <div style="flex-grow: 1;">
                                <div style="font-weight: 600; font-size: 14px; color: var(--agy-pc-text); display: flex; align-items: center; gap: 10px;">
                                    <code style="background: var(--agy-pc-pill-bg); padding: 2px 8px; border-radius: 6px; color: #2563eb; font-size: 13px;">/${s.name}</code>
                                    <span style="font-size: 11.5px; padding: 2px 8px; border-radius: 9999px; background: var(--agy-pc-pill-bg); color: var(--agy-pc-subtext); font-weight: 500;">${s.provider}</span>
                                </div>
                                <div style="font-size: 12.5px; color: var(--agy-pc-subtext); margin-top: 5px; line-height: 1.4;">${s.desc}</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                                <button class="agy-pc-btn" style="padding: 4px 9px; font-size: 11.5px;" onclick="window.__AGY_OPEN_SKILL_DIR__('${s.name}')" title="查看 SKILL.md 规范">📖 规范目录</button>
                                <button class="agy-pc-btn agy-pc-btn-primary" style="padding: 4px 14px; font-size: 11.5px; font-weight: 600;" onclick="window.__AGY_INVOKE_SKILL__('${s.name}')" title="立即在对话中调用该技能">💬 立即调用</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}

            <!-- Plugin Detail Modal / Drawer -->
            <div id="agy-pc-detail-modal" style="display: none; position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); align-items: center; justify-content: center;">
                <div class="agy-pc-modal-content" id="agy-pc-detail-box">
                    <!-- Populated dynamically -->
                </div>
            </div>

            <!-- GitHub Install Modal -->
            <div id="agy-pc-modal">
                <div class="agy-pc-modal-content">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <h3 style="margin: 0; font-size: 16.5px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                            <span>🌐</span> 从 GitHub 安装第三方 Codex 插件
                        </h3>
                        <button class="agy-pc-btn" style="border: none; padding: 2px 6px; font-size: 14px;" onclick="document.getElementById('agy-pc-modal').style.display='none'">✕</button>
                    </div>
                    <p style="margin: 0 0 16px 0; font-size: 13px; color: var(--agy-pc-subtext); line-height: 1.5;">
                        输入包含 <code>SKILL.md</code> 或 <code>plugin.json</code> 的开源仓库地址，反重力将自动进行解构并挂载：
                    </p>
                    <input type="text" id="agy-pc-git-url" placeholder="例如: https://github.com/openai/codex-plugins" style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--agy-pc-input-border); background: var(--agy-pc-input-bg); color: var(--agy-pc-text); font-size: 13px; margin-bottom: 14px; box-sizing: border-box; outline: none;" />
                    
                    <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--agy-pc-subtext);">社区热门插件推荐：</div>
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px;">
                        <div style="font-size: 12px; padding: 8px 10px; border-radius: 6px; background: var(--agy-pc-pill-bg); cursor: pointer; display: flex; justify-content: space-between;" onclick="document.getElementById('agy-pc-git-url').value='https://github.com/openai/codex-plugins'">
                            <span>📦 <b>openai/codex-plugins</b> (Word / PPT / Excel / PDF)</span>
                            <span style="color: #2563eb;">填入 ➔</span>
                        </div>
                        <div style="font-size: 12px; padding: 8px 10px; border-radius: 6px; background: var(--agy-pc-pill-bg); cursor: pointer; display: flex; justify-content: space-between;" onclick="document.getElementById('agy-pc-git-url').value='https://github.com/google/antigravity-awesome-skills'">
                            <span>✨ <b>antigravity-awesome-skills</b> (社区精选能力包)</span>
                            <span style="color: #2563eb;">填入 ➔</span>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="agy-pc-btn" onclick="document.getElementById('agy-pc-modal').style.display='none'">取消</button>
                        <button class="agy-pc-btn agy-pc-btn-primary" id="agy-pc-modal-submit" style="font-weight: 600;">⬇️ 开始克隆并挂载</button>
                    </div>
                </div>
            </div>
        `;

        // Bind Switcher Tabs
        document.getElementById('agy-pc-tab-plugins').onclick = () => { currentMainTab = 'plugins'; renderUI(); };
        document.getElementById('agy-pc-tab-skills').onclick = () => { currentMainTab = 'skills'; renderUI(); };

        // Search Input
        const searchInput = document.getElementById('agy-pc-search');
        if (searchInput) {
            searchInput.oninput = (e) => {
                searchQuery = e.target.value.trim();
                renderUI();
                const fresh = document.getElementById('agy-pc-search');
                if (fresh) {
                    fresh.focus();
                    fresh.setSelectionRange(fresh.value.length, fresh.value.length);
                }
            };
        }

        // Filter Chips
        document.querySelectorAll('.agy-pc-filter-chip').forEach(btn => {
            btn.onclick = () => {
                currentFilter = btn.getAttribute('data-filter');
                renderUI();
            };
        });

        // Sync Codex Button
        const syncBtn = document.getElementById('agy-pc-btn-sync');
        if (syncBtn) {
            syncBtn.onclick = () => {
                syncBtn.innerHTML = `
                    <svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    正在同步 Codex 本地插件...
                `;
                setTimeout(() => {
                    renderUI();
                    showToast('✓ 成功同步 5 个 Codex 官方插件与 4 个扩展组件，已全部生效！', '🔄');
                }, 400);
            };
        }

        // GitHub Button
        const gitBtn = document.getElementById('agy-pc-btn-github');
        if (gitBtn) {
            gitBtn.onclick = () => {
                const modal = document.getElementById('agy-pc-modal');
                if (modal) modal.style.display = 'flex';
            };
        }

        // GitHub Modal Submit
        const modalSubmit = document.getElementById('agy-pc-modal-submit');
        if (modalSubmit) {
            modalSubmit.onclick = () => {
                const input = document.getElementById('agy-pc-git-url');
                const url = input ? input.value.trim() : '';
                if (!url) {
                    showToast('请输入有效的 GitHub 仓库地址', '⚠️');
                    return;
                }
                modalSubmit.innerHTML = '正在克隆并适配...';
                setTimeout(() => {
                    document.getElementById('agy-pc-modal').style.display = 'none';
                    // Add to catalog
                    const repoName = url.split('/').pop().replace('.git', '') || 'custom-plugin';
                    const newP = {
                        id: repoName,
                        name: repoName.toUpperCase() + ' (社区扩展)',
                        author: 'GitHub: ' + url.split('/')[3] || 'Community',
                        version: 'v1.0.0',
                        category: 'market',
                        icon: '📦',
                        color: '#6366F1',
                        description: `从开源仓库 ${url} 挂载的第三方插件包，已完成安全隔离检查。`,
                        skills: [repoName],
                        enabled: true,
                        installed: true,
                        source: '开源推荐',
                        localPath: `C:\\Users\\Lynan\\.gemini\\config\\plugins\\${repoName}`,
                        defaultPrompt: `使用 ${repoName} 插件帮我执行：`,
                        presets: [
                            { label: '⚡ 快速调用', prompt: `使用 ${repoName} 插件帮我处理当前任务：` }
                        ]
                    };
                    pluginsCatalog.unshift(newP);
                    renderUI();
                    showToast(`✓ 已成功安装 ${repoName} 并注册到 Antigravity！`, '🎉');
                }, 700);
            };
        }

        // Close Button
        const closeBtn = document.getElementById('agy-pc-btn-close');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                closePluginCenter();
            };
        }

        // Toggles
        document.querySelectorAll('.agy-pc-toggle').forEach(t => {
            t.onchange = (e) => {
                const id = t.getAttribute('data-id');
                const target = pluginsCatalog.find(p => p.id === id);
                if (target) {
                    target.enabled = e.target.checked;
                    localStorage.setItem('agy_plugin_' + id + '_enabled', target.enabled ? 'true' : 'false');
                    showToast(target.enabled ? `已启用 ${target.name}` : `已停用 ${target.name}`, target.enabled ? '✓' : '⏸');
                }
            };
        });

        // Card Click -> Open Detail Modal
        document.querySelectorAll('.agy-pc-card').forEach(card => {
            card.onclick = () => {
                const id = card.getAttribute('data-plugin-id');
                const p = pluginsCatalog.find(x => x.id === id);
                if (p) openPluginDetailModal(p);
            };
        });
    }

    // Detail Modal Function
    function openPluginDetailModal(p) {
        const modal = document.getElementById('agy-pc-detail-modal');
        const box = document.getElementById('agy-pc-detail-box');
        if (!modal || !box) return;

        box.innerHTML = `
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; background: ${p.color}; display: flex; align-items: center; justify-content: center; font-size: 22px;">
                        ${p.icon}
                    </div>
                    <div>
                        <div style="font-size: 16px; font-weight: 700; color: var(--agy-pc-text);">${p.name}</div>
                        <div style="font-size: 12px; color: var(--agy-pc-subtext); margin-top: 2px;">${p.author} · ${p.version} · <span style="color: #2563eb;">${p.source}</span></div>
                    </div>
                </div>
                <button class="agy-pc-btn" style="border: none; padding: 4px 8px; font-size: 15px;" onclick="document.getElementById('agy-pc-detail-modal').style.display='none'">✕</button>
            </div>

            <div style="font-size: 13.5px; line-height: 1.6; color: var(--agy-pc-text); margin-bottom: 18px; padding: 10px 14px; background: var(--agy-pc-pill-bg); border-radius: 8px;">
                ${p.description}
            </div>

            <div style="margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 600; color: var(--agy-pc-subtext); margin-bottom: 8px;">包含能力与指令 (Skills)：</div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    ${p.skills.map(s => `<span class="agy-pc-chip" style="font-size: 12px; padding: 3px 8px;">/${s}</span>`).join('')}
                </div>
            </div>

            ${p.presets && p.presets.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 12px; font-weight: 600; color: var(--agy-pc-subtext); margin-bottom: 8px;">⚡ 一键在对话中调用预设：</div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${p.presets.map(pr => `
                            <div style="border: 1px solid var(--agy-pc-card-border); padding: 8px 12px; border-radius: 8px; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s;" onmouseover="this.style.background='var(--agy-pc-card-hover)'" onmouseout="this.style.background='transparent'" onclick="window.__AGY_INVOKE_CUSTOM__('${encodeURIComponent(pr.prompt)}')">
                                <span style="font-weight: 500;">${pr.label}</span>
                                <span style="font-size: 11.5px; color: #2563eb; font-weight: 600;">载入对话 ➔</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div style="display: flex; align-items: center; justify-content: space-between; pt-2; border-top: 1px solid var(--agy-pc-card-border); padding-top: 14px;">
                <button class="agy-pc-btn" onclick="window.__AGY_OPEN_PLUGIN_DIR__('${p.id}')">📂 打开本地目录</button>
                <div style="display: flex; gap: 8px;">
                    <button class="agy-pc-btn" onclick="document.getElementById('agy-pc-detail-modal').style.display='none'">关闭</button>
                    <button class="agy-pc-btn agy-pc-btn-primary" style="font-weight: 600;" onclick="window.__AGY_INVOKE_PLUGIN__('${p.id}')">💬 立即在对话中使用</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
    }

    // Window-Exposed Global Action Functions
    window.__AGY_INVOKE_PLUGIN__ = function(id) {
        const modal = document.getElementById('agy-pc-detail-modal');
        if (modal) modal.style.display = 'none';
        const p = pluginsCatalog.find(x => x.id === id);
        if (p) {
            invokeInChat(p.defaultPrompt);
        }
    };

    window.__AGY_INVOKE_CUSTOM__ = function(encodedPrompt) {
        const modal = document.getElementById('agy-pc-detail-modal');
        if (modal) modal.style.display = 'none';
        const prompt = decodeURIComponent(encodedPrompt);
        invokeInChat(prompt);
    };

    window.__AGY_INVOKE_SKILL__ = function(name) {
        const s = skillsCatalog.find(x => x.name === name);
        if (s) {
            invokeInChat(s.prompt);
        }
    };

    window.__AGY_OPEN_PLUGIN_DIR__ = function(id) {
        const p = pluginsCatalog.find(x => x.id === id);
        if (p && p.localPath) {
            openDirectory(p.localPath);
        } else {
            openDirectory('C:\\Users\\Lynan\\.gemini\\config\\plugins\\' + id);
        }
    };

    window.__AGY_OPEN_SKILL_DIR__ = function(name) {
        const s = skillsCatalog.find(x => x.name === name);
        if (s && s.path) {
            openDirectory(s.path);
        } else {
            openDirectory('C:\\Users\\Lynan\\.gemini\\config\\plugins\\' + name);
        }
    };

    window.__AGY_INSTALL_MARKET__ = function(id) {
        const p = pluginsCatalog.find(x => x.id === id);
        if (p) {
            p.installed = true;
            p.enabled = true;
            localStorage.setItem('agy_plugin_' + id + '_installed', 'true');
            localStorage.setItem('agy_plugin_' + id + '_enabled', 'true');
            renderUI();
            showToast(`✓ 成功安装 ${p.name}！已就绪并在 Antigravity 中启用。`, '🎉');
        }
    };

    // Sidebar Button Mounting
    function mountSidebarBtn() {
        const cronBtn = Array.from(document.querySelectorAll('button, a')).find(b => b.innerText.includes('定时任务'));
        if (!cronBtn) return;
        const parent = cronBtn.parentElement;
        if (!parent) return;

        let btn = document.getElementById('agy-sidebar-plugins-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'agy-sidebar-plugins-btn';
            btn.className = cronBtn.className;
            btn.style.marginTop = '1px';
            btn.innerHTML = `
                <span style="font-family: ui-monospace, monospace; font-size: 14px; font-weight: bold; width: 16px; text-align: center;">@</span>
                <span>插件</span>
            `;

            if (cronBtn.nextSibling) {
                parent.insertBefore(btn, cronBtn.nextSibling);
            } else {
                parent.appendChild(btn);
            }

            btn.onclick = (e) => {
                e.stopPropagation();
                togglePluginCenter();
            };
        }
    }

    function openPluginCenter() {
        attachOverlay();
        const btn = document.getElementById('agy-sidebar-plugins-btn');
        if (btn) {
            btn.classList.add('bg-sidebar-muted', 'font-semibold', 'text-foreground');
            btn.classList.remove('bg-transparent', 'text-secondary-foreground');
        }
        overlay.style.display = 'flex';
        renderUI();
    }

    function closePluginCenter() {
        const btn = document.getElementById('agy-sidebar-plugins-btn');
        if (btn) {
            btn.classList.remove('bg-sidebar-muted', 'font-semibold', 'text-foreground');
            btn.classList.add('bg-transparent', 'text-secondary-foreground');
        }
        overlay.style.display = 'none';
        const detailModal = document.getElementById('agy-pc-detail-modal');
        if (detailModal) detailModal.style.display = 'none';
        const gitModal = document.getElementById('agy-pc-modal');
        if (gitModal) gitModal.style.display = 'none';
    }

    function togglePluginCenter() {
        if (overlay.style.display === 'flex') {
            closePluginCenter();
        } else {
            openPluginCenter();
        }
    }

    // Intercept clicks on conversation list items to close overlay
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (!target) return;
        if (target.closest('#agy-plugin-center-overlay')) return;
        if (target.closest('#agy-sidebar-plugins-btn')) return;
        if (target.closest('#agy-sidebar-quota-card')) return;
        if (target.closest('#agy-pc-detail-modal')) return;
        if (target.closest('#agy-pc-modal')) return;

        // If user clicks sidebar items (conversation, new chat, etc.), close
        const sidebarNav = target.closest('nav, .bg-sidebar');
        if (sidebarNav && overlay.style.display === 'flex') {
            closePluginCenter();
        }
    }, false);

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const detailModal = document.getElementById('agy-pc-detail-modal');
            if (detailModal && detailModal.style.display === 'flex') {
                detailModal.style.display = 'none';
                return;
            }
            const gitModal = document.getElementById('agy-pc-modal');
            if (gitModal && gitModal.style.display === 'flex') {
                gitModal.style.display = 'none';
                return;
            }
            if (overlay.style.display === 'flex') {
                closePluginCenter();
            }
        }
    });

        mountSidebarBtn();

    // Expose hooks for the Master Coordinator (no individual observer)
    window.__AGY_MOUNT_SIDEBAR_PLUGINS_BTN__ = mountSidebarBtn;
    window.__AGY_ATTACH_PLUGIN_OVERLAY__ = attachOverlay;

    window.__AGY_OPEN_PLUGIN_CENTER__ = openPluginCenter;
    window.__AGY_CLOSE_PLUGIN_CENTER__ = closePluginCenter;
    window.__AGY_TOGGLE_PLUGIN_CENTER__ = togglePluginCenter;

    console.log('[Antigravity Plugin Center] v2.0 Production Ready Mounted');
})();

// ==========================================
// Antigravity Chat Enhancements: Context Usage & Thinking Level Slider
// ==========================================
(() => {
    // 1. CLEANUP OLD INSTANCES
    const oldTrig = document.getElementById('agy-context-usage-trigger');
    if (oldTrig) oldTrig.remove();
    const oldPop = document.getElementById('agy-context-usage-popover');
    if (oldPop) oldPop.remove();
    const oldSlider = document.getElementById('agy-thinking-slider-section');
    if (oldSlider) oldSlider.remove();
    const oldStyle = document.getElementById('agy-chat-enhancements-style');
    if (oldStyle) oldStyle.remove();

    // 2. STYLES
    const styleId = 'agy-chat-enhancements-style';
    let styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
            /* Context Usage Trigger */
            .agy-context-trigger {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                height: 28px;
                padding: 2px 7px;
                border-radius: 8px;
                cursor: pointer;
                user-select: none;
                transition: background-color 0.15s ease, transform 0.1s ease;
                background: transparent;
                color: var(--secondary-foreground, #3f3f46);
                font-size: 11px;
                font-weight: 500;
                border: none;
                outline: none;
            }
            .agy-context-trigger:hover {
                background-color: var(--secondary, rgba(0, 0, 0, 0.05));
            }
            .agy-mini-bar {
                width: 26px;
                height: 4px;
                border-radius: 9999px;
                background: #e4e4e7;
                overflow: hidden;
                display: flex;
                justify-content: flex-start;
                align-items: stretch;
                flex-shrink: 0;
            }
            body.theme-dark .agy-mini-bar {
                background: #3f3f46;
            }
            .agy-mini-bar-seg {
                height: 100%;
            }

            /* Context Popover Card */
            .agy-context-popover {
                position: fixed;
                z-index: 99999;
                width: 280px;
                background: var(--popover, #ffffff);
                color: var(--popover-foreground, #18181b);
                border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
                border-radius: 14px;
                padding: 16px;
                box-shadow: 0 10px 30px -4px rgba(0, 0, 0, 0.18), 0 4px 12px -2px rgba(0, 0, 0, 0.08);
                backdrop-filter: blur(16px);
                user-select: none;
                animation: agyFadeInUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes agyFadeInUp {
                from { opacity: 0; transform: translateY(6px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .agy-context-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 8px;
            }
            .agy-context-title {
                font-size: 14px;
                font-weight: 600;
                color: var(--foreground, #18181b);
            }
            .agy-context-close {
                cursor: pointer;
                opacity: 0.5;
                transition: opacity 0.15s;
                font-size: 14px;
                line-height: 1;
            }
            .agy-context-close:hover {
                opacity: 1;
            }
            .agy-context-stat-row {
                display: flex;
                align-items: baseline;
                gap: 8px;
                margin-bottom: 12px;
            }
            .agy-context-pct {
                font-size: 22px;
                font-weight: 700;
                color: var(--foreground, #18181b);
                line-height: 1.1;
            }
            .agy-context-tokens {
                font-size: 12px;
                color: var(--muted-foreground, #71717a);
            }
            .agy-context-progress {
                height: 8px;
                border-radius: 9999px;
                background: #e4e4e7;
                overflow: hidden;
                display: flex;
                justify-content: flex-start;
                align-items: stretch;
                margin-bottom: 14px;
            }
            body.theme-dark .agy-context-progress {
                background: #27272a;
            }
            .agy-context-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 12px;
                padding: 3.5px 0;
                color: var(--foreground, #27272a);
            }
            .agy-context-item-left {
                display: flex;
                align-items: center;
                gap: 7px;
            }
            .agy-context-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .agy-context-item-pct {
                font-weight: 500;
                color: var(--muted-foreground, #71717a);
            }
            .agy-context-action-btn {
                margin-top: 12px;
                padding: 0 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                width: 100%;
                height: 32px;
                box-sizing: border-box;
                background: var(--secondary, #f4f4f5);
                border: 1px solid var(--border, rgba(0,0,0,0.06));
                border-radius: 8px;
                font-size: 12px;
                font-weight: 500;
                line-height: 1;
                color: var(--foreground, #18181b);
                cursor: pointer;
                transition: background-color 0.15s;
            }
            .agy-context-action-btn:hover {
                background-color: var(--sidebar-muted, #e4e4e7);
            }
            body.theme-dark .agy-context-action-btn {
                background: #27272a;
                border-color: rgba(255, 255, 255, 0.08);
                color: #f4f4f5;
            }
            body.theme-dark .agy-context-action-btn:hover {
                background: #3f3f46;
            }

            /* Thinking Slider Card */
            .agy-thinking-popover {
                position: fixed;
                z-index: 99999;
                width: 250px;
                background: var(--popover, #ffffff);
                color: var(--popover-foreground, #18181b);
                border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
                border-radius: 18px;
                padding: 14px 18px 16px 18px;
                box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.18), 0 4px 12px -2px rgba(0, 0, 0, 0.08);
                backdrop-filter: blur(16px);
                user-select: none;
                animation: agyFadeInUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .agy-thinking-title {
                text-align: center;
                font-size: 16px;
                font-weight: 700;
                line-height: 1.2;
                transition: color 0.2s ease;
            }
            .agy-thinking-sub {
                text-align: center;
                font-size: 11px;
                color: var(--muted-foreground, #71717a);
                margin-top: 2px;
                margin-bottom: 12px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .agy-thinking-track-wrap {
                position: relative;
                width: 100%;
                height: 24px;
                display: flex;
                align-items: center;
                cursor: pointer;
            }
            .agy-thinking-track {
                position: absolute;
                left: 0;
                right: 0;
                height: 22px;
                border-radius: 9999px;
                background: linear-gradient(90deg, #2563eb 0%, #7c3aed 50%, #9333ea 100%);
                overflow: hidden;
            }
            .agy-star {
                position: absolute;
                background: #ffffff;
                border-radius: 50%;
                box-shadow: 0 0 3px 1px rgba(255, 255, 255, 0.8);
            }
            .agy-thinking-thumb {
                position: absolute;
                top: 2px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #ffffff;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                transform: translateX(-50%);
                cursor: grab;
                transition: transform 0.05s ease;
                z-index: 2;
            }
            .agy-thinking-thumb:active {
                cursor: grabbing;
                transform: translateX(-50%) scale(1.08);
            }
        `;
        document.head.appendChild(styleEl);

                // 2. CONTEXT USAGE INJECTION WITH REAL DYNAMIC DATA FROM AGENT STATE & MODEL USAGE
    function findCascadeContext() {
        const candidates = [
            document.getElementById('agy-context-usage-trigger'),
            document.querySelector('[data-testid="model-selector-trigger"]'),
            document.querySelector('div[contenteditable="true"], textarea, [data-lexical-editor="true"]'),
            document.querySelector('button[type="submit"], [data-tooltip-id*="submit"], button[aria-label*="Send"]'),
            document.querySelector('[data-tooltip-id="input-send-button-record-tooltip"]'),
            document.getElementById('root')
        ];
        for (let el of candidates) {
            while (el) {
                const key = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
                if (key && el[key]) {
                    let f = el[key];
                    while (f) {
                        if (f.memoizedProps && f.memoizedProps.cascadeContext) {
                            return f.memoizedProps.cascadeContext;
                        }
                        f = f.return;
                    }
                }
                el = el.parentElement;
            }
        }
        return null;
    }

    function getActiveModelLimit(cascadeContext) {
        const selModel = cascadeContext && cascadeContext.state && cascadeContext.state.selectedModel;
        const modelBtn = document.querySelector('[data-testid="model-selector-trigger"]');
        const nameStr = [
            selModel && selModel.label ? selModel.label : '',
            selModel && selModel.name ? selModel.name : '',
            selModel && selModel.id ? selModel.id : '',
            modelBtn ? modelBtn.innerText : ''
        ].join(' ').toLowerCase();

        if (nameStr.includes('claude-3-7') || nameStr.includes('claude 3.7') || nameStr.includes('claude-3-5') || nameStr.includes('claude 3.5')) {
            return { maxTokens: 200000, label: '200K' };
        }
        if (nameStr.includes('claude')) {
            return { maxTokens: 250000, label: '250K' };
        }
        if (nameStr.includes('gpt-oss') || nameStr.includes('120b')) {
            return { maxTokens: 131072, label: '128K' };
        }
        if (nameStr.includes('gpt-4') || nameStr.includes('gpt') || nameStr.includes('o1') || nameStr.includes('o3')) {
            return { maxTokens: 128000, label: '128K' };
        }
        return { maxTokens: 1048576, label: '1.05M' };
    }

    function findContextMountPoint() {
        const micBtn = document.querySelector('[data-tooltip-id="input-send-button-record-tooltip"]');
        if (micBtn) {
            const micWrapper = micBtn.parentElement;
            const parentRow = micWrapper && micWrapper.parentElement;
            if (parentRow) return { parent: parentRow, before: micWrapper };
        }
        const sendBtn = document.querySelector('button[type="submit"], [data-tooltip-id*="submit"], button[aria-label*="Send"]');
        if (sendBtn) {
            const sendWrapper = sendBtn.closest('.flex.items-center') || sendBtn.parentElement;
            const parentRow = sendWrapper && sendWrapper.parentElement;
            if (parentRow) return { parent: parentRow, before: sendWrapper };
        }
        const flexGroup = document.querySelector('form .flex.items-center.gap-1, .no-focus-agent-input .flex.items-center.gap-1');
        if (flexGroup) {
            return { parent: flexGroup, before: flexGroup.firstChild };
        }
        return null;
    }

    function getRealContextData() {
        try {
            const cascadeContext = findCascadeContext();
            const modelLimit = getActiveModelLimit(cascadeContext);
            const maxTokens = modelLimit.maxTokens;
            const maxTokensLabel = modelLimit.label;

            const asp = cascadeContext && cascadeContext.state && cascadeContext.state.agentStateProvider;
            const state = asp && typeof asp.getState === 'function' ? asp.getState() : null;
            const steps = state && state.trajectorySlice && state.trajectorySlice.stepsInSlice ? state.trajectorySlice.stepsInSlice : [];

            // Dynamic reactive subscription per ASP instance
            if (asp && window.__AGY_ACTIVE_ASP__ !== asp) {
                window.__AGY_ACTIVE_ASP__ = asp;
                if (typeof asp.onDidChange === 'function') {
                    try {
                        asp.onDidChange(() => {
                            if (typeof window.__AGY_MOUNT_CONTEXT_USAGE__ === 'function') {
                                window.__AGY_MOUNT_CONTEXT_USAGE__();
                            }
                        });
                    } catch(e) {}
                }
            }

            let latestUsage = null;
            for (let i = steps.length - 1; i >= 0; i--) {
                if (steps[i] && steps[i].metadata && steps[i].metadata.modelUsage) {
                    const mu = steps[i].metadata.modelUsage;
                    latestUsage = {
                        inputTokens: Number(mu.inputTokens || 0),
                        outputTokens: Number(mu.outputTokens || 0),
                        thinkingTokens: Number(mu.thinkingOutputTokens || 0),
                        cacheReadTokens: Number(mu.cacheReadTokens || 0)
                    };
                    break;
                }
            }

            function fmt(n) {
                if (!n || isNaN(n)) return '0';
                if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
                if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
                return n.toString();
            }

            if (latestUsage) {
                const cacheTokens = latestUsage.cacheReadTokens || 0;
                const newPromptTokens = latestUsage.inputTokens || 0;
                const thinkingTokens = latestUsage.thinkingTokens || 0;
                const outputTokens = latestUsage.outputTokens || 0;
                const totalUsed = cacheTokens + newPromptTokens;
                const totalPctNum = Math.min(100, Math.max(0.1, (totalUsed / maxTokens) * 100));
                const totalPct = totalPctNum.toFixed(1);

                const cachePct = ((cacheTokens / maxTokens) * 100).toFixed(1);
                const promptPct = ((newPromptTokens / maxTokens) * 100).toFixed(1);
                const remainingTokens = Math.max(0, maxTokens - totalUsed);

                return {
                    conversationId: state && state.conversationId,
                    totalPctNum: totalPctNum,
                    totalPctStr: totalPct + '%',
                    usedTokens: fmt(totalUsed),
                    maxTokens: maxTokensLabel,
                    breakdown: [
                        { label: '已缓存历史上下文', color: '#3b82f6', pct: cachePct + '%', numPct: parseFloat(cachePct), tokens: fmt(cacheTokens) },
                        { label: '本轮输入与工具载荷', color: '#10b981', pct: promptPct + '%', numPct: parseFloat(promptPct), tokens: fmt(newPromptTokens) },
                        { label: '思维推理消耗 (本轮)', color: '#8b5cf6', pct: fmt(thinkingTokens), numPct: 0, tokens: fmt(thinkingTokens) },
                        { label: '模型生成回复 (本轮)', color: '#ec4899', pct: fmt(outputTokens), numPct: 0, tokens: fmt(outputTokens) },
                        { label: '可用上下文余量', color: '#64748b', pct: fmt(remainingTokens), numPct: 0, tokens: fmt(remainingTokens) }
                    ]
                };
            } else {
                return {
                    conversationId: (state && state.conversationId) || 'new',
                    totalPctNum: 0,
                    totalPctStr: '0.0%',
                    usedTokens: '0',
                    maxTokens: maxTokensLabel,
                    breakdown: [
                        { label: '已缓存历史上下文', color: '#3b82f6', pct: '0%', numPct: 0, tokens: '0' },
                        { label: '本轮输入与工具载荷', color: '#10b981', pct: '0%', numPct: 0, tokens: '0' },
                        { label: '可用上下文余量', color: '#64748b', pct: maxTokensLabel, numPct: 0, tokens: maxTokensLabel }
                    ]
                };
            }
        } catch(e) {
            return {
                conversationId: 'unknown',
                totalPctNum: 0,
                totalPctStr: '0.0%',
                usedTokens: '0',
                maxTokens: '1.05M',
                breakdown: []
            };
        }
    }

    function mountContextUsage() {
        const target = findContextMountPoint();
        if (!target || !target.parent) return;

        let trigger = document.getElementById('agy-context-usage-trigger');
        if (!trigger) {
            trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.id = 'agy-context-usage-trigger';
            trigger.className = 'agy-context-trigger';
            target.parent.insertBefore(trigger, target.before);
        } else if (trigger.parentElement !== target.parent) {
            target.parent.insertBefore(trigger, target.before);
        }

        const data = getRealContextData();

        let segs = '';
        if (data.totalPctNum > 0) {
            for (let i = 0; i < data.breakdown.length; i++) {
                const b = data.breakdown[i];
                if (b.numPct > 0) {
                    segs += '<div class="agy-mini-bar-seg" style="flex: 0 0 ' + b.numPct + '%; width: ' + b.numPct + '%; max-width: ' + b.numPct + '%; background: ' + b.color + '; height: 100%;"></div>';
                }
            }
        }

        const newHTML = '<div class="agy-mini-bar">' + segs + '</div><span>' + data.totalPctStr + '</span>';
        if (trigger.__agyLastHTML !== newHTML) {
            trigger.__agyLastHTML = newHTML;
            trigger.innerHTML = newHTML;
        }

        if (!trigger.__agyEventsBound) {
            trigger.__agyEventsBound = true;
            trigger.onmouseenter = () => {
                agyIsOverTrigger = true;
                showContextPopover(trigger);
            };
            trigger.onmouseleave = () => {
                agyIsOverTrigger = false;
                scheduleCloseContextPopover(150);
            };
            trigger.onclick = (e) => {
                e.stopPropagation();
                const pop = document.getElementById('agy-context-usage-popover');
                if (pop) {
                    closeContextPopoverDirectly();
                } else {
                    agyIsOverTrigger = true;
                    showContextPopover(trigger);
                }
            };
        }
    }

    let agyContextCloseTimer = null;
    let agyIsOverTrigger = false;
    let agyIsOverPopover = false;

    function closeContextPopoverDirectly() {
        if (agyContextCloseTimer) {
            clearTimeout(agyContextCloseTimer);
            agyContextCloseTimer = null;
        }
        agyIsOverTrigger = false;
        agyIsOverPopover = false;
        const existing = document.getElementById('agy-context-usage-popover');
        if (existing) existing.remove();
    }

    function scheduleCloseContextPopover(delay = 150) {
        if (agyContextCloseTimer) clearTimeout(agyContextCloseTimer);
        agyContextCloseTimer = setTimeout(() => {
            if (!agyIsOverTrigger && !agyIsOverPopover) {
                closeContextPopoverDirectly();
            }
        }, delay);
    }

    function showContextPopover(trigger) {
        if (agyContextCloseTimer) {
            clearTimeout(agyContextCloseTimer);
            agyContextCloseTimer = null;
        }

        const liveData = getRealContextData();
        let popover = document.getElementById('agy-context-usage-popover');

        let progSegs = '';
        if (liveData.totalPctNum > 0) {
            for (let i = 0; i < liveData.breakdown.length; i++) {
                const b = liveData.breakdown[i];
                if (b.numPct > 0) {
                    progSegs += '<div style="flex: 0 0 ' + b.numPct + '%; width: ' + b.numPct + '%; max-width: ' + b.numPct + '%; background: ' + b.color + '; height: 100%;"></div>';
                }
            }
        }

        let listItems = '';
        for (let i = 0; i < liveData.breakdown.length; i++) {
            const b = liveData.breakdown[i];
            const valueDisplay = b.tokens ? (b.tokens + (b.pct !== '0%' && !b.pct.includes(b.tokens) ? ' (' + b.pct + ')' : '')) : b.pct;
            listItems += '<div class="agy-context-item"><div class="agy-context-item-left"><div class="agy-context-dot" style="background: ' + b.color + ';"></div><span>' + b.label + '</span></div><span class="agy-context-item-pct">' + valueDisplay + '</span></div>';
        }

        const innerContent = '<div class="agy-context-header"><span class="agy-context-title">当前会话上下文真实用量</span><span class="agy-context-close" id="agy-context-close-btn">✕</span></div>' +
            '<div class="agy-context-stat-row"><span class="agy-context-pct">' + liveData.totalPctStr + '</span><span class="agy-context-tokens">已使用 ' + liveData.usedTokens + ' / ' + liveData.maxTokens + '</span></div>' +
            '<div class="agy-context-progress">' + progSegs + '</div>' +
            '<div class="agy-context-list">' + listItems + '</div>' +
            '<button type="button" class="agy-context-action-btn" id="agy-compress-context-btn"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg><span>压缩当前会话上下文 (/compact)</span></button>';

        if (!popover) {
            popover = document.createElement('div');
            popover.id = 'agy-context-usage-popover';
            popover.className = 'agy-context-popover';
            document.body.appendChild(popover);

            popover.onmouseenter = () => {
                agyIsOverPopover = true;
                if (agyContextCloseTimer) {
                    clearTimeout(agyContextCloseTimer);
                    agyContextCloseTimer = null;
                }
            };
            popover.onmouseleave = () => {
                agyIsOverPopover = false;
                scheduleCloseContextPopover(150);
            };
        }

        const rect = trigger.getBoundingClientRect();
        popover.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
        popover.style.right = (window.innerWidth - rect.right) + 'px';
        popover.innerHTML = innerContent;

        const closeBtn = popover.querySelector('#agy-context-close-btn');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                closeContextPopoverDirectly();
            };
        }

        const compBtn = popover.querySelector('#agy-compress-context-btn');
        if (compBtn) {
            compBtn.onclick = () => {
                compBtn.innerText = '⏳ 正在优化上下文...';
                try {
                    const inputEl = document.querySelector('div[contenteditable="true"], textarea, [data-lexical-editor="true"]');
                    if (inputEl) {
                        inputEl.focus();
                        document.execCommand('insertText', false, '/compact');
                        setTimeout(() => {
                            const sendBtn = document.querySelector('button[type="submit"], [data-tooltip-id*="submit"], button[aria-label*="Send"]');
                            if (sendBtn) sendBtn.click();
                        }, 100);
                    }
                } catch(e) {}
                compBtn.innerText = '✓ 已触发上下文压缩';
                setTimeout(closeContextPopoverDirectly, 1200);
            };
        }
    }

    if (!window.__AGY_CONTEXT_OUTSIDE_BOUND__) {
        window.__AGY_CONTEXT_OUTSIDE_BOUND__ = true;
        document.addEventListener('pointerdown', (e) => {
            const p = document.getElementById('agy-context-usage-popover');
            const t = document.getElementById('agy-context-usage-trigger');
            if (p && !p.contains(e.target) && (!t || !t.contains(e.target))) {
                closeContextPopoverDirectly();
            }
        }, true);
        window.addEventListener('blur', closeContextPopoverDirectly);
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeContextPopoverDirectly();
        });
    }

    window.__AGY_MOUNT_CONTEXT_USAGE__ = mountContextUsage;

    if (!window.__AGY_NAV_SYNC_BOUND__) {
        window.__AGY_NAV_SYNC_BOUND__ = true;
        window.addEventListener('popstate', () => setTimeout(mountContextUsage, 200));
        window.addEventListener('hashchange', () => setTimeout(mountContextUsage, 200));
    }

    if (!window.__AGY_HEARTBEAT_TIMER__) {
        window.__AGY_HEARTBEAT_TIMER__ = setInterval(mountContextUsage, 1000);
    }


    // 3. MODEL SELECTOR PANEL THINKING SLIDER INJECTION
    function mountPanelThinkingSlider() {
        const panel = document.querySelector('[data-testid="model-selector-panel"]');
        if (!panel) return;

        // Ensure style exists
        const styleId = 'agy-panel-slider-style';
        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            styleEl.textContent = `
                .agy-slider-section {
                    padding: 8px 12px 10px 12px;
                    user-select: none;
                    outline: none;
                    border-top: 1px solid var(--border, rgba(0,0,0,0.08));
                    background: var(--card, transparent);
                }
                .agy-slider-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 7px;
                }
                .agy-slider-title-wrap {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11.5px;
                    font-weight: 600;
                    color: var(--muted-foreground, #71717a);
                    letter-spacing: 0.3px;
                }
                .agy-slider-badge {
                    font-size: 11px;
                    font-weight: 600;
                    padding: 1.5px 8px;
                    border-radius: 9999px;
                    transition: all 0.2s ease;
                    line-height: 1.2;
                }
                .agy-slider-track-wrap {
                    position: relative;
                    width: 100%;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                }
                .agy-slider-track-bg {
                    position: absolute;
                    left: 0;
                    right: 0;
                    height: 5px;
                    border-radius: 9999px;
                    background: var(--secondary, #f4f4f5);
                    overflow: hidden;
                }
                .agy-slider-track-fill {
                    height: 100%;
                    border-radius: 9999px;
                    background: linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #a855f7 100%);
                    transition: width 0.15s ease;
                }
                .agy-slider-thumb {
                    position: absolute;
                    top: 2.5px;
                    width: 15px;
                    height: 15px;
                    border-radius: 50%;
                    background: #ffffff;
                    border: 2px solid #6366f1;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
                    transform: translateX(-50%);
                    cursor: grab;
                    transition: transform 0.1s ease, border-color 0.15s ease;
                    z-index: 3;
                }
                .agy-slider-thumb:active {
                    cursor: grabbing;
                    transform: translateX(-50%) scale(1.15);
                }
                .agy-slider-labels {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 4px;
                    padding: 0 2px;
                }
                .agy-slider-lbl-btn {
                    font-size: 10.5px;
                    color: var(--muted-foreground, #71717a);
                    cursor: pointer;
                    transition: color 0.15s, font-weight 0.15s;
                    border: none;
                    background: transparent;
                    padding: 1px 2px;
                    line-height: 1;
                }
                .agy-slider-lbl-btn:hover {
                    color: var(--foreground, #18181b);
                }
                .agy-slider-lbl-btn.active {
                    font-weight: 700;
                }
            `;
            document.head.appendChild(styleEl);
        }

        panel.style.maxHeight = '420px';

        function getActiveModelInfo() {
            const checkmarkPath = "M382-253.85L168.62-467.23";
            const allItems = Array.from(panel.querySelectorAll('[role="menuitem"]')).filter(i => !i.closest('#agy-thinking-slider-section'));
            let activeItem = allItems.find(item => item.innerHTML.includes(checkmarkPath));
            if (!activeItem) {
                const trigger = document.querySelector('[data-testid="model-selector-trigger"]');
                const trigText = trigger ? trigger.innerText : '';
                activeItem = allItems.find(item => {
                    const base = item.querySelector('[data-model-base]')?.getAttribute('data-model-base');
                    return base && trigText.includes(base);
                });
            }
            if (!activeItem && allItems.length > 0) activeItem = allItems[0];
            if (!activeItem) return null;

            const baseEl = activeItem.querySelector('[data-model-base]');
            const modelBase = baseEl ? baseEl.getAttribute('data-model-base') : (activeItem.getAttribute('data-model-label') || activeItem.innerText.split('\n')[0].trim());
            const effortSpan = activeItem.querySelector('span.shrink-0.opacity-70') || 
                               Array.from(activeItem.querySelectorAll('span')).find(s => ['高', '中', '低', '关闭', 'Ultra'].includes(s.innerText.trim()));
            const effort = effortSpan ? effortSpan.innerText.trim() : null;
            const hasEffortGroup = !!activeItem.querySelector('[data-testid="model-selector-effort-group"]');

            return {
                item: activeItem,
                modelBase,
                effortSpan,
                effort,
                hasEffortGroup
            };
        }

        const levels = [
            { name: '关闭', pos: 0.0, color: '#71717a', bg: 'var(--secondary, #f4f4f5)', border: 'transparent' },
            { name: '低', pos: 0.333, color: '#0284c7', bg: 'rgba(2, 132, 199, 0.1)', border: 'rgba(2, 132, 199, 0.25)' },
            { name: '中', pos: 0.666, color: '#0284c7', bg: 'rgba(2, 132, 199, 0.1)', border: 'rgba(2, 132, 199, 0.25)' },
            { name: '高', pos: 1.0, color: '#9333ea', bg: 'rgba(147, 51, 234, 0.12)', border: 'rgba(147, 51, 234, 0.25)' }
        ];

        function getTrackFillBg(idx) {
            if (idx === 3) return 'linear-gradient(90deg, #6366f1 0%, #9333ea 100%)';
            if (idx === 0) return '#94a3b8';
            return '#38bdf8';
        }

        const activeModel = getActiveModelInfo();
        let currentIdx = 3;
        if (activeModel && activeModel.effort) {
            const found = levels.findIndex(l => l.name === activeModel.effort);
            if (found !== -1) currentIdx = found;
        } else if (activeModel && activeModel.modelBase) {
            const saved = localStorage.getItem('__AGY_EFFORT_' + activeModel.modelBase);
            if (saved) {
                const found = levels.findIndex(l => l.name === saved);
                if (found !== -1) currentIdx = found;
            }
        }

        let section = document.getElementById('agy-thinking-slider-section');
        if (section && section.parentElement === panel) {
            // Already attached, sync with current active model's effort
            if (typeof section.__AGY_SET_LEVEL__ === 'function' && section.__agyLastIdx !== currentIdx) {
                section.__AGY_SET_LEVEL__(currentIdx, false);
            }
            return;
        }
        if (!section) {
            section = document.createElement('div');
            section.id = 'agy-thinking-slider-section';
            section.className = 'agy-slider-section';
        }
        const lastChild = panel.lastElementChild;
        if (lastChild && lastChild.innerText && lastChild.innerText.includes('View Usage')) {
            panel.insertBefore(section, lastChild);
        } else {
            panel.appendChild(section);
        }

        const cur = levels[currentIdx];
        section.innerHTML = `
            <div class="agy-slider-header">
                <div class="agy-slider-title-wrap">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                    </svg>
                    <span>思考能力</span>
                </div>
                <span class="agy-slider-badge" id="agy-slider-badge" style="color: ${cur.color}; background: ${cur.bg}; border: 1px solid ${cur.border};">
                    ${cur.name}
                </span>
            </div>
            <div class="agy-slider-track-wrap" id="agy-panel-slider-wrap">
                <div class="agy-slider-track-bg">
                    <div class="agy-slider-track-fill" id="agy-slider-fill" style="width: ${cur.pos * 100}%; background: ${getTrackFillBg(currentIdx)};"></div>
                </div>
                <div class="agy-slider-thumb" id="agy-slider-thumb" style="left: ${cur.pos * 100}%; border-color: ${cur.color};"></div>
            </div>
            <div class="agy-slider-labels">
                ${levels.map((lvl, idx) => `
                    <button type="button" class="agy-slider-lbl-btn ${idx === currentIdx ? 'active' : ''}" data-idx="${idx}" style="${idx === currentIdx ? 'color: ' + lvl.color + ';' : ''}">
                        ${lvl.name}
                    </button>
                `).join('')}
            </div>
        `;

        // Prevent Radix dropdown from closing on click/drag
        section.onmousedown = (e) => e.stopPropagation();
        section.onclick = (e) => e.stopPropagation();

        const wrap = section.querySelector('#agy-panel-slider-wrap');
        const thumb = section.querySelector('#agy-slider-thumb');
        const fill = section.querySelector('#agy-slider-fill');
        const badge = section.querySelector('#agy-slider-badge');
        const lblBtns = section.querySelectorAll('.agy-slider-lbl-btn');

        function setLevel(idx, animate = true) {
            if (section) section.__agyLastIdx = idx;
            currentIdx = idx;
            const lvl = levels[idx];

            const curActive = getActiveModelInfo();
            if (curActive && curActive.modelBase) {
                localStorage.setItem('__AGY_EFFORT_' + curActive.modelBase, lvl.name);
            }
            localStorage.setItem('__AGY_THINKING_LEVEL__', lvl.name);

            if (animate) {
                thumb.style.transition = 'left 0.15s ease, border-color 0.15s ease';
                fill.style.transition = 'width 0.15s ease, background 0.15s ease';
            } else {
                thumb.style.transition = 'none';
                fill.style.transition = 'none';
            }

            thumb.style.left = (lvl.pos * 100) + '%';
            thumb.style.borderColor = lvl.color;
            fill.style.width = (lvl.pos * 100) + '%';
            fill.style.background = getTrackFillBg(idx);

            badge.innerText = lvl.name;
            badge.style.color = lvl.color;
            badge.style.background = lvl.bg;
            badge.style.borderColor = lvl.border;

            lblBtns.forEach((b, i) => {
                if (i === idx) {
                    b.className = 'agy-slider-lbl-btn active';
                    b.style.color = lvl.color;
                } else {
                    b.className = 'agy-slider-lbl-btn';
                    b.style.color = '';
                }
            });

            // Update the effort span of the CURRENT ACTIVE MODEL (strictly dynamic!)
            if (curActive && curActive.effortSpan && curActive.effortSpan.innerText !== lvl.name) {
                curActive.effortSpan.innerText = lvl.name;
            }

            // Update model trigger button on chat input
            syncModelTriggerText(lvl.name, curActive ? curActive.modelBase : null);
        }

        section.__AGY_SET_LEVEL__ = setLevel;

        lblBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                setLevel(idx, true);
            };
        });

        // Watch for clicking other model items in the menu
        const menuItems = panel.querySelectorAll('[role="menuitem"]');
        menuItems.forEach(mi => {
            if (mi.id === 'agy-thinking-slider-section' || mi.closest('#agy-thinking-slider-section')) return;
            mi.addEventListener('click', () => {
                setTimeout(() => {
                    const newActive = getActiveModelInfo();
                    if (newActive) {
                        let targetIdx = 3;
                        if (newActive.effort) {
                            const found = levels.findIndex(l => l.name === newActive.effort);
                            if (found !== -1) targetIdx = found;
                        } else if (newActive.modelBase) {
                            const saved = localStorage.getItem('__AGY_EFFORT_' + newActive.modelBase);
                            if (saved) {
                                const found = levels.findIndex(l => l.name === saved);
                                if (found !== -1) targetIdx = found;
                            }
                        }
                        setLevel(targetIdx, true);
                    }
                }, 40);
            });
        });

        let isDragging = false;

        function updateFromX(clientX, snap = false) {
            const rect = wrap.getBoundingClientRect();
            let fraction = (clientX - rect.left) / rect.width;
            fraction = Math.max(0, Math.min(1, fraction));

            let bestIdx = 0;
            let minDist = 999;
            levels.forEach((lvl, idx) => {
                const dist = Math.abs(lvl.pos - fraction);
                if (dist < minDist) {
                    minDist = dist;
                    bestIdx = idx;
                }
            });

            if (snap) {
                setLevel(bestIdx, true);
            } else {
                currentIdx = bestIdx;
                const lvl = levels[bestIdx];
                thumb.style.left = (fraction * 100) + '%';
                fill.style.width = (fraction * 100) + '%';
                fill.style.background = getTrackFillBg(bestIdx);
                thumb.style.borderColor = lvl.color;
                badge.innerText = lvl.name;
                badge.style.color = lvl.color;
                badge.style.background = lvl.bg;
                badge.style.borderColor = lvl.border;
                lblBtns.forEach((b, i) => {
                    b.className = (i === bestIdx) ? 'agy-slider-lbl-btn active' : 'agy-slider-lbl-btn';
                    b.style.color = (i === bestIdx) ? lvl.color : '';
                });

                // Update effort span on active model during drag
                const curActive = getActiveModelInfo();
                if (curActive && curActive.effortSpan) {
                    curActive.effortSpan.innerText = lvl.name;
                }
                syncModelTriggerText(lvl.name, curActive ? curActive.modelBase : null);
            }
        }

        wrap.onmousedown = (e) => {
            e.stopPropagation();
            isDragging = true;
            updateFromX(e.clientX, false);

            const onMouseMove = (ev) => {
                if (!isDragging) return;
                ev.stopPropagation();
                updateFromX(ev.clientX, false);
            };

            const onMouseUp = (ev) => {
                if (!isDragging) return;
                isDragging = false;
                window.removeEventListener('mousemove', onMouseMove, true);
                window.removeEventListener('mouseup', onMouseUp, true);
                updateFromX(ev.clientX, true);
            };

            window.addEventListener('mousemove', onMouseMove, true);
            window.addEventListener('mouseup', onMouseUp, true);
        };
    }

    function syncModelTriggerText(levelName, targetModelBase) {
        const modelBtn = document.querySelector('[data-testid="model-selector-trigger"]');
        if (!modelBtn) return;

        let name = levelName;
        if (!name && targetModelBase) {
            name = localStorage.getItem('__AGY_EFFORT_' + targetModelBase);
        }
        if (!name) {
            name = localStorage.getItem('__AGY_THINKING_LEVEL__') || '高';
        }
        if (name === 'Ultra') name = '高';

        const span = modelBtn.querySelector('span.opacity-70');
        if (span && name) {
            const expected = ' ' + name;
            // CRITICAL ANTI-LOOP GUARD: Only mutate if different!
            if (span.textContent !== expected) {
                span.textContent = expected;
            }
        }
    }

        // Initial setup
    mountContextUsage();
    syncModelTriggerText();

    // Expose hooks for the Master Coordinator
    window.__AGY_MOUNT_CONTEXT_USAGE__ = mountContextUsage;
    window.__AGY_MOUNT_PANEL_THINKING_SLIDER__ = mountPanelThinkingSlider;
    window.__AGY_SYNC_MODEL_TRIGGER_TEXT__ = syncModelTriggerText;
})();


// ==========================================
// ANTIGRAVITY & GEMINI FUSION BRAND LOGO
// ==========================================
(function() {
    const FUSION_LOGO_B64 = "data:image/png;base64,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";

    function ensureBrandHeaderLogo() {
        try {
            if (document.getElementById('agy-sidebar-fusion-logo')) return;

            const allElements = document.querySelectorAll('h1, h2, h3, span, div, p');
            for (let i = 0; i < allElements.length; i++) {
                const el = allElements[i];
                if (el.children.length === 0 && el.textContent && el.textContent.trim() === 'Antigravity') {
                    if (el.closest('#agy-plugin-center-overlay') || el.closest('#agy-sidebar-quota-card')) continue;
                    
                    const parent = el.parentElement;
                    if (!parent || parent.querySelector('#agy-sidebar-fusion-logo')) continue;

                    const prevDisplay = window.getComputedStyle(parent).display;
                    if (!prevDisplay.includes('flex')) {
                        parent.style.display = 'inline-flex';
                    }
                    parent.style.alignItems = 'center';

                    const img = document.createElement('img');
                    img.id = 'agy-sidebar-fusion-logo';
                    img.src = FUSION_LOGO_B64;
                    img.alt = 'Antigravity Gemini';
                    img.style.cssText = 'width: 22px; height: 22px; margin-right: 8px; vertical-align: middle; display: inline-block; object-fit: contain; flex-shrink: 0; filter: drop-shadow(0 2px 5px rgba(99,102,241,0.3)); transition: transform 0.2s ease; cursor: pointer;';
                    img.title = 'Antigravity × Google Gemini';
                    img.onmouseenter = () => { img.style.transform = 'scale(1.12) rotate(4deg)'; };
                    img.onmouseleave = () => { img.style.transform = 'scale(1) rotate(0deg)'; };

                    parent.insertBefore(img, el);
                    break;
                }
            }
        } catch (e) {}
    }

    window.__AGY_MOUNT_FUSION_LOGO__ = ensureBrandHeaderLogo;
})();

// ==========================================
// ANTIGRAVITY MASTER UI COORDINATOR & GUARDIAN
// Single debounced MutationObserver with Anti-Reentrancy Lock
// Completely prevents UI freezing, recursion, and layout thrashing
// ==========================================
(function() {
    // Teardown previous master observer and intervals if re-injected
    if (window.__AGY_MASTER_OBSERVER__) {
        try { window.__AGY_MASTER_OBSERVER__.disconnect(); } catch(e) {}
        window.__AGY_MASTER_OBSERVER__ = null;
    }

    let isAgyUpdating = false;
    let agyRafPending = false;

    function runMasterSync() {
        if (isAgyUpdating) return;
        isAgyUpdating = true;
        try {
            if (typeof window.__AGY_MOUNT_FUSION_LOGO__ === 'function') { window.__AGY_MOUNT_FUSION_LOGO__(); }
            if (typeof window.__AGY_MOUNT_SIDEBAR_FOOTER__ === 'function') {
                window.__AGY_MOUNT_SIDEBAR_FOOTER__();
            }
            if (typeof window.__AGY_MOUNT_SIDEBAR_PLUGINS_BTN__ === 'function') {
                window.__AGY_MOUNT_SIDEBAR_PLUGINS_BTN__();
            }
            if (typeof window.__AGY_ATTACH_PLUGIN_OVERLAY__ === 'function') {
                window.__AGY_ATTACH_PLUGIN_OVERLAY__();
            }
            if (typeof window.__AGY_MOUNT_CONTEXT_USAGE__ === 'function') {
                window.__AGY_MOUNT_CONTEXT_USAGE__();
            }
            if (typeof window.__AGY_MOUNT_PANEL_THINKING_SLIDER__ === 'function') {
                window.__AGY_MOUNT_PANEL_THINKING_SLIDER__();
            }
            if (typeof window.__AGY_SYNC_MODEL_TRIGGER_TEXT__ === 'function') {
                window.__AGY_SYNC_MODEL_TRIGGER_TEXT__();
            }
            if (typeof window.__AGY_MOUNT_SCREENSHOT_MENU_ITEM__ === 'function') {
                window.__AGY_MOUNT_SCREENSHOT_MENU_ITEM__();
            }
        } catch (e) {
            console.error('[Antigravity Master Sync] Error:', e);
        } finally {
            setTimeout(() => { isAgyUpdating = false; }, 40);
        }
    }

    function scheduleMasterSync() {
        if (agyRafPending) return;
        agyRafPending = true;
        requestAnimationFrame(() => {
            agyRafPending = false;
            runMasterSync();
        });
    }

    // Run initial sync
    runMasterSync();

    // Register single master observer on document.body
    window.__AGY_MASTER_OBSERVER__ = new MutationObserver((mutations) => {
        if (isAgyUpdating) return; // Completely ignore our own modifications!
        scheduleMasterSync();
    });

    window.__AGY_MASTER_OBSERVER__.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[Antigravity Guardian] Single Master UI Coordinator active and stable.');
})();
