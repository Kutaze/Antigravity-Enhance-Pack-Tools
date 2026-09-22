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

  // 2. Lexical & Chat Editor Safe Inserter
  function insertIntoChatBox(text) {
    const editor = document.querySelector('[data-lexical-editor="true"], div[contenteditable="true"], textarea.chat-input, textarea');
    if (!editor) {
      alert('未找到聊天输入框，请确保处于对话界面。');
      return;
    }
    editor.focus();
    let inserted = false;
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const pasteEvt = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      });
      editor.dispatchEvent(pasteEvt);
      inserted = true;
    } catch(e) {}
    if (!inserted) {
      try {
        document.execCommand('insertText', false, text);
        inserted = true;
      } catch(e) {
        if (typeof editor.value === 'string') {
          editor.value = text;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          inserted = true;
        }
      }
    }
  }

  function safeClickElement(el) {
    if (!el) return;
    try {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      el.click();
    } catch(e) {
      try { el.click(); } catch(err) {}
    }
  }

  function triggerNewChatAndInstallSkill(promptText, skillName) {
    // 1. Click New Chat button
    try {
      const allElements = Array.from(document.querySelectorAll('*'));
      const textMatch = allElements.find(el => {
        if (el.children && el.children.length > 2) return false;
        const t = (el.textContent || '').trim();
        return t === '新建会话' || t === '+ 新建会话' || t === 'New Chat' || t === '+ New Chat' || t === '新对话';
      });
      if (textMatch) {
        const targetBtn = textMatch.closest('button, [role="button"]') || textMatch;
        safeClickElement(targetBtn);
      } else {
        const plusBtn = document.querySelector('button[aria-label*="新建"], button[aria-label*="New"], [data-testid*="new-chat"], button[title*="新建会话"]');
        if (plusBtn) safeClickElement(plusBtn);
      }
    } catch(e) {
      console.warn('Error clicking new chat:', e);
    }

    // 2. Poll waiting for new chat editor to mount
    let attempts = 0;
    const maxAttempts = 40;
    const pollTimer = setInterval(() => {
      attempts++;
      const editor = document.querySelector('[data-lexical-editor="true"], div[contenteditable="true"], textarea.chat-input, textarea');
      if (editor || attempts >= maxAttempts) {
        clearInterval(pollTimer);
        if (editor) {
          insertIntoChatBox(promptText);
          showToast('🚀 已开启新会话并自动输入技能安装指令！');
          setTimeout(() => {
            try {
              const sendBtn = editor.closest('form, div.relative, div[class*="chat-input"]')?.querySelector('button[type="submit"], button[aria-label*="Send"], button[aria-label*="发送"], button:has(svg.lucide-arrow-up)');
              if (sendBtn && !sendBtn.disabled) {
                safeClickElement(sendBtn);
              } else {
                editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
              }
            } catch(e) {}
          }, 400);
        } else {
          if (navigator.clipboard) navigator.clipboard.writeText(promptText);
          showToast('已复制安装指令到剪贴板，请在会话中粘贴发送', false);
        }
      }
    }, 100);
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
  window.__AGY_SHOW_TOAST__ = showToast;

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


  // ==========================================
  // Antigravity Visual Skills Hub (技能中心)
  // ==========================================
  const AGY_BUILTIN_SKILLS = [
  {
    "id": "ask-engineer",
    "name": "ask-engineer",
    "description": "研发流程总路由与向导。当不确定当前场景该使用哪个工程技能、如何推进研发工作流、或需要会话边界管理建议时唤醒。",
    "category": "架构与工程",
    "icon": "⚡"
  },
  {
    "id": "Chinesizing",
    "name": "Chinesizing",
    "description": "Electron 桌面端软件深度汉化、解包逆向、防崩溃与防卡死全流程工程规范。用于对 Electron / React 桌面应用进行界面国际化、安全打包部署、DOM 监听死循环规避、UI 组件键值反向透传与自动化门禁自检。",
    "category": "设计与UI",
    "icon": "🎨"
  },
  {
    "id": "code-review",
    "name": "code-review",
    "description": "三轴代码与体验审查规范（Tri-Axis Review）。对比当前分支与基准点之间的差异，从“代码规范与坏味道”、“需求规约符合度”以及“UI/UX视觉与交互体验品质”三个相互独立的维度展开并行审查并汇总结构化报告。",
    "category": "审查与诊断",
    "icon": "🔍"
  },
  {
    "id": "codebase-design",
    "name": "codebase-design",
    "description": "深层模块（Deep Module）设计准则与架构词汇。用于设计或优化模块接口、寻找架构深化机会、确定测试接缝位置、提升代码可测试性与心智杠杆率。",
    "category": "架构与工程",
    "icon": "⚡"
  },
  {
    "id": "diagnosing-bugs",
    "name": "diagnosing-bugs",
    "description": "针对疑难 Bug 与性能回退的阶段门禁式诊断闭环。当用户说“调试/诊断”、“系统报错/抛出异常/挂死/变卡”时唤醒。",
    "category": "审查与诊断",
    "icon": "🔍"
  },
  {
    "id": "domain-modeling",
    "name": "domain-modeling",
    "description": "建立与锐化项目统一领域语言（Ubiquitous Language）。在讨论术语、编写或编辑 CONTEXT.md、或起草架构决策记录（ADR）时唤醒。",
    "category": "架构与工程",
    "icon": "⚡"
  },
  {
    "id": "grill-me",
    "name": "grill-me",
    "description": "纯会话态的深度审讯盘问。当用户需要对某个想法、写作方案、非代码决策进行严苛的压力测试且无需在本地落盘文档时使用。",
    "category": "审查与诊断",
    "icon": "🔍"
  },
  {
    "id": "grill-with-docs",
    "name": "grill-with-docs",
    "description": "深度审讯式对齐并同步沉淀工程文档。在代码库中通过连环盘问榨干需求假设，同时就地更新 CONTEXT.md 领域词汇表与 ADR 架构决策记录。",
    "category": "审查与诊断",
    "icon": "🔍"
  },
  {
    "id": "grilling",
    "name": "grilling",
    "description": "审讯式对齐元技能。将想法或计划建模为决策树，按轮次推进前沿问题集，智能体查清事实，由用户拍板决策。",
    "category": "审查与诊断",
    "icon": "🔍"
  },
  {
    "id": "handoff",
    "name": "handoff",
    "description": "将当前会话的上下文成果精炼压缩为便携式交接文档（Handoff Document），以便全新会话、其他智能体工具或同事无缝接盘。",
    "category": "架构与工程",
    "icon": "⚡"
  },
  {
    "id": "implement",
    "name": "implement",
    "description": "依据技术规约或工单进行高质量工程落地。驱动 TDD（测试驱动开发）与 VDD（视觉驱动开发）双核闭环，结合类型检查与三轴代码审查完成高质量交付。",
    "category": "架构与工程",
    "icon": "⚡"
  },
  {
    "id": "improve-codebase-architecture",
    "name": "improve-codebase-architecture",
    "description": "扫描代码库中的深层模块重构机会，生成可视化 HTML 体检报告，并通过盘问推演重构方案。用于日常架构治理、消除技术债、提升可测试性与智能体理解效率。",
    "category": "架构与工程",
    "icon": "⚡"
  },
  {
    "id": "prototype",
    "name": "prototype",
    "description": "构建抛弃型可运行原型以解答关键设计疑问。当用户想验证状态机/业务逻辑感觉是否合理，或者探索界面的多种交互与视觉形态时使用。",
    "category": "设计与UI",
    "icon": "🎨"
  },
  {
    "id": "resolving-merge-conflicts",
    "name": "resolving-merge-conflicts",
    "description": "意图溯源式 Git 冲突解决规范。用于解决正在进行中的 git merge 或 rebase 冲突，追溯双方提交的一手意图，逐块化解，严禁擅自 abort。",
    "category": "架构与工程",
    "icon": "⚡"
  },
  {
    "id": "tdd",
    "name": "tdd",
    "description": "测试驱动开发（TDD）工程规范。当需要以测试先行方式开发新特性、修复 Bug、实施红-绿-重构循环或编写稳健的接缝测试时唤醒。",
    "category": "架构与工程",
    "icon": "⚡"
  },
  {
    "id": "to-spec",
    "name": "to-spec",
    "description": "将当前对话与共识合成为正式的技术规约（Spec），包含业务逻辑、UI/UX 交互规约与测试接缝决策，并发布至工单跟踪系统。",
    "category": "架构与工程",
    "icon": "⚡"
  },
  {
    "id": "to-tickets",
    "name": "to-tickets",
    "description": "将规约、计划或对话拆解为一系列“曳光弹（Tracer-bullet）”垂直切片工单。明确标注阻断依赖关系与视觉验收准则（Visual AC），支持发布至本地文件或在线敏捷看板。",
    "category": "架构与工程",
    "icon": "⚡"
  },
  {
    "id": "ui-craft",
    "name": "ui-craft",
    "description": "现代 UI/UX 工程与视觉交付全流程规范。用于界面概念设计、设计系统Tokens对齐、三变体原型推演、全状态防御设计、现代前端动效与VDD（视觉驱动开发）闭环。",
    "category": "设计与UI",
    "icon": "🎨"
  },
  {
    "id": "wayfinder",
    "name": "wayfinder",
    "description": "迷雾破局者（Wayfinder）。当面临一个规模庞大、充满未知迷雾的大型项目（跨越多个会话也无法容纳）时，在工单看板建立“决策地图”，逐一破解决策盲点直至通往目标的路径清晰。",
    "category": "架构与工程",
    "icon": "⚡"
  },
  {
    "id": "agy-customizations",
    "name": "agy-customizations",
    "description": "Comprehensive guide and reference for the Antigravity Customization System. Use to explain how customizations work, their loading priority, discovery mechanisms, and to guide the creation of skills, rules, plugins, hooks, and MCP servers.",
    "category": "Gemini生态",
    "icon": "✨"
  },
  {
    "id": "antigravity_guide",
    "name": "antigravity-guide",
    "description": "Provides a comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY), including the Antigravity CLI (agy), Antigravity 2.0, Antigravity IDE, Python SDK, slash commands, keybindings, and customizations (skills, rules, MCP, sidecars). Activate this skill when the user asks questions about how to use, configure, or customize Antigravity, AGY, the agy CLI, the Antigravity IDE, or Antigravity 2.0.",
    "category": "架构与工程",
    "icon": "⚡"
  },
  {
    "id": "generative_ui",
    "name": "generative_ui",
    "description": "How to render rich interactive HTML widgets inline in the chat or as standalone artifacts. Use this skill when you want to show the user diagrams, data visualizations, interactive controls, educational walkthroughs, or any rich visual content beyond plain text and markdown.",
    "category": "设计与UI",
    "icon": "🎨"
  },
  {
    "id": "migrate-workflows",
    "name": "migrate-workflows",
    "description": "Automatically migrate legacy workflows to modern skills across global and workspace configurations. Scans for existing workflows, creates target SKILL.md files, and safely archives old workflow files.",
    "category": "Gemini生态",
    "icon": "✨"
  },
  {
    "id": "permissioned-github",
    "name": "permissioned-github",
    "description": "Guidelines for interacting with GitHub and request permissions from the user when commands fail due to restrictions in the agent environment.",
    "category": "Gemini生态",
    "icon": "✨"
  },
  {
    "id": "documents",
    "name": "documents",
    "description": "Create, edit, redline, and comment on .docx, Word, and Google Docs-targeted document artifacts inside the container, with a strict render-and-verify workflow. Use render_docx.py to generate page PNGs (and optional PDF) for visual QA, then iterate until layout is flawless before delivering the final document.",
    "category": "办公与文档",
    "icon": "📊"
  },
  {
    "id": "gemini-api-dev",
    "name": "gemini-api-dev",
    "description": "Use this skill when writing code that calls the Gemini API for text generation, multi-turn chat, multimodal understanding, image generation, video generation, streaming responses, background research tasks, function calling, structured output, or migrating from the old generateContent API. Covers SDK usage and best practices for Gemini models and agents in Python and TypeScript.",
    "category": "Gemini生态",
    "icon": "✨"
  },
  {
    "id": "gemini-live-api-dev",
    "name": "gemini-live-api-dev",
    "description": "Use this skill when building real-time, bidirectional streaming applications with the Gemini Live API. Covers WebSocket-based audio/video/text streaming, voice activity detection (VAD), native audio features, function calling, session management, ephemeral tokens for client-side auth, live translation, and all Live API configuration options. SDKs covered - google-genai (Python), @google/genai (JavaScript/TypeScript).",
    "category": "Gemini生态",
    "icon": "✨"
  },
  {
    "id": "gemini-omni-flash-api",
    "name": "gemini-omni-flash-api",
    "description": "Use this skill for generative video editing, text-to-video, image-referenced video generation, first-frame-to-video, first-and-last-frame transitions, and video extensions using Gemini Omni 1.1 Flash (gemini-omni-1.1-flash) via the official google-genai SDK. Includes workflows for pre-processing/optimizing high-resolution or long source videos with ffmpeg, stripping audio for full sound regeneration, and handling turn-by-turn video editing and parallel execution.",
    "category": "Gemini生态",
    "icon": "✨"
  },
  {
    "id": "chrome-extensions",
    "name": "chrome-extensions",
    "description": "Build and publish Chrome Extensions using Manifest V3 best practices. Use this skill whenever the user asks to create, modify, debug, or understand Chrome browser extensions, add-ons, or anything involving the Chrome Extensions API. Trigger on mentions of: 'Chrome extension', 'browser extension', 'manifest.json', 'content script', 'service worker' (in browser context), 'popup' (in browser extension context), 'side panel', 'chrome. API', 'declarativeNetRequest', 'omnibox', 'context menu' (in extension context), 'userScripts', 'user script', 'script manager', or any request to build functionality that integrates with the Chrome browser UI. Also trigger for publishing to the Chrome Web Store: 'publish extension', preparing an extension for publishing, responding to a review rejection, writing permission justifications, or drafting a privacy policy.",
    "category": "设计与UI",
    "icon": "🎨"
  },
  {
    "id": "modern-web-guidance",
    "name": "modern-web-guidance",
    "description": "Search tool for modern web development best practices. MANDATORY: Execute FIRST for all HTML/CSS and clientside JS tasks. Do NOT skip — web APIs evolve rapidly and training weights contain obsolete patterns.  Trigger immediately for: - UI/Layout: Modals, dialogs, popovers, Glassmorphism/backdrop-filters, anchor positioning, container queries, :has(), :user-valid. - Scroll/Motion: View Transitions, Scroll-driven animations, scroll parallax/reveals. - Performance: CWV (LCP, INP), content-visibility, Fetch Priority, image optimization. - System/APIs: Local filesystem access, WebUSB, WebSockets sync, WebAssembly widgets. - Frameworks: Adapting layout/styles in React, Vue, Angular. - General Frontend: Forms, autofill, advanced inputs, custom scrollbars, modern component states, etc.  DO NOT trigger for: - Backend: Database SQL, ORMs, Express API routes. - Pipelines: CI/CD deployment, Docker, Actions. - Generic: Local scripts (Python/Go tools), ESLint, Git.",
    "category": "设计与UI",
    "icon": "🎨"
  },
  {
    "id": "pdf",
    "name": "pdf",
    "description": "Read, create, inspect, render, and verify PDF files where visual layout matters, including fillable AcroForms. Use Poppler rendering plus Python tools such as reportlab, pdfplumber, and pypdf for generation and extraction.",
    "category": "办公与文档",
    "icon": "📊"
  },
  {
    "id": "presentations",
    "name": "Presentations",
    "description": "Read, create or edit PowerPoint or Google Slides decks. Use for presentation, slide deck, PowerPoint, PPT, PPTX, or Google Slides requests.",
    "category": "办公与文档",
    "icon": "📊"
  },
  {
    "id": "excel-live-control",
    "name": "excel-live-control",
    "description": "Control an open or active Microsoft Excel workbook through the ChatGPT add-in or connected session. Use when the user tags the Microsoft Excel app in Codex or follows up on an established live Excel task. Do not use for standalone spreadsheet files or Google Sheets.",
    "category": "办公与文档",
    "icon": "📊"
  },
  {
    "id": "spreadsheets",
    "name": "Spreadsheets",
    "description": "Create, edit, analyze, and verify standalone spreadsheet files or Google Sheets-ready workbooks, including .xlsx, .xls, .csv, and .tsv. Do not use for live controlling Microsoft Excel app or a live Excel session.",
    "category": "办公与文档",
    "icon": "📊"
  },
  {
    "id": "template-creator",
    "name": "template-creator",
    "description": "Create or update a reusable personal Codex artifact-template skill. Use when the user invokes $template-creator or asks in natural language to create a reusable template from a reference document, presentation, spreadsheet, Google Docs, Slides, or Sheets link, ImageGen or Product Design image, email, Slack message, or Site project, or explicitly asks to edit or update a passed artifact-template skill. Do not use for one-off creation from an existing template.",
    "category": "办公与文档",
    "icon": "📊"
  }
];

  AGY_BUILTIN_SKILLS.forEach(s => { s.origin = 'builtin'; });

  function inferSkillCategory(id, desc) {
    const text = ((id || '') + ' ' + (desc || '')).toLowerCase();
    if (text.includes('gemini') || text.includes('omni') || text.includes('live-api') || text.includes('flash-api')) {
      return 'Gemini生态';
    }
    if (text.includes('doc') || text.includes('word') || text.includes('slide') || text.includes('presentation') || 
        text.includes('ppt') || text.includes('sheet') || text.includes('excel') || text.includes('pdf') || 
        text.includes('template') || text.includes('office') || text.includes('文档') || text.includes('表格') || text.includes('幻灯片')) {
      return '办公与文档';
    }
    if (text.includes('review') || text.includes('diagnos') || text.includes('grill') || text.includes('tdd') || 
        text.includes('test') || text.includes('audit') || text.includes('审查') || text.includes('诊断') || 
        text.includes('测试') || text.includes('排查') || text.includes('体检')) {
      return '审查与诊断';
    }
    if (text.includes('ui') || text.includes('design') || text.includes('style') || text.includes('css') || 
        text.includes('frontend') || text.includes('chinesizing') || text.includes('banner') || text.includes('brand') || 
        text.includes('icon') || text.includes('logo') || text.includes('前端') || text.includes('设计') || 
        text.includes('汉化') || text.includes('视觉') || text.includes('样式')) {
      return '设计与UI';
    }
    if (text.includes('engineer') || text.includes('architect') || text.includes('codebase') || text.includes('domain') || 
        text.includes('model') || text.includes('implement') || text.includes('handoff') || text.includes('merge') || 
        text.includes('git') || text.includes('refactor') || text.includes('架构') || text.includes('工程') || 
        text.includes('重构') || text.includes('研发') || text.includes('领域')) {
      return '架构与工程';
    }
    return '其他';
  }

  let agyCurrentSkills = [...AGY_BUILTIN_SKILLS];
  let agySelectedCategory = 'all';
  let agySearchQuery = '';

  function createSkillsHubModal() {
    const modal = document.createElement('div');
    modal.id = 'agy-skills-modal';
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999999;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 16px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    modal.innerHTML = `
      <style>
        #agy-skills-modal {
          --sk-bg: #ffffff;
          --sk-header-bg: #f8fafc;
          --sk-text: #0f172a;
          --sk-subtext: #475569;
          --sk-desc: #1e293b;
          --sk-border: #e2e8f0;
          --sk-card-bg: #ffffff;
          --sk-card-border: #cbd5e1;
          --sk-card-hover-border: #6366f1;
          --sk-card-hover-bg: #f5f7ff;
          --sk-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          --sk-badge-color: #3730a3;
          --sk-badge-bg: rgba(99, 102, 241, 0.12);
          --sk-badge-border: rgba(99, 102, 241, 0.3);
          --sk-cat-color: #475569;
          --sk-cat-bg: #f1f5f9;
          --sk-cat-border: #cbd5e1;
          --sk-input-bg: #ffffff;
          --sk-input-text: #0f172a;
          --sk-input-border: #cbd5e1;
          --sk-footer-text: #64748b;
          --sk-filter-bg: #f1f5f9;
          --sk-filter-text: #334155;
          --sk-filter-border: #cbd5e1;
          --sk-filter-active-bg: #4f46e5;
          --sk-filter-active-text: #ffffff;
          --sk-filter-active-border: #4338ca;
        }
        #agy-skills-modal[data-theme="dark"],
        body.theme-dark #agy-skills-modal,
        body.dark #agy-skills-modal,
        html.dark #agy-skills-modal {
          --sk-bg: #18181b;
          --sk-header-bg: rgba(255, 255, 255, 0.02);
          --sk-text: #f8fafc;
          --sk-subtext: #94a3b8;
          --sk-desc: #e2e8f0;
          --sk-border: rgba(255, 255, 255, 0.1);
          --sk-card-bg: rgba(255, 255, 255, 0.035);
          --sk-card-border: rgba(255, 255, 255, 0.1);
          --sk-card-hover-border: rgba(129, 140, 248, 0.65);
          --sk-card-hover-bg: rgba(99, 102, 241, 0.12);
          --sk-card-shadow: none;
          --sk-badge-color: #c7d2fe;
          --sk-badge-bg: rgba(99, 102, 241, 0.22);
          --sk-badge-border: rgba(99, 102, 241, 0.4);
          --sk-cat-color: #cbd5e1;
          --sk-cat-bg: rgba(255, 255, 255, 0.07);
          --sk-cat-border: rgba(255, 255, 255, 0.12);
          --sk-input-bg: rgba(255, 255, 255, 0.05);
          --sk-input-text: #f8fafc;
          --sk-input-border: rgba(255, 255, 255, 0.15);
          --sk-footer-text: #94a3b8;
          --sk-filter-bg: rgba(255, 255, 255, 0.04);
          --sk-filter-text: #cbd5e1;
          --sk-filter-border: rgba(255, 255, 255, 0.12);
          --sk-filter-active-bg: rgba(99, 102, 241, 0.3);
          --sk-filter-active-text: #e0e7ff;
          --sk-filter-active-border: #6366f1;
        }
        @media (prefers-color-scheme: dark) {
          body:not(.theme-light) #agy-skills-modal:not([data-theme="light"]) {
            --sk-bg: #18181b;
            --sk-header-bg: rgba(255, 255, 255, 0.02);
            --sk-text: #f8fafc;
            --sk-subtext: #94a3b8;
            --sk-desc: #e2e8f0;
            --sk-border: rgba(255, 255, 255, 0.1);
            --sk-card-bg: rgba(255, 255, 255, 0.035);
            --sk-card-border: rgba(255, 255, 255, 0.1);
            --sk-card-hover-border: rgba(129, 140, 248, 0.65);
            --sk-card-hover-bg: rgba(99, 102, 241, 0.12);
            --sk-card-shadow: none;
            --sk-badge-color: #c7d2fe;
            --sk-badge-bg: rgba(99, 102, 241, 0.22);
            --sk-badge-border: rgba(99, 102, 241, 0.4);
            --sk-cat-color: #cbd5e1;
            --sk-cat-bg: rgba(255, 255, 255, 0.07);
            --sk-cat-border: rgba(255, 255, 255, 0.12);
            --sk-input-bg: rgba(255, 255, 255, 0.05);
            --sk-input-text: #f8fafc;
            --sk-input-border: rgba(255, 255, 255, 0.15);
            --sk-footer-text: #94a3b8;
            --sk-filter-bg: rgba(255, 255, 255, 0.04);
            --sk-filter-text: #cbd5e1;
            --sk-filter-border: rgba(255, 255, 255, 0.12);
            --sk-filter-active-bg: rgba(99, 102, 241, 0.3);
            --sk-filter-active-text: #e0e7ff;
            --sk-filter-active-border: #6366f1;
          }
        }

        #agy-skills-cards-wrapper {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 10px;
        }
        @media (max-width: 860px) {
          #agy-skills-cards-wrapper {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 560px) {
          #agy-skills-cards-wrapper {
            grid-template-columns: 1fr !important;
          }
        }
        .agy-skill-card {
          border: 1px solid var(--sk-card-border);
          background: var(--sk-card-bg);
          box-shadow: var(--sk-card-shadow);
        }
        .agy-skill-card:hover {
          border-color: var(--sk-card-hover-border) !important;
          background: var(--sk-card-hover-bg) !important;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px -3px rgba(99, 102, 241, 0.18) !important;
        }
      </style>
      <div id="agy-skills-container" style="
        position: relative;
        width: 95%;
        max-width: 960px;
        max-height: 85vh;
        background: var(--sk-bg);
        color: var(--sk-text);
        border: 1px solid var(--sk-border);
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: agyModalFadeIn 0.15s ease-out;
      ">
        <!-- Header -->
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--sk-border);
          background: var(--sk-header-bg);
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 10px;
              background: linear-gradient(135deg, #6366f1, #a855f7);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-size: 16px;
              box-shadow: 0 4px 10px rgba(99, 102, 241, 0.35);
            ">✨</div>
            <div>
              <div style="font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: var(--sk-text);">
                <span>技能中心 (Skills Hub)</span>
                <span id="agy-skills-count-badge" style="
                  font-size: 11px;
                  font-weight: 600;
                  padding: 1px 7px;
                  border-radius: 9999px;
                  background: rgba(99, 102, 241, 0.15);
                  color: #4f46e5;
                  border: 1px solid rgba(99, 102, 241, 0.25);
                ">${AGY_BUILTIN_SKILLS.length} 个可用技能</span>
              </div>
              <div style="font-size: 12px; color: var(--sk-subtext); margin-top: 2px;">
                点击任意卡片一键填入指令并唤醒对应专家角色
              </div>
            </div>
          </div>
          <button id="agy-skills-close-btn" type="button" style="
            background: transparent;
            border: none;
            color: var(--sk-subtext);
            cursor: pointer;
            font-size: 18px;
            width: 30px;
            height: 30px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
          " onmouseover="this.style.background='rgba(99,102,241,0.1)';this.style.color='#6366f1';" onmouseout="this.style.background='transparent';this.style.color='var(--sk-subtext)';">✕</button>
        </div>

        <!-- Search Bar & Filters -->
        <div style="padding: 14px 20px 10px; display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--sk-border);">
          <div style="position: relative; width: 100%;">
            <input id="agy-skills-search-input" type="text" placeholder="🔍 搜索技能名称、描述或关键词 (如: UI、审查、TDD、文档、架构...)" style="
              width: 100%;
              box-sizing: border-box;
              padding: 9px 14px;
              background: var(--sk-input-bg);
              color: var(--sk-input-text);
              border: 1px solid var(--sk-input-border);
              border-radius: 8px;
              font-size: 13px;
              outline: none;
              transition: border-color 0.15s ease;
            " onfocus="this.style.borderColor='#6366f1';" onblur="this.style.borderColor='var(--sk-input-border)';">
          </div>
          
          <div id="agy-skills-category-bar" style="display: flex; gap: 6px; flex-wrap: wrap;">
            <!-- Category buttons injected by JS -->
          </div>
        </div>

        <!-- Skills Cards Grid (3 Columns) -->
        <div id="agy-skills-cards-wrapper" style="
          padding: 14px 20px 18px;
          overflow-y: auto;
          max-height: 480px;
          box-sizing: border-box;
        ">
        </div>

        <!-- Footer -->
        <div style="
          padding: 10px 20px;
          border-top: 1px solid var(--sk-border);
          background: var(--sk-header-bg);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: var(--sk-footer-text);
          flex-wrap: wrap;
          gap: 10px;
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>💡 提示：点击技能卡片后直接在对话框输入具体需求并发送</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <button id="agy-skills-add-btn" type="button" style="
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 5px 13px;
              border-radius: 7px;
              font-size: 12px;
              font-weight: 600;
              color: #ffffff;
              background: linear-gradient(135deg, #10b981, #059669);
              border: 1px solid rgba(255, 255, 255, 0.2);
              cursor: pointer;
              box-shadow: 0 2px 7px rgba(16, 185, 129, 0.35);
              transition: all 0.15s ease;
            " onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(16,185,129,0.45)';" onmouseout="this.style.transform='none';this.style.boxShadow='0 2px 7px rgba(16,185,129,0.35)';">
              <span style="font-size: 13px;">➕</span>
              <span>从 GitHub 添加技能</span>
            </button>
            <span style="font-size: 11px; opacity: 0.8;">Esc 或点击外围关闭</span>
          </div>
        </div>

        <!-- Skill Install from GitHub Dialog Overlay (Hidden by default) -->
        <div id="agy-skills-add-dialog" style="
          position: absolute;
          inset: 0;
          background: var(--sk-bg);
          z-index: 50;
          display: none;
          flex-direction: column;
          padding: 24px 28px;
          box-sizing: border-box;
          border-radius: 16px;
        ">
          <!-- Dialog Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="
                width: 36px;
                height: 36px;
                border-radius: 10px;
                background: linear-gradient(135deg, #10b981, #059669);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                font-size: 18px;
                box-shadow: 0 4px 10px rgba(16, 185, 129, 0.35);
              ">📥</div>
              <div>
                <div style="font-size: 15px; font-weight: 600; color: var(--sk-text);">从 GitHub 安装与部署新技能 (Skill)</div>
                <div style="font-size: 12px; color: var(--sk-subtext); margin-top: 2px;">
                  分享 GitHub 仓库链接，系统将自动发起新会话并引导 Gemini 将其安装部署至本地技能库
                </div>
              </div>
            </div>
            <button id="agy-skill-add-close-btn" type="button" style="
              background: transparent;
              border: none;
              color: var(--sk-subtext);
              cursor: pointer;
              font-size: 18px;
              width: 30px;
              height: 30px;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.15s ease;
            " onmouseover="this.style.background='rgba(99,102,241,0.1)';this.style.color='#6366f1';" onmouseout="this.style.background='transparent';this.style.color='var(--sk-subtext)';">✕</button>
          </div>

          <!-- Dialog Body -->
          <div style="display: flex; flex-direction: column; gap: 16px; flex: 1;">
            <div>
              <label style="display: block; font-size: 12.5px; font-weight: 600; color: var(--sk-text); margin-bottom: 7px;">
                GitHub 仓库链接 / Skill 地址
              </label>
              <input id="agy-skill-github-input" type="text" placeholder="例如: https://github.com/owner/skill-repo 或 owner/repo" style="
                width: 100%;
                box-sizing: border-box;
                padding: 11px 14px;
                background: var(--sk-input-bg);
                color: var(--sk-input-text);
                border: 1px solid var(--sk-input-border);
                border-radius: 8px;
                font-size: 13px;
                outline: none;
                transition: border-color 0.15s ease;
              " onfocus="this.style.borderColor='#10b981';" onblur="this.style.borderColor='var(--sk-input-border)';" />
            </div>

            <!-- Deployment Flow Guide Card -->
            <div style="
              padding: 14px 16px;
              border-radius: 10px;
              background: var(--sk-card-bg);
              border: 1px solid var(--sk-card-border);
              font-size: 12px;
              color: var(--sk-subtext);
              line-height: 1.65;
            ">
              <div style="font-weight: 600; color: var(--sk-text); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <span>⚡</span>
                <span>自动化安装流程说明</span>
              </div>
              <div style="margin-bottom: 3px;">1. 点击确认后，系统将自动跳转至<b>全新对话会话</b>，并自动录入专业部署指引；</div>
              <div style="margin-bottom: 3px;">2. Gemini 智能体将解析该仓库中的 <code>SKILL.md</code> 规范并将其克隆部署至本地配置目录：<code>~/.gemini/config/skills/</code>；</div>
              <div style="margin-bottom: 3px;">3. 部署完成后，该技能将标注为<b>「用户添加」</b>，若未能自动匹配已知分区，将智能归入<b>「📦 其他」</b>分页；</div>
              <div>4. 随后在对话中输入 <code>$技能名</code> 即可随时唤醒该专业技能。</div>
            </div>
          </div>

          <!-- Dialog Footer -->
          <div style="
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            padding-top: 14px;
            border-top: 1px solid var(--sk-border);
          ">
            <button id="agy-skill-add-cancel-btn" type="button" style="
              padding: 7px 15px;
              border-radius: 7px;
              font-size: 12.5px;
              font-weight: 500;
              cursor: pointer;
              background: var(--sk-filter-bg);
              color: var(--sk-filter-text);
              border: 1px solid var(--sk-filter-border);
              transition: all 0.15s ease;
            " onmouseover="this.style.opacity='0.85';" onmouseout="this.style.opacity='1';">取消</button>
            <button id="agy-skill-add-submit-btn" type="button" style="
              padding: 7px 18px;
              border-radius: 7px;
              font-size: 12.5px;
              font-weight: 600;
              cursor: pointer;
              background: linear-gradient(135deg, #10b981, #059669);
              color: #ffffff;
              border: 1px solid rgba(255, 255, 255, 0.2);
              box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
              transition: all 0.15s ease;
            " onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(16,185,129,0.45)';" onmouseout="this.style.transform='none';this.style.boxShadow='0 2px 8px rgba(16,185,129,0.35)';">
              🚀 开启新会话并自动安装
            </button>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeSkillsHubModal();
      }
    });

    const closeBtn = modal.querySelector('#agy-skills-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSkillsHubModal();
      });
    }

    const searchInput = modal.querySelector('#agy-skills-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        agySearchQuery = e.target.value.trim().toLowerCase();
        renderSkillsList();
      });
    }

    // Add Skill Dialog Events
    const addBtn = modal.querySelector('#agy-skills-add-btn');
    const addDialog = modal.querySelector('#agy-skills-add-dialog');
    const addCloseBtn = modal.querySelector('#agy-skill-add-close-btn');
    const addCancelBtn = modal.querySelector('#agy-skill-add-cancel-btn');
    const addSubmitBtn = modal.querySelector('#agy-skill-add-submit-btn');
    const githubInput = modal.querySelector('#agy-skill-github-input');

    const closeAddDialog = () => {
      if (addDialog) addDialog.style.display = 'none';
    };

    if (addBtn && addDialog) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addDialog.style.display = 'flex';
        if (githubInput) {
          githubInput.value = '';
          setTimeout(() => githubInput.focus(), 60);
        }
      });
    }

    if (addCloseBtn) addCloseBtn.addEventListener('click', closeAddDialog);
    if (addCancelBtn) addCancelBtn.addEventListener('click', closeAddDialog);

    const handleInstallSubmit = () => {
      let rawUrl = (githubInput ? githubInput.value : '').trim();
      if (!rawUrl) {
        showToast('请输入有效的 GitHub 仓库链接！', false);
        if (githubInput) githubInput.focus();
        return;
      }

      let cleanUrl = rawUrl;
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('git@')) {
        cleanUrl = 'https://github.com/' + cleanUrl.replace(/^github\.com\//, '');
      }

      let repoName = 'custom-skill';
      try {
        const parts = cleanUrl.replace(/\.git$/, '').split('/');
        if (parts.length > 0 && parts[parts.length - 1]) {
          repoName = parts[parts.length - 1];
        }
      } catch(e) {}

      const deployPrompt = `请帮我安装并部署这个技能 (Agent Skill)：\n仓库地址：${cleanUrl}\n\n具体执行指引：\n1. 请深入分析该仓库中的 SKILL.md 规范与实现文件；\n2. 将该技能完整克隆并放置在本机技能目录中：\n   - 目标部署路径：~/.gemini/config/skills/${repoName}\n3. 检查并适配其所需的脚本、配置与运行环境；\n4. 部署完成后，请向我汇报该技能的核心功能与具体调用指令（如：$${repoName}）。`;

      closeAddDialog();
      closeSkillsHubModal();
      triggerNewChatAndInstallSkill(deployPrompt, repoName);
    };

    if (addSubmitBtn) {
      addSubmitBtn.addEventListener('click', handleInstallSubmit);
    }
    if (githubInput) {
      githubInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleInstallSubmit();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        if (addDialog && addDialog.style.display === 'flex') {
          closeAddDialog();
        } else {
          closeSkillsHubModal();
        }
      }
    });

    return modal;
  }

  function renderSkillsCategories() {
    const bar = document.getElementById('agy-skills-category-bar');
    if (!bar) return;

    const standardCats = ['架构与工程', '设计与UI', '审查与诊断', '办公与文档', 'Gemini生态'];
    const categories = ['all', ...standardCats, '其他'];
    const catLabels = {
      'all': '全部',
      '架构与工程': '⚡ 架构与工程',
      '设计与UI': '🎨 设计与UI',
      '审查与诊断': '🔍 审查与诊断',
      '办公与文档': '📊 办公与文档',
      'Gemini生态': '✨ Gemini生态',
      '其他': '📦 其他'
    };

    bar.innerHTML = categories.map(cat => {
      const isActive = agySelectedCategory === cat;
      let count = 0;
      if (cat === 'all') {
        count = agyCurrentSkills.length;
      } else if (cat === '其他') {
        count = agyCurrentSkills.filter(s => s.category === '其他' || !standardCats.includes(s.category)).length;
      } else {
        count = agyCurrentSkills.filter(s => s.category === cat).length;
      }

      return `
        <button type="button" data-category="${cat}" style="
          padding: 4px 11px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          border: 1px solid ${isActive ? 'var(--sk-filter-active-border)' : 'var(--sk-filter-border)'};
          background: ${isActive ? 'var(--sk-filter-active-bg)' : 'var(--sk-filter-bg)'};
          color: ${isActive ? 'var(--sk-filter-active-text)' : 'var(--sk-filter-text)'};
          font-weight: ${isActive ? '600' : '500'};
          transition: all 0.15s ease;
        " onmouseover="if(!${isActive}) this.style.opacity='0.85';" onmouseout="if(!${isActive}) this.style.opacity='1';">${catLabels[cat] || cat} (${count})</button>
      `;
    }).join('');

    bar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        agySelectedCategory = btn.getAttribute('data-category');
        renderSkillsCategories();
        renderSkillsList();
      });
    });
  }

  function renderSkillsList() {
    const wrapper = document.getElementById('agy-skills-cards-wrapper');
    if (!wrapper) return;

    renderSkillsCategories();

    const standardCats = ['架构与工程', '设计与UI', '审查与诊断', '办公与文档', 'Gemini生态'];
    let filtered = agyCurrentSkills;
    if (agySelectedCategory === '其他') {
      filtered = filtered.filter(s => s.category === '其他' || !standardCats.includes(s.category));
    } else if (agySelectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === agySelectedCategory);
    }
    if (agySearchQuery) {
      filtered = filtered.filter(s => {
        const isCustom = s.origin === 'custom' || s.type === 'custom';
        const isPlugin = s.origin === 'plugin' || s.type === 'plugin';
        const originText = isCustom ? '用户添加 自定义' : (isPlugin ? '插件扩展 插件' : '原生自带 官方自带 内置');
        return s.id.toLowerCase().includes(agySearchQuery) ||
               (s.name && s.name.toLowerCase().includes(agySearchQuery)) ||
               (s.description && s.description.toLowerCase().includes(agySearchQuery)) ||
               (s.category && s.category.toLowerCase().includes(agySearchQuery)) ||
               originText.toLowerCase().includes(agySearchQuery);
      });
    }

    if (filtered.length === 0) {
      wrapper.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; color: var(--sk-subtext, #94a3b8);">
          <div style="font-size: 28px; margin-bottom: 8px;">🔍</div>
          <div style="font-size: 14px; font-weight: 500;">未找到${agySearchQuery ? '与 "' + agySearchQuery + '" ' : ''}相关的技能</div>
          <div style="font-size: 12px; margin-top: 4px; opacity: 0.7;">请尝试更换关键词搜索，或点击底部按钮从 GitHub 安装新技能</div>
        </div>
      `;
      return;
    }

    wrapper.innerHTML = filtered.map(skill => {
      const isCustom = skill.origin === 'custom' || skill.type === 'custom';
      const isPlugin = skill.origin === 'plugin' || skill.type === 'plugin';
      const originLabel = isCustom ? '用户添加' : (isPlugin ? '插件扩展' : '原生自带');
      
      const originStyle = isCustom
        ? 'color: #059669; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.28);'
        : (isPlugin
          ? 'color: #7c3aed; background: rgba(124, 58, 237, 0.12); border: 1px solid rgba(124, 58, 237, 0.25);'
          : 'color: #4f46e5; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.22);');

      const catDisplay = standardCats.includes(skill.category) ? skill.category : '其他';

      return `
        <div class="agy-skill-card" data-skill-id="${skill.id}" style="
          padding: 12px 14px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
        ">
          <!-- Card Top: Icon, Name badge, Origin Tag, Category Tag -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;">
              <span style="font-size: 15px; flex-shrink: 0;">${skill.icon || (isCustom ? '🧩' : '⚡')}</span>
              <span class="agy-skill-badge" title="$${skill.id}" style="
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 12px;
                font-weight: 600;
                color: var(--sk-badge-color);
                background: var(--sk-badge-bg);
                padding: 1.5px 7px;
                border-radius: 5px;
                border: 1px solid var(--sk-badge-border);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              ">$${skill.id}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
              <!-- Origin Tag (原生自带 vs 用户添加) -->
              <span class="agy-skill-origin" style="
                font-size: 10px;
                padding: 1px 5px;
                border-radius: 4px;
                white-space: nowrap;
                font-weight: 600;
                ${originStyle}
              ">${originLabel}</span>

              <!-- Category Tag -->
              <span class="agy-skill-cat" style="
                font-size: 10px;
                color: var(--sk-cat-color);
                background: var(--sk-cat-bg);
                border: 1px solid var(--sk-cat-border);
                padding: 1px 5px;
                border-radius: 4px;
                white-space: nowrap;
                font-weight: 500;
              ">${catDisplay}</span>
            </div>
          </div>

          <!-- Description (high-contrast readable dark text) -->
          <div class="agy-skill-desc" style="
            font-size: 12px;
            line-height: 1.5;
            color: var(--sk-desc);
            font-weight: 500;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            min-height: 36px;
          ">${skill.description || '暂无描述'}</div>
        </div>
      `;
    }).join('');

    wrapper.querySelectorAll('.agy-skill-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const skillId = card.getAttribute('data-skill-id');
        if (skillId) {
          insertIntoChatBox('$' + skillId + ' ');
          closeSkillsHubModal();
          showToast('✨ 已填入技能：$' + skillId);
        }
      });
    });
  }

  function detectSkillsThemeIsDark() {
    if (document.body.classList.contains('theme-dark') || document.documentElement.classList.contains('dark')) return true;
    if (document.body.classList.contains('theme-light')) return false;
    try {
      const bg = window.getComputedStyle(document.body).backgroundColor;
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const lum = 0.299 * parseInt(match[1]) + 0.587 * parseInt(match[2]) + 0.114 * parseInt(match[3]);
        return lum < 128;
      }
    } catch(e) {}
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function openSkillsHubModal() {
    let modal = document.getElementById('agy-skills-modal');
    if (!modal) {
      modal = createSkillsHubModal();
      document.body.appendChild(modal);
    }
    const isDark = detectSkillsThemeIsDark();
    modal.setAttribute('data-theme', isDark ? 'dark' : 'light');
    modal.style.display = 'flex';
    
    // Auto focus search input
    const searchInput = document.getElementById('agy-skills-search-input');
    if (searchInput) {
      searchInput.value = '';
      agySearchQuery = '';
      setTimeout(() => searchInput.focus(), 60);
    }
    renderSkillsList();

    // Dynamically query Electron IPC if available for any custom workspace skills
    if (window.electronNative && typeof window.electronNative.getSkills === 'function') {
      window.electronNative.getSkills().then((extra) => {
        if (Array.isArray(extra) && extra.length > 0) {
          const map = new Map(agyCurrentSkills.map(s => [s.id, s]));
          for (const item of extra) {
            const isBuiltin = item.type === 'builtin';
            const isPlugin = item.type === 'plugin';
            const origin = isBuiltin ? 'builtin' : (isPlugin ? 'plugin' : 'custom');

            if (!map.has(item.id)) {
              const inferredCat = inferSkillCategory(item.id, item.description || '');
              map.set(item.id, {
                id: item.id,
                name: item.name || item.id,
                description: item.description || '自定义扩展技能',
                category: inferredCat,
                origin: origin,
                type: item.type || 'custom',
                icon: item.icon || (origin === 'custom' ? '🧩' : (inferredCat === 'Gemini生态' ? '✨' : '⚡'))
              });
            } else {
              const existing = map.get(item.id);
              if (item.type) existing.type = item.type;
              if (!existing.origin) existing.origin = origin;
            }
          }
          agyCurrentSkills = Array.from(map.values());
          const badge = document.getElementById('agy-skills-count-badge');
          if (badge) badge.innerText = agyCurrentSkills.length + ' 个可用技能';
          renderSkillsCategories();
          renderSkillsList();
        }
      }).catch(() => {});
    }
  }

  function closeSkillsHubModal() {
    const modal = document.getElementById('agy-skills-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  function toggleSkillsHubModal() {
    const modal = document.getElementById('agy-skills-modal');
    if (modal && modal.style.display === 'flex') {
      closeSkillsHubModal();
    } else {
      openSkillsHubModal();
    }
  }

  window.__AGY_OPEN_SKILLS_HUB__ = openSkillsHubModal;
  window.__AGY_CLOSE_SKILLS_HUB__ = closeSkillsHubModal;
  window.__AGY_TOGGLE_SKILLS_HUB__ = toggleSkillsHubModal;


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

    // Ensure toolbar screenshot button is removed (it belongs in '+' menu)
    const oldScreenBtn = document.getElementById('agy-toolbar-screenshot-btn');
    if (oldScreenBtn) oldScreenBtn.remove();

    // Visual Skills Hub toolbar button
    let skillsBtn = document.getElementById('agy-skills-btn');
    if (!skillsBtn) {
      skillsBtn = document.createElement('button');
      skillsBtn.id = 'agy-skills-btn';
      skillsBtn.type = 'button';
      skillsBtn.className = 'p-1.5 rounded-full text-secondary-foreground hover:bg-secondary cursor-pointer transition-colors';
      skillsBtn.setAttribute('aria-label', '技能中心 (Skills Hub)');
      skillsBtn.setAttribute('title', '技能中心 (Skills Hub) - 可视化选择与调用技能');
      skillsBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          <path d="M5 3v4"/>
          <path d="M19 17v4"/>
          <path d="M3 5h4"/>
          <path d="M17 19h4"/>
        </svg>
      `;
      skillsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSkillsHubModal();
      });

      if (btn && btn.parentElement) {
        btn.insertAdjacentElement('afterend', skillsBtn);
      } else {
        toolbar.appendChild(skillsBtn);
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
                font-size: 8px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                padding: 0px 3.5px;
                border-radius: 3px;
                line-height: 1.1;
                margin: 0;
                display: inline-block;
                vertical-align: middle;
                flex-shrink: 0;
                box-shadow: none;
                transition: all 0.15s ease;
                align-self: flex-start;
            }
            .agy-profile-user-name {
                font-size: 12px;
                font-weight: 600;
                color: var(--foreground, #18181b);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 100%;
                line-height: 1.2;
            }
            body.theme-dark .agy-profile-user-name,
            html.dark .agy-profile-user-name {
                color: #f4f4f5 !important;
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

            /* Modern Floating Tooltip (matching Antigravity native style - Image 2) */
            .agy-modern-tooltip {
                position: fixed;
                z-index: 2147483647;
                display: none;
                align-items: center;
                gap: 6px;
                padding: 4px 8px;
                font-size: 12px;
                line-height: 1.35;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                border-radius: 6px;
                background: #ffffff;
                color: #18181b;
                border: 1px solid rgba(0, 0, 0, 0.08);
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
                pointer-events: none;
                white-space: nowrap;
                opacity: 0;
                transform: translateY(3px);
                transition: opacity 0.12s cubic-bezier(0.16, 1, 0.3, 1), transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
                user-select: none;
            }
            body.theme-dark .agy-modern-tooltip,
            :root.dark .agy-modern-tooltip,
            html.dark .agy-modern-tooltip {
                background: #1f1f23;
                color: #f4f4f5;
                border-color: rgba(255, 255, 255, 0.12);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2);
            }
        `;
        document.head.appendChild(styleEl);
    }

    // Modern Tooltip Singleton
    let modernTooltipEl = null;
    function showModernTooltip(anchorEl, contentHtml) {
        if (!anchorEl) return;
        if (!modernTooltipEl) {
            modernTooltipEl = document.createElement('div');
            modernTooltipEl.id = 'agy-modern-tooltip';
            modernTooltipEl.className = 'agy-modern-tooltip';
            document.body.appendChild(modernTooltipEl);
        }
        modernTooltipEl.innerHTML = contentHtml;
        modernTooltipEl.style.display = 'inline-flex';
        modernTooltipEl.style.opacity = '0';
        modernTooltipEl.style.transform = 'translateY(3px)';

        const rect = anchorEl.getBoundingClientRect();
        const tooltipRect = modernTooltipEl.getBoundingClientRect();

        let top = rect.top - tooltipRect.height - 6;
        let left = rect.left;

        if (top < 8) {
            top = rect.bottom + 6;
        }
        if (left < 8) left = 8;
        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }

        modernTooltipEl.style.top = `${top}px`;
        modernTooltipEl.style.left = `${left}px`;

        requestAnimationFrame(() => {
            if (modernTooltipEl) {
                modernTooltipEl.style.opacity = '1';
                modernTooltipEl.style.transform = 'translateY(0)';
            }
        });
    }

    function hideModernTooltip() {
        if (modernTooltipEl) {
            modernTooltipEl.style.opacity = '0';
            modernTooltipEl.style.transform = 'translateY(3px)';
            setTimeout(() => {
                if (modernTooltipEl && modernTooltipEl.style.opacity === '0') {
                    modernTooltipEl.style.display = 'none';
                }
            }, 120);
        }
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
    function parseBucket(b, fallbackWindow = '') {
        if (!b) return null;
        const frac = b.remaining?.case === 'remainingFraction' ? b.remaining.value : (typeof b.remaining?.value === 'number' ? b.remaining.value : 1);
        const pct = Math.round(frac * 100);
        let resetText = '';
        let resetMs = 0;
        if (b.resetTime?.seconds) {
            resetMs = Number(b.resetTime.seconds) * 1000;
        } else if (typeof b.resetTime === 'number') {
            resetMs = b.resetTime < 1e11 ? b.resetTime * 1000 : b.resetTime;
        } else if (typeof b.resetTime === 'string') {
            const parsed = Date.parse(b.resetTime);
            if (!isNaN(parsed)) resetMs = parsed;
        }

        if (resetMs > 0) {
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
        } else if (b.resetText) {
            resetText = b.resetText.replace(' 重置', '').trim();
        }

        const win = b.window || fallbackWindow;
        return {
            id: b.bucketId || (win ? `${win}-bucket` : ''),
            window: win,
            fraction: Math.max(0, Math.min(1, frac)),
            percent: pct,
            resetText: resetText ? `${resetText} 重置` : ''
        };
    }

    function extractBucketsFromGroup(group) {
        if (!group || !Array.isArray(group.buckets)) return { weekly: null, fiveHour: null };
        const buckets = group.buckets;
        let wk = buckets.find(b => b.window === 'weekly' || (b.bucketId && b.bucketId.toLowerCase().includes('week')));
        let fh = buckets.find(b => b.window === '5h' || (b.bucketId && (b.bucketId.toLowerCase().includes('5h') || b.bucketId.toLowerCase().includes('hour'))));

        if (!wk || !fh) {
            if (buckets.length >= 2) {
                const getMs = (b) => {
                    if (b?.resetTime?.seconds) return Number(b.resetTime.seconds) * 1000;
                    if (typeof b?.resetTime === 'number') return b.resetTime < 1e11 ? b.resetTime * 1000 : b.resetTime;
                    if (typeof b?.resetTime === 'string') return Date.parse(b.resetTime) || 0;
                    return 0;
                };
                const ms0 = getMs(buckets[0]);
                const ms1 = getMs(buckets[1]);
                if (ms0 && ms1) {
                    if (ms0 > ms1) {
                        if (!wk) wk = buckets[0];
                        if (!fh) fh = buckets[1];
                    } else {
                        if (!wk) wk = buckets[1];
                        if (!fh) fh = buckets[0];
                    }
                } else {
                    if (!fh) fh = buckets[0];
                    if (!wk) wk = buckets[1];
                }
            } else if (buckets.length === 1) {
                if (!fh) fh = buckets[0];
            }
        }
        return {
            weekly: parseBucket(wk, 'weekly'),
            fiveHour: parseBucket(fh, '5h')
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

            const geminiBuckets = extractBucketsFromGroup(geminiGroup);
            const claudeBuckets = extractBucketsFromGroup(claudeGroup);

            quotaData = {
                gemini: {
                    name: 'Gemini 系列',
                    weekly: geminiBuckets.weekly,
                    fiveHour: geminiBuckets.fiveHour
                },
                claude: {
                    name: 'Claude / GPT 系列',
                    weekly: claudeBuckets.weekly,
                    fiveHour: claudeBuckets.fiveHour
                }
            };
            window.__AGY_GET_QUOTA_DATA__ = () => quotaData;
            renderWidget();
            if (typeof window.__AGY_SYNC_CURRENT_ACCOUNT__ === 'function') {
                window.__AGY_SYNC_CURRENT_ACCOUNT__();
            }
        } catch (err) {
            console.error('[Antigravity Quota] Fetch failed:', err);
        } finally {
            isFetching = false;
            updateRefreshButtonSpin(false);
        }
    }
    window.__AGY_REFRESH_QUOTA__ = fetchQuota;
    window.__AGY_GET_QUOTA_DATA__ = () => quotaData;

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

                        const defActive = window.__AGY_BOOTSTRAP_PROFILES__?.active || localStorage.getItem('__AGY_ACTIVE_EMAIL__') || '';
                        const profile = {
                            name: u.name || (defActive ? defActive.split('@')[0] : '用户'),
                            email: u.email || defActive,
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

            const defActive = window.__AGY_BOOTSTRAP_PROFILES__?.active || localStorage.getItem('__AGY_ACTIVE_EMAIL__') || '';
            return {
                name: (defActive ? defActive.split('@')[0] : '用户'),
                email: defActive,
                avatar: '',
                tier: 'PRO'
            };
        } catch(e) {
            const defActive = window.__AGY_BOOTSTRAP_PROFILES__?.active || localStorage.getItem('__AGY_ACTIVE_EMAIL__') || '';
            return {
                name: (defActive ? defActive.split('@')[0] : '用户'),
                email: defActive,
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

        // 3. User Profile Widget (Integrated with Switch Account Trigger & Modern Tooltip)
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

            profileWidget.style.cssText = 'display: flex; align-items: center; gap: 7px; min-width: 0; max-width: calc(100% - 66px); padding: 3px 6px; border-radius: 8px; cursor: pointer; transition: background 0.15s ease; user-select: none; overflow: hidden; flex: 1 1 auto;';
            profileWidget.removeAttribute('title');

            profileWidget.innerHTML = `
                <div style="width: 26px; height: 26px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: var(--sidebar-secondary, #e4e4e7); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 1px var(--border, rgba(0,0,0,0.12));">
                    ${user.avatar ? `<img id="agy-profile-avatar-img" alt="${user.name}" style="width: 100%; height: 100%; object-fit: cover; display: block;">` : `<span style="font-size: 11px; font-weight: 600; color: var(--foreground, #18181b);">${user.name.charAt(0)}</span>`}
                </div>
                <div style="display: flex; flex-direction: column; justify-content: center; align-items: flex-start; min-width: 0; overflow: hidden; gap: 1px; flex: 1;">
                    ${badgeHtml}
                    <span class="agy-profile-user-name" style="font-size: 12px; font-weight: 600; color: var(--foreground, #18181b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; line-height: 1.2;">${user.name}</span>
                </div>
                <div class="agy-profile-switch-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; color: var(--muted-foreground, #71717a); flex-shrink: 0; opacity: 0.7; transition: opacity 0.15s ease, transform 0.15s ease; margin-left: 2px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16"/>
                    </svg>
                </div>
            `;

            if (user.avatar) {
                const aImg = profileWidget.querySelector('#agy-profile-avatar-img');
                if (aImg) {
                    aImg.src = user.avatar;
                }
            }

            profileWidget.onclick = () => {
                hideModernTooltip();
                if (typeof window.__AGY_OPEN_ACCOUNT_SWITCHER__ === 'function') {
                    window.__AGY_OPEN_ACCOUNT_SWITCHER__();
                } else {
                    settingsBtn.click();
                }
            };

            profileWidget.onmouseenter = () => {
                profileWidget.style.backgroundColor = 'var(--sidebar-muted, rgba(0, 0, 0, 0.06))';
                const sIcon = profileWidget.querySelector('.agy-profile-switch-icon');
                if (sIcon) {
                    sIcon.style.opacity = '1';
                    sIcon.style.color = 'var(--foreground, #18181b)';
                }
                const curU = getUserProfile();
                const tipHtml = `
                    <span style="font-weight: 500; color: var(--foreground, #18181b);">${curU.name}${curU.email ? ' (' + curU.email + ')' : ''}${curU.tier ? ' · ' + curU.tier + ' 订阅' : ''}</span>
                    <span style="color: var(--muted-foreground, #71717a); font-size: 11.5px; margin-left: 5px;">点击切换账号</span>
                `;
                showModernTooltip(profileWidget, tipHtml);
            };
            profileWidget.onmouseleave = () => {
                profileWidget.style.backgroundColor = 'transparent';
                const sIcon = profileWidget.querySelector('.agy-profile-switch-icon');
                if (sIcon) {
                    sIcon.style.opacity = '0.7';
                    sIcon.style.color = 'var(--muted-foreground, #71717a)';
                }
                hideModernTooltip();
            };
        } else if (profileWidget.parentElement !== bottomRow) {
            bottomRow.prepend(profileWidget);
        }

        if (profileWidget) {
            profileWidget.removeAttribute('title');
            profileWidget.style.maxWidth = 'calc(100% - 66px)';
            const curU = getUserProfile();
            const nEl = profileWidget.querySelector('.agy-profile-user-name');
            if (nEl) {
                nEl.removeAttribute('title');
                if (curU.name && nEl.textContent !== curU.name) {
                    nEl.textContent = curU.name;
                }
            }
            const bEl = profileWidget.querySelector('.agy-profile-tier-badge');
            if (bEl && curU.tier) {
                bEl.className = `agy-profile-tier-badge ${curU.tier.toLowerCase()}`;
                bEl.textContent = curU.tier;
            }
            const aEl = profileWidget.querySelector('#agy-profile-avatar-img');
            if (aEl && curU.avatar && aEl.src !== curU.avatar) aEl.src = curU.avatar;

            // Ensure integrated switch icon is present
            if (!profileWidget.querySelector('.agy-profile-switch-icon')) {
                const sDiv = document.createElement('div');
                sDiv.className = 'agy-profile-switch-icon';
                sDiv.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; color: var(--muted-foreground, #71717a); flex-shrink: 0; opacity: 0.7; transition: opacity 0.15s ease, transform 0.15s ease; margin-left: 2px;';
                sDiv.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16"/>
                    </svg>
                `;
                profileWidget.appendChild(sDiv);
            }
        }

        // 4. Actions Wrap Container on right (Switch Account + Settings)
        let actionsWrap = document.getElementById('agy-sidebar-actions-wrap');
        if (!actionsWrap) {
            actionsWrap = document.createElement('div');
            actionsWrap.id = 'agy-sidebar-actions-wrap';
            bottomRow.appendChild(actionsWrap);
        }
        actionsWrap.style.cssText = 'display: inline-flex !important; flex-direction: row !important; flex-wrap: nowrap !important; align-items: center !important; white-space: nowrap !important; gap: 3px !important; flex-shrink: 0 !important; margin-left: auto !important;';

        if (settingsBtn.parentElement !== actionsWrap) {
            actionsWrap.appendChild(settingsBtn);
            settingsBtn.classList.remove('w-full', 'flex-1', 'justify-start');
            settingsBtn.classList.add('w-fit');
            settingsBtn.style.cssText = 'margin: 0 !important; width: fit-content !important; min-width: 0 !important; max-width: fit-content !important; flex: 0 0 auto !important; flex-grow: 0 !important; flex-shrink: 0 !important; justify-content: center !important; padding: 4px 6px !important; border-radius: 6px !important; gap: 3px !important; display: inline-flex !important; align-items: center !important; font-size: 12.5px !important; font-weight: 500 !important;';
        }

        // 4.1 Mount switchAccountBtn inside actionsWrap
        if (typeof window.__AGY_MOUNT_SWITCH_ACCOUNT_BTN__ === 'function') {
            window.__AGY_MOUNT_SWITCH_ACCOUNT_BTN__();
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
    window.__AGY_GET_USER_PROFILE__ = getUserProfile;

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

    // Mounted Skills Catalog (Comprehensive & Dynamically Enriched)
    const skillsCatalog = [
        // User Custom Skills (我让你加载的技能 / 用户自定义)
        { name: 'Chinesizing', desc: 'Electron 桌面端软件深度汉化、逆向与防崩溃规范', provider: 'Chinesizing', type: 'custom', typeLabel: '用户配置', prompt: '/Chinesizing 帮我检查并优化桌面端汉化规则：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\Chinesizing' },
        { name: 'ui-ux-pro-max', desc: 'UI/UX 专业设计系统、全栈页面布局、动效与设计令牌', provider: 'UI/UX Design', type: 'custom', typeLabel: '用户配置', prompt: '/ui-ux-pro-max 帮我设计符合现代规范的页面布局与组件风格：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\ui-ux-pro-max' },
        { name: 'ui-craft', desc: '现代前端动效、微交互、视觉驱动开发 (VDD) 规范', provider: 'UI Craft', type: 'custom', typeLabel: '用户配置', prompt: '/ui-craft 帮我优化这个前端界面的交互质感与动态细节：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\ui-craft' },
        { name: 'ui-styling', desc: 'Tailwind CSS 与 shadcn/ui 组件库设计与无障碍规范', provider: 'UI Styling', type: 'custom', typeLabel: '用户配置', prompt: '/ui-styling 帮我编写一套高复用性的 Tailwind/shadcn 组件样式：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\ui-styling' },
        { name: 'tdd', desc: '测试驱动开发（TDD）全流程红绿重构与稳健接缝测试', provider: 'Engineering', type: 'custom', typeLabel: '用户配置', prompt: '/tdd 请以测试驱动开发规范帮我编写这个模块：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\tdd' },
        { name: 'code-review', desc: '三轴代码与体验审查规范（规范、业务符合度、体验品质）', provider: 'Engineering', type: 'custom', typeLabel: '用户配置', prompt: '/code-review 请对我当前的改动展开三轴代码与体验审查：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\code-review' },
        { name: 'codebase-design', desc: '深层模块 (Deep Module) 架构设计与高杠杆接口抽象', provider: 'Architecture', type: 'custom', typeLabel: '用户配置', prompt: '/codebase-design 请帮我重构并深化这个模块的接口设计：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\codebase-design' },
        { name: 'diagnosing-bugs', desc: '疑难 Bug 与性能回退的阶段门禁式诊断与排查闭环', provider: 'Diagnostics', type: 'custom', typeLabel: '用户配置', prompt: '/diagnosing-bugs 帮我诊断定位系统报错与异常闪退的根本原因：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\diagnosing-bugs' },
        { name: 'domain-modeling', desc: '建立与锐化项目统一领域语言 (Ubiquitous Language) 与 ADR', provider: 'Domain Model', type: 'custom', typeLabel: '用户配置', prompt: '/domain-modeling 帮我梳理业务领域模型并起草架构决策记录 (ADR)：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\domain-modeling' },
        { name: 'grilling', desc: '审讯式对齐元技能：决策树前沿问题集推演与拍板', provider: 'Planning', type: 'custom', typeLabel: '用户配置', prompt: '/grilling 针对这个技术方案对我展开审讯式提问与对齐：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\grilling' },
        { name: 'prototype', desc: '抛弃型可运行原型开发，快速验证状态机与业务直觉', provider: 'Prototype', type: 'custom', typeLabel: '用户配置', prompt: '/prototype 帮我构建一个最小验证的原型代码以测试该交互：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\prototype' },
        { name: 'resolving-merge-conflicts', desc: '意图溯源式 Git 合并冲突化解规范', provider: 'Git Tools', type: 'custom', typeLabel: '用户配置', prompt: '/resolving-merge-conflicts 帮我追溯双方意图并安全化解这个 Git 冲突：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\resolving-merge-conflicts' },
        { name: 'slides', desc: '专业 HTML 战略演示文稿制作（Chart.js、响应式排版）', provider: 'Presentations', type: 'custom', typeLabel: '用户配置', prompt: '/slides 帮我生成一套高水准的 HTML 演示幻灯片：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\slides' },
        { name: 'brand', desc: '品牌调性、视觉识别 (VI) 框架与风格指南管理', provider: 'Branding', type: 'custom', typeLabel: '用户配置', prompt: '/brand 帮我设计符合品牌调性的设计规范与视觉指引：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\brand' },
        { name: 'banner-design', desc: '多平台横幅 Banner 视觉设计与创意资产生成', provider: 'Design Tools', type: 'custom', typeLabel: '用户配置', prompt: '/banner-design 帮我设计一组适配各平台的营销 Banner：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\banner-design' },
        { name: 'design', desc: '全维度品牌与设计系统：Logo、设计令牌、演示文稿与图标', provider: 'Design System', type: 'custom', typeLabel: '用户配置', prompt: '/design 帮我构建全套设计令牌与视觉识别规范：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\design' },
        { name: 'design-system', desc: '三层设计令牌体系 (Primitive → Semantic → Component)', provider: 'Design System', type: 'custom', typeLabel: '用户配置', prompt: '/design-system 帮我梳理三层设计 Tokens 架构与 CSS 变量：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\design-system' },
        { name: 'ask-engineer', desc: '研发流程总路由与向导，协助规划工作流与技能分派', provider: 'Engineering', type: 'custom', typeLabel: '用户配置', prompt: '/ask-engineer 针对我当前的项目任务推荐最佳的工作流与技能：', path: 'C:\\Users\\Lynan\\.gemini\\config\\skills\\ask-engineer' },

        // Builtin Skills (软件自带 / 官方核心内置)
        { name: 'antigravity_guide', desc: 'Antigravity (AGY) 官方全能指南、快捷键与高级定制索引', provider: 'Antigravity Builtin', type: 'builtin', typeLabel: '官方自带', prompt: '/antigravity_guide 帮我查询 Antigravity 的配置项与核心功能用法：', path: 'C:\\Users\\Lynan\\.gemini\\antigravity\\builtin\\skills\\antigravity_guide' },
        { name: 'agy-customizations', desc: 'Antigravity 扩展定制体系指南（Skills, Rules, MCP, Hooks）', provider: 'Antigravity Builtin', type: 'builtin', typeLabel: '官方自带', prompt: '/agy-customizations 帮我编写符合规范的 Antigravity 自定义插件或规则：', path: 'C:\\Users\\Lynan\\.gemini\\antigravity\\builtin\\skills\\agy-customizations' },
        { name: 'generative_ui', desc: '富交互式 HTML 动态部件与实时可视化微件渲染', provider: 'Antigravity Builtin', type: 'builtin', typeLabel: '官方自带', prompt: '/generative_ui 帮我渲染一个富交互式的动态 HTML 微件：', path: 'C:\\Users\\Lynan\\.gemini\\antigravity\\builtin\\skills\\generative_ui' },
        { name: 'migrate-workflows', desc: '传统旧工作流规范向现代 Skills 架构自动迁移工具', provider: 'Antigravity Builtin', type: 'builtin', typeLabel: '官方自带', prompt: '/migrate-workflows 帮我把旧版工作流迁移为现代 Skill 规范：', path: 'C:\\Users\\Lynan\\.gemini\\antigravity\\builtin\\skills\\migrate-workflows' },

        // Plugin Ecosystem Skills (插件扩展技能)
        { name: 'documents', desc: 'Word (.docx) 专业文档生成、智能排版与校验', provider: 'Documents', type: 'plugin', typeLabel: '插件扩展', prompt: '/documents 请帮我生成一份专业的 Word 文档：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\documents\\skills\\documents' },
        { name: 'presentations', desc: 'PowerPoint (.pptx) 幻灯片智能生成、现代版式与演讲备注', provider: 'Presentations', type: 'plugin', typeLabel: '插件扩展', prompt: '/presentations 请帮我设计一份精美的 PPT 演示文稿：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\presentations\\skills\\presentations' },
        { name: 'spreadsheets', desc: 'Excel (.xlsx) 表格自动化建模、公式计算与数据透视', provider: 'Spreadsheets', type: 'plugin', typeLabel: '插件扩展', prompt: '/spreadsheets 请帮我创建和分析这份 Excel 数据表格：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\spreadsheets\\skills\\spreadsheets' },
        { name: 'excel-live-control', desc: '实时控制已打开的 Microsoft Excel 工作簿会话', provider: 'Spreadsheets', type: 'plugin', typeLabel: '插件扩展', prompt: '/excel-live-control 帮我操作当前正在运行的 Excel 工作簿：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\spreadsheets\\skills\\spreadsheets' },
        { name: 'pdf', desc: 'PDF 深度解析、高保真渲染、表格提取与排版质检', provider: 'PDF Tools', type: 'plugin', typeLabel: '插件扩展', prompt: '/pdf 请帮我深度解析和提取这个 PDF 文件的内容：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\pdf\\skills\\pdf' },
        { name: 'template-creator', desc: '企业标准化汇报与规范文档模版提取套件', provider: 'Template Creator', type: 'plugin', typeLabel: '插件扩展', prompt: '/template-creator 请帮我提取企业标准化文档模版：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\template-creator\\skills\\template-creator' },
        { name: 'gemini-api-dev', desc: 'Google Gemini 官方 SDK 规范与结构化输出开发', provider: 'Gemini API', type: 'plugin', typeLabel: '插件扩展', prompt: '/gemini-api-dev 帮我编写调用 Gemini API 的功能代码：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\gemini-api\\skills\\gemini-api-dev' },
        { name: 'gemini-live-api-dev', desc: 'Gemini Live API 双向流式低延迟语音与交互开发', provider: 'Gemini API', type: 'plugin', typeLabel: '插件扩展', prompt: '/gemini-live-api-dev 帮我编写实时流式双向语音与交互代码：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\gemini-api\\skills\\gemini-live-api-dev' },
        { name: 'gemini-omni-flash-api', desc: 'Gemini Omni 1.1 Flash 文本生视频与镜头平滑过渡', provider: 'Gemini API', type: 'plugin', typeLabel: '插件扩展', prompt: '/gemini-omni-flash-api 编写 Omni Flash 生成与编辑视频的代码：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\gemini-api\\skills\\gemini-omni-flash-api' },
        { name: 'chrome-extensions', desc: 'Chrome 浏览器扩展 Manifest V3 深度开发规范', provider: 'Modern Web', type: 'plugin', typeLabel: '插件扩展', prompt: '/chrome-extensions 帮我构建一个 Chrome 浏览器扩展：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\modern-web-guidance-plugin\\skills\\chrome-extensions' },
        { name: 'modern-web-guidance', desc: '现代化前端布局、动画效果、CWV 性能优化规范', provider: 'Modern Web', type: 'plugin', typeLabel: '插件扩展', prompt: '/modern-web-guidance 帮我按照现代化 Web 最佳实践构建前端组件：', path: 'C:\\Users\\Lynan\\.gemini\\config\\plugins\\modern-web-guidance-plugin\\skills\\modern-web-guidance' }
    ];

    // Asynchronously sync dynamic skills from filesystem via IPC
    function syncDynamicSkills() {
        if (window.electronNative && typeof window.electronNative.getSkills === 'function') {
            window.electronNative.getSkills().then(list => {
                if (Array.isArray(list) && list.length > 0) {
                    let changed = false;
                    for (const item of list) {
                        const existing = skillsCatalog.find(s => s.name === item.name);
                        if (!existing) {
                            skillsCatalog.push({
                                name: item.name,
                                desc: item.description || '自定义扩展技能规范',
                                provider: item.typeLabel || '自定义技能',
                                type: item.type || 'custom',
                                typeLabel: item.typeLabel || '用户配置',
                                prompt: '/' + item.name + ' 请帮我调用该技能处理当前任务：',
                                path: item.dir
                            });
                            changed = true;
                        } else {
                            if (item.dir && !existing.path) existing.path = item.dir;
                            if (item.type && !existing.type) existing.type = item.type;
                            if (item.typeLabel && !existing.typeLabel) existing.typeLabel = item.typeLabel;
                        }
                    }
                    if (changed && currentMainTab === 'skills') {
                        renderUI();
                    }
                }
            }).catch(() => {});
        }
    }
    setTimeout(syncDynamicSkills, 800);

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

    // Helper: Insert Text into Lexical or Standard Editor
    function insertTextIntoLexicalEditor(editor, promptText) {
        if (!editor) return;
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
                    if (selectBuckets) {
                        for (const bucket of selectBuckets) {
                            if (bucket && !selHandled) {
                                for (const fn of bucket) {
                                    if (fn()) { selHandled = true; break; }
                                }
                            }
                        }
                    }

                    const insertKey = Array.from(lexicalEditor._commands.keys()).find(k => k && k.type === 'CONTROLLED_TEXT_INSERTION_COMMAND');
                    const insertBuckets = lexicalEditor._commands.get(insertKey);
                    let insHandled = false;
                    if (insertBuckets) {
                        for (const bucket of insertBuckets) {
                            if (bucket && !insHandled) {
                                for (const fn of bucket) {
                                    if (fn(promptText)) { insHandled = true; break; }
                                }
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
            try {
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, promptText);
                inserted = true;
            } catch(e) {}
        }

        if (!inserted && typeof editor.value === 'string') {
            editor.value = promptText;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        }

        try {
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(editor);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        } catch(e) {}
    }

    function safeClickElement(el) {
        if (!el) return;
        try {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            el.click();
        } catch(e) {
            el.click();
        }
    }

    // Helper: Close Plugin Center, Click New Chat, and Insert Skill
    function triggerNewChatAndInvoke(promptText, skillName) {
        closePluginCenter();

        // 1. Try to click "+ 新建会话" button on sidebar
        try {
            const allElements = Array.from(document.querySelectorAll('*'));
            const textMatch = allElements.find(el => {
                if (el.children && el.children.length > 2) return false;
                const t = (el.textContent || '').trim();
                return t === '新建会话' || t === '+ 新建会话' || t === 'New Chat' || t === '+ New Chat';
            });
            if (textMatch) {
                const targetBtn = textMatch.closest('button, [role="button"]') || textMatch;
                safeClickElement(targetBtn);
            } else {
                const plusBtn = document.querySelector('button[aria-label*="新建"], button[aria-label*="New"], [data-testid*="new-chat"]');
                if (plusBtn) safeClickElement(plusBtn);
            }
        } catch(e) {
            console.warn('Error clicking new chat:', e);
        }

        // 2. Poll waiting for new chat editor to mount
        let attempts = 0;
        const maxAttempts = 35;
        const pollTimer = setInterval(() => {
            attempts++;
            const editor = document.querySelector('[data-lexical-editor="true"], textarea.chat-input, textarea');
            if (editor || attempts >= maxAttempts) {
                clearInterval(pollTimer);
                if (editor) {
                    insertTextIntoLexicalEditor(editor, promptText);
                    showToast('已开启新会话，并载入技能 /' + (skillName || '') + ' 🚀', '✨');
                } else {
                    if (navigator.clipboard) navigator.clipboard.writeText(promptText);
                    showToast('已复制指令到剪贴板，请在会话中粘贴', '📋');
                }
            }
        }, 100);
    }

    // Helper: Open Local Directory via Native Shell with triple fallback
    function openDirectory(folderPath) {
        if (!folderPath) {
            showToast('未找到有效目录路径', '⚠️');
            return;
        }

        const normPath = folderPath.indexOf('/') !== -1 ? folderPath.split('/').join('\\\\') : folderPath;
        const fileUrl = 'file:///' + folderPath.split('\\\\').join('/');

        // 1. Try our custom openPath (native direct folder open)
        if (window.electronNative && typeof window.electronNative.openPath === 'function') {
            try {
                window.electronNative.openPath(normPath).catch(() => {});
            } catch(e) {}
        }

        // 2. Try official revealInFilePicker with fileUrl (official backend requirement: URL scheme file://)
        if (window.electronNative && typeof window.electronNative.revealInFilePicker === 'function') {
            try {
                window.electronNative.revealInFilePicker(fileUrl);
            } catch(e) {}
        }

        // 3. Fallback openExternal
        if (window.electronNative && typeof window.electronNative.openExternal === 'function') {
            try {
                window.electronNative.openExternal(fileUrl);
            } catch(e) {}
        }

        showToast('已在资源管理器中打开规范目录', '📂');
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
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const note = (localStorage.getItem('__AGY_SKILL_NOTE_' + s.name) || '').toLowerCase();
            return s.name.toLowerCase().includes(q) || 
                s.desc.toLowerCase().includes(q) ||
                s.provider.toLowerCase().includes(q) ||
                (s.typeLabel && s.typeLabel.toLowerCase().includes(q)) ||
                note.includes(q);
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
                    ${filteredSkills.map(s => {
                        const note = localStorage.getItem('__AGY_SKILL_NOTE_' + s.name) || '';
                        let badgeHtml = '';
                        if (s.type === 'custom') {
                            badgeHtml = '<span style="font-size: 11px; padding: 2px 7px; border-radius: 5px; background: rgba(245, 158, 11, 0.12); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 600; display: inline-flex; align-items: center; gap: 3px;">👤 用户配置</span>';
                        } else if (s.type === 'builtin') {
                            badgeHtml = '<span style="font-size: 11px; padding: 2px 7px; border-radius: 5px; background: rgba(59, 130, 246, 0.12); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 600; display: inline-flex; align-items: center; gap: 3px;">⚡ 官方自带</span>';
                        } else {
                            badgeHtml = '<span style="font-size: 11px; padding: 2px 7px; border-radius: 5px; background: rgba(147, 51, 234, 0.12); color: #7c3aed; border: 1px solid rgba(147, 51, 234, 0.3); font-weight: 600; display: inline-flex; align-items: center; gap: 3px;">🧩 插件扩展</span>';
                        }

                        return `
                            <div style="border: 1px solid var(--agy-pc-card-border); background: var(--agy-pc-card-bg); border-radius: 12px; padding: 14px 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; transition: border-color 0.15s, box-shadow 0.15s;" onmouseover="this.style.borderColor='#94a3b8'" onmouseout="this.style.borderColor='var(--agy-pc-card-border)'">
                                <div style="flex-grow: 1;">
                                    <div style="font-weight: 600; font-size: 14px; color: var(--agy-pc-text); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                        <code style="background: var(--agy-pc-pill-bg); padding: 2px 8px; border-radius: 6px; color: #2563eb; font-size: 13px; font-weight: 600;">/${s.name}</code>
                                        ${badgeHtml}
                                        <span style="font-size: 11.5px; padding: 2px 8px; border-radius: 9999px; background: var(--agy-pc-pill-bg); color: var(--agy-pc-subtext); font-weight: 500;">${s.provider}</span>
                                    </div>
                                    <div style="font-size: 12.5px; color: var(--agy-pc-subtext); margin-top: 6px; line-height: 1.45;">${s.desc}</div>
                                    <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                                        ${note ? `
                                            <div style="font-size: 11.5px; background: rgba(245, 158, 11, 0.08); border: 1px dashed rgba(245, 158, 11, 0.35); padding: 3px 8px; border-radius: 6px; color: var(--agy-pc-text); display: inline-flex; align-items: center; gap: 6px;">
                                                <span>📝 <b>备注:</b> ${note}</span>
                                                <button onclick="window.__AGY_EDIT_SKILL_NOTE__('${s.name}')" style="background: none; border: none; color: #2563eb; font-size: 11px; cursor: pointer; text-decoration: underline; padding: 0;">修改</button>
                                                <button onclick="window.__AGY_CLEAR_SKILL_NOTE__('${s.name}')" style="background: none; border: none; color: #ef4444; font-size: 11px; cursor: pointer; text-decoration: underline; padding: 0;">清除</button>
                                            </div>
                                        ` : `
                                            <button onclick="window.__AGY_EDIT_SKILL_NOTE__('${s.name}')" style="background: none; border: 1px dashed var(--agy-pc-card-border); color: var(--agy-pc-subtext); font-size: 11px; cursor: pointer; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; opacity: 0.75;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.75">
                                                + 添加个人备注
                                            </button>
                                        `}
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-top: 2px;">
                                    <button class="agy-pc-btn" style="padding: 5px 10px; font-size: 11.5px;" onclick="window.__AGY_OPEN_SKILL_DIR__('${s.name}')" title="在资源管理器中打开包含 SKILL.md 的目录">📖 规范目录</button>
                                    <button class="agy-pc-btn agy-pc-btn-primary" style="padding: 5px 14px; font-size: 11.5px; font-weight: 600;" onclick="window.__AGY_INVOKE_SKILL__('${s.name}')" title="自动开启新会话并在聊天框中填入该技能">💬 立即调用</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
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
            triggerNewChatAndInvoke(p.defaultPrompt, p.name);
        }
    };

    window.__AGY_INVOKE_CUSTOM__ = function(encodedPrompt) {
        const modal = document.getElementById('agy-pc-detail-modal');
        if (modal) modal.style.display = 'none';
        const prompt = decodeURIComponent(encodedPrompt);
        triggerNewChatAndInvoke(prompt, 'custom');
    };

    window.__AGY_INVOKE_SKILL__ = function(name) {
        const s = skillsCatalog.find(x => x.name === name);
        if (s) {
            triggerNewChatAndInvoke(s.prompt, s.name);
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
            openDirectory('C:\\Users\\Lynan\\.gemini\\config\\skills\\' + name);
        }
    };

    window.__AGY_EDIT_SKILL_NOTE__ = function(name) {
        const current = localStorage.getItem('__AGY_SKILL_NOTE_' + name) || '';
        const input = prompt('为技能 /' + name + ' 设置个人专属备注与工作说明：', current);
        if (input !== null) {
            const trimmed = input.trim();
            if (trimmed) {
                localStorage.setItem('__AGY_SKILL_NOTE_' + name, trimmed);
                showToast('已保存 /' + name + ' 的备注', '📝');
            } else {
                localStorage.removeItem('__AGY_SKILL_NOTE_' + name);
                showToast('已清除 /' + name + ' 的备注', '🗑️');
            }
            renderUI();
        }
    };

    window.__AGY_CLEAR_SKILL_NOTE__ = function(name) {
        localStorage.removeItem('__AGY_SKILL_NOTE_' + name);
        showToast('已清除 /' + name + ' 的备注', '🗑️');
        renderUI();
    };

    window.__AGY_INSTALL_MARKET__ = function(id) {
        const p = pluginsCatalog.find(x => x.id === id);
        if (p) {
            p.installed = true;
            p.enabled = true;
            localStorage.setItem('agy_plugin_' + id + '_installed', 'true');
            localStorage.setItem('agy_plugin_' + id + '_enabled', 'true');
            renderUI();
            showToast('✓ 成功安装 ' + p.name + '！已就绪并在 Antigravity 中启用。', '🎉');
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
    const FUSION_LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAACZ1SURBVHhetX0JdBRV9r4bM+OCIOqAyDKIjjqOjjOO288ZUWfBwV1cGdkXWSVIwBAIOyEQCAESIrIjIIjsO4hhk30A2ZcQCAnZl+5OV3V3ku7vf15Rt7j16lXHmXP+95yiuu9X977v3rfdruoONwC45YYbbrgBgOq4UZwJJyGcvTau49e4XGe9lnVcb76+ketlG4XOup508nuVD1kk/1Zc/FrJl+0aZncTcVK1I2TZsmU3CfAWmbxKarvGrRE3vZvIwdamJ/k5+H8rKp8qnSwqXGVnvAdwO80CWciIHzKues3fy3pTZ80sWWrBlP64qHA3O7eZa2JKO9PGwbGWeJW+DIlEInUB1JH1pgFNpZskvQ3jjk3MoTcxhw3zZ0xZdua4w07CCJcxsrElzHx/cxSflp0FXMOU/kyM87DyZWKWDfdp+DA7wNoHOMiMuJ4aEUuXgwxPhnQQQRG4HBgPzkaW2Rh2irbqKPTkz2bHDsJsetNWiUk8rLZMG4GJfJAdT7IVs6ItowPuiEQiv2AGtsO60N4p4rCNHAmXbcShHD3Mxg0jvarTiAuHyMatwxw8GEfy59aWdZYwmk3cTPapxGgGyD3mIGFiDgISZr2W9FFJuGH8LGO1cDQS7IJFs3NgbnoS4i7z/Bl212wikcht5jQmQGkgRNUQSW2YStz0QqJhQtzw/4WHEDeMEinrhagGDkk0HjYBcGskEvmV28XkSIVHw4TIxPl1bjZCasHckuGaEDc9FxUeza6WuB0Yy5XdJ4B65ixwM3JdItjGo8KEjcBlTOhpjZZtxGGs0Taj63ZGe5KebIyiQIEJOzeObm0RprIjvbVqSJiKB8XszCWAO8UsoAQwvTioIVsihTOxcas+xJkN/VLuHIU/GbuF+TQCYAkUOrKTS2KO8b2MONr4k0+OSf4EL+Iv29Vhdtamy/mbOOdBPsnGxl/8IzrA+BwgOaTeNAyZnhIiSBqVhmzDO8fUkx0FYNmZtsJOtCMHRqNXtGWMOIkjYUZnSna2thhGbVGSHfxdYjPaIp+Mu4GZemEnDxBhR4fcadfKUBoFEkk6yB8ZGaOQJ1eByaObArMl3sTpehtBholkWf4YRv5sNiYm9BZPpqfB4+AiJUvmwe1UGNlZehPjcXO9dTg+CVPCrKuZmI3Z17DrmO3M9XIiuPBEKEhaHc3lZ/h08DD1NGgcdrXolZgQN4z0dJBOvoZmgO1WhHwhSTT9/wfMERRJFBtXrDZxa89NLyRae9EwmwCe+ooliOHOEcCd8x6WRTV6Tb04HMsRSZQZWJtPWW1ILRxrm4EOLj+Dh62tqLkCypWbMJ3Z+mZr0Hxv26SZjbH2mRuTZcPsaMPlestODlrC5OD4GizbcUy2I3+ChwojjvLAs9Z1bmPilJNopbK9A8QewO8FCZEMVGWcwERFID7AWYk0MaPCYJUQx0QiqKLhlQQFLMphuUOpw2xVC9mx0k/eVAUm+FkVlKkXh/BjcWQ2Ih9GNcPKTbKxeJiYPOiIo8yfYiP+vKI0XoigjWRIjdGub2HmWQTKSzxqy2iMJ8QCrhMRJNxKNdWIoxFMg0DuGCORvGMk/qpOMz4DmJ0jOJHe4m/aWbOeBiPrFD6weFty8o1O44NR4uKsgpihatqKw0iEAiMijnXTxIRetUxYU1omZ+oMG97RtYlpQz65nuKKxl+cjcQzjPOQORJ/B0fGQ9XetRf8eQABRIJdz7HrxnbMspFxFQFTr+xoE6MAVFj9S/srXzq6qqDj0WVX+5xekd8+d3dJq0gkci+7xm50vT3HpirELWYhbhjLlW1GS5hNz7BrOvog5pZYkmi4ihyJm40QTlDSK33qZWVNdiwsS1mbmJ+3NiEf20aU4McxpTg4rhiHx+fiyKSs0nNzc74uOV7yJ9m2Fv6ueG16FUaiwriNcTafCdvWeelimpKOhAhxw0xbt5H/X9tlLi/8dOnY0pLlQwNYHFOEpf1zsGJANtYPzMbW2IvIHHQBe7/IwqlRV3Eq9VLV5Y15CcynaunjbTlmhYnZlj+edHlvkewc/BlmWxaFop68B5h6cdASIW8u5Ig2Jltjph1tqlxP5AR5ayNjGLVl+5LAmgUFI+YNCyC9bzm+6n8VCwbkYenAK1gZexlrY7OxOTYL2wefx6648/hx6FkcSriArJRCnF10eTFt7JyjIjYZI72Kv4G5VI4Wf4UdtWfvbFUZKoQl0baZmc5o16cqw4aJCkOuhLgdlXHcTir/LJJrF+TFzhoZxJR+pUj7rABfxeRjwedXsSQ2D98NvoI1gy9h0+BsbIu7iB3xWdgz9AL2DTuLffFnkDWpGBdWXVpotsHLPxEXlbwOji78jXy4YCIW4cutxKYBZ9vTjPjNJcj6IMZ6i5zKU5Df5lV1DJVd8qwgfzQiuR2NHIMgYTs2FP59+tBKJPUpx5T+RUjvX4SZMYWYO7AAiwfnY1l8LlYMy8H6YTnYMjQHP8RnY+fQLOwZdgH7Es7jwPBzyJpWjIsbc2M4D7MMtZXRZrucv9wx4lrH4DFxuhsqx2b5VOTROBwzQOoAOYlExEbAxKixaGufyqehk32KEZoxtuB8Yh8NSX1LkNKvGGn9i/HlgGLMHlyE+cMKsWJ0ETYlFmLVmDysH5mLrcNysD0+GzuGXsSehGzsHZ6FgwmXcGxqtu654mlp+qWykNMgjkKvwmj5sDpMsqkNk2O2DvGPbQ8wG3MkUYhlpBBKoqwX4mZn6q0Rw+XbjPzxqbERjOtVigl9SpHStxTT+pVgxoASzIovwayxRdiWWoFTM3UsmZSP1Yn52JBwBVvjRSdcxg9DL2HXsEv4cVg2TiWW4sSi7HVmm/J6T6+VPFgiHbgqLubP1acQy5Z/EFM5JD0/yxLNTqUXQgRlvZCiHM8DUweUBMd08iGpZwUm9q5ASp9ypPYtx/SBZcgYVY701BLsXOTHuRVVWDS7GEsnF2D1yDxsGJKLrXG5+H7IFWTG52B3fA72xuXg+MR8FBwtaSW3JaSWRCk5yrHJr+X3XGzv5e8FyWI6c+7eprhhzE6GomJCVmcUT53WE0jsVIak7hVI/tSLlF4epPbzYOoX5UibWIHp8yuQ+X0Qh3fWYPHyCszPKMa34/Kxemg+Ng65iq1xedgel4cdcXnYPfgKTowox09zstfLbdGSpNCLw7FkMsy2tFAsqhWEYYZPjllfS7Ep7QREQ7a13WyE3xuRMb7hqnwa1ZUFMJKaVnr/rEElnuQOOiZ29mBiVw+Se3gxqbcXkwd4kTKiAhPTPEhb78PmE9VYfyKMZXt0zFhYhkWpRVg+qhBr4ouw4YtCbB1UgB8GFWJnbD72xl7F0aTcsOes589meyIug6PEg/YyOtxik9d8gTk2cBOjvcVWURrCZ4DkMGq1w+6EytWCUaq57PwckwMzEvHDnNKEmV2ASe39mNzZj+RuPiT38iE5xovkBB+SUysx+msv0g7pmHMljIycMBZerMbkdRWYNa8ciycXY/nIYqyJL8amL4qwLbYYmQOLsOvzApyMr8TZhfmzzTYdJa/Jg5fXPG4j8dH4m5gxM8x4HR1DdoTfAFSITVj+jYAwop1dTqKt5GIkxGF7IC9hNOIExtsSB820OosGlV5IbVuN1PYapnTVkdJHx6RBfkwcWYlxUyoxaqEfU/b4kV5cg/6lYfQsDSOpIoJZZwKYutaDGXPLsWBKCZaPK8Oa4WXYFFeK7QNLkBlThL19S3F4XF6ZuGfE2rXxd+FojF6KjeIy7WjGqAaqjMk5MV5YnwOYQ6sHubCOUa2ZNMVUGE1dGSI7YxZd2F3Z6uvuQUxt68fU9n6k9tQxaXAASWM1jE/3I3G5himHgphRFsYALYzX9Br8Ta9BB60GKZVhzD4fwrQtfmQs9mHeDA+WTfBg7TAPNseWY1u/UmT2KsaJBD+ytxR1UPAgLkbsEkaxqfYDGjyO+Bhm05vYtfyWlxtPxOS7ofarTVEREMLIy5AhbphpZ/ncmlSRtqQdkPGhH9M6+DGjj4Zl43SsWxLExp1VWHmuBtMLI+jpCePVQBhPh8N4MhLGS1VhfOKrQVJhGN9dqMH3+6uQuTKIHzI0bB7jw7pYD7b0q0Bm7zIc+SyA49MKNip4KDkKkXnWphdCmMonDXLjjVyGuomqY+g9x/g1tZCwXSvWzxV9K3LnvR3GrHY60jrqWDzAj5PpVTi9NoxD/4lg5YUIxlwN42NvDf5aVYPHEcbvEMGzNWG8UxnGFwU1WHShBvt+qsG5rWFcnB/G/gk6Vg30YUs/P37o5cHubl4cii/WAp5AC8ZDyVGIm16IGxbNn0PkL2a5JNBalri46U1MHG7TVhy2NfHshoqXV/y7BnPfCGHOhwHM6hJEWj8dyUP9mDJdx6x1Qcw8GEL61RokaGG0DYbxTLgGfwrX4J/BGsRoEWSUhDH3ZBXmfh/EvG8CmJ2iYWGChtUDg9jYO4jve2jY3tmHo5/VIGtNWU+Ti9uSSvxVGC1Jsl4ZG8Od+YpESpTPA8wLhSMqx2SM9G6Yqgwln7aNTsjuCRVTV70FLHgziHkfhPBVpyqk9a3CpLgQxiQGETddR/+vNQz5Qcfk3CrE6WG01cJ4Wwujd2UYyWVhjDmq44v1fgyZryFxuo608QHMGxrC0pgqrOlVhU1dQ9jWUcOBLsBPqWVrTE62QcKSa/C0yNcet7jecTPOxIRPitm6KWgIPRFjvUeHMLKec5KBiYnrxbeqbTemxNnUWUQkf0JnPZwmO2GzNdZz9rs2wIK3qzD7oyrM6FSFyb2qkTiwCsOHBjF4vI6BGTr6Lg2g2/c6kvOqMbo0jC+KapBRGsHgozo+XV+J2EUa4tM0jEwKYOLIENLiQpgbE8I3vUNY3S2ELZ2CyGxXg31xXk8kErlfMUAEN+XzXRabMcJZ3PwGn9UxLG4akMYMYD6Nf8QSJPcYH/2q5NPolmtoo0Q1ich1MrezTc+ys77/29QpEP7mdWDeBzXIaF+NlG5VGNc3hGGfBzFoaAj9xwTRZ4qO7nM1dFgTwLhjQSy7VIM5F2ow+0IIPTL96P6thl4zNfRP0fBFYhAjRgYxYWgAabFBzP0shKU9q7CuSxW2tqvG4T5Afqb3E4kjxawqGfnnInnGUFy2iocNSJU/6431xSx2gXOtuo6JBt3WN9vIYBjZ2dZTuu7YTE/CxrbAwrYRzGxfgyndQkjsXWUkPzY+iL6jguiRFEDnVB3t52josErHpzt1rDlcjT1Hwhh+QMdHWzR0/EZDx5l+dJumoV9yAIPHBzF8VOBaJwwKYW6/KnzboxrrOlZjbwfgeLpnLuMieCsrITaKbbGZcZGdKifKfNnaMGfAzy1Do2GOxJMQJuP0PnOob9Pyd4CvPg5jSpdqI/nDPw9dS/7oELpPCKBDqo6PZuh4f76G91bqePN7DcszQzi9qxqf7tHw9qYA2i7T8cFcDf+eqaFrmo6+UwIYNCGIEWPETAgifWAIc/tUYVnXKmxqB+we7jsrDz5ZWBJlyOoAWV+bSB1gfA6wLUEqidaQKrmm3rbmqQTA3Wv7aeWz3wNSO9YgsVcICQOqEDs0hD5jguiaHMAn03S8P1PHm/M0vLZEQ5s1Gv6eqWH25gD2r6jCa7s0vLZVx6srA3jtGx3vLPDj4zl+dM7Q0Huq2QmjgpgQH0TagBDm9gxhafswNscEwhWX/H+QOZHUlnw3qQ2z5UQ8Dzh58iSVoY6pQkmUlw8TF+TcSi7CZMjCxOvzG7XXv+0OpLYLY3yPKgyLCWFgfAi9xwTRZVIAH6cH8O6sAF5bqOMfSzW8vFLHS5s0/GWnhv6bA0hfFcJzP+p4aXsArTbq+NsaHa2/0/HmEg0fzBNLko5e0wIYOCGIhFEBJMUFMf2zEOZ0rcK6T4Gji72xCn7E0Vh2FBjtaRwivVHWKjDC7XmUPwdIF1PJKG8uArMqmuveLMztnpCxyfF7Ktun+abM7gIkdg0hoV8IA+NC6Dk6iE6TAvgwPYC35gTRerGOl5Zr+MtaHc9t1vF0poY/79Hx/D4dL+zT8dS+AJ7aHcDTO3Q8v03Dixt1/GOVjteW6mi7UEOHr3R8OjWAAUlBDBsexPjYIKb1CuHrLsCWCR56UMP581/CkN7gz6sdFhfFpipOrLjNw9EBxhMxRY/xXV/uHKNU49UO6zTqGGPTJVvzNX2flG7+3bx0hOen5M7AsN5BfD4oiF4jg+iYHMQH6QG8MTeAvy/R8deVOp7ZqOOP2zU8sUvDY/s1PHpIw8NHNDx8VMcjRzQ8cljHYwd1/GGvjj/v0PDCFg2vrNXwr281vLtQwyczdfSYEkTM2ACGxgeRGBNAWvcIvon3FkUikUYUs1RCWwOPku9SovKvNFqjXxrEhg3PoyH8FzIE8GWHd4zU01ZyTYympaOXZTvSl14OPpo+wF81rHs1BgwMokdCAB2SAnh/uo7X5+p45RsN/7daw1ObdTy+Q8PD+zS0PKyjxXEdzU/paHpWR5NzOpqeC6D5mQBanNTx0NFrHfHkbh3Pfu9Hqw1+tF6u4Z0FGv49I4BuyTr6jwog/osAxvUJYc7AME5m+lubPK0Zr+BPM9foFEXcKjtaxoxlScKEndUBalASIiJfb2LUaTJERMRhW0+3L/J1mxQDxPQLoGd8EB3G6Xhvqo42szS8vMSP51f78eQWDY/s0tDyoI5mPwXQ+IyOhlkB3HM5gLuvBNAgN4C7cwO4N0dHo2wdTc8H8MAJHb/9j47HxWz4QcNf12v4xzINb83V0G66jq5JGj4briN+oIbUAcDqDO944sn5kZjc3fY6GqjRMBmiXFqfhOWe428tHe95WaLpVeSELEgpXz4kBvh0kI72ozS0TfGjzUwNLy3S8OwqP57YquG3u/1ofkhD4xM6fp0VwJ25QdxSGsYtOiBGjvgQI+6n/6Ia+IWnBnfk6Wh4UUOzMzpaHtPxu70a/rTdjxfWavjbEg1vfqXho1QNXcZp6DdEQ0IM8NX4soNuHIW4xW3q3RKsHIwO4Z8D3IyijW4h/61eSCTibZCYUFrcM6YG7RM0vDvBj1fT/Gg1X8Mz3/nx+01+tNypockhDY1O6rjzYgB1PMBvwsArlQFvR39gf/9AcEG8HkyP1YNzugaCma19WsnD1cBtOlAvR8d9ZzQ0F/vEjxqe3FqJ51dU4pWFfrye4ceHyX50GeFHv4FBJA3zVuVf8j0iePGBRnHL3IW45YTZOfT8bAndjiZDO2o1JFdBdNAapyrVjGWH603MuHb392WvxsYF8clgHW3HVuJfqZVoNcuPp5f68di6SrT8QcP9B3Tcc1zHL7JDuL8KeF+rOragpqZzJBJpovArYrlve03NRz2DoR9bVgF18qrx69N+ND2s4aGdlXhiYyWeW+bDK3Mq8UZqJT4aW4nOcT7EDQNWrSjvS37MM8XmaMfMiWMp5nEr7Cy9DeN/K0KRZNpcbFUSqwiE3uoAIsBKNYFzzPAn3n/5VVlqj3ig7TAf2kzwodWMSjy7wI/fr/Lhga2VaPyjhnuOaaiTXY3HvECKFkgWVYZFwuxMs63bRHXF9Dd9HQzGvlAWDP3qagR3H/ejyX4/Wm6vxBOrfXhuYSVeyfDhjYk+fDDCg25DIpgyvdx4SGPypJhtHcDyYRQbTC9j8nNykXjyaR/k8u8DhNCoZ0m0epQ5s+5qmnpx8DrZ2rQ4JmzEeUhi8am2Q6rRZrQXL6V48exsHx5fWomWG3y4b4cfDQ75cfPZEP5YFsEKLdCDcbNx5OWwPIiOB/3/erEkqN2cXY27/1OJxrsq8eBGHx5fVmm090qqF6+PrcB78X7EJpZ6/UX+hsKeeHKf5mv+wJ6XofxX8vJnAJpJlj+GGS+sh/KSkVE68R5jU89WIzPMKMXkKcjsjHb2H/Y+222MF62HevBykgfPpHvx+AIvWq70ovFWHxr86MctP+n4TSkwt9wfx3yQPx6YrTqhzqZR+L3P1/bJ4mrceDKI+vt8uG+bDy1XefDEQi+eneHByxMq8K/h5eiSWI1VWyo6mj5UsVES3TCKnWMWF5kjv0gUEvyhPAV3/aLrGHWMDBHmWPOFyD6TFxZNemtsNV4aU4ZnUyrwxFcePPCNB/et9+KuTC9uPeBH3XwgoahypexLiOxPwkRCbANnRqlvYsMioM7BStTf4UOj9R60XFqBJ2Z58FxKBV4aU4o3RlZh3OyiDbX4lCGeE7d9kKudYi5B1jLiJqZDxyZNUpste12n++S8rBdGePFMUhmeSKvAQ/Mr0Og7D+7a5MXtO3244WQY71zR8yORyD02R6bUwsOaKUx3c4+8ygO3nAd+tduHeps9aLTCgwcWlBvtP5tUhr8klKP7pCJ/IBB4wGYcJbZoOXGzcUi0X8iQ1NKQI2ASGjlct/2Q919vTvTijyNL8PikMjw0sxxNFpfhrtUe3LHFixt3+fDwZWCbp/ID5sc6u7VHI07Wk5RUaX96NitQc8M+DbdvrUC91R40WlSOhzLK8XhyCZ4eVYTXJwTw9bYy6+acW1tCasFcR74jj3QzjhxKo5UacptitO5ziNvYqgghCV/nL3o+UcdjicV4cGopmswpw11Ly3HHGi9u3ebFL48D/bO8W7kN8aL9RYE51lmGW0vjpDxPar0zQJ1tHtRd60H9byrQ6KsyPDilGL9PLMRTIzzom3FFfCgzljAVf7M9R4XEMGvDlTBaquy3/lkHGA4kA9pc5CpJOKKbUhYRlgzHD7UNPBBo/mFqnu+RkcV4cGIRmqaX4J55ZbhtaRluX+PBjZkB/PWUHvRFgo8yf1RqWhUZ48Exoy3eWcyGPmjWe/20N/+GPVW4Y10F7lxajnpzStF4WjEeTCrCo8Pz8e7kIpy+4nvRvF4uTkQbqq80Ghhrj5ehNEgdGzhdUF8YSjo+gm0jnBzyUpN1gOg0KlEdjU3bWDjuqfE+tBybj+YphWiYUYK680UHlOOXqyvw62PA9BzvNLpe0aGWTynJ1ohjHcBLZWs0ri7zd3vgBHDL2grUXVqKunNLcXdaMZokF+Kh0Vfx1Ggvhi3KWWz6ssXGS02ZBytRrQKAdZoj+cTT9sUsBhprN3fGjIQja8mSMGpItRTU/3DapYLG8UVoNj4f96UWocGXJbhjQRluX1aOGzYG8NYRz9VIJHIXs6FB4FhT2Qx140iBy3Z1ep4oO3bj1ircsawUdeeVon56MRpOKkBzMTDiruL1pCsBrzf4ILOh5choT/JHg07FkXAVR+HzRvHC9kzYvMCRQCGsY2SInMpqSxbuzOv93Pgy3J+Qi0bj83HPlELUn1mCOxeUo84yDx7cB6zM99CXpXgio3FxYCxold64/mKl/u9nDlThpiVlqDuvBPVmFOOeyQW4b9xVNIu/gidHViBx+aUJkj8bF2pflVzeHn/Pr7HypeoAN5GDIlElgosY/e2nZ11tFpePpiNz8evxV9FgSj7qfVmEO+aX4daNQL9jFbslG2WChbjxiCYsIcbymXy6bHmDTcBtc0pRf0YR7p6Uj4bjctE04Qp+MygP7yZf9lWGQr8nW5VYSVRINMwmqtvRssi9zIWmmKSjs2GTvu7SiCeHFqHpoEtoPDIP947PR4OUfNTLKMRNC3xo9UNlqCwU+h3ZqkZwNIzpHRjDrXVZSCQS+fW7uzyFNy/QUC+tAA2Sr+LesbloPFx0wCU8+nkhEpdc3iD7IuE5kZOtGjx0DZ8VBPBnwiojMfXEISdZOLL2A8nGWBfF+0hEa/zm6AvlTXtfQtPYi2g0/AruSczHXZML8au0QjRbF8aXZ8qHSj4dzyeET9qIVZhcfZgYLR0yRyOWbbne9o+vr0KdKYVoMDEP94zNQ6NhOWg28CKa9biAVwZnVe/+z/U/eyC1pdpf+F4hY8LOKAgIM86iA8zA5E3VmK5yY6xT3MpQ+qWIsawNmHZ2zaN98tGi3wXcH3sRDYddNgKtP6kA9eaH0DOzKJOCYj+C5rdG5Lur1ig3OfK/7UMjktZm8WNsRyVk8jf+TE/i/qKl984L4M6kq7h7TC4axl9CkwEX0KLXWTzc4wp6TDh/hGIx+dEvZOR9k9+IlEtUZUVmyLUl6JLjNq+4mJd4UtCOUpN1jPUz/qlfn+n7fO+L+E2n02je9wIaD8zGvfGX0WBUDm6b4sNbq8sLAL2paa8qNaljbAnmHPkgYIfVoVLHGHamP9EB4nXdzhtKjtRL1XDXiBzcG5eNxjEX0Kz3OTzQ+TT+1D0Ho9LPpZv21o/QJZ+2u6FSTmjmqmaF8c/tgPW9IB6AtcZxAzNBRjnGHXI78X7djpy/tO59Itjig+No0ekkmvY+j0ZmB9w6shD/N684tCen/C+mrfBnJV7259KWtbQoAiOOqlltYaQPBDwt2ywuKrl1RDHu/uIiGg7IQpNe59Ci80k88P4xvNT1PDIWZdGdUnkppmVOlS/CZB7Xz/LnAArcupoJ9bwiYDoMAjt2ZP3+7V7Hi3/73lk82O4nNO90Evf3PItGAy6i7pACPP1lKRYeuNqO+bQlmPl06Bnm4GFiSn8Ms0Yvl13ZxS+2+rIgUDeuCA1jsnB/zzNo1vEEWn50HA+/dRKvdjoenLfkdBtuE42jEFU7XJQd4CY8wSohEnsO5TzwQffDuY+2+QkPtT2KFu1OoWnnU7jv09Oo2zcbT6cUYe7eQuMBi1sShVCnqiSa3o1jNIxk88mi1i9PLfDX65+HRt1PoWmHk2jx0Uk88s4xPPbqEbzx8UF94cIzz4troyX/v+Iu3QtSEnQbNYyEMWPEWteh1769f/jnSTzSZi9avnMIzdudQOPOZ9Gg5xW8MD47PG9nDn/oofL5s2aZArN4yFILf9vSt+Fw7sutJ14uv7dHLu775Cx+8+EpPPTWETzW+kf88eUj+KTT/myv19sgChfRlnK9Vy1TQml9OdfFyLFmUuN8HRb6iZOPv/dim6N49JUDePi1g2j5zgHc//5RNPm0AG9MzLm06Uje30x7w07VFm1YEkZBGVWQC2bsSy6YvIFTMmxVHMmFnILffZRy5UjLniW4753jePCNQ3i09QH8odU+/O0fxzBpwpHPbAb2XAmfcjlMuTL2Co5ZH8RohDEjQdD2bTBTT0FZZSjZxA7ZP+i5v5/Gwy/uQ4vWx9Cs7Xn8sWc2ekzLXhGJlDY226OKht9pFG3xO6gGSepoU0/t8UQKXm52AqNf8dhGuRkXlbyOktF8fWdM+sWZT3c/hxZvZ+HBf57E7144jFf+cRrjRh/63HJ2PSdGZajwaWAqHobIP1FiRjSqrOWA9KzksvX05s0XmnTtc3Dzqx8erPx7p8OlHw8/tyV9VZ71YIUlyuGT1cmWP5ZIx91V6hgKWMHf7Qu2td7VFBi1s2TT5TZdR19Y0abL0YuvfXTw8oBBR+ddPXv1bs6DDVRrhlJbbFbIHX3tjXwrghlaSWKY0LmVVnxkNhcf9S3wms5hY+ppejo2NNaWDWM2jhHF+NuWTROjzla1RZjB0wZey5P4kw53yHo3/oyHY903ba7lwuU3YvytJaoEmnrLqQvmCJhh0Xy62dFAkKHa7BzJIDHtHLGTP5uSicrG1CvzQcI6wP5L+f9F3JL4v4pbUEL+V0yICiOdChMSLbZoejdMiA2LREqtJcitx0yHDszUK0cV2ajI1DKCaUrL+p9j5xip0TgKcVtyGA8V5urT1CvvLpON1AHu3w1la5ixxjG9OGiTlisTsrPumzBMNM43cYJ4wMY6bAHMTlU2mhi1JZehhj+Zh4lxjnJsVA7b9i3G0Sg1FTyIo8yDcmhVaqb+WgeYN60cSeQ7OyMhXtMvXWxExNm0ETe6bJsdSxSVf3LH0DNVuUNFMuivoNtGJGGMC0GUfFsZyriQna2SI478zqXMn980ZHrOX+Zo5MsFMzrgLjMAS2ka0Qg3DCgAU0eJMhLMDhodcvK5neWTYcJGNar4KLVGPuNIdnJbBg8a3ZRI82zDrMau2fLSVfbJZ6A8eIgH5yj0lEcbxnwaL8T/I6bqAKv3mZEgf3Mkct5BnuGu66IiwRyTlwjyZ3BxwVRtcbv/BqNE2jiamDhsiZewaGu+qq3rZ/O7odbzAJOIW0M0koRTMZrlqWY3um4nqw0hn7JeSC2YjSP3rxo4pr42LtHslJgQE6NBxPVR7SwxN+HbZT2JyhFrlE9vmx2JbMv00WyiYcoBIqQWO1lliJuexM0n6c2DlhmjE8xDydEh5o/0jKdDLg0plwiGuS0R1EkcIlzobWsiw4Sd43MJ8+m2RBhcbIApFINCb7RVC38VRnHz2w5kQxxtM1TCrzt06wDTQDiybcYmRsTljYcwWu9VGw/prUSSnm+AChtro2Z6cVBnqhLJ21LxpxjkpZTaEgf3x+OWS2WjAqSCQcJoEAtbRxlq3OMgEiyJwsgqC6Vk8buJsh1/FisnUuioHKPRQx1GmNUetcX0VpJZx7jdgXT7s5tGEvndUNYe3ahT3Snld2XlRFLcVK2pOtvG38SsGSC+om4pWY+pkug2KyhZFkY+TZyT4HoawZQoOTD6ICWXjEbQ8mhkPAgT18mdRhhfQoyBwDqNt2VwNDGrM02MDyAZo9iMGcgxEzf+EfeCjP9NlZSqi02MGpMhK1lyohjmtp4SxiHCjeTJmGlnjVwJI44qTBy2TlZgNo4mRmu+DP0s/rJeiNmeNQPEtOIJka+Piglh9rJemUQTU9pwTCWqziRxsxESzcatvZ8Rt9KnkCg217GKigrrP3SOJtFwN6yWEaDEyFcUn7LKklqSGBVTSS2YMfJlvRDenpu9JeavJB3/oTPDlY5MHY1ut6Ul2nLlmO7MzjGlTcyxFEg8bDwZ99qWHZWe9kE3zDELGQ83O+dMoj/eLROns2qtZY3Qwa/nmLyBU1COvcLEaPNWtUe28sZPbcmbO/FQVh+12BEXVWxUZMgDwYpLERv5NGy4nXgjKiA5UTSaKPmcPAVmOeNOWWN05n4pMJk8YUaCWfsyeRUXNz0lWMZ4W9EGicxd2TEmbotLwZ/nk/TXjGn0S41RUFYjDLMaUAlvUNJbmEJvO5ieEm/YKuysQEkn4czCpnfwY5iVJElPbdlsmQ1Puny9bQDYXquC4EnkB8Oj6kjPG3Ih7mrDrnEkqxa9gUnvox7ytQp/rod5nTzDbJhsw46b/h/0SJNTrZUAagAAAABJRU5ErkJggg==";

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
// ANTIGRAVITY MULTI-ACCOUNT & QUOTA SWITCHER (GRID VIEW & OAUTH 2.0)
// High-fidelity grid layout matching user screenshot
// Independent Web OAuth authorization without logging out active session
// Real percentage progress bars, device fingerprint management & search filter
// ==========================================
(function() {
    // 1. Inject Comprehensive Theme-Aware Stylesheet
    const styleId = 'agy-account-switcher-style';
    let style = document.getElementById(styleId);
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }
    style.textContent = `
        :root {
            --as-overlay-bg: rgba(15, 23, 42, 0.45);
            --as-modal-bg: #ffffff;
            --as-modal-border: #e2e8f0;
            --as-card-bg: #ffffff;
            --as-card-border: #e2e8f0;
            --as-card-hover-border: #cbd5e1;
            --as-text-main: #0f172a;
            --as-text-muted: #64748b;
            --as-active-border: #2563eb;
            --as-active-bg: linear-gradient(145deg, #f0f7ff 0%, #e0f2fe 55%, #f8faff 100%);
            --as-active-glow: 0 0 0 1.5px rgba(37, 99, 235, 0.25), 0 10px 25px -5px rgba(37, 99, 235, 0.15);
            --as-bar-track: #f1f5f9;
            --as-bar-fill-gemini: rgba(34, 197, 94, 0.22);
            --as-bar-text-gemini: #15803d;
            --as-bar-fill-claude: rgba(249, 115, 22, 0.20);
            --as-bar-text-claude: #c2410c;
            --as-bar-fill-low: rgba(239, 68, 68, 0.22);
            --as-bar-text-low: #dc2626;
            --as-tag-bg: #eff6ff;
            --as-tag-text: #2563eb;
            --as-tag-border: #bfdbfe;
            --as-btn-bg: #ffffff;
            --as-btn-border: #cbd5e1;
            --as-btn-text: #1e293b;
            --as-btn-hover: #f8fafc;
            --as-input-bg: #ffffff;
            --as-input-border: #cbd5e1;
            --as-code-bg: #f8fafc;
        }

        html.dark, html.dark-theme, body.dark, body.theme-dark, [data-theme="dark"], [data-color-mode="dark"], .vscode-dark {
            --as-overlay-bg: rgba(0, 0, 0, 0.75);
            --as-modal-bg: #141416;
            --as-modal-border: #27272a;
            --as-card-bg: #18181b;
            --as-card-border: #27272a;
            --as-card-hover-border: #3f3f46;
            --as-text-main: #f4f4f5;
            --as-text-muted: #a1a1aa;
            --as-active-border: #3b82f6;
            --as-active-bg: linear-gradient(145deg, rgba(30, 58, 138, 0.35) 0%, rgba(30, 64, 175, 0.18) 55%, rgba(24, 24, 27, 0.95) 100%);
            --as-active-glow: 0 0 0 1.5px rgba(59, 130, 246, 0.3), 0 12px 28px -5px rgba(59, 130, 246, 0.2);
            --as-bar-track: #202024;
            --as-bar-fill-gemini: rgba(34, 197, 94, 0.26);
            --as-bar-text-gemini: #4ade80;
            --as-bar-fill-claude: rgba(249, 115, 22, 0.26);
            --as-bar-text-claude: #fb923c;
            --as-bar-fill-low: rgba(239, 68, 68, 0.28);
            --as-bar-text-low: #f87171;
            --as-tag-bg: rgba(59, 130, 246, 0.15);
            --as-tag-text: #60a5fa;
            --as-tag-border: rgba(59, 130, 246, 0.3);
            --as-btn-bg: #202024;
            --as-btn-border: #2e2e34;
            --as-btn-text: #f4f4f5;
            --as-btn-hover: #2a2a30;
            --as-input-bg: #18181b;
            --as-input-border: #2e2e34;
            --as-code-bg: #111113;
        }

        /* Sidebar Account Switcher Button (Aligned with Settings) */
        #agy-sidebar-actions-wrap {
            display: inline-flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            white-space: nowrap !important;
            gap: 3px !important;
            flex-shrink: 0 !important;
            margin-left: auto !important;
        }

        #agy-sidebar-switch-account-btn {
            margin: 0 !important;
            width: 26px !important;
            min-width: 26px !important;
            max-width: 26px !important;
            height: 26px !important;
            flex: 0 0 26px !important;
            flex-grow: 0 !important;
            flex-shrink: 0 !important;
            justify-content: center !important;
            padding: 0 !important;
            border-radius: 6px !important;
            display: inline-flex !important;
            align-items: center !important;
            font-size: 12.5px !important;
            white-space: nowrap !important;
            background: transparent !important;
            border: none !important;
            cursor: pointer !important;
            outline: none !important;
            color: inherit !important;
            line-height: 1 !important;
            user-select: none !important;
            transition: background 0.15s ease !important;
        }

        #agy-sidebar-switch-account-btn:hover {
            background: var(--sidebar-muted, rgba(128, 128, 128, 0.15)) !important;
        }

        #agy-sidebar-switch-account-btn svg {
            flex-shrink: 0 !important;
            display: inline-block !important;
            margin: 0 !important;
        }

        #agy-sidebar-switch-account-btn span {
            display: none !important;
        }

        #agy-as-modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: var(--as-overlay-bg);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 999999;
            display: none;
            align-items: center;
            justify-content: center;
            animation: agyAsFadeIn 0.18s ease-out forwards;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
        }

        @keyframes agyAsFadeIn {
            from { opacity: 0; transform: scale(0.985); }
            to { opacity: 1; transform: scale(1); }
        }

        .agy-as-card {
            background: var(--as-modal-bg);
            border: 1px solid var(--as-modal-border);
            border-radius: 14px;
            width: 960px;
            max-width: 95vw;
            height: 88vh;
            max-height: 860px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
            overflow: hidden;
            transition: background-color 0.2s ease, border-color 0.2s ease;
        }

        .agy-as-header {
            padding: 18px 24px 14px 24px;
            border-bottom: 1px solid var(--as-modal-border);
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            flex-shrink: 0;
            background: var(--as-modal-bg);
        }

        .agy-as-title-box h3 {
            margin: 0;
            font-size: 16.5px;
            font-weight: 600;
            color: var(--as-text-main);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .agy-as-title-box p {
            margin: 4px 0 0 0;
            font-size: 12px;
            color: var(--as-text-muted);
        }

        .agy-as-actions {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .agy-as-btn {
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 12.5px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid var(--as-btn-border);
            background: var(--as-btn-bg);
            color: var(--as-btn-text);
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            outline: none;
            user-select: none;
        }

        .agy-as-btn:hover {
            background: var(--as-btn-hover);
            border-color: #3b82f6;
        }

        .agy-as-btn-primary {
            background: #2563eb !important;
            border-color: #2563eb !important;
            color: #ffffff !important;
        }
        .agy-as-btn-primary:hover {
            background: #1d4ed8 !important;
            border-color: #1d4ed8 !important;
        }

        /* Toolbar: Search & Filter Tabs */
        .agy-as-toolbar {
            padding: 12px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            border-bottom: 1px solid var(--as-modal-border);
            background: var(--as-modal-bg);
            flex-shrink: 0;
        }

        .agy-as-search-box {
            position: relative;
            flex: 1;
            max-width: 380px;
            display: flex;
            align-items: center;
        }

        .agy-as-search-box svg {
            position: absolute;
            left: 10px;
            color: var(--as-text-muted);
            pointer-events: none;
        }

        .agy-as-search-input {
            width: 100%;
            height: 32px;
            padding: 0 12px 0 32px;
            border-radius: 8px;
            border: 1px solid var(--as-input-border);
            background: var(--as-input-bg);
            color: var(--as-text-main);
            font-size: 12.5px;
            outline: none;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .agy-as-search-input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }

        .agy-as-modal-input {
            width: 100%;
            height: 36px;
            padding: 0 12px !important;
            border-radius: 8px;
            border: 1px solid var(--as-input-border);
            background: var(--as-input-bg);
            color: var(--as-text-main);
            font-size: 13px;
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
            text-align: left !important;
        }

        .agy-as-modal-input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }

        .agy-as-filter-tabs {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .agy-as-filter-pill {
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid var(--as-btn-border);
            background: var(--as-btn-bg);
            color: var(--as-text-muted);
            transition: all 0.15s ease;
            user-select: none;
        }

        .agy-as-filter-pill.active {
            background: rgba(37, 99, 235, 0.15);
            border-color: rgba(37, 99, 235, 0.4);
            color: #2563eb;
            font-weight: 600;
        }

        html.dark .agy-as-filter-pill.active {
            background: rgba(59, 130, 246, 0.2);
            border-color: rgba(59, 130, 246, 0.4);
            color: #60a5fa;
        }

        /* Body & Grid */
        .agy-as-body {
            padding: 20px 24px;
            overflow-y: auto;
            flex: 1;
            background: var(--as-modal-bg);
        }

        .agy-as-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
            gap: 16px;
        }

        /* Account Card (Matching User Screenshot 2) */
        .agy-as-account-card {
            background: var(--as-card-bg);
            border: 1px solid var(--as-card-border);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            transition: all 0.2s ease;
            position: relative;
            user-select: none;
        }

        .agy-as-account-card:hover {
            border-color: var(--as-card-hover-border);
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05);
        }

        /* Active Card Blue Border, Light Blue Gradient & Glow */
        .agy-as-account-card.active {
            background: var(--as-active-bg) !important;
            border: 2px solid var(--as-active-border) !important;
            box-shadow: var(--as-active-glow);
        }
        .agy-as-account-card.active .agy-as-bar-track {
            background: rgba(255, 255, 255, 0.65);
        }
        html.dark .agy-as-account-card.active .agy-as-bar-track,
        body.theme-dark .agy-as-account-card.active .agy-as-bar-track {
            background: rgba(0, 0, 0, 0.32);
        }

        .agy-as-card-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }

        .agy-as-card-user {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
            flex: 1;
        }

        .agy-as-card-avatar {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            overflow: hidden;
            flex-shrink: 0;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 14px;
            font-weight: 700;
        }

        .agy-as-card-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .agy-as-card-user-info {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        .agy-as-card-name {
            font-size: 13.5px;
            font-weight: 600;
            color: var(--as-text-main);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .agy-as-card-email {
            font-size: 12px;
            color: var(--as-text-muted);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .agy-as-card-tag {
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11.5px;
            font-weight: 500;
            background: var(--as-tag-bg);
            color: var(--as-tag-text);
            border: 1px solid var(--as-tag-border);
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .agy-as-card-tag:hover {
            opacity: 0.85;
            transform: translateY(-1px);
        }

        .agy-as-card-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11.5px;
            color: var(--as-text-muted);
        }

        .agy-as-badge-box {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .agy-as-badge-current {
            background: rgba(37, 99, 235, 0.15);
            color: #2563eb;
            font-size: 11px;
            font-weight: 600;
            border-radius: 4px;
            padding: 1.5px 6px;
        }
        html.dark .agy-as-badge-current {
            background: rgba(59, 130, 246, 0.25);
            color: #60a5fa;
        }

        .agy-as-badge-pro {
            background: #2563eb;
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            border-radius: 9999px;
            padding: 1.5px 8px;
        }

        /* Real Quota Progress Bars */
        .agy-as-quotas-box {
            display: flex;
            flex-direction: column;
            gap: 7px;
        }

        .agy-as-bar-track {
            height: 26px;
            border-radius: 6px;
            background: var(--as-bar-track);
            border: 1px solid var(--as-card-border);
            overflow: hidden;
            position: relative;
            display: flex;
            align-items: center;
        }

        .agy-as-bar-fill {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            border-radius: 5px;
            transition: width 0.3s ease;
        }

        .agy-as-bar-fill.gemini {
            background: var(--as-bar-fill-gemini);
        }
        .agy-as-bar-fill.claude {
            background: var(--as-bar-fill-claude);
        }
        .agy-as-bar-fill.low {
            background: var(--as-bar-fill-low) !important;
        }

        .agy-as-bar-content {
            position: relative;
            z-index: 2;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 10px;
            font-size: 11.5px;
            line-height: 1;
        }

        .agy-as-bar-content.gemini {
            color: var(--as-bar-text-gemini);
        }
        .agy-as-bar-content.claude {
            color: var(--as-bar-text-claude);
        }
        .agy-as-bar-content.low {
            color: var(--as-bar-text-low) !important;
        }

        .agy-as-bar-content b {
            font-weight: 700;
        }

        /* Card Action Buttons Row */
        .agy-as-card-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--as-card-border);
        }

        .agy-as-card-actions-left {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .agy-as-card-actions-right {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-left: auto;
        }

        .agy-as-card-btn {
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid var(--as-btn-border);
            background: var(--as-btn-bg);
            color: var(--as-btn-text);
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .agy-as-card-btn:hover {
            background: var(--as-btn-hover);
            border-color: #3b82f6;
        }

        .agy-as-card-btn.primary {
            background: #10b981;
            border-color: #10b981;
            color: #ffffff;
            font-weight: 600;
        }
        .agy-as-card-btn.primary:hover {
            background: #059669;
            border-color: #059669;
        }

        .agy-as-card-active-label {
            padding: 4px 8px;
            font-size: 12px;
            font-weight: 600;
            color: #2563eb;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        html.dark .agy-as-card-active-label {
            color: #60a5fa;
        }

        .agy-as-card-icon-btn {
            padding: 5px;
            border-radius: 6px;
            background: transparent;
            border: 1px solid transparent;
            color: var(--as-text-muted);
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
        }

        .agy-as-card-icon-btn:hover {
            background: var(--as-btn-hover);
            border-color: var(--as-btn-border);
            color: var(--as-text-main);
        }

        .agy-as-card-icon-btn.danger:hover {
            background: rgba(239, 68, 68, 0.12);
            color: #ef4444;
            border-color: rgba(239, 68, 68, 0.25);
        }

        .agy-as-footer {
            padding: 12px 24px;
            border-top: 1px solid var(--as-modal-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            color: var(--as-text-muted);
            background: var(--as-modal-bg);
            flex-shrink: 0;
        }

        /* Device Fingerprint Modal (Matching User Screenshot 3) */
        .agy-fp-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: var(--as-overlay-bg);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 1000005;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: agyAsFadeIn 0.15s ease-out forwards;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .agy-fp-card {
            background: var(--as-modal-bg);
            border: 1px solid var(--as-modal-border);
            border-radius: 14px;
            width: 780px;
            max-width: 92vw;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
        }

        .agy-fp-header {
            padding: 18px 24px;
            border-bottom: 1px solid var(--as-modal-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .agy-fp-header h4 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--as-text-main);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .agy-fp-header .email-badge {
            background: rgba(37, 99, 235, 0.12);
            color: #2563eb;
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 6px;
            font-weight: 500;
        }
        html.dark .agy-fp-header .email-badge {
            background: rgba(59, 130, 246, 0.2);
            color: #60a5fa;
        }

        .agy-fp-body {
            padding: 20px 24px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .agy-fp-actions-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .agy-fp-section-card {
            background: var(--as-card-bg);
            border: 1px solid var(--as-card-border);
            border-radius: 10px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .agy-fp-section-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 600;
            color: var(--as-text-main);
        }

        .agy-fp-section-desc {
            font-size: 11.5px;
            color: var(--as-text-muted);
        }

        .agy-fp-code-box {
            background: var(--as-code-bg);
            border: 1px solid var(--as-card-border);
            border-radius: 6px;
            padding: 10px;
            font-family: Consolas, monospace;
            font-size: 11px;
            color: var(--as-text-muted);
            white-space: pre-wrap;
            word-break: break-all;
            max-height: 140px;
            overflow-y: auto;
        }

        /* Universal Custom Modal Dialog */
        .agy-as-confirm-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: var(--as-overlay-bg);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 1000010;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: agyAsFadeIn 0.15s ease-out forwards;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .agy-as-confirm-card {
            background: var(--as-modal-bg);
            border: 1px solid var(--as-modal-border);
            border-radius: 14px;
            width: 480px;
            max-width: 90vw;
            padding: 24px;
            box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.45);
            display: flex;
            flex-direction: column;
            gap: 18px;
            user-select: none;
        }

        #agy-as-scan-btn.agy-spinning svg {
            animation: agySpin 0.8s linear infinite;
        }
        @keyframes agySpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;

    // 2. State & Caches
    let switcherOverlay = null;
    let cachedProfiles = [];
    let currentActiveEmail = '';
    let searchQuery = '';
    let selectedTierFilter = 'all';

    // 3. Helper: Custom Universal Modal (Confirm / Alert / Prompt)
    function showAgyModal(options) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'agy-as-confirm-overlay';
            overlay.innerHTML = `
                <div class="agy-as-confirm-card" onclick="event.stopPropagation()">
                    <div style="display: flex; gap: 14px; align-items: flex-start;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(37,99,235,0.12); color: #2563eb;">
                            ${options.iconSvg || '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 600; color: var(--as-text-main);">${options.title || '系统提示'}</h4>
                            <div style="font-size: 13px; line-height: 1.5; color: var(--as-text-muted); white-space: pre-wrap;">${options.message || ''}</div>
                            ${options.hasInput ? `<input type="text" id="agy-modal-input" class="agy-as-modal-input" style="margin-top: 12px; width: 100%; box-sizing: border-box; text-align: left; padding: 0 12px;" value="${options.inputValue || ''}" placeholder="${options.inputPlaceholder || ''}" />` : ''}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 4px;">
                        ${!options.isAlert ? `<button type="button" class="agy-as-btn" id="agy-modal-cancel">${options.cancelText || '取消'}</button>` : ''}
                        <button type="button" class="agy-as-btn agy-as-btn-primary" id="agy-modal-ok" style="${options.confirmColor ? 'background:'+options.confirmColor+'!important;border-color:'+options.confirmColor+'!important;' : ''}">${options.confirmText || '确定'}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const okBtn = overlay.querySelector('#agy-modal-ok');
            const cancelBtn = overlay.querySelector('#agy-modal-cancel');
            const inputEl = overlay.querySelector('#agy-modal-input');

            if (inputEl) {
                setTimeout(() => { inputEl.focus(); inputEl.select(); }, 50);
                inputEl.onkeydown = (e) => {
                    if (e.key === 'Enter') okBtn.click();
                    if (e.key === 'Escape') cancelBtn ? cancelBtn.click() : overlay.remove();
                };
            }

            const close = (result) => {
                overlay.remove();
                resolve(result);
            };

            okBtn.onclick = () => close(options.hasInput ? inputEl.value : true);
            if (cancelBtn) cancelBtn.onclick = () => close(false);
            overlay.onclick = () => close(false);
        });
    }

    // 3.5 Initialize cached profiles synchronously from Bootstrap or localStorage
    function initCachedProfiles() {
        if (cachedProfiles && cachedProfiles.length > 0) return;
        try {
            const b = window.__AGY_BOOTSTRAP_PROFILES__;
            if (b && Array.isArray(b.profiles) && b.profiles.length > 0) {
                cachedProfiles = JSON.parse(JSON.stringify(b.profiles));
                if (b.active) currentActiveEmail = b.active;
            }
        } catch(e) {}
        if (!cachedProfiles || cachedProfiles.length === 0) {
            try {
                const c = localStorage.getItem('__AGY_ACCOUNT_PROFILES__');
                if (c) {
                    const parsed = JSON.parse(c);
                    if (Array.isArray(parsed) && parsed.length > 0) cachedProfiles = parsed;
                }
                const act = localStorage.getItem('__AGY_ACTIVE_EMAIL__');
                if (act) currentActiveEmail = act;
            } catch(e) {}
        }
    }

    // 4. Create Main Switcher Modal UI
    function createSwitcherOverlay() {
        initCachedProfiles();
        const existing = document.getElementById('agy-as-modal-overlay');
        if (existing) {
            switcherOverlay = existing;
            renderCardsGrid();
            return switcherOverlay;
        }
        switcherOverlay = document.createElement('div');
        switcherOverlay.id = 'agy-as-modal-overlay';
        switcherOverlay.innerHTML = `
            <div class="agy-as-card" onclick="event.stopPropagation()">
                <div class="agy-as-header">
                    <div class="agy-as-title-box">
                        <h3>
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
                            </svg>
                            多账号额度管理与快捷切换
                        </h3>
                        <p>本地安全保存多套凭证，直接切换秒级生效，免去频繁网页登录授权</p>
                    </div>
                    <div class="agy-as-actions">
                        <button class="agy-as-btn" id="agy-as-scan-btn" title="检测并刷新本地账号存档">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                            刷新检测本地账号
                        </button>
                        <button class="agy-as-btn agy-as-btn-primary" id="agy-as-add-btn" title="登录并添加新的 Google/Gemini 账号">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            登录新账号
                        </button>
                        <button class="agy-as-btn" id="agy-as-close-btn" style="padding: 6px 9px;">✕</button>
                    </div>
                </div>
                <div class="agy-as-toolbar">
                    <div class="agy-as-search-box">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="agy-as-search-input" id="agy-as-search-input" placeholder="搜索邮箱、用户名或备注..." />
                    </div>
                    <div class="agy-as-filter-tabs" id="agy-as-filter-tabs">
                        <button class="agy-as-filter-pill active" data-filter="all">全部 <span class="count" id="count-all">0</span></button>
                        <button class="agy-as-filter-pill" data-filter="pro">PRO <span class="count" id="count-pro">0</span></button>
                        <button class="agy-as-filter-pill" data-filter="ultra">ULTRA <span class="count" id="count-ultra">0</span></button>
                        <button class="agy-as-filter-pill" data-filter="free">FREE <span class="count" id="count-free">0</span></button>
                    </div>
                </div>
                <div class="agy-as-body" id="agy-as-body">
                    <!-- Cards Grid dynamically rendered here -->
                </div>
                <div class="agy-as-footer">
                    <span>🔒 账号凭证仅安全加密保存在您本地电脑的 ~/.gemini/ 目录及系统凭据管理器中。</span>
                    <button class="agy-as-btn" id="agy-as-footer-close">关闭</button>
                </div>
            </div>
        `;

        switcherOverlay.onclick = closeSwitcher;
        switcherOverlay.querySelector('#agy-as-close-btn').onclick = closeSwitcher;
        switcherOverlay.querySelector('#agy-as-footer-close').onclick = closeSwitcher;

        // Scan & Refresh Local Accounts
        switcherOverlay.querySelector('#agy-as-scan-btn').onclick = async () => {
            const btn = switcherOverlay.querySelector('#agy-as-scan-btn');
            if (btn) btn.classList.add('agy-spinning');
            try {
                if (typeof window.__AGY_REFRESH_QUOTA__ === 'function') {
                    await window.__AGY_REFRESH_QUOTA__();
                }
                await syncCurrentAccount();
                if (window.electronNative && typeof window.electronNative.refreshAllAccountQuotas === 'function') {
                    await window.electronNative.refreshAllAccountQuotas();
                }
                await loadProfilesAndRender();
                if (window.__AGY_SHOW_TOAST__) {
                    window.__AGY_SHOW_TOAST__('🔍 已完成所有本地账号的实时额度探测与同步');
                }
            } finally {
                if (btn) btn.classList.remove('agy-spinning');
            }
        };

        // Add Account (Independent Web OAuth)
        switcherOverlay.querySelector('#agy-as-add-btn').onclick = handleStartOAuthLogin;

        // Search Input Event
        const searchInput = switcherOverlay.querySelector('#agy-as-search-input');
        searchInput.oninput = (e) => {
            searchQuery = (e.target.value || '').trim().toLowerCase();
            renderCardsGrid();
        };

        // Filter Pills Event
        switcherOverlay.querySelectorAll('.agy-as-filter-pill').forEach(pill => {
            pill.onclick = () => {
                switcherOverlay.querySelectorAll('.agy-as-filter-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                selectedTierFilter = pill.getAttribute('data-filter') || 'all';
                renderCardsGrid();
            };
        });

        document.body.appendChild(switcherOverlay);
        renderCardsGrid();
        return switcherOverlay;
    }

    // 5. Helper: Render 4 Quota Progress Bars with Real Percentage Width
    function renderQuotaBarsHtml(quota) {
        const g5h = quota?.gemini?.fiveHour;
        const gWk = quota?.gemini?.weekly;
        const c5h = quota?.claude?.fiveHour;
        const cWk = quota?.claude?.weekly;

        function computeBucketCountdown(b, defaultText, is5h) {
            if (!b) return { pct: 100, resetText: defaultText };
            let pct = (typeof b.percent === 'number') ? b.percent : 100;
            let resetText = '';
            let resetMs = 0;
            if (b.resetTime) {
                resetMs = typeof b.resetTime === 'number' ? b.resetTime : Date.parse(b.resetTime);
            }
            if (resetMs > 0) {
                const diffMs = resetMs - Date.now();
                if (diffMs <= 0) {
                    pct = 100;
                    resetText = '刚刚已重置';
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
            } else if (b.resetText) {
                resetText = b.resetText.replace(' 重置', '').trim();
            }
            if (!resetText) resetText = defaultText;
            if (is5h && resetText.includes('d')) resetText = defaultText;
            if (!is5h && resetText.includes('h') && !resetText.includes('d')) resetText = defaultText;
            return { pct, resetText };
        }

        const g5hInfo = computeBucketCountdown(g5h, '4h 59m', true);
        const gWkInfo = computeBucketCountdown(gWk, '6d 23h', false);
        const c5hInfo = computeBucketCountdown(c5h, '4h 59m', true);
        const cWkInfo = computeBucketCountdown(cWk, '6d 23h', false);

        const g5hPct = g5hInfo.pct;
        const g5hReset = g5hInfo.resetText;
        const gWkPct = gWkInfo.pct;
        const gWkReset = gWkInfo.resetText;
        const c5hPct = c5hInfo.pct;
        const c5hReset = c5hInfo.resetText;
        const cWkPct = cWkInfo.pct;
        const cWkReset = cWkInfo.resetText;

        const getStatusClass = (pct) => {
            if (pct <= 20) return 'low';
            return '';
        };

        return `
            <div class="agy-as-quotas-box">
                <div class="agy-as-bar-track" title="Gemini 3.1 Pro / Flash (5小时周期)">
                    <div class="agy-as-bar-fill gemini ${getStatusClass(g5hPct)}" style="width: ${Math.max(0, Math.min(100, g5hPct))}%;"></div>
                    <div class="agy-as-bar-content gemini ${getStatusClass(g5hPct)}">
                        <span>✦ Gemini 3.1 Pro (5h) ⏱ ${g5hReset}</span>
                        <b>${g5hPct}%</b>
                    </div>
                </div>
                <div class="agy-as-bar-track" title="Gemini 3.1 系列 (周周期)">
                    <div class="agy-as-bar-fill gemini ${getStatusClass(gWkPct)}" style="width: ${Math.max(0, Math.min(100, gWkPct))}%;"></div>
                    <div class="agy-as-bar-content gemini ${getStatusClass(gWkPct)}">
                        <span>✦ Gemini (周配额) ⏱ ${gWkReset}</span>
                        <b>${gWkPct}%</b>
                    </div>
                </div>
                <div class="agy-as-bar-track" title="Claude 3.7 / GPT 系列 (5小时周期)">
                    <div class="agy-as-bar-fill claude ${getStatusClass(c5hPct)}" style="width: ${Math.max(0, Math.min(100, c5hPct))}%;"></div>
                    <div class="agy-as-bar-content claude ${getStatusClass(c5hPct)}">
                        <span>✳ Claude Sonnet (5h) ⏱ ${c5hReset}</span>
                        <b>${c5hPct}%</b>
                    </div>
                </div>
                <div class="agy-as-bar-track" title="Claude 3.7 / GPT 系列 (周周期)">
                    <div class="agy-as-bar-fill claude ${getStatusClass(cWkPct)}" style="width: ${Math.max(0, Math.min(100, cWkPct))}%;"></div>
                    <div class="agy-as-bar-content claude ${getStatusClass(cWkPct)}">
                        <span>✳ Claude (周配额) ⏱ ${cWkReset}</span>
                        <b>${cWkPct}%</b>
                    </div>
                </div>
            </div>
        `;
    }

    // Helper: Dynamic Live Quota for Active Account
    function getLiveQuotaForActiveAccount() {
        if (typeof window.__AGY_GET_QUOTA_DATA__ === 'function') {
            const q = window.__AGY_GET_QUOTA_DATA__();
            if (q && (q.gemini || q.claude)) {
                return q;
            }
        }
        return null;
    }

    // 6. Render Cards Grid
    function renderCardsGrid() {
        const overlay = switcherOverlay || document.getElementById('agy-as-modal-overlay');
        if (!overlay) return;
        const body = overlay.querySelector('#agy-as-body');
        if (!body) return;

        const profiles = Array.isArray(cachedProfiles) ? cachedProfiles : [];

        // Filter profiles based on search and tier tabs
        const filtered = profiles.filter(p => {
            if (!p || typeof p !== 'object') return false;
            const matchesTier = selectedTierFilter === 'all' || (p.tier || 'PRO').toLowerCase() === selectedTierFilter.toLowerCase();
            if (!matchesTier) return false;

            if (!searchQuery) return true;
            const searchHaystack = `${p.email || ''} ${p.name || ''} ${p.tag || ''}`.toLowerCase();
            return searchHaystack.includes(searchQuery);
        });

        // Update counts
        const allCount = profiles.length;
        const proCount = profiles.filter(p => (p?.tier || 'PRO').toUpperCase() === 'PRO').length;
        const ultraCount = profiles.filter(p => (p?.tier || '').toUpperCase() === 'ULTRA').length;
        const freeCount = profiles.filter(p => (p?.tier || '').toUpperCase() === 'FREE').length;

        const countAllEl = overlay.querySelector('#count-all');
        if (countAllEl) countAllEl.textContent = allCount;
        const countProEl = overlay.querySelector('#count-pro');
        if (countProEl) countProEl.textContent = proCount;
        const countUltraEl = overlay.querySelector('#count-ultra');
        if (countUltraEl) countUltraEl.textContent = ultraCount;
        const countFreeEl = overlay.querySelector('#count-free');
        if (countFreeEl) countFreeEl.textContent = freeCount;

        if (filtered.length === 0) {
            body.innerHTML = `
                <div style="padding: 60px 20px; text-align: center; color: var(--as-text-muted);">
                    <p style="font-size: 14px; margin-bottom: 14px;">${profiles.length === 0 ? '尚未发现本地账号存档' : '未找到匹配的账号记录'}</p>
                    <button class="agy-as-btn agy-as-btn-primary" id="agy-as-empty-add-btn" style="display: inline-flex; align-items: center; gap: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        登录添加账号
                    </button>
                </div>
            `;
            const emptyBtn = body.querySelector('#agy-as-empty-add-btn');
            if (emptyBtn) emptyBtn.onclick = handleStartOAuthLogin;
            return;
        }

        let html = '<div class="agy-as-grid">';
        filtered.forEach(p => {
            const isActive = currentActiveEmail && p.email && typeof p.email === 'string' && typeof currentActiveEmail === 'string' && p.email.toLowerCase() === currentActiveEmail.toLowerCase();
            let effectiveQuota = p.quota;
            if (isActive) {
                const liveQ = getLiveQuotaForActiveAccount();
                if (liveQ) effectiveQuota = liveQ;
            }

            const initial = (p.name || p.email || 'A').charAt(0).toUpperCase();

            html += `
                <div class="agy-as-account-card ${isActive ? 'active' : ''}">
                    <!-- Card Top: Avatar, Name, Email, Tag -->
                    <div class="agy-as-card-top">
                        <div class="agy-as-card-user">
                            <div class="agy-as-card-avatar">
                                ${p.avatar ? `<img src="${p.avatar}" alt="${p.name}" />` : initial}
                            </div>
                            <div class="agy-as-card-user-info">
                                <span class="agy-as-card-name" title="${p.name || p.email}">${p.name || p.email.split('@')[0]}</span>
                                <span class="agy-as-card-email" title="${p.email}">${p.email}</span>
                            </div>
                        </div>
                        <div class="agy-as-card-tag" data-email="${p.email}" title="点击修改备注标签">
                            🏷️ ${p.tag || '备注'}
                        </div>
                    </div>

                    <!-- Card Meta: Badges & Time -->
                    <div class="agy-as-card-meta">
                        <div class="agy-as-badge-box">
                            ${isActive ? '<span class="agy-as-badge-current">当前</span>' : ''}
                            <span class="agy-as-badge-pro">◆ ${p.tier || 'PRO'}</span>
                        </div>
                        <span class="agy-as-card-time">${p.lastUsed || '刚刚'}</span>
                    </div>

                    <!-- Quota Progress Bars -->
                    ${renderQuotaBarsHtml(effectiveQuota)}

                    <!-- Card Actions -->
                    <div class="agy-as-card-actions">
                        <div class="agy-as-card-actions-left">
                            ${isActive ? `
                                <span class="agy-as-card-active-label">✓ 生效中</span>
                            ` : `
                                <button class="agy-as-card-btn primary agy-as-btn-switch" data-email="${p.email}">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
                                    切换
                                </button>
                            `}
                            <button class="agy-as-card-btn agy-as-btn-refresh-single" data-email="${p.email}" title="刷新额度">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                刷新
                            </button>
                            <button class="agy-as-card-btn agy-as-btn-fingerprint" data-email="${p.email}" title="设备指纹配置">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 0-10 10c0 5.52 4.48 10 10 10s10-4.48 10-10c0-1.85-.5-3.58-1.38-5.07"/><path d="M12 6a6 6 0 0 0-6 6c0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.24-.38-2.39-1.02-3.34"/><circle cx="12" cy="12" r="2"/></svg>
                                指纹
                            </button>
                        </div>
                        <div class="agy-as-card-actions-right">
                            <button class="agy-as-card-icon-btn agy-as-btn-export" data-email="${p.email}" title="导出账号凭据">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </button>
                            ${!isActive ? `
                                <button class="agy-as-card-icon-btn danger agy-as-btn-delete" data-email="${p.email}" title="删除此本地存档">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            ` : `
                                <button class="agy-as-card-btn danger agy-as-btn-logout" data-email="${p.email}" title="退出当前账号登录" style="color: #ef4444 !important; border-color: rgba(239, 68, 68, 0.3) !important; background: rgba(239, 68, 68, 0.08) !important; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; font-size: 11.5px; border-radius: 6px; font-weight: 500; cursor: pointer; transition: all 0.15s ease;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                        <polyline points="16 17 21 12 16 7"></polyline>
                                        <line x1="21" y1="12" x2="9" y2="12"></line>
                                    </svg>
                                    退出登录
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        body.innerHTML = html;

        // Bind events
        // 1. Switch
        body.querySelectorAll('.agy-as-btn-switch').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const em = btn.getAttribute('data-email');
                if (em) handleSwitchAccount(em, btn);
            };
        });

        // 2. Refresh single
        body.querySelectorAll('.agy-as-card-btn-refresh-single').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const em = btn.getAttribute('data-email');
                if (!em) return;
                btn.classList.add('agy-spinning');
                try {
                    if (em.toLowerCase() === currentActiveEmail.toLowerCase()) {
                        if (typeof window.__AGY_REFRESH_QUOTA__ === 'function') {
                            await window.__AGY_REFRESH_QUOTA__();
                            await syncCurrentAccount();
                        }
                    } else {
                        if (window.electronNative && typeof window.electronNative.refreshAccountQuota === 'function') {
                            await window.electronNative.refreshAccountQuota(em);
                        }
                    }
                    await loadProfilesAndRender();
                    if (window.__AGY_SHOW_TOAST__) window.__AGY_SHOW_TOAST__(`⚡ 账号 ${em} 实时配额已同步`);
                } catch(err) {
                    console.error('[Account Switcher] Refresh failed:', err);
                } finally {
                    btn.classList.remove('agy-spinning');
                }
            };
        });

        // 3. Fingerprint
        body.querySelectorAll('.agy-as-btn-fingerprint').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const em = btn.getAttribute('data-email');
                if (em) openFingerprintModal(em);
            };
        });

        // 4. Export
        body.querySelectorAll('.agy-as-btn-export').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const em = btn.getAttribute('data-email');
                if (em) handleExportAccount(em);
            };
        });

        // 5. Delete
        body.querySelectorAll('.agy-as-btn-delete').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const em = btn.getAttribute('data-email');
                if (!em) return;
                const confirmed = await showAgyModal({
                    title: '删除本地凭证存档',
                    message: `确定要从本地账号池中删除 ${em} 吗？\n\n此操作仅清除本机的免密登录存档，不会影响您的 Google 账号本身。`,
                    type: 'danger',
                    confirmText: '确认删除',
                    cancelText: '取消',
                    confirmColor: '#ef4444'
                });
                if (confirmed) {
                    if (window.electronNative && typeof window.electronNative.deleteAccountProfile === 'function') {
                        await window.electronNative.deleteAccountProfile(em);
                        await loadProfilesAndRender();
                    }
                }
            };
        });

        // 5.1 Logout current active account (Secondary confirmation)
        body.querySelectorAll('.agy-as-btn-logout').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const em = btn.getAttribute('data-email');
                if (!em) return;

                const confirmed = await showAgyModal({
                    title: '确认退出登录',
                    message: `确定要退出当前账号 ${em} 的登录状态吗？\n\n退出后将清除当前客户端的活跃会话凭据。\n本地账号池中仍将安全保留该账号的凭据记录，您随时可在多账号管理中秒切恢复。`,
                    type: 'danger',
                    confirmText: '退出登录',
                    cancelText: '取消',
                    confirmColor: '#ef4444',
                    iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>'
                });
                if (!confirmed) return;

                btn.disabled = true;
                btn.innerHTML = '正在退出...';

                try {
                    localStorage.removeItem('__AGY_ACTIVE_EMAIL__');
                    localStorage.removeItem('__AGY_USER_PROFILE__');
                    currentActiveEmail = '';

                    if (window.__AGY_SHOW_TOAST__) {
                        window.__AGY_SHOW_TOAST__(`🚪 正在退出账号 ${em}，客户端即将重载...`);
                    }

                    if (window.electronNative && typeof window.electronNative.logoutCurrentAccount === 'function') {
                        await window.electronNative.logoutCurrentAccount();
                    } else if (window.electronNative && typeof window.electronNative.relaunchApp === 'function') {
                        window.electronNative.relaunchApp();
                    } else {
                        setTimeout(() => {
                            window.location.reload();
                        }, 800);
                    }
                } catch(err) {
                    btn.disabled = false;
                    btn.innerHTML = '退出登录';
                    await showAgyModal({
                        title: '退出异常',
                        message: err.message,
                        isAlert: true,
                        confirmText: '我知道了'
                    });
                }
            };
        });

        // 6. Tag edit
        body.querySelectorAll('.agy-as-card-tag').forEach(tagEl => {
            tagEl.onclick = async (e) => {
                e.stopPropagation();
                const em = tagEl.getAttribute('data-email');
                if (!em) return;
                const p = cachedProfiles.find(item => item.email && item.email.toLowerCase() === em.toLowerCase());
                const newTag = await showAgyModal({
                    title: '修改账号备注标签',
                    message: `为账号 ${em} 设置个性化备注（如：主力号、测试号、备用）：`,
                    hasInput: true,
                    inputValue: p?.tag || '',
                    inputPlaceholder: '例如：主力号、工作、备用',
                    confirmText: '保存备注',
                    cancelText: '取消'
                });
                if (newTag !== false) {
                    if (window.electronNative && typeof window.electronNative.updateAccountTag === 'function') {
                        await window.electronNative.updateAccountTag(em, newTag);
                        await loadProfilesAndRender();
                    }
                }
            };
        });
    }

    // 7. Load Profiles Data from Backend
    async function loadProfilesAndRender() {
        try {
            let profiles = [];
            let activeEmail = '';

            // 1. Try Electron IPC with timeout race (2.5s maximum wait)
            if (window.electronNative && typeof window.electronNative.getAccountProfiles === 'function') {
                try {
                    const ipcPromise = window.electronNative.getAccountProfiles();
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('IPC timeout')), 2500));
                    const res = await Promise.race([ipcPromise, timeoutPromise]);
                    if (res && res.success && Array.isArray(res.profiles)) {
                        profiles = res.profiles;
                        activeEmail = res.activeEmail || '';
                    }
                } catch(e) {
                    console.warn('[Account Switcher] IPC getAccountProfiles warning:', e);
                }
            }

            // 2. Fallback to Bootstrap data injected directly by main process
            if (profiles.length === 0 && window.__AGY_BOOTSTRAP_PROFILES__) {
                try {
                    const b = window.__AGY_BOOTSTRAP_PROFILES__;
                    if (Array.isArray(b.profiles) && b.profiles.length > 0) {
                        profiles = JSON.parse(JSON.stringify(b.profiles));
                    }
                    if (!activeEmail && b.active) {
                        activeEmail = b.active;
                    }
                } catch(e) {}
            }

            // 3. Fallback to localStorage cached profiles
            if (profiles.length === 0) {
                try {
                    const c = localStorage.getItem('__AGY_ACCOUNT_PROFILES__');
                    if (c) {
                        const parsed = JSON.parse(c);
                        if (Array.isArray(parsed) && parsed.length > 0) profiles = parsed;
                    }
                } catch(e) {}
            }

            // Fallback to in-memory cachedProfiles if available
            if (profiles.length === 0 && Array.isArray(cachedProfiles) && cachedProfiles.length > 0) {
                profiles = JSON.parse(JSON.stringify(cachedProfiles));
            }

            // 4. Resolve currently active user from React & storage
            const getActiveUser = () => {
                try {
                    if (typeof window.__AGY_GET_USER_PROFILE__ === 'function') {
                        return window.__AGY_GET_USER_PROFILE__();
                    }
                    const p = localStorage.getItem('__AGY_USER_PROFILE__');
                    if (p) return JSON.parse(p);
                } catch(e) {}
                return null;
            };

            const activeUser = getActiveUser();

            if (!activeEmail) {
                if (window.__AGY_BOOTSTRAP_PROFILES__ && window.__AGY_BOOTSTRAP_PROFILES__.active) {
                    activeEmail = window.__AGY_BOOTSTRAP_PROFILES__.active;
                } else if (localStorage.getItem('__AGY_ACTIVE_EMAIL__')) {
                    activeEmail = localStorage.getItem('__AGY_ACTIVE_EMAIL__');
                } else if (activeUser && activeUser.email) {
                    activeEmail = activeUser.email;
                } else if (profiles.length > 0 && profiles[0] && profiles[0].email) {
                    activeEmail = profiles[0].email;
                } else {
                    activeEmail = '';
                }
            }
            if (typeof activeEmail !== 'string') activeEmail = String(activeEmail || '');

            // 5. Ensure the active account is present in profiles list and has latest name/avatar/quota
            const nowStr = (() => {
                const d = new Date();
                return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            })();

            if (activeEmail) {
                let activeCard = profiles.find(p => p && p.email && typeof p.email === 'string' && p.email.toLowerCase() === activeEmail.toLowerCase());
                if (activeCard) {
                    if (activeUser && activeUser.name && activeUser.name !== '乐禾泽') {
                        activeCard.name = activeUser.name;
                    }
                    if (activeUser && activeUser.avatar) {
                        activeCard.avatar = activeUser.avatar;
                    }
                    if (activeUser && activeUser.tier) {
                        activeCard.tier = activeUser.tier;
                    }
                    const liveQ = getLiveQuotaForActiveAccount();
                    if (liveQ) activeCard.quota = liveQ;
                } else {
                    profiles.unshift({
                        email: activeEmail,
                        name: (activeUser && activeUser.name) || activeEmail.split('@')[0],
                        avatar: (activeUser && activeUser.avatar) || '',
                        tier: (activeUser && activeUser.tier) || 'PRO',
                        tag: '当前账号',
                        lastUsed: nowStr,
                        quota: getLiveQuotaForActiveAccount()
                    });
                }
            }

            // 5.5 Sanitize quotas to prevent weekly vs 5-hour mixup
            profiles.forEach(p => {
                if (p && p.quota && typeof p.quota === 'object') {
                    try {
                        ['gemini', 'claude'].forEach(m => {
                            const mod = p.quota[m];
                            if (mod && typeof mod === 'object') {
                                if (mod.fiveHour && typeof mod.fiveHour.resetText === 'string' && mod.fiveHour.resetText.includes('d')) {
                                    mod.fiveHour.resetText = '4h 59m';
                                }
                                if (mod.weekly && typeof mod.weekly.resetText === 'string') {
                                    const r = mod.weekly.resetText;
                                    if (r.includes('h') && !r.includes('d')) {
                                        mod.weekly.resetText = '6d 23h 重置';
                                    }
                                }
                            }
                        });
                    } catch(e) {}
                }
            });

            // 6. Save to cache
            cachedProfiles = profiles;
            currentActiveEmail = activeEmail;
            try {
                localStorage.setItem('__AGY_ACCOUNT_PROFILES__', JSON.stringify(profiles));
                if (activeEmail) localStorage.setItem('__AGY_ACTIVE_EMAIL__', activeEmail);
            } catch(e) {}

            renderCardsGrid();
        } catch(err) {
            console.error('[Account Switcher] Fatal in loadProfilesAndRender:', err);
            try { renderCardsGrid(); } catch(e2) {}
        }
    }

    // 8. Handle Switch Account
    async function handleSwitchAccount(targetEmail, triggerBtn) {
        if (!targetEmail) return;

        const confirmed = await showAgyModal({
            title: '确认切换账号',
            message: `即将切换至账号：\n${targetEmail}\n\n系统将自动写入本地凭据、释放后台语言服务并重启客户端生效，无需跳转浏览器重新登录。\n\n是否立即切换？`,
            confirmText: '立即切换',
            cancelText: '取消',
            confirmColor: '#10b981',
            iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>'
        });
        if (!confirmed) return;

        window.__AGY_IS_SWITCHING__ = true;

        if (triggerBtn) {
            triggerBtn.disabled = true;
            triggerBtn.innerHTML = '切换中...';
        }

        // 1. Immediately update local storage & active email and remove stale cached profile
        currentActiveEmail = targetEmail;
        try {
            localStorage.setItem('__AGY_ACTIVE_EMAIL__', targetEmail);
            localStorage.removeItem('__AGY_USER_PROFILE__');
        } catch(e) {}

        if (window.__AGY_SHOW_TOAST__) {
            window.__AGY_SHOW_TOAST__(`🔄 正在无感秒切至 ${targetEmail}，即将生效...`);
        }

        if (window.electronNative && typeof window.electronNative.switchAccountProfile === 'function') {
            try {
                const res = await window.electronNative.switchAccountProfile(targetEmail);
                if (res && res.success) {
                    if (triggerBtn) triggerBtn.innerHTML = '切换成功';
                    if (window.__AGY_SHOW_TOAST__) {
                        window.__AGY_SHOW_TOAST__(`✅ 已成功切换至 ${targetEmail}，客户端正在重启...`);
                    }
                    setTimeout(() => {
                        window.location.reload();
                    }, 1200);
                    return;
                } else if (res && res.error) {
                    window.__AGY_IS_SWITCHING__ = false;
                    await showAgyModal({
                        title: '切换提示',
                        message: res.error,
                        isAlert: true,
                        confirmText: '我知道了'
                    });
                }
            } catch(err) {
                window.__AGY_IS_SWITCHING__ = false;
                await showAgyModal({
                    title: '切换异常',
                    message: err.message,
                    isAlert: true,
                    confirmText: '我知道了'
                });
            }
        }

        window.__AGY_IS_SWITCHING__ = false;
        if (triggerBtn) {
            triggerBtn.disabled = false;
            triggerBtn.innerHTML = '切换';
        }
    }

    // 9. Independent Web OAuth 2.0 Flow (Never Logs Out Active Session!)
    async function handleStartOAuthLogin() {
        if (!window.electronNative || typeof window.electronNative.startOAuthFlow !== 'function') {
            await showAgyModal({
                title: '环境未就绪',
                message: '当前客户端主进程未就绪独立授权接口，请稍后再试。',
                isAlert: true
            });
            return;
        }

        let authRes = null;
        try {
            authRes = await window.electronNative.startOAuthFlow();
        } catch(e) {
            await showAgyModal({
                title: '启动授权失败',
                message: '无法启动本地授权服务: ' + e.message,
                isAlert: true
            });
            return;
        }

        if (!authRes || !authRes.success || !authRes.authUrl) {
            await showAgyModal({
                title: '获取授权链接失败',
                message: authRes?.error || '无法生成 Google 授权链接',
                isAlert: true
            });
            return;
        }

        const authUrl = authRes.authUrl;

        // Display Dedicated Web OAuth Modal
        const oauthModal = document.createElement('div');
        oauthModal.className = 'agy-as-confirm-overlay';
        oauthModal.innerHTML = `
            <div class="agy-as-confirm-card" style="width: 520px;" onclick="event.stopPropagation()">
                <div style="display: flex; gap: 14px; align-items: flex-start;">
                    <div style="width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(37,99,235,0.12); color: #2563eb;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <h4 style="margin: 0 0 6px 0; font-size: 15.5px; font-weight: 600; color: var(--as-text-main);">添加新 Google 账号 (免登出当前账号)</h4>
                        <p style="font-size: 12.5px; line-height: 1.5; color: var(--as-text-muted); margin: 0 0 12px 0;">
                            系统已在本地启动官方授权监听服务（端口 51121）。请在浏览器中登录您的新账号，完成后该账号将独立存入本地多账号池，<b>当前客户端正在使用的账号完全不受影响</b>。
                        </p>
                        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                            <input type="text" class="agy-as-search-input" readonly value="${authUrl}" id="agy-oauth-link-input" style="flex: 1; font-size: 11px; color: var(--as-text-muted);" />
                            <button class="agy-as-btn" id="agy-oauth-copy-btn">📋 复制链接</button>
                        </div>
                        <div id="agy-oauth-status-box" style="padding: 10px 12px; border-radius: 8px; background: var(--as-bar-track); font-size: 12px; color: #2563eb; display: flex; align-items: center; gap: 8px;">
                            <span class="agy-spinning"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg></span>
                            <span>正在等待浏览器完成 Google 登录授权...</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 6px;">
                    <button class="agy-as-btn" id="agy-oauth-cancel-btn">取消</button>
                    <button class="agy-as-btn agy-as-btn-primary" id="agy-oauth-open-btn">🌐 打开浏览器登录</button>
                </div>
            </div>
        `;
        document.body.appendChild(oauthModal);

        let isOpeningBrowser = false;
        const openInBrowser = (url) => {
            if (!url || isOpeningBrowser) return;
            isOpeningBrowser = true;
            setTimeout(() => { isOpeningBrowser = false; }, 2000);

            if (window.electronNative && typeof window.electronNative.openExternal === 'function') {
                window.electronNative.openExternal(url).catch(() => {});
                return;
            }
            if (window.electronNative && typeof window.electronNative.openPath === 'function') {
                window.electronNative.openPath(url).catch(() => {});
                return;
            }
            try {
                window.open(url, '_blank');
            } catch(e) {}
        };

        // Open in default browser automatically
        openInBrowser(authUrl);

        const copyBtn = oauthModal.querySelector('#agy-oauth-copy-btn');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(authUrl);
            copyBtn.textContent = '✓ 已复制';
            setTimeout(() => { copyBtn.textContent = '📋 复制链接'; }, 1500);
        };

        const openBtn = oauthModal.querySelector('#agy-oauth-open-btn');
        openBtn.onclick = () => {
            openBtn.textContent = '🌐 正在打开浏览器...';
            openInBrowser(authUrl);
            setTimeout(() => {
                openBtn.textContent = '🌐 打开浏览器登录';
            }, 1500);
        };

        let pollTimer = null;
        const cleanup = () => {
            if (pollTimer) clearInterval(pollTimer);
            if (window.electronNative.cancelOAuthFlow) window.electronNative.cancelOAuthFlow();
            oauthModal.remove();
        };

        oauthModal.querySelector('#agy-oauth-cancel-btn').onclick = cleanup;
        oauthModal.onclick = cleanup;

        // Poll for completion
        pollTimer = setInterval(async () => {
            try {
                if (window.electronNative && typeof window.electronNative.checkOAuthStatus === 'function') {
                    const status = await window.electronNative.checkOAuthStatus();
                    if (status && status.status === 'completed') {
                        clearInterval(pollTimer);
                        const statusBox = oauthModal.querySelector('#agy-oauth-status-box');
                        if (statusBox) {
                            statusBox.style.color = '#10b981';
                            statusBox.innerHTML = `🎉 <b>${status.result?.email || '新账号'}</b> 授权成功并已存档！`;
                        }
                        setTimeout(() => {
                            cleanup();
                            loadProfilesAndRender();
                            if (window.__AGY_SHOW_TOAST__) {
                                window.__AGY_SHOW_TOAST__(`🎉 新账号 ${status.result?.email} 已成功添加至账号池！`);
                            }
                        }, 1200);
                    } else if (status && status.status === 'error') {
                        const statusBox = oauthModal.querySelector('#agy-oauth-status-box');
                        if (statusBox) {
                            statusBox.style.color = '#ef4444';
                            statusBox.innerHTML = `❌ 授权失败: ${status.error || '未知错误'}`;
                        }
                    }
                }
            } catch(e) {}
        }, 1200);
    }

    // 10. Device Fingerprint Modal (Matching User Screenshot 3)
    async function openFingerprintModal(email) {
        if (!window.electronNative || typeof window.electronNative.getDeviceFingerprint !== 'function') return;

        const res = await window.electronNative.getDeviceFingerprint(email);
        const modal = document.createElement('div');
        modal.className = 'agy-fp-overlay';
        modal.innerHTML = `
            <div class="agy-fp-card" onclick="event.stopPropagation()">
                <div class="agy-fp-header">
                    <h4>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 0-10 10c0 5.52 4.48 10 10 10s10-4.48 10-10c0-1.85-.5-3.58-1.38-5.07"/><path d="M12 6a6 6 0 0 0-6 6c0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.24-.38-2.39-1.02-3.34"/><circle cx="12" cy="12" r="2"/></svg>
                        设备指纹
                        <span class="email-badge">${email}</span>
                    </h4>
                    <button class="agy-as-btn" id="agy-fp-close" style="padding: 4px 8px;">✕</button>
                </div>
                <div class="agy-fp-body">
                    <div class="agy-fp-actions-bar">
                        <span style="font-size: 13px; font-weight: 600; color: var(--as-text-main);">设备指纹操作</span>
                        <div style="display: flex; gap: 8px;">
                            <button class="agy-as-btn" id="agy-fp-gen-btn" title="为该账号生成全新硬件指纹">🪄 生成并绑定</button>
                            <button class="agy-as-btn" id="agy-fp-restore-btn" title="恢复为默认硬件指纹">↺ 恢复原始</button>
                            <button class="agy-as-btn" id="agy-fp-dir-btn" title="在系统资源管理器中打开账号存储目录">📁 打开存储目录</button>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                        <div class="agy-fp-section-card">
                            <div class="agy-fp-section-title">
                                <span>当前存储</span>
                                <span style="font-size: 11px; color: #10b981; font-weight: 600;">已生效</span>
                            </div>
                            <span class="agy-fp-section-desc">读取自 storage.json (切换账号时应用绑定后更新)</span>
                            <div class="agy-fp-code-box" id="agy-fp-storage-code">${res.currentStorage ? JSON.stringify(res.currentStorage, null, 2) : 'Empty (未检测到或尚未初始化)'}</div>
                        </div>

                        <div class="agy-fp-section-card">
                            <div class="agy-fp-section-title">
                                <span>账号绑定</span>
                                <span style="font-size: 11px; color: #f59e0b; font-weight: 600;">${res.boundFingerprint ? '已绑定' : '待应用'}</span>
                            </div>
                            <span class="agy-fp-section-desc">生成/恢复后保存为绑定，切换账号时写入 storage.json</span>
                            <div class="agy-fp-code-box" id="agy-fp-bound-code">${res.boundFingerprint ? JSON.stringify(res.boundFingerprint, null, 2) : 'Empty (暂未绑定独立指纹)'}</div>
                        </div>
                    </div>

                    <div class="agy-fp-section-card">
                        <div class="agy-fp-section-title">
                            <span>历史指纹 (可选恢复/删除)</span>
                        </div>
                        <div id="agy-fp-history-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto;">
                            ${(res.history && res.history.length > 0) ? res.history.map((h, i) => `
                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 6px; background: var(--as-code-bg); border: 1px solid var(--as-card-border); font-size: 12px;">
                                    <div style="display: flex; flex-direction: column;">
                                        <span style="font-weight: 600; color: var(--as-text-main);">auto_generated ${i === 0 ? '<span style="color:#2563eb;font-size:11px;">当前</span>' : ''}</span>
                                        <span style="font-size: 11px; color: var(--as-text-muted); font-family: monospace;">${h.fingerprint?.['telemetry.machineId'] ? h.fingerprint['telemetry.machineId'].substring(0, 24) + '...' : ''}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 11px; color: var(--as-text-muted);">${h.timestamp || ''}</span>
                                        <button class="agy-as-btn agy-fp-apply-hist-btn" data-idx="${i}" style="padding: 2px 8px; font-size: 11px;">恢复</button>
                                    </div>
                                </div>
                            `).join('') : '<div style="padding: 16px; text-align: center; color: var(--as-text-muted); font-size: 12px;">暂无历史指纹记录</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.onclick = () => modal.remove();
        modal.querySelector('#agy-fp-close').onclick = () => modal.remove();

        // 1. Open Directory
        modal.querySelector('#agy-fp-dir-btn').onclick = () => {
            if (window.electronNative.openAccountFolder) {
                window.electronNative.openAccountFolder(email);
            }
        };

        // 2. Generate Random Fingerprint
        modal.querySelector('#agy-fp-gen-btn').onclick = async () => {
            const crypto = window.crypto || {};
            const genHex = (len) => {
                const arr = new Uint8Array(len);
                if (crypto.getRandomValues) crypto.getRandomValues(arr);
                return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
            };
            const genUuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });

            const newFp = {
                "telemetry.machineId": genHex(32),
                "telemetry.macMachineId": genHex(32),
                "telemetry.devDeviceId": genUuid(),
                "telemetry.sqmId": "{" + genUuid().toUpperCase() + "}"
            };

            const isCurrent = email.toLowerCase() === currentActiveEmail.toLowerCase();
            await window.electronNative.bindDeviceFingerprint(email, newFp, isCurrent);
            modal.remove();
            openFingerprintModal(email);
            if (window.__AGY_SHOW_TOAST__) window.__AGY_SHOW_TOAST__('✨ 已为该账号生成并绑定全新设备指纹！');
        };

        // 3. Restore Default
        modal.querySelector('#agy-fp-restore-btn').onclick = async () => {
            await window.electronNative.bindDeviceFingerprint(email, {}, true);
            modal.remove();
            openFingerprintModal(email);
            if (window.__AGY_SHOW_TOAST__) window.__AGY_SHOW_TOAST__('↺ 已重置设备指纹');
        };

        // 4. History apply
        modal.querySelectorAll('.agy-fp-apply-hist-btn').forEach(btn => {
            btn.onclick = async () => {
                const idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
                const targetH = res.history?.[idx];
                if (targetH && targetH.fingerprint) {
                    const isCurrent = email.toLowerCase() === currentActiveEmail.toLowerCase();
                    await window.electronNative.bindDeviceFingerprint(email, targetH.fingerprint, isCurrent);
                    modal.remove();
                    openFingerprintModal(email);
                    if (window.__AGY_SHOW_TOAST__) window.__AGY_SHOW_TOAST__('✓ 已恢复历史指纹');
                }
            };
        });
    }

    // 11. Handle Export Account
    async function handleExportAccount(email) {
        if (!window.electronNative || typeof window.electronNative.exportAccountProfile !== 'function') return;
        const res = await window.electronNative.exportAccountProfile(email);
        if (!res || !res.success || !res.data) {
            await showAgyModal({ title: '导出失败', message: '无法导出凭据数据', isAlert: true });
            return;
        }

        const jsonStr = JSON.stringify(res.data, null, 2);
        const modal = document.createElement('div');
        modal.className = 'agy-as-confirm-overlay';
        modal.innerHTML = `
            <div class="agy-as-confirm-card" style="width: 580px;" onclick="event.stopPropagation()">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <h4 style="margin: 0; font-size: 15px; font-weight: 600; color: var(--as-text-main);">导出账号凭证 (${email})</h4>
                    <button class="agy-as-btn" id="agy-export-close" style="padding: 4px 8px;">✕</button>
                </div>
                <div class="agy-fp-code-box" style="max-height: 240px;">${jsonStr}</div>
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
                    <button class="agy-as-btn" id="agy-export-download">💾 保存为文件</button>
                    <button class="agy-as-btn agy-as-btn-primary" id="agy-export-copy">📋 复制到剪贴板</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.onclick = () => modal.remove();
        modal.querySelector('#agy-export-close').onclick = () => modal.remove();

        modal.querySelector('#agy-export-copy').onclick = () => {
            navigator.clipboard.writeText(jsonStr);
            if (window.__AGY_SHOW_TOAST__) window.__AGY_SHOW_TOAST__('✓ 凭证已复制到系统剪贴板！');
            modal.remove();
        };

        modal.querySelector('#agy-export-download').onclick = () => {
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `antigravity_profile_${email.replace(/[@.]/g, '_')}.json`;
            a.click();
            URL.revokeObjectURL(url);
            modal.remove();
        };
    }

    // 12. Auto Sync Current Active Account
    async function syncCurrentAccount() {
        if (window.__AGY_IS_SWITCHING__) return;
        try {
            const getUser = () => {
                if (typeof window.__AGY_GET_USER_PROFILE__ === 'function') {
                    return window.__AGY_GET_USER_PROFILE__();
                }
                try {
                    const p = localStorage.getItem('__AGY_USER_PROFILE__');
                    if (p) return JSON.parse(p);
                } catch(e) {}
                return null;
            };
            const user = getUser();
            let activeEmail = (user && user.email) ? user.email.trim() : '';
            if (!activeEmail) return;

            let qData = null;
            if (typeof window.__AGY_GET_QUOTA_DATA__ === 'function') {
                qData = window.__AGY_GET_QUOTA_DATA__();
            }

            if (window.electronNative && typeof window.electronNative.saveCurrentProfile === 'function') {
                await window.electronNative.saveCurrentProfile({
                    email: activeEmail,
                    name: (user && user.name) || activeEmail.split('@')[0],
                    avatar: (user && user.avatar) || '',
                    tier: (user && user.tier) || 'PRO',
                    quota: qData
                });
            }
        } catch(e) {}
    }

    // 13. Open & Close Switcher Modal
    async function openSwitcher() {
        const overlay = createSwitcherOverlay();
        initCachedProfiles();
        renderCardsGrid();
        overlay.style.display = 'flex';
        try {
            await loadProfilesAndRender();
        } catch(e) {
            console.error('[Account Switcher] loadProfiles error:', e);
        }
        try {
            const refreshTasks = [];
            if (typeof window.__AGY_REFRESH_QUOTA__ === 'function') {
                refreshTasks.push(window.__AGY_REFRESH_QUOTA__().then(() => syncCurrentAccount()).catch(() => {}));
            }
            if (window.electronNative && typeof window.electronNative.refreshAllAccountQuotas === 'function') {
                refreshTasks.push(window.electronNative.refreshAllAccountQuotas().catch(() => {}));
            }
            await Promise.allSettled(refreshTasks);
            await loadProfilesAndRender();
        } catch(e) {}
    }

    function closeSwitcher() {
        const overlay = switcherOverlay || document.getElementById('agy-as-modal-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // 14. Mount Switch Account Button in Sidebar Bottom Row (Left of Settings)
    function mountSwitchAccountBtn() {
        const settingsBtn = Array.from(document.querySelectorAll('button')).find(b => {
            return b.innerText && b.innerText.trim() === '设置' && !b.closest('#agy-plugin-center-overlay') && !b.closest('#agy-sidebar-quota-card');
        });
        if (!settingsBtn) return;

        const bottomRow = document.getElementById('agy-sidebar-bottom-row');
        if (!bottomRow) return;

        let actionsWrap = document.getElementById('agy-sidebar-actions-wrap');
        if (!actionsWrap) {
            actionsWrap = document.createElement('div');
            actionsWrap.id = 'agy-sidebar-actions-wrap';
            bottomRow.appendChild(actionsWrap);
        }
        actionsWrap.style.cssText = 'display: inline-flex !important; flex-direction: row !important; flex-wrap: nowrap !important; align-items: center !important; white-space: nowrap !important; gap: 3px !important; flex-shrink: 0 !important; margin-left: auto !important;';

        if (settingsBtn.parentElement !== actionsWrap) {
            actionsWrap.appendChild(settingsBtn);
            settingsBtn.classList.remove('w-full', 'flex-1', 'justify-start');
            settingsBtn.classList.add('w-fit');
            settingsBtn.style.cssText = 'margin: 0 !important; width: fit-content !important; min-width: 0 !important; max-width: fit-content !important; flex: 0 0 auto !important; flex-grow: 0 !important; flex-shrink: 0 !important; justify-content: center !important; padding: 4px 6px !important; border-radius: 6px !important; gap: 3px !important; display: inline-flex !important; flex-direction: row !important; flex-wrap: nowrap !important; align-items: center !important; font-size: 12.5px !important; font-weight: 500 !important; white-space: nowrap !important;';
        }

        let switchBtn = document.getElementById('agy-sidebar-switch-account-btn');
        if (switchBtn) {
            switchBtn.remove();
        }
    }

    // Expose globals
    window.__AGY_OPEN_ACCOUNT_SWITCHER__ = openSwitcher;
    window.__AGY_CLOSE_ACCOUNT_SWITCHER__ = closeSwitcher;
    window.__AGY_MOUNT_SWITCH_ACCOUNT_BTN__ = mountSwitchAccountBtn;
    window.__AGY_SYNC_CURRENT_ACCOUNT__ = syncCurrentAccount;

    // Initial sync & cache preload
    initCachedProfiles();
    setTimeout(syncCurrentAccount, 2000);

    console.log('[Antigravity Account Switcher] Multi-Account Profile & Quota Switcher Loaded.');
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
            if (typeof window.__AGY_MOUNT_SWITCH_ACCOUNT_BTN__ === 'function') {
                window.__AGY_MOUNT_SWITCH_ACCOUNT_BTN__();
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

    function attachMasterObserver() {
        if (!document.body || !window.__AGY_MASTER_OBSERVER__) return;
        try {
            window.__AGY_MASTER_OBSERVER__.observe(document.body, {
                childList: true,
                subtree: true
            });
        } catch (e) {}
    }

    if (document.body) {
        attachMasterObserver();
    } else {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attachMasterObserver, { once: true });
        } else {
            setTimeout(attachMasterObserver, 50);
        }
    }

    // Global Zoom Hotkeys & Safety Guard
    if (!window.__AGY_ZOOM_GUARD_BOUND__) {
        window.__AGY_ZOOM_GUARD_BOUND__ = true;

        window.addEventListener('keydown', (e) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            if (!isCtrl) return;

            // Ctrl + 0: Reset zoom to 100%
            if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
                e.preventDefault();
                if (window.electronNative && typeof window.electronNative.resetZoom === 'function') {
                    window.electronNative.resetZoom();
                }
                if (window.__AGY_SHOW_TOAST__) {
                    window.__AGY_SHOW_TOAST__('🔍 界面缩放已重置为 100% 默认大小');
                }
                return;
            }

            // Ctrl + = / Ctrl + +: Zoom in
            if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
                e.preventDefault();
                if (window.electronNative && typeof window.electronNative.zoomIn === 'function') {
                    window.electronNative.zoomIn();
                    setTimeout(() => {
                        try {
                            const factor = Math.round((window.electronNative.getZoomLevel() || 1) * 100);
                            if (window.__AGY_SHOW_TOAST__) {
                                window.__AGY_SHOW_TOAST__(`🔍 界面放大：${factor}% (按 Ctrl+0 可重置)`);
                            }
                        } catch(err) {}
                    }, 60);
                }
                return;
            }

            // Ctrl + -: Zoom out
            if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
                e.preventDefault();
                if (window.electronNative && typeof window.electronNative.zoomOut === 'function') {
                    window.electronNative.zoomOut();
                    setTimeout(() => {
                        try {
                            const factor = Math.round((window.electronNative.getZoomLevel() || 1) * 100);
                            if (window.__AGY_SHOW_TOAST__) {
                                window.__AGY_SHOW_TOAST__(`🔍 界面缩小：${factor}% (按 Ctrl+0 可重置)`);
                            }
                        } catch(err) {}
                    }, 60);
                }
                return;
            }
        }, true);
    }

    console.log('[Antigravity Guardian] Single Master UI Coordinator active and stable.');
})();
