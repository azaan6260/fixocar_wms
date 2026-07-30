export interface StandardHSN {
  code: string;
  description: string;
  defaultGstRate: number; // e.g. 28, 18, 12, 5
  type: 'PART' | 'LABOR' | 'CONSUMABLE';
}

export const STANDARD_HSN_CODES: StandardHSN[] = [
  // Services & Labor (SAC)
  { code: '998714', description: 'Maintenance & repair services of motor vehicles (General Repairs & Service)', defaultGstRate: 18, type: 'LABOR' },
  { code: '998713', description: 'Specialized car washing, polishing, vacuuming & detailing services', defaultGstRate: 18, type: 'LABOR' },
  { code: '998729', description: 'Motor vehicle body repair, denting, spray painting & electrical works', defaultGstRate: 18, type: 'LABOR' },
  { code: '998313', description: 'Technical testing, inspection, diagnostic scanning & PDI certification', defaultGstRate: 18, type: 'LABOR' },

  // Spare Parts (HSN)
  { code: '8708', description: 'Motor vehicle spare parts & mechanical assemblies (General Parts)', defaultGstRate: 28, type: 'PART' },
  { code: '8708 93', description: 'Clutches, brake pads, brake discs, linings & brake assemblies', defaultGstRate: 28, type: 'PART' },
  { code: '8708 80', description: 'Suspension systems, shock absorbers, struts & steering linkages', defaultGstRate: 28, type: 'PART' },
  { code: '8708 29', description: 'Body panels, bumpers, grilles, fenders, doors & body parts', defaultGstRate: 28, type: 'PART' },
  { code: '8708 40', description: 'Gearboxes, clutch plates, torque converters & transmission parts', defaultGstRate: 28, type: 'PART' },
  { code: '4011', description: 'New pneumatic tires, inner tubes & wheel accessories', defaultGstRate: 28, type: 'PART' },
  { code: '8507', description: 'Automotive lead-acid batteries & electric accumulators', defaultGstRate: 28, type: 'PART' },
  { code: '8511', description: 'Ignition coils, spark plugs, alternators, starter motors & fuses', defaultGstRate: 28, type: 'PART' },
  { code: '7007', description: 'Safety toughened glass, windshields, door glasses & mirrors', defaultGstRate: 28, type: 'PART' },
  { code: '8421', description: 'Oil filters, air filters, cabin pollen filters & fuel filters', defaultGstRate: 18, type: 'PART' },
  { code: '2710', description: 'Engine oils, gear oils, hydraulic brake fluids & coolants', defaultGstRate: 18, type: 'CONSUMABLE' },
  { code: '3926', description: 'Plastic automotive accessories, mats, clips & interior trims', defaultGstRate: 18, type: 'PART' },
  { code: '3208', description: 'Automotive paints, lacquers, primers, thinners & clear coats', defaultGstRate: 18, type: 'CONSUMABLE' },
];

export const GST_RATES = [28, 18, 12, 5, 0];

export const DEFAULT_WORKSHOP_GSTIN = "27AABCU9603R1ZM"; // AutoCraft Motors India Pvt Ltd
export const DEFAULT_CARS24_GSTIN = "07AABCC8821R1Z5"; // Cars24 Services India Pvt Ltd

export function getDefaultHSNForCategory(category: string, isPart: boolean): { code: string; rate: number } {
  if (isPart) {
    if (category === 'ENGINE' || category === 'SUSPENSION') return { code: '8708', rate: 28 };
    if (category === 'ELECTRICAL') return { code: '8511', rate: 28 };
    if (category === 'TYRE_WORK' || category === 'ALIGNMENT_BALANCING') return { code: '4011', rate: 28 };
    if (category === 'WASHING') return { code: '2710', rate: 18 };
    return { code: '8708', rate: 28 };
  } else {
    if (category === 'WASHING') return { code: '998713', rate: 18 };
    if (category === 'BODYWORK' || category === 'PAINTING') return { code: '998729', rate: 18 };
    if (category === 'INSPECTION') return { code: '998313', rate: 18 };
    return { code: '998714', rate: 18 };
  }
}

export function numberToWordsIndian(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'Rupees Zero Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  }

  const rounded = Math.round(num);
  return 'Rupees ' + inWords(rounded) + ' Only';
}
