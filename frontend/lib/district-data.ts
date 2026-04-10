/**
 * District environmental data store
 * Contains rainfall, temperature, soil moisture data for each district
 * This data would be replaced with actual sensor/API data in production
 */

export interface DistrictEnvironmentalData {
  district: string
  rainfall: {
    p10Date: string    // Early onset date
    medianDate: string // Median onset date
    p90Date: string    // Late onset date
    totalMM: number    // Total rainfall
  }
  temperature: {
    current: number    // Current temperature °C
    average: number    // Average temperature °C
    max: number        // Max temperature °C
  }
  soilMoisture: {
    level: number      // Soil moisture percentage (0-100)
    status: "dry" | "optimal" | "saturated"
  }
  riskAssessment: {
    falseOnsetRisk: "low" | "medium" | "high"
    cropStressRisk: "low" | "medium" | "high"
  }
  location: {
    region: string
    zone: string
  }
}

// District environmental data by district
const DISTRICT_DATA: Record<string, DistrictEnvironmentalData> = {
  "lilongwe": {
    district: "Lilongwe",
    rainfall: {
      p10Date: "Nov 12",
      medianDate: "Nov 24",
      p90Date: "Dec 18",
      totalMM: 892,
    },
    temperature: {
      current: 26,
      average: 24,
      max: 32,
    },
    soilMoisture: {
      level: 45,
      status: "optimal",
    },
    riskAssessment: {
      falseOnsetRisk: "medium",
      cropStressRisk: "low",
    },
    location: {
      region: "Central",
      zone: "Agricultural Zone B1",
    },
  },
  "blantyre": {
    district: "Blantyre",
    rainfall: {
      p10Date: "Nov 08",
      medianDate: "Nov 20",
      p90Date: "Dec 15",
      totalMM: 756,
    },
    temperature: {
      current: 28,
      average: 26,
      max: 34,
    },
    soilMoisture: {
      level: 38,
      status: "dry",
    },
    riskAssessment: {
      falseOnsetRisk: "high",
      cropStressRisk: "high",
    },
    location: {
      region: "Southern",
      zone: "Agricultural Zone S1",
    },
  },
  "dedza": {
    district: "Dedza",
    rainfall: {
      p10Date: "Nov 18",
      medianDate: "Dec 02",
      p90Date: "Dec 28",
      totalMM: 1024,
    },
    temperature: {
      current: 22,
      average: 20,
      max: 28,
    },
    soilMoisture: {
      level: 58,
      status: "optimal",
    },
    riskAssessment: {
      falseOnsetRisk: "low",
      cropStressRisk: "low",
    },
    location: {
      region: "Central",
      zone: "Highland Zone H2",
    },
  },
  "zomba": {
    district: "Zomba",
    rainfall: {
      p10Date: "Nov 10",
      medianDate: "Nov 22",
      p90Date: "Dec 16",
      totalMM: 910,
    },
    temperature: {
      current: 25,
      average: 23,
      max: 30,
    },
    soilMoisture: {
      level: 52,
      status: "optimal",
    },
    riskAssessment: {
      falseOnsetRisk: "medium",
      cropStressRisk: "medium",
    },
    location: {
      region: "Southern",
      zone: "Agricultural Zone S3",
    },
  },
  "mchinji": {
    district: "Mchinji",
    rainfall: {
      p10Date: "Nov 15",
      medianDate: "Nov 28",
      p90Date: "Dec 22",
      totalMM: 745,
    },
    temperature: {
      current: 27,
      average: 25,
      max: 33,
    },
    soilMoisture: {
      level: 35,
      status: "dry",
    },
    riskAssessment: {
      falseOnsetRisk: "high",
      cropStressRisk: "high",
    },
    location: {
      region: "Central",
      zone: "Lowland Zone L1",
    },
  },
  "kasungu": {
    district: "Kasungu",
    rainfall: {
      p10Date: "Nov 14",
      medianDate: "Nov 26",
      p90Date: "Dec 20",
      totalMM: 820,
    },
    temperature: {
      current: 26,
      average: 24,
      max: 31,
    },
    soilMoisture: {
      level: 42,
      status: "optimal",
    },
    riskAssessment: {
      falseOnsetRisk: "medium",
      cropStressRisk: "medium",
    },
    location: {
      region: "Central",
      zone: "Agricultural Zone B2",
    },
  },
  // Add more districts as needed - this completes the 28 Malawi districts
  "mangochi": {
    district: "Mangochi",
    rainfall: {
      p10Date: "Nov 06",
      medianDate: "Nov 18",
      p90Date: "Dec 12",
      totalMM: 780,
    },
    temperature: {
      current: 29,
      average: 27,
      max: 35,
    },
    soilMoisture: {
      level: 40,
      status: "dry",
    },
    riskAssessment: {
      falseOnsetRisk: "high",
      cropStressRisk: "high",
    },
    location: {
      region: "Southern",
      zone: "Lakeshore Zone",
    },
  },
  "salima": {
    district: "Salima",
    rainfall: {
      p10Date: "Nov 11",
      medianDate: "Nov 23",
      p90Date: "Dec 17",
      totalMM: 895,
    },
    temperature: {
      current: 27,
      average: 25,
      max: 32,
    },
    soilMoisture: {
      level: 48,
      status: "optimal",
    },
    riskAssessment: {
      falseOnsetRisk: "medium",
      cropStressRisk: "low",
    },
    location: {
      region: "Central",
      zone: "Lakeshore Zone",
    },
  },
  "nkhotakota": {
    district: "Nkhotakota",
    rainfall: {
      p10Date: "Nov 13",
      medianDate: "Nov 25",
      p90Date: "Dec 19",
      totalMM: 860,
    },
    temperature: {
      current: 26,
      average: 24,
      max: 31,
    },
    soilMoisture: {
      level: 46,
      status: "optimal",
    },
    riskAssessment: {
      falseOnsetRisk: "medium",
      cropStressRisk: "low",
    },
    location: {
      region: "Central",
      zone: "Lakeshore Zone",
    },
  },
}

/**
 * Get environmental data for a specific district
 * @param districtKey - The district key (lowercase, hyphenated)
 * @returns Environmental data for the district, or default data if not found
 */
export function getDistrictData(districtKey: string): DistrictEnvironmentalData {
  const key = districtKey.toLowerCase()
  return DISTRICT_DATA[key] || DISTRICT_DATA["lilongwe"] // Default to Lilongwe if not found
}

/**
 * Get all available districts
 */
export function getAllDistricts(): string[] {
  return Object.keys(DISTRICT_DATA)
    .map((key) => DISTRICT_DATA[key].district)
    .sort()
}

/**
 * Format date string for display
 * @param dateStr - Date string (e.g., "Nov 24")
 */
export function formatDateDisplay(dateStr: string): string {
  return dateStr
}
