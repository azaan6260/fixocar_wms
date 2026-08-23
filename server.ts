import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Lazy Supabase Admin Client
function getSupabaseAdminClient(customUrl?: string, customKey?: string) {
  const url = customUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = customKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) return null;
  try {
    return createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (err) {
    console.warn('Failed to initialize Supabase admin client:', err);
    return null;
  }
}

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
        model: 'gemini-3.7-flash',
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

  // AI-Powered Vehicle Cost & Estimate Generator Fallback
  function generateFallbackCostEstimate(payload: any) {
    const { vehicle = {}, selectedJobs = [], customRepairNotes = '', customerType = 'RETAIL' } = payload;
    const make = (vehicle.make || 'Maruti Suzuki').trim();
    const model = (vehicle.model || 'Swift').trim();
    const fuel = (vehicle.fuelType || 'Petrol').trim();
    const year = vehicle.year || 2022;
    const mileage = vehicle.mileage || 32000;
    const isB2B = customerType === 'CARS24_B2B' || vehicle.isCars24;
    const isLuxury = ['BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Jaguar', 'Land Rover', 'Volvo', 'Porsche', 'Lexus'].some(b => make.toLowerCase().includes(b.toLowerCase()));
    const isSUV = ['SUV', 'Compact SUV', 'MUV'].includes(vehicle.category || '') || ['Creta', 'Seltos', 'Scorpio', 'XUV700', 'Harrier', 'Safari', 'Fortuner', 'Brezza', 'Nexon'].some(m => model.toLowerCase().includes(m.toLowerCase()));
    const isEV = fuel === 'EV' || fuel.toLowerCase().includes('electric');

    // Multipliers based on vehicle engineering complexity
    let multiplier = 1.0;
    if (isLuxury) multiplier = 2.4;
    else if (isSUV) multiplier = 1.35;
    else if (isEV) multiplier = 1.2;

    const rateDiscount = isB2B ? 0.82 : 1.0;

    let items: any[] = [];

    if (Array.isArray(selectedJobs) && selectedJobs.length > 0) {
      items = selectedJobs.map((job: any, index: number) => {
        const basePrice = isB2B ? (job.cars24Price || job.retailPrice || 1200) : (job.retailPrice || 1400);
        const adjustedPrice = Math.round(basePrice * (job.category === 'PAINT' ? 1.0 : multiplier) * rateDiscount);
        const partCost = Math.round(adjustedPrice * 0.42);
        const laborCost = Math.round(adjustedPrice * 0.35);
        const laborHours = job.estimatedHours || (job.category === 'PAINT' ? 3 : 1.5);
        
        let partName = `${make} ${model} ${job.title.replace(' - Paint & Dent Repair', '')}`;
        let partNumber = `OEM-${make.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

        if (job.title.includes('Oil')) {
          partName = `${vehicle.engineOilSpec || 'Synthetic 5W-30 Engine Oil'} + OEM Spin-on Filter`;
          partNumber = `OIL-${make.slice(0, 3).toUpperCase()}-${model.slice(0, 3).toUpperCase()}`;
        } else if (job.title.includes('Brake')) {
          partName = `Front Ceramic Low-Metallic Brake Pads Set`;
          partNumber = `BP-${make.slice(0, 3).toUpperCase()}-FR`;
        } else if (job.category === 'PAINT') {
          partName = `PPG / Standox Automotive Grade Lacquer & Epoxy Primer`;
          partNumber = `PNT-${job.id || 'STD'}`;
        }

        return {
          id: `est-item-${Date.now()}-${index}`,
          title: job.title,
          category: job.category || 'MECHANICAL',
          partName,
          partNumber,
          partCost,
          laborHours,
          laborCost,
          customerPrice: adjustedPrice,
          team: job.category === 'PAINT' ? 'Paint' : job.category === 'DENTING' ? 'Denting' : job.category === 'WASHING' ? 'Detailing & Washing' : 'Mechanical',
          requiresApproval: Boolean(job.requiresCustomerApproval),
          isContractBasis: Boolean(job.isContractBasis),
          painterPayout: job.painterPayout ? Math.round(job.painterPayout * (isB2B ? 1 : 1.1)) : undefined,
          denterPayout: job.denterPayout ? Math.round(job.denterPayout * (isB2B ? 1 : 1.1)) : undefined,
          explanation: `Tailored for ${make} ${model} (${fuel}) factoring in ${isLuxury ? 'premium European OEM tolerances' : 'standard high-durability specification'}.`
        };
      });
    } else {
      // Default baseline package tailored to vehicle model
      const oilPrice = Math.round((isLuxury ? 4200 : isSUV ? 2400 : 1850) * rateDiscount);
      const brakePrice = Math.round((isLuxury ? 3800 : isSUV ? 2200 : 1650) * rateDiscount);
      const filterPrice = Math.round((isLuxury ? 1800 : 950) * rateDiscount);
      const scanPrice = Math.round((isLuxury ? 1200 : 650) * rateDiscount);
      const washPrice = isB2B ? 400 : 650;

      items = [
        {
          id: `est-item-1`,
          title: `Periodic Engine Service (${vehicle.engineOilSpec || 'Synthetic Oil'} & Filter)`,
          category: 'MECHANICAL',
          partName: `${make} OEM Spec Engine Oil (${vehicle.engineOilSpec ? vehicle.engineOilSpec.split('•')[0].trim() : '3.5L'}) + Micro-filter`,
          partNumber: `SYN-${make.slice(0, 3).toUpperCase()}-ENG`,
          partCost: Math.round(oilPrice * 0.55),
          laborHours: isLuxury ? 2.5 : 1.5,
          laborCost: Math.round(oilPrice * 0.3),
          customerPrice: oilPrice,
          team: 'Mechanical',
          requiresApproval: false,
          isContractBasis: false,
          explanation: `Engine oil capacity and viscosity spec matched to ${make} ${model} ${fuel} engine.`
        },
        {
          id: `est-item-2`,
          title: `Cabin AC Filter & Engine Air Intake Filter Replacement`,
          category: 'MECHANICAL',
          partName: `High-Flow PM2.5 Carbon Air & Cabin Filter Kit`,
          partNumber: `FLT-${make.slice(0, 3).toUpperCase()}-CAB`,
          partCost: Math.round(filterPrice * 0.5),
          laborHours: 0.5,
          laborCost: Math.round(filterPrice * 0.25),
          customerPrice: filterPrice,
          team: 'Mechanical',
          requiresApproval: false,
          isContractBasis: false,
          explanation: `Replaces clogged air intake and cabin pollen filter to restore AC cooling and engine breathing.`
        },
        {
          id: `est-item-3`,
          title: `Front Ceramic Brake Pads & Caliper Service`,
          category: 'MECHANICAL',
          partName: `Front Ceramic Brake Pad Set (Low Dust, High Heat)`,
          partNumber: `BP-${make.slice(0, 3).toUpperCase()}-CER`,
          partCost: Math.round(brakePrice * 0.5),
          laborHours: 1.5,
          laborCost: Math.round(brakePrice * 0.3),
          customerPrice: brakePrice,
          team: 'Mechanical',
          requiresApproval: mileage > 30000,
          isContractBasis: false,
          explanation: `Recommended based on vehicle mileage (${mileage.toLocaleString()} km) and friction wear.`
        },
        {
          id: `est-item-4`,
          title: `30-Point Computerized OBD-II Diagnostics & Module Health Scan`,
          category: 'INSPECTION',
          partName: `FixoCar Pro Scan Cloud Diagnostic Health Certificate`,
          partNumber: `DIAG-PRO-OBD`,
          partCost: 50,
          laborHours: 0.8,
          laborCost: Math.round(scanPrice * 0.4),
          customerPrice: scanPrice,
          team: 'Management',
          requiresApproval: false,
          isContractBasis: false,
          explanation: `Full electronic ECU/TCU/ABS sensor error code clearing and calibration.`
        },
        {
          id: `est-item-5`,
          title: `Eco High-Pressure Steam Wash & Interior Deep Vacuuming`,
          category: 'WASHING',
          partName: `Biodegradable Foam Shampoo & Microfiber Buffing Polish`,
          partNumber: `WSH-ECO-FOAM`,
          partCost: 120,
          laborHours: 1.0,
          laborCost: Math.round(washPrice * 0.5),
          customerPrice: washPrice,
          team: 'Detailing & Washing',
          requiresApproval: false,
          isContractBasis: false,
          explanation: `Complete exterior wheel-arch degreasing and cabin dust extraction.`
        }
      ];
    }

    const totalPartsCost = items.reduce((sum, it) => sum + (it.partCost || 0), 0);
    const totalLaborCost = items.reduce((sum, it) => sum + (it.laborCost || 0), 0);
    const consumablesCost = Math.round(totalPartsCost * 0.08 + 180);
    const recommendedCustomerPrice = items.reduce((sum, it) => sum + (it.customerPrice || 0), 0);
    const estimatedHours = Number(items.reduce((sum, it) => sum + (it.laborHours || 1), 0).toFixed(1));
    const estimatedDealershipPrice = Math.round(recommendedCustomerPrice * (isLuxury ? 1.65 : 1.42));
    const customerSavings = estimatedDealershipPrice - recommendedCustomerPrice;
    const savingsPercentage = Math.round((customerSavings / estimatedDealershipPrice) * 100);

    const modelInsights = [
      `${make} ${model} (${fuel}) specifies ${vehicle.engineOilSpec || 'synthetic grade lubricant'} with ${vehicle.coolantSpec || 'long-life coolant'}.`,
      isLuxury 
        ? `European electronic calipers require computerized parking brake release mode prior to pad replacement.`
        : `High-availability spare parts profile ensures fast same-day turnaround within ${estimatedHours} labor hours.`,
      isB2B 
        ? `Cars24 B2B fleet rate applied with standardized pre-negotiated labor and part billing tiers.`
        : `Transparent baseline estimate saves customer approximately ₹${customerSavings.toLocaleString('en-IN')} (${savingsPercentage}%) compared to authorized showroom dealerships.`,
      mileage > 40000 
        ? `At ${mileage.toLocaleString()} km, suspension bushing play and brake disc rotor thickness should be checked during the physical inspection.`
        : `Vehicle is in prime operational mileage window (${mileage.toLocaleString()} km).`
    ];

    const priceTierRange = {
      budgetOes: Math.round(recommendedCustomerPrice * 0.85),
      recommendedOem: recommendedCustomerPrice,
      premiumDealership: estimatedDealershipPrice
    };

    return {
      overallSummary: `AI Baseline Cost Analysis for ${year} ${make} ${model} ${vehicle.variant || ''} (${fuel}, ${mileage.toLocaleString()} km). Estimated at ₹${recommendedCustomerPrice.toLocaleString('en-IN')} across ${items.length} key service & parts items.`,
      recommendedEstimate: {
        totalPartsCost,
        totalLaborCost,
        consumablesCost,
        subtotal: totalPartsCost + totalLaborCost + consumablesCost,
        recommendedCustomerPrice,
        estimatedDealershipPrice,
        customerSavings,
        savingsPercentage,
        estimatedHours
      },
      confidence: isLuxury ? 'HIGH' : 'HIGH',
      itemizedBreakdown: items,
      modelInsights,
      priceTierRange
    };
  }

  // AI-Powered Baseline Cost Estimator using Gemini 3.7 Flash
  app.post('/api/ai-cost-estimate', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const { vehicle, selectedJobs, customRepairNotes, customerType, pricingTier } = req.body;

      if (!vehicle || !vehicle.make) {
        return res.status(400).json({ error: 'vehicle details (make, model) are required' });
      }

      if (!apiKey) {
        const fallback = generateFallbackCostEstimate(req.body);
        return res.json({ success: true, estimate: fallback, isFallback: true });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `You are a Master Automotive Cost Estimator and Technical Operations Director for FixoCar multi-brand workshop network.
Analyze the vehicle engineering profile and requested repair/maintenance tasks to generate a mathematically accurate, transparent baseline price estimate for the customer.

Vehicle Profile:
- Make: ${vehicle.make}
- Model: ${vehicle.model}
- Variant: ${vehicle.variant || 'Standard'}
- Year: ${vehicle.year || 2022}
- Mileage: ${vehicle.mileage || 35000} km
- Fuel Type: ${vehicle.fuelType || 'Petrol'}
- Category: ${vehicle.category || 'Hatchback'}
- Factory Oil Spec: ${vehicle.engineOilSpec || 'Synthetic 5W-30'}
- Coolant Spec: ${vehicle.coolantSpec || 'Long Life Coolant'}
- Customer Type: ${customerType === 'CARS24_B2B' ? 'Cars24 Fleet Partner (Pre-negotiated B2B Rates)' : 'Retail Private Customer'}
- Pricing Tier Preference: ${pricingTier || 'RECOMMENDED_OEM'}

Requested Standard Jobs / Work Items:
${JSON.stringify(selectedJobs || [], null, 2)}

Advisor Symptoms / Custom Notes:
"${customRepairNotes || 'Calculate standard baseline service & wear-and-tear cost estimation based on car model and mileage'}"

ESTIMATION RULES & PRICING LOGIC:
1. Vehicle Brand Complexity:
   - European/Luxury (BMW, Mercedes, Audi, Jaguar, Volvo, Porsche): Parts and skilled labor are significantly higher (e.g. specialized synthetic oils LL-01/C3, electronic caliper retract, German paint matching).
   - Japanese/Korean/Indian (Maruti, Hyundai, Honda, Tata, Mahindra): Fast-moving OEM/OES parts with competitive pricing.
   - Electric/Hybrid (EV, Strong Hybrid): Include high-voltage safety scan and specialized regenerative braking / inverter coolant protocols.
   - Heavy SUVs/MUVs: Factor larger fluid capacities and heavy-duty suspension bushes/pads.
2. Itemized Breakdown:
   Provide an array of items (matching or expanding the selected standard jobs/parts, or proposing comprehensive baseline maintenance):
   - "id": string (e.g. "est-1")
   - "title": task title
   - "category": ("MECHANICAL" | "DENTING" | "PAINT" | "SUBLET_VENDOR" | "WASHING" | "INSPECTION" | "PARTS" | "ACCESSORIES")
   - "partName": precise OEM/OES part name with grade/capacity
   - "partNumber": realistic automotive part number (e.g. "OF-MAR-1197", "SYN-5W30-4L")
   - "partCost": wholesale cost in INR (number)
   - "laborHours": estimated labor duration in hours (number)
   - "laborCost": internal workshop technician labor in INR (number)
   - "customerPrice": recommended billing price to customer in INR (number)
   - "team": ("Mechanical" | "Denting" | "Paint" | "Detailing & Washing" | "Sublet / Lathe" | "Management")
   - "requiresApproval": boolean
   - "isContractBasis": boolean (true for paint & denting)
   - "painterPayout": number (optional, for contract paint jobs)
   - "denterPayout": number (optional, for contract denting jobs)
   - "explanation": brief technical reason why this price and part matches this vehicle model.
3. Market Benchmarking:
   - "totalPartsCost": sum of part wholesale costs in INR
   - "totalLaborCost": sum of labor expenses in INR
   - "consumablesCost": shop supplies & environmental disposal in INR
   - "recommendedCustomerPrice": fair competitive customer billing total in INR
   - "estimatedDealershipPrice": authorized showroom dealership price in INR (typically 35% to 65% higher)
   - "customerSavings": dealership price minus recommended customer price in INR
   - "savingsPercentage": integer percentage saved (e.g. 38)
   - "estimatedHours": total labor hours
4. Model Insights:
   - 3 to 4 bullet points with specific technical recommendations for this exact car model (fluid grades, known maintenance tips, wear warnings).
5. Price Tier Range:
   - "budgetOes": budget aftermarket tier in INR
   - "recommendedOem": recommended balanced OEM tier in INR
   - "premiumDealership": authorized dealership quote in INR

Return valid JSON matching the exact schema.`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              overallSummary: { type: 'STRING' },
              recommendedEstimate: {
                type: 'OBJECT',
                properties: {
                  totalPartsCost: { type: 'NUMBER' },
                  totalLaborCost: { type: 'NUMBER' },
                  consumablesCost: { type: 'NUMBER' },
                  subtotal: { type: 'NUMBER' },
                  recommendedCustomerPrice: { type: 'NUMBER' },
                  estimatedDealershipPrice: { type: 'NUMBER' },
                  customerSavings: { type: 'NUMBER' },
                  savingsPercentage: { type: 'NUMBER' },
                  estimatedHours: { type: 'NUMBER' }
                },
                required: [
                  'totalPartsCost',
                  'totalLaborCost',
                  'consumablesCost',
                  'recommendedCustomerPrice',
                  'estimatedDealershipPrice',
                  'customerSavings',
                  'savingsPercentage',
                  'estimatedHours'
                ]
              },
              confidence: { type: 'STRING' },
              itemizedBreakdown: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    id: { type: 'STRING' },
                    title: { type: 'STRING' },
                    category: { type: 'STRING' },
                    partName: { type: 'STRING' },
                    partNumber: { type: 'STRING' },
                    partCost: { type: 'NUMBER' },
                    laborHours: { type: 'NUMBER' },
                    laborCost: { type: 'NUMBER' },
                    customerPrice: { type: 'NUMBER' },
                    team: { type: 'STRING' },
                    requiresApproval: { type: 'BOOLEAN' },
                    isContractBasis: { type: 'BOOLEAN' },
                    painterPayout: { type: 'NUMBER' },
                    denterPayout: { type: 'NUMBER' },
                    explanation: { type: 'STRING' }
                  },
                  required: ['id', 'title', 'category', 'partName', 'customerPrice', 'partCost', 'laborCost', 'laborHours']
                }
              },
              modelInsights: {
                type: 'ARRAY',
                items: { type: 'STRING' }
              },
              priceTierRange: {
                type: 'OBJECT',
                properties: {
                  budgetOes: { type: 'NUMBER' },
                  recommendedOem: { type: 'NUMBER' },
                  premiumDealership: { type: 'NUMBER' }
                },
                required: ['budgetOes', 'recommendedOem', 'premiumDealership']
              }
            },
            required: ['overallSummary', 'recommendedEstimate', 'itemizedBreakdown', 'modelInsights', 'priceTierRange']
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

      if (!parsed || !parsed.recommendedEstimate) {
        parsed = generateFallbackCostEstimate(req.body);
      }

      res.json({ success: true, estimate: parsed });
    } catch (err: any) {
      console.error('Gemini AI Cost Estimate Error:', err);
      const fallback = generateFallbackCostEstimate(req.body || {});
      res.json({ success: true, estimate: fallback, isFallback: true, error: err.message });
    }
  });

  // Fallback priority suggestion generator
  function generateFallbackPrioritySuggestion(ctx: any) {
    const todayStr = new Date().toISOString().split('T')[0];
    const estDate = ctx.estimatedCompletionDate || todayStr;
    const progressPct = ctx.progressPct || 0;
    const remainingTasks = Math.max(0, (ctx.totalCount || 0) - (ctx.completedCount || 0));
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

  // ==========================================
  // SUPABASE AUTHENTICATION & USER MANAGEMENT
  // ==========================================

  // Check Supabase Auth configuration status
  app.get('/api/supabase/status', (req, res) => {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const hasAnonKey = Boolean(process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

    res.json({
      configured: Boolean(url && (hasServiceKey || hasAnonKey)),
      hasAdminServiceKey: hasServiceKey,
      hasAnonKey,
      supabaseUrl: url ? url.replace(/(https:\/\/[^.]+).*/, '$1.supabase.co') : null
    });
  });

  // Diagnostic utility endpoint to verify if Supabase 'auth.users' is in sync with 'public.employees'
  app.post('/api/supabase/admin/diagnose-sync', async (req, res) => {
    try {
      const { supabaseUrl, supabaseServiceKey, supabaseAnonKey, localEmployees = [] } = req.body;
      const url = supabaseUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const serviceKey = supabaseServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
      const anonKey = supabaseAnonKey || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const warnings: string[] = [];
      const recommendations: string[] = [];

      if (!url) {
        return res.json({
          success: false,
          isConfigured: false,
          error: 'Supabase URL is not configured.',
          recommendations: ['Enter your Supabase URL in Database Settings']
        });
      }

      const client = getSupabaseAdminClient(url, serviceKey || anonKey);
      if (!client) {
        return res.json({
          success: false,
          isConfigured: false,
          error: 'Failed to initialize Supabase client.',
          recommendations: ['Verify Supabase URL and API keys in Database Settings.']
        });
      }

      const hasServiceRoleKey = Boolean(serviceKey && serviceKey.length > 20);
      if (!hasServiceRoleKey) {
        warnings.push('Supabase Service Role Key is missing. Standard anon key can only query public.employees, not auth.users.');
        recommendations.push('Provide the Supabase service_role key in Database Settings to allow querying and auto-syncing auth.users directly.');
      }

      // Fetch records from public.employees table
      let dbEmployees: any[] = [];
      try {
        const { data, error } = await client.from('employees').select('*');
        if (error) {
          warnings.push(`DB Query error on public.employees: ${error.message}`);
        } else {
          dbEmployees = data || [];
        }
      } catch (dbErr: any) {
        warnings.push(`Could not query public.employees: ${dbErr.message}`);
      }

      // Fetch users from auth.users (if service role key is provided)
      let authUsers: any[] = [];
      let canQueryAuthUsers = false;
      if (hasServiceRoleKey && client.auth?.admin) {
        try {
          const { data: userList, error: listErr } = await client.auth.admin.listUsers();
          if (listErr) {
            warnings.push(`Failed to list users from auth.users: ${listErr.message}`);
          } else {
            authUsers = userList?.users || [];
            canQueryAuthUsers = true;
          }
        } catch (authErr: any) {
          warnings.push(`Auth admin query exception: ${authErr.message}`);
        }
      }

      // Cross-verify between local employees, public.employees, and auth.users
      const employeeList = localEmployees.length > 0 ? localEmployees : dbEmployees;
      
      const matchedAccounts: any[] = [];
      const missingInAuth: any[] = [];

      for (const emp of employeeList) {
        const empEmail = (emp.email || `${emp.loginId || emp.id}@workshop.fixocar.com`).toLowerCase().trim();
        const inDb = dbEmployees.some((d: any) => d.id === emp.id || (d.email && d.email.toLowerCase() === empEmail));
        const authMatch = authUsers.find((u: any) => 
          u.email?.toLowerCase() === empEmail || 
          u.user_metadata?.employee_id === emp.id || 
          u.user_metadata?.login_id === emp.loginId
        );

        if (authMatch) {
          matchedAccounts.push({
            id: emp.id,
            name: emp.name,
            email: empEmail,
            role: emp.role,
            authUserId: authMatch.id,
            lastSignIn: authMatch.last_sign_in_at || 'Never',
            emailConfirmed: Boolean(authMatch.email_confirmed_at)
          });
        } else {
          missingInAuth.push({
            id: emp.id,
            name: emp.name,
            email: empEmail,
            role: emp.role,
            inDatabaseTable: inDb
          });
        }
      }

      if (missingInAuth.length > 0) {
        warnings.push(`${missingInAuth.length} employee account(s) exist in local/database state but are missing in Supabase Authentication (auth.users).`);
        recommendations.push('Click "Sync Staff to Supabase" in Staff Directory (with Service Role Key configured) to create these accounts in auth.users.');
      } else if (canQueryAuthUsers) {
        recommendations.push('All employee accounts are 100% in sync between public.employees and auth.users!');
      }

      return res.json({
        success: true,
        timestamp: new Date().toISOString(),
        isConfigured: true,
        hasServiceRoleKey,
        canQueryAuthUsers,
        localEmployeesCount: localEmployees.length,
        dbEmployeesCount: dbEmployees.length,
        authUsersCount: authUsers.length,
        syncedCount: matchedAccounts.length,
        unsyncedCount: missingInAuth.length,
        matchedAccounts,
        missingInAuth,
        warnings,
        recommendations
      });
    } catch (err: any) {
      console.error('Supabase diagnostic endpoint error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Sync / Create / Update / Delete User Credential in Supabase Auth & Database
  app.post('/api/supabase/admin/sync-user', async (req, res) => {
    try {
      const { 
        action = 'update', 
        employee, 
        newPassword, 
        supabaseUrl, 
        supabaseServiceKey,
        supabaseAnonKey 
      } = req.body;

      if (!employee || !employee.id) {
        return res.status(400).json({ error: 'employee data with valid ID is required' });
      }

      const client = getSupabaseAdminClient(
        supabaseUrl, 
        supabaseServiceKey || supabaseAnonKey
      );

      const email = (employee.email || `${employee.loginId || employee.id}@workshop.fixocar.com`).trim().toLowerCase();
      const password = (newPassword || employee.password || 'password123').trim();

      if (!client) {
        return res.json({
          success: true,
          authSynced: false,
          message: 'Saved in local engine. Note: Connect Supabase in settings to sync live to Supabase Auth.',
          employee
        });
      }

      let authSynced = false;
      let authUserId: string | null = null;
      let syncNotes = '';

      // Check if this is a delete action
      if (action === 'delete') {
        try {
          if (client.auth?.admin) {
            const { data: userList } = await client.auth.admin.listUsers();
            const existing = (userList?.users as any[])?.find((u: any) => u.email?.toLowerCase() === email || u.user_metadata?.employee_id === employee.id);
            if (existing) {
              await client.auth.admin.deleteUser(existing.id);
            }
          }
          await client.from('employees').delete().eq('id', employee.id);
          return res.json({ success: true, message: 'Deleted employee from Supabase Auth & Database' });
        } catch (delErr: any) {
          console.warn('Supabase delete warning:', delErr.message);
        }
      }

      // 1. Try Supabase Auth Admin User creation / password update
      if (client.auth?.admin) {
        try {
          const { data: userList } = await client.auth.admin.listUsers();
          const existingUser = (userList?.users as any[])?.find(
            (u: any) => u.email?.toLowerCase() === email || u.user_metadata?.employee_id === employee.id || u.user_metadata?.login_id === employee.loginId
          );

          if (existingUser) {
            // Update existing user in Supabase Auth
            const updatePayload: any = {
              user_metadata: {
                employee_id: employee.id,
                name: employee.name,
                role: employee.role,
                phone: employee.phone,
                specialized_team: employee.specializedTeam,
                workshop_id: employee.workshopId,
                workshop_name: employee.workshopName,
                city_id: employee.cityId,
                city_name: employee.cityName,
                login_id: employee.loginId,
                employment_type: employee.employmentType
              }
            };

            if (password) {
              updatePayload.password = password;
            }
            if (email && email !== existingUser.email) {
              updatePayload.email = email;
            }

            const { data: updated, error: updateErr } = await client.auth.admin.updateUserById(
              existingUser.id,
              updatePayload
            );

            if (updateErr) {
              console.warn('Supabase Auth update error:', updateErr);
              syncNotes = `Auth update: ${updateErr.message}`;
            } else {
              authSynced = true;
              authUserId = updated?.user?.id || existingUser.id;
              syncNotes = `Password & profile updated in Supabase Auth for ${email}`;
            }
          } else {
            // Create user in Supabase Auth
            const { data: created, error: createErr } = await client.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: {
                employee_id: employee.id,
                name: employee.name,
                role: employee.role,
                phone: employee.phone,
                specialized_team: employee.specializedTeam,
                workshop_id: employee.workshopId,
                workshop_name: employee.workshopName,
                city_id: employee.cityId,
                city_name: employee.cityName,
                login_id: employee.loginId,
                employment_type: employee.employmentType
              }
            });

            if (createErr) {
              console.warn('Supabase Auth create error:', createErr);
              syncNotes = `Auth create note: ${createErr.message}`;
            } else {
              authSynced = true;
              authUserId = created?.user?.id || null;
              syncNotes = `New user account created in Supabase Auth (${email})`;
            }
          }
        } catch (authAdminErr: any) {
          console.warn('Supabase Admin Auth skipped or unauthorized:', authAdminErr.message);
          syncNotes = `Database synced (Auth requires SUPABASE_SERVICE_ROLE_KEY)`;
        }
      }

      // 2. Upsert employee record into public.employees table
      try {
        const { error: dbErr } = await client.from('employees').upsert({
          id: employee.id,
          name: employee.name,
          role: employee.role,
          phone: employee.phone,
          email,
          specialized_team: employee.specializedTeam,
          status: employee.status || 'AVAILABLE',
          active_jobs_count: employee.activeJobsCount || 0,
          avatar_url: employee.avatarUrl,
          login_id: employee.loginId,
          password_hash: password,
          base_salary: employee.baseSalary || 0,
          employment_type: employee.employmentType || 'PAYROLL',
          city_id: employee.cityId,
          city_name: employee.cityName,
          workshop_id: employee.workshopId,
          workshop_name: employee.workshopName,
          updated_at: new Date().toISOString()
        });

        if (dbErr) {
          console.warn('Supabase employees table upsert warning:', dbErr);
        }
      } catch (dbErr: any) {
        console.warn('Supabase DB upsert error:', dbErr.message);
      }

      return res.json({
        success: true,
        authSynced,
        authUserId,
        message: syncNotes || 'Employee credentials synced with Supabase'
      });
    } catch (err: any) {
      console.error('Supabase sync user endpoint failure:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Verify credentials and authenticate against Supabase
  app.post('/api/supabase/auth/login', async (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ error: 'identifier and password are required' });
      }

      const cleanId = identifier.trim().toLowerCase();
      const cleanPass = password.trim();
      const client = getSupabaseAdminClient();

      if (client) {
        // First check in public.employees
        const { data: employees } = await client.from('employees').select('*');
        if (employees && employees.length > 0) {
          const matched = employees.find((e: any) => 
            (e.login_id && e.login_id.toLowerCase() === cleanId) ||
            (e.email && e.email.toLowerCase() === cleanId) ||
            (e.id && e.id.toLowerCase() === cleanId) ||
            (e.phone && e.phone.replace(/\D/g, '') === cleanId.replace(/\D/g, '') && cleanId.replace(/\D/g, '').length >= 10)
          );

          if (matched) {
            const expectedPass = matched.password_hash || matched.password || 'password123';
            if (cleanPass !== expectedPass) {
              return res.status(401).json({ success: false, error: 'Incorrect password for this staff account.' });
            }

            return res.json({
              success: true,
              source: 'SUPABASE_DB',
              user: {
                id: matched.id,
                name: matched.name,
                loginId: matched.login_id || matched.email?.split('@')[0],
                email: matched.email,
                phone: matched.phone,
                role: matched.role,
                userType: matched.employment_type === 'CONTRACT' ? 'CONTRACTOR' : (matched.role === 'SUPER_ADMIN' || matched.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE'),
                employeeId: matched.id,
                specializedTeam: matched.specialized_team,
                workshopId: matched.workshop_id,
                workshopName: matched.workshop_name,
                cityId: matched.city_id,
                cityName: matched.city_name,
                employmentType: matched.employment_type || 'PAYROLL',
                loggedInAt: new Date().toISOString()
              }
            });
          }
        }
      }

      return res.json({ success: false, error: 'No matching user found on Supabase backend' });
    } catch (err: any) {
      console.error('Supabase login endpoint error:', err);
      return res.status(500).json({ success: false, error: err.message });
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
