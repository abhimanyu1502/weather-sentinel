/**
 * landmarks.ts — Strategic national infrastructure sites monitored for severe storm impact.
 *
 * Sourced from IMD / NDMA nowcast priority assets (Airports, Railway terminals,
 * Commercial centres, Himalayan hill stations).
 * Solves PRD Gap F10.
 */

export interface StrategicLandmark {
  name: string;
  lat: number;
  lon: number;
  category: "Airport" | "Railway" | "Commercial" | "Urban" | "Hill Station" | string;
  region: string;
  alert_radius_km: number;
}

export const STRATEGIC_LANDMARKS: StrategicLandmark[] = [
  // Western India & Ghats
  { name: "Mumbai Airport (CSMIA)", lat: 19.0896, lon: 72.8656, category: "Airport", region: "WEST_INDIA", alert_radius_km: 12.0 },
  { name: "Mumbai Central Station", lat: 18.9692, lon: 72.8247, category: "Railway", region: "WEST_INDIA", alert_radius_km: 8.0 },
  { name: "BKC Commercial Hub", lat: 19.0660, lon: 72.8650, category: "Commercial", region: "WEST_INDIA", alert_radius_km: 8.0 },
  { name: "Thane City Junction", lat: 19.2183, lon: 72.9781, category: "Urban", region: "WEST_INDIA", alert_radius_km: 12.0 },
  { name: "Pune Central Station", lat: 18.5289, lon: 73.8744, category: "Railway", region: "WEST_INDIA", alert_radius_km: 12.0 },
  { name: "Surat Airport", lat: 21.1139, lon: 72.7419, category: "Airport", region: "WEST_INDIA", alert_radius_km: 12.0 },
  { name: "Ahmedabad Sardar Patel Airport", lat: 23.0772, lon: 72.6347, category: "Airport", region: "WEST_INDIA", alert_radius_km: 12.0 },
  { name: "Goa Mopa Airport", lat: 15.7583, lon: 73.8683, category: "Airport", region: "WEST_INDIA", alert_radius_km: 10.0 },

  // Northern India & Himalayan Belt
  { name: "Delhi IGI Airport (DEL)", lat: 28.5562, lon: 77.1000, category: "Airport", region: "NORTH_INDIA", alert_radius_km: 15.0 },
  { name: "New Delhi Railway Station", lat: 28.6429, lon: 77.2195, category: "Railway", region: "NORTH_INDIA", alert_radius_km: 10.0 },
  { name: "Noida Cyber City", lat: 28.5355, lon: 77.3910, category: "Commercial", region: "NORTH_INDIA", alert_radius_km: 10.0 },
  { name: "Dehradun Jolly Grant Airport", lat: 30.1897, lon: 78.1803, category: "Airport", region: "NORTH_INDIA", alert_radius_km: 14.0 },
  { name: "Kedarnath Valley", lat: 30.7346, lon: 79.0669, category: "Hill Station", region: "NORTH_INDIA", alert_radius_km: 15.0 },
  { name: "Shimla Ridge", lat: 31.1048, lon: 77.1734, category: "Hill Station", region: "NORTH_INDIA", alert_radius_km: 12.0 },
  { name: "Chandigarh Airport", lat: 30.6735, lon: 76.7885, category: "Airport", region: "NORTH_INDIA", alert_radius_km: 12.0 },

  // Eastern & Bay of Bengal
  { name: "Kolkata Netaji Subhash Airport (CCU)", lat: 22.6547, lon: 88.4467, category: "Airport", region: "EAST_INDIA", alert_radius_km: 14.0 },
  { name: "Howrah Junction", lat: 22.5839, lon: 88.3426, category: "Railway", region: "EAST_INDIA", alert_radius_km: 10.0 },
  { name: "Bhubaneswar Biju Patnaik Airport", lat: 20.2444, lon: 85.8178, category: "Airport", region: "EAST_INDIA", alert_radius_km: 12.0 },
  { name: "Patna Jayprakash Airport", lat: 25.5913, lon: 85.0880, category: "Airport", region: "EAST_INDIA", alert_radius_km: 10.0 },

  // Southern Peninsula
  { name: "Bengaluru Kempegowda Airport (BLR)", lat: 13.1986, lon: 77.7066, category: "Airport", region: "SOUTH_INDIA", alert_radius_km: 15.0 },
  { name: "Bengaluru Electronic City", lat: 12.8399, lon: 77.6770, category: "Commercial", region: "SOUTH_INDIA", alert_radius_km: 10.0 },
  { name: "Chennai International Airport (MAA)", lat: 12.9941, lon: 80.1709, category: "Airport", region: "SOUTH_INDIA", alert_radius_km: 14.0 },
  { name: "Hyderabad Rajiv Gandhi Airport (HYD)", lat: 17.2403, lon: 78.4294, category: "Airport", region: "SOUTH_INDIA", alert_radius_km: 14.0 },
  { name: "Kochi International Airport (COK)", lat: 10.1556, lon: 76.3908, category: "Airport", region: "SOUTH_INDIA", alert_radius_km: 12.0 },
  { name: "Wayanad Foothills", lat: 11.6854, lon: 76.1320, category: "Hill Station", region: "SOUTH_INDIA", alert_radius_km: 15.0 },

  // Northwest & Northeast
  { name: "Jaipur International Airport", lat: 26.8242, lon: 75.8122, category: "Airport", region: "NORTHWEST", alert_radius_km: 14.0 },
  { name: "Guwahati Lokpriya Gopinath Airport", lat: 26.1061, lon: 91.5859, category: "Airport", region: "NORTHEAST", alert_radius_km: 14.0 },
  { name: "Shillong Peak", lat: 25.5348, lon: 91.8542, category: "Hill Station", region: "NORTHEAST", alert_radius_km: 12.0 },
];
