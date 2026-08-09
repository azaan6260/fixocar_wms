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
          note: 'GEMINI_API_KEY is not set. Using simulated license plate OCR.'
        });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `You are a specialized Optical Character Recognition (OCR) model for vehicle license plates.
Task: Inspect the provided image carefully and extract the vehicle registration / license plate number.

Rules:
1. Locate any license plate / registration tag on the vehicle (front bumper, rear bumper, frame, or windshield).
2. Read all visible alphanumeric characters accurately (e.g. Indian plates: "MH12AB1234", "DL01CA9988", "KA05MH8822"; US/EU plates: "6XYZ789", "ABC1234", "1ABC234").
3. Strip out state or country headers ("IND", "CALIFORNIA", etc.), dealer slogans, frame borders, spaces, dots, and hyphens.
4. Return ONLY the uppercase alphanumeric license plate string (e.g., "MH12AB1234").
5. If no license plate is identifiable or text is unreadable, reply ONLY with "UNKNOWN".`;

      // Dynamically extract mimeType and clean base64 string
      const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

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
                  mimeType: mimeType
                }
              }
            ]
          }
        ]
      });

      const rawText = aiResponse.text?.trim() || '';
      let plateNumber = rawText.toUpperCase().replace(/[^A-Z0-9]/g, '');

      // Regex fallback extraction if AI response contains extra words or formatting
      if (!plateNumber || plateNumber === 'UNKNOWN' || plateNumber.length < 3) {
        const platePattern = /[A-Z]{1,3}\s*\d{1,2}\s*[A-Z]{0,3}\s*\d{3,4}|[A-Z0-9]{4,11}/gi;
        const matches = rawText.match(platePattern);
        if (matches && matches.length > 0) {
          const candidate = matches[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (candidate.length >= 4 && candidate !== 'UNKNOWN') {
            plateNumber = candidate;
          }
        }
      }

      if (!plateNumber || plateNumber === 'UNKNOWN' || plateNumber.length < 3) {
        return res.json({ 
          success: false, 
          plateNumber: 'UNKNOWN',
          error: 'Could not clearly detect a valid vehicle license plate in the image.'
        });
      }

      res.json({ success: true, plateNumber });
    } catch (err: any) {
      console.error('Gemini AI License Plate Scan Error:', err);
      res.json({
        success: false,
        error: err.message || 'Failed to scan license plate',
        plateNumber: 'UNKNOWN'
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

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
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
