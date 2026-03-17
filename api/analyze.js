const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { resume, role, lang = '繁體中文', jd, mode = 'analyze' } = req.body;
  if (!resume) return res.status(400).json({ error: '缺少履歷內容' });

  let prompt;

  if (mode === 'improve') {
    const analyzePrompt = `你是一位資深履歷顧問，請分析以下履歷並給出具體建議。

${role ? `應徵職位：${role}` : '（未指定職位）'}
${jd ? `職缺描述：\n${jd}` : ''}

履歷內容：
${resume}

請用 JSON 格式回覆，不要加任何其他文字：
{
  "weaknesses": ["最需要改善的問題1", "最需要改善的問題2", "最需要改善的問題3"],
  "missing_from_jd": ["職缺要求但履歷沒展現的能力1", "能力2"],
  "strongest_points": ["最有說服力的亮點1", "亮點2"],
  "overall_strategy": "一句話說明改寫策略方向"
}`;

    let analysis = null;
    try {
      const analyzeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{ role: 'user', content: analyzePrompt }]
        })
      });
      if (analyzeRes.ok) {
        const analyzeData = await analyzeRes.json();
        const analyzeText = analyzeData.content.map(i => i.text || '').join('');
        const clean = analyzeText.replace(/```json|```/g, '').trim();
        analysis = JSON.parse(clean);
      }
    } catch(e) {
      console.log('分析步驟失敗，繼續改寫:', e.message);
    }

    const weaknessSection = analysis ? `
【分析發現的問題，改寫時必須解決】
${analysis.weaknesses.map((w, i) => `${i+1}. ${w}`).join('\n')}

【職缺要求但目前履歷沒展現的能力，改寫時要想辦法凸顯】
${(analysis.missing_from_jd || []).map((m, i) => `${i+1}. ${m}`).join('\n')}

【這些亮點要保留並強化】
${analysis.strongest_points.map((s, i) => `${i+1}. ${s}`).join('\n')}

【改寫策略】${analysis.overall_strategy}
` : '';

    prompt = `你是一位頂尖的履歷撰寫專家。請根據以下分析結果，針對性地改寫這份履歷。

回覆語言：${lang}
${role ? `應徵職位：${role}` : ''}
${jd ? `職缺描述：\n${jd}` : ''}
${weaknessSection}

原始履歷：
${resume}

【改寫規則】
1. 針對上方「分析發現的問題」逐一解決，這是最優先任務
2. 凸顯與職缺最相關的技能與成就，讓面試官一眼看到符合度
3. 保留原始數字，絕對不可自行捏造數字
4. 用主動語氣重寫（「主導」「推動」「建立」），去掉「負責」「協助」等被動詞
5. 每條經歷要有「做了什麼 + 怎麼做 + 產生什麼價值」的結構
6. 直接輸出完整改善版履歷，不要加任何說明或前言`;

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
      res.status(200).json({ improved: text, analysis: analysis });
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
