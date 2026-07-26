import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoints
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'AutoCraft Workshop Backend', timestamp: new Date().toISOString() });
  });

  // AI-Powered Diagnostics & Estimate Generator using Gemini
  app.post('/api/ai-diagnosis', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'GEMINI_API_KEY not configured.' });
      }

      const { vehicleInfo, reportedSymptoms } = req.body;
      if (!reportedSymptoms) {
        return res.status(400).json({ error: 'reportedSymptoms is required' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a Master Automotive Workshop Service Advisor & Chief Mechanical Inspector.
Vehicle Context: ${JSON.stringify(vehicleInfo || {})}
Reported Symptoms / Customer Request: "${reportedSymptoms}"

Provide a structured repair recommendation JSON with:
1. "summary": Brief technical diagnosis (1-2 sentences)
2. "suggestedTasks": Array of recommended job card tasks with fields:
   - "title": Task name
   - "category": One of ("MECHANICAL", "DENTING", "PAINT", "SUBLET_VENDOR", "WASHING", "INSPECTION", "PARTS")
   - "team": Recommended team ("Mechanical", "Denting", "Paint", "Detailing & Washing", "Sublet / Lathe")
   - "estimatedCost": Parts & labor wholesale cost estimate in USD (number)
   - "customerPrice": Customer billing price estimate in USD (number)
   - "requiresCustomerApproval": boolean (true if additional/discovered work)
   - "explanation": Why this repair is necessary
3. "customerExplanation": Polite, non-technical message to send to the customer for approval.

Return valid JSON ONLY without markdown backticks.`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = aiResponse.text || '{}';
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      res.json({ success: true, diagnosis: parsed });
    } catch (err: any) {
      console.error('Gemini AI Diagnosis Error:', err);
      res.status(500).json({ error: 'Failed to generate AI diagnosis', details: err.message });
    }
  });

  // Vite middleware setup for Development vs Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AutoCraft Workshop Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Express server:', err);
});
