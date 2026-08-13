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
          success: false,
          error: 'GEMINI_API_KEY is not configured on the server environment. You can enter the license plate manually or select a sample vehicle plate.'
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

      const prompt = `Inspect this vehicle photo or license plate image carefully.
Extract the vehicle registration / license plate number.
Return ONLY a JSON object formatted exactly as:
{
  "detected": true,
  "plateNumber": "MH12AB1234",
  "vehicleType": "Hatchback",
  "vehicleColor": "White",
  "confidence": "high"
}
If no license plate text is readable or present, return:
{
  "detected": false,
  "plateNumber": "UNKNOWN",
  "error": "No clear license plate found in image"
}
Rules:
- Strip away header words like "IND", country/state names, slogans.
- Format plateNumber as uppercase alphanumeric characters only without hyphens or spaces.`;

      const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
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
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              detected: { type: 'BOOLEAN' },
              plateNumber: { type: 'STRING' },
              confidence: { type: 'STRING' },
              vehicleType: { type: 'STRING' },
              vehicleColor: { type: 'STRING' },
              error: { type: 'STRING' }
            },
            required: ['detected', 'plateNumber']
          }
        }
      });

      const rawText = aiResponse.text?.trim() || '';
      let detectedPlate = '';
      let confidence = 'high';
      let vehicleType = '';
      let vehicleColor = '';

      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.detected && parsed.plateNumber && parsed.plateNumber !== 'UNKNOWN') {
            detectedPlate = parsed.plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
            confidence = parsed.confidence || 'high';
            vehicleType = parsed.vehicleType || '';
            vehicleColor = parsed.vehicleColor || '';
          }
        }
      } catch (e) {
        // Fallback parsing if needed
      }

      if (!detectedPlate || detectedPlate.length < 3) {
        // Regex fallback to extract alphanumeric string of length 4 to 12
        const matches = rawText.match(/[A-Z0-9]{4,12}/gi);
        if (matches) {
          for (const m of matches) {
            const clean = m.toUpperCase();
            if (!['UNKNOWN', 'DETECTED', 'LICENSE', 'PLATE', 'NUMBER', 'TRUE', 'FALSE', 'IMAGE'].includes(clean)) {
              detectedPlate = clean;
              confidence = 'medium';
              break;
            }
          }
        }
      }

      if (detectedPlate && detectedPlate.length >= 3 && detectedPlate !== 'UNKNOWN') {
        return res.json({ 
          success: true, 
          plateNumber: detectedPlate,
          confidence,
          vehicleType,
          vehicleColor
        });
      }

      return res.json({ 
        success: false, 
        error: 'Could not clearly detect a valid vehicle registration plate from this image. Please adjust camera or type plate manually.' 
      });
    } catch (err: any) {
      console.error('Gemini AI License Plate Scan Error:', err);
      return res.json({
        success: false,
        error: err.message || 'Failed to scan license plate'
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

  // Helper for Priority Suggestion fallback
  function generateFallbackPrioritySuggestion(ctx: any) {
    const todayStr = new Date().toISOString().split('T')[0];
    const estDate = ctx.estimatedCompletionDate || todayStr;
    const progressPct = ctx.progressPct || 0;
    const remainingTasks = (ctx.totalCount || 0) - (ctx.completedCount || 0);
    const isUrgent = ctx.isUrgent || false;
    const pendingApprovals = ctx.pendingApprovalsCount || 0;
    const pendingReqs = ctx.pendingRequisitionsCount || 0;

    const isTodayOrPast = estDate <= todayStr;
    let suggestedPriority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    let urgencyScore = 50;
    let headline = '';
    let keyReasons: string[] = [];
    let recommendedActions: string[] = [];
    let estimatedRisk = '';
    let shouldBeMarkedUrgent = false;

    if (isTodayOrPast && progressPct < 70) {
      suggestedPriority = 'CRITICAL';
      urgencyScore = 95;
      headline = `Critical Alert: Vehicle promised ${estDate === todayStr ? 'TODAY' : 'OVERDUE'} with ${remainingTasks} tasks pending (${progressPct}% completed).`;
      keyReasons = [
        `Promised delivery date (${estDate}) is ${estDate === todayStr ? 'today' : 'overdue'}, but ${remainingTasks} tasks remain incomplete.`,
        `Overall progress is at ${progressPct}%, requiring immediate floor intervention.`,
        pendingApprovals > 0 ? `${pendingApprovals} unapproved customer estimate items are blocking repair progress.` : 'Work sequence needs immediate escalation.'
      ];
      recommendedActions = [
        'Reassign available technicians from low-priority cars to accelerate active tasks.',
        'Contact customer or service advisor to clear pending estimate approvals.',
        'Flag job card as 🔥 URGENT for priority bay allocation.'
      ];
      estimatedRisk = 'High Risk: Delivery delay highly probable without immediate intervention.';
      shouldBeMarkedUrgent = true;
    } else if (isTodayOrPast || progressPct < 50 || isUrgent || pendingReqs > 0) {
      suggestedPriority = 'HIGH';
      urgencyScore = 78;
      headline = `High Priority: Completion target ${estDate} with ${remainingTasks} tasks remaining (${progressPct}% done).`;
      keyReasons = [
        `Completion deadline is scheduled for ${estDate}.`,
        `${remainingTasks} remaining task(s) in repair pipeline (${progressPct}% total progress).`,
        pendingReqs > 0 ? `${pendingReqs} spare part requisition(s) pending fulfillment.` : (isUrgent ? 'Card manually marked as urgent in daily huddle.' : 'Sub-optimal progress speed detected.')
      ];
      recommendedActions = [
        'Issue required spare parts from inventory store immediately.',
        'Pair senior mechanic with apprentice to expedite remaining jobs.',
        'Schedule mid-day inspection check with Floor Manager.'
      ];
      estimatedRisk = 'Moderate Risk: Potential bottleneck if parts or approval stall.';
      shouldBeMarkedUrgent = true;
    } else if (progressPct >= 80) {
      suggestedPriority = 'LOW';
      urgencyScore = 20;
      headline = `On Track / Low Urgency: ${progressPct}% completed. Final inspection & delivery prep active.`;
      keyReasons = [
        `Most repair tasks (${ctx.completedCount}/${ctx.totalCount}) are successfully finished.`,
        `Promised delivery timeline (${estDate}) has comfortable buffer.`,
        'No major workflow bottlenecks or part shortages flagged.'
      ];
      recommendedActions = [
        'Conduct final Quality Control (QC) inspection.',
        'Initiate washing and interior detailing.',
        'Generate GST Invoice and notify delivery driver.'
      ];
      estimatedRisk = 'Low Risk: On track for on-time customer delivery.';
      shouldBeMarkedUrgent = false;
    } else {
      suggestedPriority = 'MEDIUM';
      urgencyScore = 48;
      headline = `Standard Priority: ${progressPct}% completed for promised completion date ${estDate}.`;
      keyReasons = [
        `Job card is progressing at steady pace (${ctx.completedCount}/${ctx.totalCount} completed).`,
        `Completion deadline (${estDate}) allows sufficient time under standard workflow.`,
        'Technicians are actively assigned to current task phase.'
      ];
      recommendedActions = [
        'Continue standard repair workflow sequence.',
        'Ensure technicians log task completions upon finishing.',
        'Verify required parts are available before starting next phase.'
      ];
      estimatedRisk = 'Low-Moderate Risk: Normal monitoring required.';
      shouldBeMarkedUrgent = isUrgent;
    }

    return {
      suggestedPriority,
      urgencyScore,
      headline,
      keyReasons,
      recommendedActions,
      estimatedRisk,
      shouldBeMarkedUrgent
    };
  }

  // AI-Powered Priority Suggestion Endpoint
  app.post('/api/ai-priority-suggestion', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const { jobContext } = req.body;
      if (!jobContext) {
        return res.status(400).json({ error: 'jobContext is required' });
      }

      if (!apiKey) {
        const fallback = generateFallbackPrioritySuggestion(jobContext);
        return res.json({ success: true, analysis: fallback, isFallback: true });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const todayStr = new Date().toISOString().split('T')[0];
      const prompt = `You are an AI Workshop Operations Director & Master Service Scheduler.
Analyze this automotive job card's deadline, progress, and blockers to suggest an optimal team priority level and key operational next steps:

Current Date: ${todayStr}
Job Card Details:
${JSON.stringify(jobContext, null, 2)}

Requirements for Analysis:
1. Compare current date (${todayStr}) with estimated completion date (${jobContext.estimatedCompletionDate}).
2. Evaluate task progress (${jobContext.completedCount}/${jobContext.totalCount} = ${jobContext.progressPct}%).
3. Consider pending customer approvals (${jobContext.pendingApprovalsCount || 0}) and pending spare parts requisitions (${jobContext.pendingRequisitionsCount || 0}).
4. Determine priority rating:
   - CRITICAL: Deadline is today/overdue AND < 75% completed OR major blockers present.
   - HIGH: Deadline within 24-48 hours AND < 60% completed OR parts pending.
   - MEDIUM: Steady progress with standard time buffer remaining.
   - LOW: > 80% completed or ample time remaining.

Return JSON matching this structure:
{
  "suggestedPriority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "urgencyScore": number 1 to 100,
  "headline": "concise 1-sentence priority diagnosis summary",
  "keyReasons": ["reason 1", "reason 2", "reason 3"],
  "recommendedActions": ["action 1", "action 2"],
  "estimatedRisk": "short risk assessment text",
  "shouldBeMarkedUrgent": boolean
}
Return valid JSON ONLY.`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              suggestedPriority: { type: 'STRING' },
              urgencyScore: { type: 'NUMBER' },
              headline: { type: 'STRING' },
              keyReasons: {
                type: 'ARRAY',
                items: { type: 'STRING' }
              },
              recommendedActions: {
                type: 'ARRAY',
                items: { type: 'STRING' }
              },
              estimatedRisk: { type: 'STRING' },
              shouldBeMarkedUrgent: { type: 'BOOLEAN' }
            },
            required: ['suggestedPriority', 'urgencyScore', 'headline', 'keyReasons', 'recommendedActions', 'estimatedRisk', 'shouldBeMarkedUrgent']
          }
        }
      });

      const rawText = aiResponse.text?.trim() || '{}';
      let parsed = null;
      try {
        parsed = JSON.parse(rawText);
      } catch (e) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      }

      if (!parsed || !parsed.suggestedPriority) {
        parsed = generateFallbackPrioritySuggestion(jobContext);
      }

      res.json({ success: true, analysis: parsed });
    } catch (err: any) {
      console.error('Gemini Priority Analysis Error:', err);
      const fallback = generateFallbackPrioritySuggestion(req.body.jobContext || {});
      res.json({ success: true, analysis: fallback, isFallback: true, error: err.message });
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
