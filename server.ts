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
