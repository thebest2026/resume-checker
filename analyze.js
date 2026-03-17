export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { resume, role, lang = '繁體中文' } = req.body;
  if (!resume) return res.status(400).json({ error: '缺少履歷內容' });

  const roleNote = role ? `應徵職位：${role}` : '（未指定職位，請給通用建議）';

  const prompt = `你是一位資深履歷顧問，請分析以下履歷並給出具體建議。

${roleNote}
回覆語言：${lang}

履歷內容：
${resume}

請用以下 JSON 格式回覆，不要加任何其他文字或 markdown：
{
  "overall": 整體分數(0-100),
  "scores": {
    "內容完整度": 分數(0-100),
    "表達清晰度": 分數(0-100),
    "亮點突出度": 分數(0-100)
  },
  "strengths": ["優點1", "優點2", "優點3"],
  "warnings": ["需改善1", "需改善2", "需改善3"],
  "critical": ["必須修正1", "必須修正2"],
  "tip": "最重要的一句話建議（50字以內）"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error('API 呼叫失敗');

    const data = await response.json();
    const text = data.content.map(i => i.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
