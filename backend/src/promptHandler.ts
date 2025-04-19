import { Request, Response } from 'express';
import OpenAI from 'openai';

export async function handlePrompt(req: Request, res: Response) {
  const { apiKey, baseUrl, prompt, model } = req.body;
  if (!apiKey || !prompt) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const openai = new OpenAI({ apiKey, baseURL: baseUrl });
    const chatResponse = await openai.chat.completions.create({
      model: model || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    });
    const responseText = chatResponse.choices[0].message?.content || '';
    res.json({ response: responseText });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Error processing prompt.' });
  }
}
