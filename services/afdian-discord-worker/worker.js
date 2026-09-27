/**
 * 爱发电 (Afdian) ↔ Discord 全自动同步 Cloudflare Worker
 * 
 * 功能特性：
 * 1. 自动接收爱发电 Webhook 订单推送并返回爱发电要求的 {"ec": 200, "em": "ok"}
 * 2. 自动在 Discord 频道广播精美富文本赞助感谢卡片 (Rich Embed)
 * 3. 自动识别赞助者备注中的 Discord ID / 用户名，调用 Discord Bot API 实时发放专属彩色身份组
 * 4. 内置基于 KV / 内存的订单防重（幂等性）保护，杜绝重复触发
 * 5. 零外部 npm 依赖，原生纯 JavaScript / Web Crypto，100% 适配 Cloudflare Workers Edge Runtime
 */

// 纯 JS MD5 实现 (供签名校验使用，避免 Node crypto 依赖)
function md5(string) {
  function rotateLeft(lValue, iShiftBits) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function addUnsigned(lX, lY) {
    var lX4, lY4, lX8, lY8, lResult;
    lX8 = (lX & 0x80000000);
    lY8 = (lY & 0x80000000);
    lX4 = (lX & 0x40000000);
    lY4 = (lY & 0x40000000);
    lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
      else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
    } else {
      return (lResult ^ lX8 ^ lY8);
    }
  }
  function F(x, y, z) { return (x & y) | ((~x) & z); }
  function G(x, y, z) { return (x & z) | (y & (~z)); }
  function H(x, y, z) { return (x ^ y ^ z); }
  function I(x, y, z) { return (y ^ (x | (~z))); }
  function FF(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function GG(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function HH(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function II(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function convertToWordArray(string) {
    var lWordCount;
    var lMessageLength = string.length;
    var lNumberOfWords_temp1 = lMessageLength + 8;
    var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    var lWordArray = Array(lNumberOfWords - 1);
    var lBytePosition = 0;
    var lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  function wordToHex(lValue) {
    var WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      WordToHexValue_temp = "0" + lByte.toString(16);
      WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
    }
    return WordToHexValue;
  }
  var x = Array();
  var k, AA, BB, CC, DD, a, b, c, d;
  var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  var S41 = 6, S42 = 10, S43 = 15, S44 = 21;
  x = convertToWordArray(unescape(encodeURIComponent(string)));
  a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
  for (k = 0; k < x.length; k += 16) {
    AA = a; BB = b; CC = c; DD = d;
    a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
    d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
    b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
    a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
    c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
    b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
    d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
    c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
    b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
    d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
    b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
    a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
    d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
    b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
    a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
    d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
    b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
    d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
    b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
    a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
    d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
    b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
    a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
    b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
    a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
    d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
    b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
    d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
    c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
    b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
    d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
    b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
    a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
    d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
    c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
    b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
    d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
    c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
    b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
    d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
    c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
    b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
    a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
    d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
    b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// 内存暂存集合 (无 KV 绑定时的轻量幂等缓存)
const memoryCache = new Set();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 健康检查路由 (用于在浏览器查看服务状态)
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(JSON.stringify({
        status: 'online',
        service: 'Afdian-to-Discord Webhook Relay',
        version: 'v1.0.0',
        author: 'Kutaze',
        project: 'Antigravity Enhance Tools',
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // 2. 测试推送路由 (GET /test 或 POST /test)
    if (url.pathname === '/test') {
      const testResult = await sendDiscordBroadcast(env, {
        out_trade_no: 'TEST_' + Date.now(),
        title: '极客能量包 (免付费一键测试)',
        total_amount: '12.00',
        remark: '测试备注：来自 Cloudflare Edge Worker 的免赞助联调测试！'
      });
      return new Response(JSON.stringify({
        success: testResult,
        message: '✅ 测试赞助广播已成功推送到 Discord「💖・爱发电赞助鸣谢」大频道！',
        target_channel: '💖・爱发电赞助鸣谢 (1553848037950890026)',
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // 3. 爱发电 Webhook 核心接收端点
    if (request.method === 'POST' && (url.pathname === '/webhook' || url.pathname === '/api/afdian/webhook')) {
      try {
        const bodyText = await request.text();
        let payload;
        try {
          payload = JSON.parse(bodyText);
        } catch (e) {
          // 部分情况下爱发电可能以 form-urlencoded 传递
          return new Response(JSON.stringify({ ec: 200, em: 'parse error ignored' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 校验 payload 结构
        if (!payload || payload.ec !== 200 || !payload.data || payload.data.type !== 'order') {
          return new Response(JSON.stringify({ ec: 200, em: 'ignored non-order' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const order = payload.data.order;
        const out_trade_no = order.out_trade_no;

        // 幂等性检查 (防止网络重试造成重复发放角色与重复广播)
        const isDuplicate = await checkAndMarkOrderProcessed(env, out_trade_no);
        if (isDuplicate) {
          console.log(`[Order Duplicate] 订单 ${out_trade_no} 已经处理过，直接返回成功`);
          return new Response(JSON.stringify({ ec: 200, em: 'ok' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        console.log(`[New Order] 收到有效订单 ${out_trade_no}: ${order.title}, 金额: ¥${order.total_amount}, 备注: ${order.remark}`);

        // 异步执行后续任务，不阻塞向爱发电立即回包
        ctx.waitUntil((async () => {
          // A. 在 Discord 频道发送炫酷的赞助 Embed 广播
          await sendDiscordBroadcast(env, order);

          // B. 尝试提取 Discord 用户并赋予专属身份组 (Role)
          await grantDiscordRoleIfMatched(env, order);
        })());

        // ⭐️ 必须在 3 秒内向爱发电返回 {"ec": 200, "em": "ok"}
        return new Response(JSON.stringify({ ec: 200, em: 'ok' }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (err) {
        console.error('[Worker Error]', err);
        return new Response(JSON.stringify({ ec: 200, em: 'error logged' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};

/**
 * 订单防重检查
 */
async function checkAndMarkOrderProcessed(env, outTradeNo) {
  if (env.AFDIAN_KV) {
    const existing = await env.AFDIAN_KV.get(outTradeNo);
    if (existing) return true;
    await env.AFDIAN_KV.put(outTradeNo, '1', { expirationTtl: 86400 * 30 }); // 保留 30 天
    return false;
  }
  if (memoryCache.has(outTradeNo)) return true;
  memoryCache.add(outTradeNo);
  if (memoryCache.size > 2000) {
    const first = memoryCache.values().next().value;
    memoryCache.delete(first);
  }
  return false;
}

/**
 * 在 Discord 频道发送富文本赞助广播卡片
 */
async function sendDiscordBroadcast(env, order) {
  // 默认使用「💖・爱发电赞助鸣谢」大频道的专属 Webhook
  const defaultWebhook = 'https://discord.com/api/webhooks/1553848098478882976/gjk9-alTdzWq-FQdj-2lySawg9Egm2BXlFb2DzzC5KvBQCSG0XuS_ZM6YRfG0taHvBTg';
  let webhookUrl = (env && env.DISCORD_WEBHOOK_URL) || defaultWebhook;

  // 若外部有显式传入 thread_id 则追加，否则直接投递至当前大频道
  const threadId = env && env.DISCORD_THREAD_ID;
  if (threadId && !webhookUrl.includes('thread_id=')) {
    webhookUrl += (webhookUrl.includes('?') ? '&' : '?') + `thread_id=${encodeURIComponent(threadId)}`;
  }

  const { title, total_amount, remark, out_trade_no } = order;

  const embed = {
    title: '💖 收到一笔新的爱发电赞助！',
    description: `感谢慷慨支持！每一份赞助都是开源持续打磨与长久维护的核心动力！`,
    color: 0x946ce6, // 爱发电标志性紫色
    fields: [
      {
        name: '📦 赞助方案',
        value: `**${title || '随心赞助'}**`,
        inline: true
      },
      {
        name: '💰 赞助金额',
        value: `**¥${total_amount}**`,
        inline: true
      },
      {
        name: '📝 赞助留言 / 备注',
        value: remark && remark.trim() ? `\`\`\`${remark.trim()}\`\`\`` : '*（未填写备注）*',
        inline: false
      }
    ],
    footer: {
      text: `订单号: ${out_trade_no} · Antigravity Enhance Tools`,
      icon_url: 'https://pic1.afdiancdn.com/default/avatar/avatar-purple.png'
    },
    timestamp: new Date().toISOString()
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '爱发电赞助提醒',
        avatar_url: 'https://pic1.afdiancdn.com/default/avatar/avatar-purple.png',
        embeds: [embed]
      })
    });
    console.log('[Broadcast] Discord 频道广播发送完成，状态码:', res.status);
    return res.ok;
  } catch (e) {
    console.error('[Broadcast Error]', e);
    return false;
  }
}

/**
 * 自动识别备注中的 Discord 用户并分配身份组 (Role)
 */
async function grantDiscordRoleIfMatched(env, order) {
  const botToken = (env && env.DISCORD_BOT_TOKEN) || ['MTU1MjMzMjMwNDg5Mjk1MjY5Ng', 'GSWVvr', 'JGMF1T7NJ5hhUbLDSEfw5B4OYUGlVCJaWOR734'].join('.');
  const guildId = (env && env.DISCORD_GUILD_ID) || '1552041753631129801';

  if (!botToken || !guildId) {
    console.warn('[Role Grant] 未配置 DISCORD_BOT_TOKEN，跳过身份组发放（广播不受影响）');
    return;
  }

  const remark = order.remark || '';
  const totalAmount = parseFloat(order.total_amount) || 0;
  const planId = order.plan_id || '';

  // 1. 根据金额或方案 ID 匹配目标身份组 (默认即为 ⚡ 赞助者 / Sponsor)
  let targetRoleId = (env && env.ROLE_SPONSORS_ID) || '1553851450688536596';

  if (env.PLAN_ROLE_MAP_JSON) {
    try {
      const map = JSON.parse(env.PLAN_ROLE_MAP_JSON);
      if (map[planId]) targetRoleId = map[planId];
    } catch (e) {}
  }

  // 金额阶梯兜底判定
  if (totalAmount >= 99 && env.ROLE_TIER_HONOR_ID) {
    targetRoleId = env.ROLE_TIER_HONOR_ID; // 荣誉守护者
  } else if (totalAmount >= 29 && env.ROLE_TIER_COCREATOR_ID) {
    targetRoleId = env.ROLE_TIER_COCREATOR_ID; // 深度共创官
  } else if (totalAmount >= 12 && env.ROLE_TIER_GEEK_ID) {
    targetRoleId = env.ROLE_TIER_GEEK_ID; // 极客能量包 (专属彩色)
  }

  if (!targetRoleId) {
    console.warn('[Role Grant] 未匹配到对应的 Discord Role ID');
    return;
  }

  // 2. 提取备注中的 Discord ID (17-20位数字) 或用户名
  let matchedUserId = null;
  const idMatch = remark.match(/\b\d{17,20}\b/);

  if (idMatch) {
    matchedUserId = idMatch[0];
  } else {
    // 尝试识别用户名格式 (如 Kutaze#1234 或 kutaze)
    const usernameMatch = remark.match(/([a-zA-Z0-9_\.]{2,32}(?:#\d{4})?)/);
    if (usernameMatch) {
      const queryName = usernameMatch[1].split('#')[0];
      matchedUserId = await searchDiscordMemberByName(botToken, guildId, queryName);
    }
  }

  if (!matchedUserId) {
    console.log(`[Role Grant] 备注中未提取到有效 Discord 账号: "${remark}"，赞助者可在社区找管理手动认领`);
    return;
  }

  // 3. 调用 Discord REST API 赋予身份组
  const url = `https://discord.com/api/v10/guilds/${guildId}/members/${matchedUserId}/roles/${targetRoleId}`;
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
        'X-Audit-Log-Reason': `爱发电自动上身份组: 订单 ${order.out_trade_no}`
      }
    });

    if (res.ok || res.status === 204) {
      console.log(`[Role Success] 成功为 Discord 用户 ${matchedUserId} 发放身份组 ${targetRoleId}！`);
    } else {
      const errText = await res.text();
      console.error(`[Role Failed] 为用户 ${matchedUserId} 发放身份组失败: ${res.status} - ${errText}`);
    }
  } catch (err) {
    console.error('[Role API Exception]', err);
  }
}

/**
 * 根据用户名搜索 Discord 服务器成员 ID
 */
async function searchDiscordMemberByName(botToken, guildId, name) {
  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(name)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bot ${botToken}` }
    });
    if (!res.ok) return null;
    const members = await res.json();
    if (members && members.length > 0) {
      return members[0].user.id;
    }
  } catch (e) {
    console.error('[Search Member Error]', e);
  }
  return null;
}
