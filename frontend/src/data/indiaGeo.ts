/**
 * indiaGeo.ts — Pan-India geography dataset
 * 28 States + 8 Union Territories, with capital + major cities and coordinates.
 */

export interface City {
  id: string;
  name: string;
  lat: number;
  lon: number;
  state: string;
  type: "metro" | "state-capital" | "major" | "coastal" | "hill" | "industrial";
  population_m: number; // in millions
}

export interface StateRegion {
  id: string;
  name: string;
  short: string;
  zone: "North" | "South" | "East" | "West" | "Central" | "Islands" | "Northeast";
  capital: string;
  lat: number;
  lon: number;
  cities: City[];
}

const C = (
  name: string,
  state: string,
  lat: number,
  lon: number,
  type: City["type"],
  population_m: number
): City => ({
  id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  name,
  lat,
  lon,
  state,
  type,
  population_m,
});

export const INDIA_REGIONS: StateRegion[] = [
  // ── NORTH ──────────────────────────────────────────────────────────────
  {
    id: "DL", name: "Delhi (NCT)", short: "DL", zone: "North",
    capital: "New Delhi", lat: 28.6139, lon: 77.209,
    cities: [
      C("New Delhi", "Delhi (NCT)", 28.6139, 77.209, "state-capital", 32.9),
      C("Dwarka", "Delhi (NCT)", 28.5921, 77.046, "major", 1.1),
      C("Rohini", "Delhi (NCT)", 28.7495, 77.0565, "major", 1.8),
      C("Noida", "Delhi (NCT)", 28.5355, 77.391, "metro", 1.9),
      C("Ghaziabad", "Delhi (NCT)", 28.6692, 77.4538, "industrial", 2.4),
    ],
  },
  {
    id: "HR", name: "Haryana", short: "HR", zone: "North",
    capital: "Chandigarh", lat: 29.0588, lon: 76.0856,
    cities: [
      C("Chandigarh", "Haryana", 30.7333, 76.7794, "state-capital", 1.1),
      C("Gurugram", "Haryana", 28.4595, 77.0266, "metro", 3.1),
      C("Faridabad", "Haryana", 28.4089, 77.3178, "industrial", 2.0),
      C("Panipat", "Haryana", 29.3909, 76.9635, "major", 0.6),
      C("Ambala", "Haryana", 30.3782, 76.7767, "major", 0.2),
    ],
  },
  {
    id: "PB", name: "Punjab", short: "PB", zone: "North",
    capital: "Chandigarh", lat: 31.1471, lon: 75.3414,
    cities: [
      C("Ludhiana", "Punjab", 30.9010, 75.8573, "major", 1.8),
      C("Amritsar", "Punjab", 31.6340, 74.8723, "major", 1.7),
      C("Jalandhar", "Punjab", 31.3260, 75.5762, "major", 0.9),
      C("Patiala", "Punjab", 30.3398, 76.3869, "major", 0.6),
      C("Bathinda", "Punjab", 30.2110, 74.9455, "major", 0.3),
    ],
  },
  {
    id: "JK", name: "Jammu & Kashmir", short: "JK", zone: "North",
    capital: "Srinagar", lat: 34.0837, lon: 74.7973,
    cities: [
      C("Srinagar", "Jammu & Kashmir", 34.0837, 74.7973, "state-capital", 1.3),
      C("Jammu", "Jammu & Kashmir", 32.7266, 74.8570, "major", 1.5),
      C("Anantnag", "Jammu & Kashmir", 33.7311, 75.1487, "major", 0.2),
      C("Baramulla", "Jammu & Kashmir", 34.2090, 74.3436, "hill", 0.3),
    ],
  },
  {
    id: "LA", name: "Ladakh", short: "LA", zone: "North",
    capital: "Leh", lat: 34.1526, lon: 77.5771,
    cities: [
      C("Leh", "Ladakh", 34.1526, 77.5771, "state-capital", 0.3),
      C("Kargil", "Ladakh", 34.5539, 76.1349, "hill", 0.02),
    ],
  },
  {
    id: "HP", name: "Himachal Pradesh", short: "HP", zone: "North",
    capital: "Shimla", lat: 31.1048, lon: 77.1734,
    cities: [
      C("Shimla", "Himachal Pradesh", 31.1048, 77.1734, "state-capital", 0.2),
      C("Dharamshala", "Himachal Pradesh", 32.2190, 76.3234, "hill", 0.15),
      C("Solan", "Himachal Pradesh", 30.9045, 77.0967, "hill", 0.08),
      C("Mandi", "Himachal Pradesh", 31.7085, 76.9316, "hill", 0.06),
    ],
  },
  {
    id: "UK", name: "Uttarakhand", short: "UK", zone: "North",
    capital: "Dehradun", lat: 30.3165, lon: 78.0322,
    cities: [
      C("Dehradun", "Uttarakhand", 30.3165, 78.0322, "state-capital", 0.8),
      C("Haridwar", "Uttarakhand", 29.9457, 78.1642, "major", 0.4),
      C("Haldwani", "Uttarakhand", 29.2183, 79.5130, "major", 0.3),
      C("Rishikesh", "Uttarakhand", 30.0869, 78.2676, "hill", 0.1),
      C("Rudrapur", "Uttarakhand", 28.9845, 79.4141, "industrial", 0.15),
    ],
  },
  {
    id: "UP", name: "Uttar Pradesh", short: "UP", zone: "North",
    capital: "Lucknow", lat: 26.8467, lon: 80.9462,
    cities: [
      C("Lucknow", "Uttar Pradesh", 26.8467, 80.9462, "state-capital", 3.9),
      C("Kanpur", "Uttar Pradesh", 26.4499, 80.3319, "metro", 3.2),
      C("Varanasi", "Uttar Pradesh", 25.3176, 82.9739, "major", 1.3),
      C("Agra", "Uttar Pradesh", 27.1767, 78.0081, "major", 2.0),
      C("Prayagraj", "Uttar Pradesh", 25.4358, 81.8463, "major", 1.6),
      C("Meerut", "Uttar Pradesh", 28.9845, 77.7064, "major", 1.4),
      C("Bareilly", "Uttar Pradesh", 28.3670, 79.4304, "major", 1.0),
      C("Aligarh", "Uttar Pradesh", 27.8974, 78.0880, "major", 0.9),
      C("Ayodhya", "Uttar Pradesh", 26.7922, 82.1998, "major", 0.6),
    ],
  },
  {
    id: "RJ", name: "Rajasthan", short: "RJ", zone: "North",
    capital: "Jaipur", lat: 26.9124, lon: 75.7873,
    cities: [
      C("Jaipur", "Rajasthan", 26.9124, 75.7873, "state-capital", 4.1),
      C("Jodhpur", "Rajasthan", 26.2389, 73.0243, "major", 1.7),
      C("Udaipur", "Rajasthan", 24.5854, 73.7125, "major", 0.9),
      C("Kota", "Rajasthan", 25.2138, 75.8648, "industrial", 1.0),
      C("Ajmer", "Rajasthan", 26.4499, 74.6399, "major", 0.6),
      C("Bikaner", "Rajasthan", 28.0229, 73.3119, "major", 0.3),
    ],
  },

  {
    id: "CH", name: "Chandigarh", short: "CH", zone: "North",
    capital: "Chandigarh", lat: 30.7333, lon: 76.7794,
    cities: [C("Chandigarh", "Chandigarh", 30.7333, 76.7794, "state-capital", 1.15)],
  },

  // ── WEST ───────────────────────────────────────────────────────────────
  {
    id: "GJ", name: "Gujarat", short: "GJ", zone: "West",
    capital: "Gandhinagar", lat: 22.2587, lon: 71.1924,
    cities: [
      C("Ahmedabad", "Gujarat", 23.0225, 72.5714, "metro", 8.5),
      C("Surat", "Gujarat", 21.1702, 72.8311, "coastal", 7.5),
      C("Vadodara", "Gujarat", 22.3072, 73.1812, "industrial", 2.2),
      C("Rajkot", "Gujarat", 22.3039, 70.8022, "major", 1.6),
      C("Bhavnagar", "Gujarat", 21.7645, 72.1519, "coastal", 0.6),
      C("Jamnagar", "Gujarat", 22.4707, 70.0577, "coastal", 0.5),
      C("Gandhinagar", "Gujarat", 23.2156, 72.6369, "state-capital", 0.3),
    ],
  },
  {
    id: "MH", name: "Maharashtra", short: "MH", zone: "West",
    capital: "Mumbai", lat: 19.0760, lon: 72.8777,
    cities: [
      C("Mumbai", "Maharashtra", 19.0760, 72.8777, "coastal", 21.3),
      C("Pune", "Maharashtra", 18.5204, 73.8567, "metro", 7.4),
      C("Nagpur", "Maharashtra", 21.1458, 79.0882, "major", 3.0),
      C("Nashik", "Maharashtra", 19.9975, 73.7898, "major", 1.9),
      C("Aurangabad", "Maharashtra", 19.8762, 75.3433, "major", 1.6),
      C("Kolhapur", "Maharashtra", 16.7050, 74.2433, "major", 0.7),
      C("Solapur", "Maharashtra", 17.6599, 75.9064, "major", 0.7),
    ],
  },
  {
    id: "MP", name: "Madhya Pradesh", short: "MP", zone: "Central",
    capital: "Bhopal", lat: 23.2599, lon: 77.4126,
    cities: [
      C("Bhopal", "Madhya Pradesh", 23.2599, 77.4126, "state-capital", 2.4),
      C("Indore", "Madhya Pradesh", 22.7196, 75.8577, "metro", 3.3),
      C("Jabalpur", "Madhya Pradesh", 23.1815, 79.9864, "major", 1.3),
      C("Gwalior", "Madhya Pradesh", 26.2183, 78.1828, "major", 1.1),
      C("Ujjain", "Madhya Pradesh", 23.1793, 75.7849, "major", 0.5),
    ],
  },
  {
    id: "GA", name: "Goa", short: "GA", zone: "West",
    capital: "Panaji", lat: 15.4909, lon: 73.8278,
    cities: [
      C("Panaji", "Goa", 15.4909, 73.8278, "state-capital", 0.05),
      C("Margao", "Goa", 15.2832, 73.9862, "coastal", 0.04),
      C("Vasco da Gama", "Goa", 15.3950, 73.8150, "coastal", 0.04),
    ],
  },
  {
    id: "DD", name: "Dadra & Nagar Haveli and Daman & Diu", short: "DD", zone: "West",
    capital: "Daman", lat: 20.3974, lon: 72.8328,
    cities: [
      C("Daman", "Dadra & Nagar Haveli and Daman & Diu", 20.3974, 72.8328, "coastal", 0.06),
      C("Diu", "Dadra & Nagar Haveli and Daman & Diu", 20.7144, 70.9874, "coastal", 0.03),
      C("Silvassa", "Dadra & Nagar Haveli and Daman & Diu", 20.2738, 72.9967, "industrial", 0.06),
    ],
  },

  // ── CENTRAL ────────────────────────────────────────────────────────────
  {
    id: "CG", name: "Chhattisgarh", short: "CG", zone: "Central",
    capital: "Raipur", lat: 21.2514, lon: 81.6296,
    cities: [
      C("Raipur", "Chhattisgarh", 21.2514, 81.6296, "state-capital", 1.4),
      C("Bhilai", "Chhattisgarh", 21.2090, 81.3790, "industrial", 0.6),
      C("Bilaspur", "Chhattisgarh", 22.0797, 82.1391, "major", 0.5),
      C("Korba", "Chhattisgarh", 22.3595, 82.7501, "industrial", 0.4),
      C("Jagdalpur", "Chhattisgarh", 19.0925, 82.0141, "major", 0.3),
    ],
  },
  {
    id: "TS", name: "Telangana", short: "TS", zone: "South",
    capital: "Hyderabad", lat: 17.3850, lon: 78.4867,
    cities: [
      C("Hyderabad", "Telangana", 17.3850, 78.4867, "state-capital", 10.5),
      C("Warangal", "Telangana", 17.9689, 79.5941, "major", 0.8),
      C("Nizamabad", "Telangana", 18.6725, 78.0940, "major", 0.4),
      C("Ramagundam", "Telangana", 18.7557, 79.4740, "industrial", 0.3),
    ],
  },

  // ── EAST ───────────────────────────────────────────────────────────────
  {
    id: "BR", name: "Bihar", short: "BR", zone: "East",
    capital: "Patna", lat: 25.5941, lon: 85.1376,
    cities: [
      C("Patna", "Bihar", 25.5941, 85.1376, "state-capital", 2.5),
      C("Gaya", "Bihar", 24.7955, 85.0002, "major", 0.5),
      C("Bhagalpur", "Bihar", 25.2425, 86.9842, "major", 0.4),
      C("Muzaffarpur", "Bihar", 26.1209, 85.3647, "major", 0.5),
      C("Darbhanga", "Bihar", 26.1542, 85.8918, "major", 0.4),
    ],
  },
  {
    id: "JH", name: "Jharkhand", short: "JH", zone: "East",
    capital: "Ranchi", lat: 23.3441, lon: 85.3096,
    cities: [
      C("Ranchi", "Jharkhand", 23.3441, 85.3096, "state-capital", 1.1),
      C("Jamshedpur", "Jharkhand", 22.8046, 86.2029, "industrial", 1.1),
      C("Dhanbad", "Jharkhand", 23.7957, 86.4304, "industrial", 0.6),
      C("Bokaro", "Jharkhand", 23.6693, 86.1511, "industrial", 0.5),
      C("Deoghar", "Jharkhand", 24.4823, 86.6963, "major", 0.2),
    ],
  },
  {
    id: "WB", name: "West Bengal", short: "WB", zone: "East",
    capital: "Kolkata", lat: 22.5726, lon: 88.3639,
    cities: [
      C("Kolkata", "West Bengal", 22.5726, 88.3639, "coastal", 15.1),
      C("Howrah", "West Bengal", 22.5958, 88.2636, "major", 1.1),
      C("Durgapur", "West Bengal", 23.5204, 87.3119, "industrial", 0.7),
      C("Siliguri", "West Bengal", 26.7271, 88.3953, "major", 0.6),
      C("Asansol", "West Bengal", 23.6739, 86.9524, "industrial", 0.5),
      C("Darjeeling", "West Bengal", 27.0410, 88.2663, "hill", 0.15),
    ],
  },
  {
    id: "OD", name: "Odisha", short: "OD", zone: "East",
    capital: "Bhubaneswar", lat: 20.9517, lon: 85.0985,
    cities: [
      C("Bhubaneswar", "Odisha", 20.2961, 85.8245, "state-capital", 0.9),
      C("Cuttack", "Odisha", 20.4625, 85.8828, "major", 0.6),
      C("Rourkela", "Odisha", 22.2604, 84.8536, "industrial", 0.4),
      C("Puri", "Odisha", 19.8135, 85.8312, "coastal", 0.2),
      C("Sambalpur", "Odisha", 21.4669, 83.9756, "major", 0.3),
    ],
  },
  {
    id: "PY", name: "Puducherry", short: "PY", zone: "South",
    capital: "Puducherry", lat: 11.9416, lon: 79.8083,
    cities: [
      C("Puducherry", "Puducherry", 11.9416, 79.8083, "coastal", 0.3),
      C("Karaikal", "Puducherry", 10.9254, 79.8380, "coastal", 0.07),
      C("Mahe", "Puducherry", 11.9969, 75.2669, "coastal", 0.04),
    ],
  },

  // ── SOUTH ──────────────────────────────────────────────────────────────
  {
    id: "KA", name: "Karnataka", short: "KA", zone: "South",
    capital: "Bengaluru", lat: 15.3173, lon: 75.7139,
    cities: [
      C("Bengaluru", "Karnataka", 12.9716, 77.5946, "metro", 13.6),
      C("Mysuru", "Karnataka", 12.2958, 76.6394, "major", 0.9),
      C("Hubballi", "Karnataka", 15.3647, 75.1240, "industrial", 0.9),
      C("Mangaluru", "Karnataka", 12.9141, 74.8560, "coastal", 0.5),
      C("Belagavi", "Karnataka", 15.8497, 74.4977, "major", 0.5),
      C("Kalaburagi", "Karnataka", 17.3297, 76.8343, "major", 0.3),
    ],
  },
  {
    id: "AP", name: "Andhra Pradesh", short: "AP", zone: "South",
    capital: "Amaravati", lat: 16.5062, lon: 80.6480,
    cities: [
      C("Visakhapatnam", "Andhra Pradesh", 17.6868, 83.2185, "coastal", 1.8),
      C("Vijayawada", "Andhra Pradesh", 16.5062, 80.6480, "major", 1.8),
      C("Guntur", "Andhra Pradesh", 16.3067, 80.4365, "major", 0.7),
      C("Nellore", "Andhra Pradesh", 14.4426, 79.9865, "coastal", 0.6),
      C("Tirupati", "Andhra Pradesh", 13.6288, 79.4192, "major", 0.3),
      C("Amaravati", "Andhra Pradesh", 16.5726, 80.3520, "state-capital", 0.2),
    ],
  },
  {
    id: "KL", name: "Kerala", short: "KL", zone: "South",
    capital: "Thiruvananthapuram", lat: 8.5241, lon: 76.9366,
    cities: [
      C("Thiruvananthapuram", "Kerala", 8.5241, 76.9366, "coastal", 0.9),
      C("Kochi", "Kerala", 9.9312, 76.2673, "coastal", 2.1),
      C("Kozhikode", "Kerala", 11.2588, 75.7804, "coastal", 0.95),
      C("Thrissur", "Kerala", 10.5276, 76.2144, "major", 0.3),
      C("Kollam", "Kerala", 8.8932, 76.6141, "coastal", 0.4),
    ],
  },
  {
    id: "TN", name: "Tamil Nadu", short: "TN", zone: "South",
    capital: "Chennai", lat: 11.1271, lon: 78.6569,
    cities: [
      C("Chennai", "Tamil Nadu", 13.0827, 80.2707, "coastal", 11.5),
      C("Coimbatore", "Tamil Nadu", 11.0168, 76.9558, "industrial", 1.1),
      C("Madurai", "Tamil Nadu", 9.9252, 78.1198, "major", 1.0),
      C("Tiruchirappalli", "Tamil Nadu", 10.7905, 78.7047, "major", 0.4),
      C("Salem", "Tamil Nadu", 11.6643, 78.1460, "major", 0.4),
      C("Tirunelveli", "Tamil Nadu", 8.7139, 77.7567, "major", 0.25),
    ],
  },

  // ── NORTHEAST ──────────────────────────────────────────────────────────
  {
    id: "AS", name: "Assam", short: "AS", zone: "Northeast",
    capital: "Dispur", lat: 26.2006, lon: 92.9376,
    cities: [
      C("Guwahati", "Assam", 26.1445, 91.7362, "state-capital", 1.2),
      C("Silchar", "Assam", 24.8333, 92.7789, "major", 0.5),
      C("Dibrugarh", "Assam", 27.4728, 94.9120, "major", 0.15),
      C("Jorhat", "Assam", 26.7509, 94.2037, "major", 0.15),
      C("North Lakhimpur", "Assam", 27.2000, 94.2167, "major", 0.02),
    ],
  },
  {
    id: "ML", name: "Meghalaya", short: "ML", zone: "Northeast",
    capital: "Shillong", lat: 25.5788, lon: 91.8933,
    cities: [
      C("Shillong", "Meghalaya", 25.5788, 91.8933, "state-capital", 0.15),
      C("Tura", "Meghalaya", 25.5171, 90.2024, "hill", 0.04),
      C("Jowai", "Meghalaya", 25.2425, 92.2263, "hill", 0.02),
    ],
  },
  {
    id: "AR", name: "Arunachal Pradesh", short: "AR", zone: "Northeast",
    capital: "Itanagar", lat: 27.0844, lon: 93.6053,
    cities: [
      C("Itanagar", "Arunachal Pradesh", 27.0844, 93.6053, "state-capital", 0.15),
      C("Tawang", "Arunachal Pradesh", 27.5860, 91.8560, "hill", 0.01),
      C("Pasighat", "Arunachal Pradesh", 28.0665, 95.3438, "hill", 0.02),
    ],
  },
  {
    id: "NL", name: "Nagaland", short: "NL", zone: "Northeast",
    capital: "Kohima", lat: 25.6751, lon: 94.1086,
    cities: [C("Kohima", "Nagaland", 25.6751, 94.1086, "state-capital", 0.15), C("Dimapur", "Nagaland", 25.9060, 93.7268, "major", 0.15)],
  },
  {
    id: "MN", name: "Manipur", short: "MN", zone: "Northeast",
    capital: "Imphal", lat: 24.8170, lon: 93.9368,
    cities: [C("Imphal", "Manipur", 24.8170, 93.9368, "state-capital", 0.3), C("Thoubal", "Manipur", 24.5047, 93.5813, "major", 0.04)],
  },
  {
    id: "MZ", name: "Mizoram", short: "MZ", zone: "Northeast",
    capital: "Aizawl", lat: 23.7271, lon: 92.7176,
    cities: [C("Aizawl", "Mizoram", 23.7271, 92.7176, "state-capital", 0.13), C("Lunglei", "Mizoram", 23.7450, 92.5667, "hill", 0.02)],
  },
  {
    id: "TR", name: "Tripura", short: "TR", zone: "Northeast",
    capital: "Agartala", lat: 23.8315, lon: 91.2868,
    cities: [C("Agartala", "Tripura", 23.8315, 91.2868, "state-capital", 0.4), C("Udaipur", "Tripura", 23.5300, 91.5620, "major", 0.03)],
  },
  {
    id: "SK", name: "Sikkim", short: "SK", zone: "Northeast",
    capital: "Gangtok", lat: 27.3314, lon: 88.6138,
    cities: [C("Gangtok", "Sikkim", 27.3314, 88.6138, "state-capital", 0.08), C("Namchi", "Sikkim", 27.1700, 88.3700, "hill", 0.01)],
  },

  // ── ISLANDS ────────────────────────────────────────────────────────────
  {
    id: "AN", name: "Andaman & Nicobar Islands", short: "AN", zone: "Islands",
    capital: "Port Blair", lat: 11.7401, lon: 92.6586,
    cities: [
      C("Port Blair", "Andaman & Nicobar Islands", 11.7401, 92.6586, "coastal", 0.14),
      C("Diglipur", "Andaman & Nicobar Islands", 12.9833, 92.9333, "coastal", 0.01),
    ],
  },
  {
    id: "LD", name: "Lakshadweep", short: "LD", zone: "Islands",
    capital: "Kavaratti", lat: 10.5669, lon: 72.6420,
    cities: [C("Kavaratti", "Lakshadweep", 10.5669, 72.6420, "coastal", 0.01), C("Agatti", "Lakshadweep", 10.8557, 72.1820, "coastal", 0.008)],
  },
];

