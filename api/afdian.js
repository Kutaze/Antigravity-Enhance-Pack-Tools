export default async function handler(req, res) {
  // 1. GET 请求：状态检查与一键免付费测试
  if (req.method === 'GET') {
    const isTest = req.query.test === '1' || req.query.test === 'true';
    if (isTest) {
      try {
        const testOrder = {
          out_trade_no: 'TEST_' + Date.now(),
          title: '极客能量包 (测试赞助)',
          total_amount: '12.00',
          remark: '这是来自 Vercel Serverless 的一键测试广播！'
        };
        await sendDiscordNotification(testOrder, req.query.thread_id);
        return res.status(200).json({
          ec: 200,
          em: 'ok',
          message: '✅ 测试赞助广播已成功发送到 Discord 指定频道/子区！'
        });
      } catch (err) {
        return res.status(500).json({
          ec: 500,
          error: err.message
        });
      }
    }

    return res.status(200).json({
      status: 'online',
      service: 'Afdian Discord Relay (Vercel Serverless)',
      version: 'v1.1.0',
      author: 'Kutaze',
      test_hint: '访问 /api/afdian?test=1 可直接触发一条测试赞助卡片到 Discord',
      timestamp: new Date().toISOString()
    });
  }

  // 2. POST 请求：接收爱发电官方 Webhook
  if (req.method === 'POST') {
    try {
      let payload = req.body;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) {}
      }
      if (payload && payload.params) {
        try {
          payload = typeof payload.params === 'string' ? JSON.parse(payload.params) : payload.params;
        } catch (e) {}
      }

      if (payload && payload.ec === 200 && payload.data && payload.data.type === 'order') {
        const order = payload.data.order;
        await sendDiscordNotification(order, req.query.thread_id);
      }

      // 无论内部处理细节，必须在 3 秒内向爱发电返回 ec: 200 保证握手成功
      return res.status(200).json({ ec: 200, em: 'ok' });
    } catch (e) {
      console.error('[Relay Error]', e);
      return res.status(200).json({ ec: 200, em: 'ok' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

/**
 * 发送 Discord Webhook 富文本广播（支持独立频道与子频道/子区 Thread）
 */
async function sendDiscordNotification(order, queryThreadId) {
  const defaultWebhook = 'https://discord.com/api/webhooks/1552329570957529110/t53NF1st_oEqpgnJpRT6CUKWyozRfv9D0CFPKe7UpK7mm7Ye9c7OFr5Kcy5A05MxCnxu';
  let targetUrl = process.env.DISCORD_WEBHOOK_URL || defaultWebhook;

  // 默认直接发送至新创建的子区：💖 · 爱发电赞助鸣谢 (Thread ID: 1553841999575261234)
  const defaultThreadId = '1553841999575261234';
  const threadId = queryThreadId || process.env.DISCORD_THREAD_ID || defaultThreadId;
  if (threadId && !targetUrl.includes('thread_id=')) {
    targetUrl += (targetUrl.includes('?') ? '&' : '?') + `thread_id=${encodeURIComponent(threadId)}`;
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: '爱发电赞助提醒',
      avatar_url: 'https://pic1.afdiancdn.com/static/img/logo/logo.png',
      embeds: [{
        title: '💖 收到一笔新的爱发电赞助！',
        description: '感谢慷慨支持！每一份赞助都是开源持续打磨与长久维护的核心动力！',
        color: 0x946ce6, // 爱发电专属紫色
        fields: [
          { name: '📦 赞助方案', value: `**${order.title || '随心赞助'}**`, inline: true },
          { name: '💰 赞助金额', value: `**¥${order.total_amount}**`, inline: true },
          { name: '📝 赞助留言 / 备注', value: order.remark && order.remark.trim() ? `\`\`\`${order.remark.trim()}\`\`\`` : '*（未填写备注）*', inline: false }
        ],
        footer: {
          text: `订单号: ${order.out_trade_no} · Antigravity Enhance Tools`,
          icon_url: 'https://pic1.afdiancdn.com/static/img/logo/logo.png'
        },
        timestamp: new Date().toISOString()
      }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Discord Webhook Error]', response.status, errorText);
  }
}
