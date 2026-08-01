import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ limit: '25mb', extended: true }));

  // API Endpoints
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'AutoCraft Workshop Backend', timestamp: new Date().toISOString() });
  });

  // AI-Powered License Plate Scanner using Gemini Vision
  app.post('/api/scan-plate', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 is required' });
      }

      if (!apiKey) {
        return res.json({
          success: true,
          plateNumber: 'MH12AB1234',
          note: 'GEMINI_API_KEY not set. Using simulated plate recognition.'
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Extract the vehicle registration number (license plate) from this image. 
      Return ONLY the alphanumeric characters of the license plate without spaces or hyphens. 
      If you cannot detect a license plate, return "UNKNOWN".`;

      const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: 'image/jpeg'
                }
              }
            ]
          }
        ]
      });

      const plateNumber = aiResponse.text?.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'UNKNOWN';

      res.json({ success: true, plateNumber });
    } catch (err: any) {
      console.error('Gemini AI License Plate Scan Error:', err);
      res.json({
        success: false,
        error: err.message || 'Failed to scan license plate',
        fallbackPlate: 'KA05MH8822'
      });
    }
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

    // Serve index.html for all non-API GET requests in development mode (SPA fallback)
    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const fs = await import('fs');
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
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
