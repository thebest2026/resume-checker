const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { resume, role, lang = '繁體中文', jd, mode = 'analyze' } = req.body;
  if (!resume) return res.status(400).json({ error: '缺少履歷內容' });

  let prompt;

  if (mode === 'improve') {
    prompt = `你是一位頂尖的履歷撰寫專家，擅長將平淡的履歷改寫成令人印象深刻的版本。

回覆語言：${lang}
${role ? `應徵職位：${role}` : ''}
${jd ? `職缺描述（請針對此職缺優化）：\n${jd}` : ''}

原始履歷：
${resume}

請依照以下原則大幅改寫這份履歷，直接輸出完整改善版，不要加任何說明：

【改寫原則】
1. 每條經歷都必須用「動詞開頭 + 具體行動 + 量化成果」的結構重寫
   - 錯誤示範：「負責市場分析與策略規劃」
   - 正確示範：「主導3大產業品牌年度市場分析，識別5個關鍵成長機會，直接支援品牌媒體預算配置決策」
2. 數字只能使用原始履歷中明確提到的數據，絕對不可以自己編造或估算任何數字、百分比、金額或數量。如果原文沒有數字，就用強而有力的動詞和具體描述取代，不要捏造。
3. 把被動語氣改成主動語氣（「負責」→「主導」、「協助」→「獨立完成」）
4. 突出你的獨特貢獻，而不只是描述職責
5. 如果有提供職缺描述，優先凸顯與職缺最相關的技能與成就
6. 整體篇幅可以比原版精簡20%，去掉冗詞贅字`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API錯誤: ${response.status} - ${errText.substring(0, 200)}`);
      }
      const data = await response.json();
      const text = data.content.map(i => i.text || '').join('');
      res.status(200).json({ improved: text });
    } catch(e) {
      console.error('Error:', e.message);
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // mode === 'analyze'
  const jdSection = jd ? `\n職缺描述：\n${jd}\n\n請額外分析履歷與職缺的符合度（0-100分），並列出符合的技能與缺少的技能。` : '';
  prompt = `你是一位資深履歷顧問，請分析以下履歷並給出具體建議。

${role ? `應徵職位：${role}` : '（未指定職位，請給通用建議）'}
回覆語言：${lang}
${jdSection}

履歷內容：
${resume}

請用以下 JSON 格式回覆，不要加任何其他文字或 markdown：
{
  "overall": 整體分數(0-100),
  "scores": {
    "內容完整度": 分數,
    "表達清晰度": 分數,
    "亮點突出度": 分數${jd ? ',\n    "職缺符合度": 分數' : ''}
  },
  "strengths": ["優點1", "優點2", "優點3"],
  "warnings": ["需改善1", "需改善2", "需改善3"],
  "critical": ["必須修正1", "必須修正2"],
  "tip": "最重要的一句話建議（50字以內）"${jd ? ',\n  "matched_skills": ["符合技能1", "符合技能2"],\n  "missing_skills": ["缺少技能1", "缺少技能2"]' : ''}
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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API錯誤: ${response.status} - ${errText.substring(0, 200)}`);
    }
    const data = await response.json();
    const text = data.content.map(i => i.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    res.status(200).json(JSON.parse(clean));
  } catch(e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
};

module.exports = handler;