export const ALL_CITIES: City[] = INDIA_REGIONS.flatMap((r) => r.cities);

export const REGION_COUNT = INDIA_REGIONS.length;
export const CITY_COUNT = ALL_CITIES.length;

/**
 * Bounding box of the official Survey of India national boundary (mainland + island territories),
 * derived from the official Survey of India map in public/geo/india-outline.geojson.
 * See tools/build_india_geo.py — regenerate after updating boundary data.
 */
export const INDIA_BOUNDS: [number, number, number, number] = [68.15, 6.7, 97.45, 37.15];

/**
 * Bounds formatted specifically for fitBounds to guarantee all of India (Kashmir to Kanyakumari,
 * Gujarat to Arunachal Pradesh, Lakshadweep and Andaman & Nicobar) fits cleanly inside the map stage.
 */
export const INDIA_FIT_BOUNDS: [[number, number], [number, number]] = [
  [67.8, 6.2],   // Southwest: Lakshadweep, Kanyakumari, Indira Point, Gujarat coast
  [97.8, 37.4],  // Northeast: Kashmir, Ladakh, Arunachal Pradesh, Assam
];

/**
 * Generous regional bounding box allowing smooth panning, zooming, and full-country centering
 * without MapLibre clamping zoom or cutting off the southern peninsula.
 */
