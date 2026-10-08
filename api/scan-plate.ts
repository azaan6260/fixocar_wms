import { GoogleGenAI, Type } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { imageBase64 } = body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    if (!apiKey) {
      return res.status(200).json({
        success: false,
        error: 'GEMINI_API_KEY environment variable is missing on Vercel project settings.'
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
- Indian license plates typically follow the format: 2 letters (State Code), 2 digits (RTO Code), 1 or 2 letters (unique series), and 4 digits (Registration number). Ensure you extract and normalize to this standard format (e.g., MH12AB1234) if it fits.
- Strip away header words like "IND", country/state names, slogans.
- Format plateNumber as uppercase alphanumeric characters only without hyphens or spaces.`;

    const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const runOcr = async (modelName: string) => {
      return await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detected: { type: Type.BOOLEAN },
              plateNumber: { type: Type.STRING },
              confidence: { type: Type.STRING },
              vehicleType: { type: Type.STRING },
              vehicleColor: { type: Type.STRING },
              error: { type: Type.STRING }
            },
            required: ['detected', 'plateNumber']
          }
        }
      });
    };

    let aiResponse;
    try {
      aiResponse = await runOcr('gemini-flash-latest');
    } catch (primaryError) {
      console.warn('Primary scan model failed, trying fallback gemini-3.8-flash:', primaryError);
      try {
        aiResponse = await runOcr('gemini-3.8-flash');
      } catch (fallbackError) {
        console.error('OCR fallback model failed:', fallbackError);
        throw fallbackError;
      }
    }

    const rawText = aiResponse.text || '';
    let parsed: any = null;
    let detectedPlate = '';
    let vehicleType = '';
    let vehicleColor = '';
    let confidence = 'high';

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
        if (parsed.plateNumber && parsed.plateNumber !== 'UNKNOWN') {
          detectedPlate = parsed.plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
          vehicleType = parsed.vehicleType || '';
          vehicleColor = parsed.vehicleColor || '';
          confidence = parsed.confidence || 'high';
        }
      }
    } catch (e) {
      console.warn('Failed to parse JSON response:', e);
    }

    if (!detectedPlate || detectedPlate.length < 3) {
      const matches = rawText.match(/[A-Z0-9]{4,12}/gi);
      if (matches) {
        for (const m of matches) {
          const clean = m.toUpperCase();
          const excludeList = ['UNKNOWN', 'DETECTED', 'LICENSE', 'PLATE', 'NUMBER', 'TRUE', 'FALSE', 'IMAGE', 'HATCHBACK', 'SEDAN', 'SUV', 'WHITE', 'BLACK', 'GREY', 'SILVER', 'RED', 'BLUE', 'CONFIDENCE', 'HIGH', 'MEDIUM', 'LOW'];
          const hasLetters = /[A-Z]/i.test(clean);
          const hasDigits = /[0-9]/.test(clean);

          if (hasLetters && hasDigits && !excludeList.includes(clean)) {
            detectedPlate = clean;
            confidence = 'medium';
            break;
          }
        }
      }
    }

    if (detectedPlate && detectedPlate.length >= 3) {
      return res.status(200).json({
        success: true,
        plateNumber: detectedPlate,
        vehicleType,
        vehicleColor,
        confidence,
        rawText
      });
    }

    return res.status(200).json({
      success: false,
      error: parsed?.error || 'Could not clearly detect a valid vehicle registration plate from this image. Please adjust camera or type plate manually.'
    });
  } catch (err: any) {
    console.error('Vercel API License Plate Scan Error:', err);
    return res.status(500).json({
      success: false,
      error: 'License plate scan service error: ' + (err.message || 'Server error')
    });
  }
}