export const INDIA_REGIONAL_MAX_BOUNDS: [[number, number], [number, number]] = [
  [55.0, 0.0],
  [108.0, 42.0],
];

/** Aggregate clusters for national overview. */
export interface ZoneCluster {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
  states: string[];
}

export const ZONE_CLUSTERS: ZoneCluster[] = [
  { id: "NORTH", name: "North & Himalayan Belt", center: [76.5, 31.5], zoom: 5.8, states: ["DL", "HR", "PB", "JK", "LA", "HP", "UK", "UP", "RJ", "CH"] },
  { id: "WEST", name: "Western India & Ghats", center: [73.4, 20.5], zoom: 6.0, states: ["GJ", "MH", "MP", "DD", "GA"] },
  { id: "CENTRAL", name: "Central India", center: [81.5, 22.5], zoom: 5.8, states: ["CG", "TS"] },
  { id: "EAST", name: "Eastern India & Odisha", center: [86.5, 22.0], zoom: 5.8, states: ["BR", "JH", "WB", "OD", "PY"] },
  { id: "SOUTH", name: "Southern Peninsula", center: [77.0, 12.0], zoom: 5.8, states: ["KA", "AP", "KL", "TN"] },
  { id: "NORTHEAST", name: "North-East Hill Tracts", center: [94.0, 26.5], zoom: 5.4, states: ["AS", "AR", "NL", "MN", "MZ", "TR", "SK", "ML"] },
  { id: "ISLANDS", name: "Islands (A&N + Lakshadweep)", center: [82.0, 11.0], zoom: 4.2, states: ["AN", "LD"] },
];

export function cityById(id: string): City | undefined {
  return ALL_CITIES.find((c) => c.id === id);
}
