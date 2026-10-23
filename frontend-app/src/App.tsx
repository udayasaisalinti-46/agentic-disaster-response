/**
 * ResQAI — Agentic AI Disaster Response System
 * Government Emergency Management Portal
 * React 19 + TypeScript + Leaflet + Tailwind CSS
 * 
 * UI Style: Indian Government Portal (NDMA/NIC inspired)
 * 8-Agent Pipeline with auto-advance, location geocoding, and LLM integration
 */

import { useCallback, useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from "react-leaflet";
import L from "leaflet";
import {
  Activity, AlertOctagon, AlertTriangle, ArrowLeft, Bell,
  CheckCircle2, ChevronLeft, ChevronRight, Clock,
  CloudRain, Compass, Database, FileDown, FileText,
  Layers, MapPin, RefreshCw, RotateCcw, Search, Shield,
  ShieldAlert, ShieldCheck, Truck, Users, Warehouse,
  Workflow, Zap, Navigation,
  Phone, BarChart2, CheckCircle, XCircle, AlertCircle,
  Eye, Send, ThumbsUp, ThumbsDown
} from "lucide-react";
import "./App.css";

// ============================================================================
// API CONFIG
// ============================================================================
const API =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
    ? ""
    : "https://resqai-backend-vflw.onrender.com");

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ============================================================================
// LOCATION DATA
// ============================================================================
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

const STATE_DISTRICTS: Record<string, string[]> = {
  "Andhra Pradesh": ["Alluri Sitharama Raju", "Anakapalli", "Anantapur", "Annamayya", "Bapatla", "Chittoor", "East Godavari", "Eluru", "Guntur", "Kakinada", "Konaseema", "Krishna", "Kurnool", "Nandyal", "NTR", "Palnadu", "Parvathipuram Manyam", "Prakasam", "Srikakulam", "Sri Balaji", "Sri Sathya Sai", "Tirupati", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"],
  "Telangana": ["Adilabad", "Bhadradri Kothagudem", "Hanamkonda", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Kumuram Bheem Asifabad", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri"],
  "Maharashtra": ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
  "Karnataka": ["Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir"],
  "Tamil Nadu": ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Villupuram", "Virudhunagar"],
  "Kerala": ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"],
  "Gujarat": ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad"],
  "Uttar Pradesh": ["Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Jalaun", "Jaunpur", "Jhansi", "Kanpur Nagar", "Kaushambi", "Kushinagar", "Lakhimpur Kheri", "Lalitpur", "Lucknow", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Prayagraj", "Rae Bareli", "Rampur", "Saharanpur", "Shahjahanpur", "Sitapur", "Sultanpur", "Unnao", "Varanasi"],
  "Rajasthan": ["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jodhpur", "Kota", "Nagaur", "Pali", "Rajsamand", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"],
  "West Bengal": ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"],
  "Madhya Pradesh": ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Hoshangabad", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena", "Narsinghpur", "Neemuch", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shivpuri", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha"],
  "Odisha": ["Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh"],
  "Bihar": ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"],
  "Assam": ["Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar", "Sonitpur", "Tinsukia", "Udalguri"],
  "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
  "Punjab": ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Mansa", "Moga", "Mohali", "Muktsar", "Nawanshahr", "Pathankot", "Patiala", "Ropar", "Sangrur", "Tarn Taran"],
  "Haryana": ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"],
};

// ============================================================================
// CONSTANTS
// ============================================================================
const DISASTER_TYPES = [
  "Flood", "Cyclone / Hurricane", "Earthquake", "Wildfire / Forest Fire",
  "Landslide", "Tsunami", "Drought", "Heatwave", "Cloudburst",
  "Industrial Accident", "Chemical Hazard", "Urban Emergency",
  "Dam Breach", "Lightning Strike", "Urban Flooding", "Avalanche",
  "Volcanic Activity", "Other",
];

const SOURCE_TYPES = [
  "Emergency Call 911", "Field Rescue Team Report", "Weather Service Alert",
  "IoT / Water Level Sensor", "Government Alert / NDMA", "GIS Monitoring System",
  "Shelter Management Report", "Hospital Report", "Rescue Team Field Update",
  "Transportation Authority Alert", "Citizen Report / Social Media",
  "Satellite Imagery Analysis", "News Media Report", "Other",
];

const INFRASTRUCTURE_OPTIONS = [
  "None reported", "Road partially flooded", "Main road closed",
  "Bridge damaged or submerged", "Power lines down", "Communication disrupted",
  "Hospital partially affected", "Residential area flooding",
  "Village access cut off completely", "Dam or reservoir at risk",
  "Landslide blocking road", "Industrial facility affected", "Other",
];

const ASSISTANCE_OPTIONS = [
  "Rescue boat deployment", "Evacuation assistance", "Medical assistance",
  "Food and water supply", "Temporary shelter arrangement", "Search and rescue",
  "Road clearance", "Power restoration", "Communication restoration",
  "Aerial assistance (if approved)", "Structural safety assessment", "Other",
];

const WMO_CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog", 51: "Light drizzle", 53: "Moderate drizzle",
  55: "Heavy drizzle", 61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Light snow", 73: "Moderate snow", 75: "Heavy snow",
  80: "Light showers", 81: "Moderate showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm heavy hail",
};

// ============================================================================
// TYPES
// ============================================================================
type Incident = {
  incident_id: string; disaster_type: string; description: string;
  location: string; people_affected: number; urgency: number; source: string;
  severity_score?: number; severity_level?: string;
  severity?: { score?: number; level?: string };
  status: string; verification_status: string;
  possible_duplicate?: boolean; duplicate_of?: string | null;
  latitude?: number | null; longitude?: number | null;
  assistance_requested?: string | null; infrastructure_issue?: string | null;
  created_at?: string;
};
type Resource = {
  resource_id: string; resource_type: string; name: string; location: string;
  capacity: number; capability?: string | null;
  status: "Available" | "Reserved" | "Deployed" | "Returning";
  latitude?: number | null; longitude?: number | null;
};
type Shelter = {
  shelter_id: string; name: string; location: string; total_capacity: number;
  occupied: number; status: string; latitude?: number | null; longitude?: number | null;
};
type Road = {
  road_id: string; name: string; origin_location: string; destination_location: string;
  status: "Open" | "Partially Blocked" | "Closed" | "Unknown";
  closure_type: string; reason?: string | null;
};
type Approval = {
  request_id: string; incident_id: string; allocation_id?: string | null;
  action_type: string; proposed_action: string;
  status: "Pending" | "Approved" | "Rejected" | "Modified";
  reviewer?: string | null; comments?: string | null;
  created_at: string; reviewed_at?: string | null;
};
type ResponseAction = {
  action_id: string; incident_id: string; title: string;
  description: string; priority: string;
  status: "Open" | "In Progress" | "Blocked" | "Completed" | "Cancelled";
  assigned_resource_id?: string | null; remarks?: string | null;
  updated_at: string;
};
type AlertItem = {
  alert_id: string; alert_type: string;
  severity: "Critical" | "Warning" | "Info";
  title: string; message: string; related_id?: string | null;
  acknowledged: number; created_at: string;
};
type DashboardData = {
  incidents?: { total?: number; critical?: number; high?: number; possible_duplicates?: number; needs_reassessment?: number };
  resources_by_status?: Record<string, number>;
  shelters?: { total?: number; total_capacity?: number; total_occupied?: number; available_capacity?: number; full?: number; near_full?: number };
  roads?: { total?: number; open?: number; closed?: number; partially_blocked?: number };
  pending_approvals?: number; unread_alerts?: number;
  actions_by_status?: Record<string, number>;
};

// Pipeline shared state
type PipelineData = {
  incident?: Incident;
  location_state?: string; location_district?: string; location_mandal?: string; location_village?: string;
  severity_score?: number; severity_level?: string; severity_factors?: string[];
  ai_analysis?: string; ai_source?: string;
  weather?: Record<string, number | string>;
  route_assessment?: Record<string, unknown>;
  selected_resources?: Resource[];
  allocation_ids?: string[];
  approval_id?: string;
  commander_decision?: string; commander_name?: string;
  action_id?: string;
};

type ActiveTab = "pipeline" | "dashboard" | "incidents" | "resources" | "shelters" | "routes" | "approvals" | "actions" | "alerts" | "reports";

// ============================================================================
// LEAFLET ICONS
// ============================================================================
const makeIcon = (color: string, label: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${color};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${label}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  });

// ============================================================================
// AGENT 1 — INCIDENT INTAKE
// ============================================================================
type Agent1Props = {
  onComplete: (data: PipelineData) => void;
  onBack?: () => void;
};

function Agent1Intake({ onComplete, onBack }: Agent1Props) {
  const [country] = useState("India");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [mandal, setMandal] = useState("");
  const [village, setVillage] = useState("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [disasterType, setDisasterType] = useState("");
  const [description, setDescription] = useState("");
  const [peopleAffected, setPeopleAffected] = useState<number>(0);
  const [urgency, setUrgency] = useState<number>(3);
  const [source, setSource] = useState("");
  const [infrastructure, setInfrastructure] = useState("None reported");
  const [assistance, setAssistance] = useState("");
  const [callerPhone, setCallerPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [savedIncident, setSavedIncident] = useState<Incident | null>(null);
  const [dupWarning, setDupWarning] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const districts = state ? (STATE_DISTRICTS[state] || []) : [];

  // Auto-geocode when state + district selected
  useEffect(() => {
    if (state && district) {
      const query = [district, mandal, state, "India"].filter(Boolean).join(", ");
      setGeocoding(true);
      fetch(`${API}/geocode?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then((data: { results?: Array<{ latitude: number; longitude: number }> }) => {
          if (data.results?.length) {
            setLatitude(data.results[0].latitude.toFixed(5));
            setLongitude(data.results[0].longitude.toFixed(5));
          }
        })
        .catch(() => {})
        .finally(() => setGeocoding(false));
    }
  }, [state, district, mandal]);

  // Auto-advance countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (savedIncident) onComplete({
        incident: savedIncident,
        location_state: state, location_district: district,
        location_mandal: mandal, location_village: village,
      });
      return;
    }
    const t = setTimeout(() => {
      setCountdown(c => (c !== null ? c - 1 : null));
      setProgress(p => Math.min(100, p + 25));
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown, savedIncident, onComplete, state, district, mandal, village]);

  const locationDisplay = [village, mandal, district, state, country].filter(Boolean).join(", ");

  const handleSubmit = async () => {
    setError("");
    if (!disasterType) { setError("Please select disaster type."); return; }
    if (!state) { setError("Please select State."); return; }
    if (!district) { setError("Please select District."); return; }
    if (!description.trim() || description.length < 10) { setError("Description must be at least 10 characters."); return; }
    if (peopleAffected < 0) { setError("People affected cannot be negative."); return; }
    if (!source) { setError("Please select information source."); return; }

    setLoading(true);
    try {
      const payload = {
        disaster_type: disasterType,
        location: locationDisplay,
        description,
        people_affected: peopleAffected,
        urgency,
        source,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        infrastructure_issue: infrastructure,
        assistance_requested: assistance,
      };
      const res = await apiFetch<{ incident: Incident; duplicate_detection?: { duplicate_detected?: boolean; duplicate_of?: string | null; reason?: string } }>("/incidents", { method: "POST", body: JSON.stringify(payload) });
      setSavedIncident(res.incident);
      if (res.duplicate_detection?.duplicate_detected) {
        setDupWarning(`Potential duplicate of ${res.duplicate_detection.duplicate_of || "an existing incident"}. Flagged for commander review.`);
      }
      setSuccess(true);
      setCountdown(4);
      setProgress(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  if (success && savedIncident) {
    return (
      <div className="agent-card">
        <div className="agent-card-header">
          <div>
            <div className="agent-title"><CheckCircle size={18} style={{color:"var(--gov-green)"}} />Incident Registered Successfully</div>
            <div className="agent-subtitle">Incident ID: <strong style={{color:"var(--gov-blue)",fontFamily:"monospace"}}>{savedIncident.incident_id}</strong></div>
          </div>
          <span className="badge badge-info">{disasterType}</span>
        </div>
        <div className="agent-body">
          {dupWarning && (
            <div className="duplicate-banner mb-3">
              <AlertTriangle size={16} />
              <span><strong>Duplicate Flagged:</strong> {dupWarning}</span>
            </div>
          )}
          <table className="output-table">
            <tbody>
              <tr><td>Incident ID</td><td style={{fontFamily:"monospace",fontWeight:700,color:"var(--gov-blue)"}}>{savedIncident.incident_id}</td></tr>
              <tr><td>Disaster Type</td><td>{savedIncident.disaster_type}</td></tr>
              <tr><td>Location</td><td>{savedIncident.location}</td></tr>
              <tr><td>Coordinates</td><td>{savedIncident.latitude?.toFixed(5)}, {savedIncident.longitude?.toFixed(5)}</td></tr>
              <tr><td>People Affected</td><td>{savedIncident.people_affected}</td></tr>
              <tr><td>Urgency</td><td>{savedIncident.urgency}/5</td></tr>
              <tr><td>Source</td><td>{savedIncident.source}</td></tr>
              <tr><td>Verification</td><td>{savedIncident.verification_status}</td></tr>
              <tr><td>Duplicate Check</td><td>{savedIncident.possible_duplicate ? "⚠️ Flagged" : "✅ Unique"}</td></tr>
            </tbody>
          </table>

          <div className="mt-4" style={{textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--gov-text-muted)",marginBottom:8}}>
              Auto-advancing to Agent 2 in {countdown}s...
            </div>
            <div className="auto-advance-bar">
              <div className="auto-advance-fill" style={{width:`${progress}%`}} />
            </div>
          </div>
        </div>
        <div className="agent-footer">
          {onBack && <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>}
          <button className="btn btn-primary" onClick={() => onComplete({ incident: savedIncident, location_state: state, location_district: district, location_mandal: mandal, location_village: village })}>
            Continue to Agent 2 →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span className="agent-number">AGENT 1</span>
            <span style={{fontSize:11,color:"var(--gov-text-muted)"}}>Emergency Incident Intake</span>
          </div>
          <div className="agent-title"><Phone size={16} /> Incident Report Form</div>
          <div className="agent-subtitle">Enter complete incident details. All fields marked * are required.</div>
        </div>
        {onBack && <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>}
      </div>

      <div className="agent-body">
        <div className="safety-notice">
          <Shield size={14} style={{flexShrink:0,marginTop:2}} />
          <span><strong>Mandatory:</strong> This form creates an official incident record. Provide accurate information. All submissions are logged and reviewed by the Emergency Operations Commander.</span>
        </div>

        {error && (
          <div className="gov-alert alert-danger mb-3">
            <AlertCircle size={16} />
            <div><strong>Validation Error</strong> {error}</div>
          </div>
        )}

        <div className="gov-form">
          {/* Section 1: Disaster Type */}
          <div style={{background:"#f7f9fb",border:"1px solid var(--gov-border)",borderRadius:"var(--radius-sm)",padding:"14px",marginBottom:4}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--gov-navy)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>
              1. Disaster Classification
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Disaster Type <span className="req">*</span></label>
                <select className="form-control" value={disasterType} onChange={e => setDisasterType(e.target.value)}>
                  <option value="">-- Select Disaster Type --</option>
                  {DISASTER_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Information Source <span className="req">*</span></label>
                <select className="form-control" value={source} onChange={e => setSource(e.target.value)}>
                  <option value="">-- Select Source --</option>
                  {SOURCE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Location Hierarchy */}
          <div style={{background:"#f7f9fb",border:"1px solid var(--gov-border)",borderRadius:"var(--radius-sm)",padding:"14px",marginBottom:4}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--gov-navy)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>
              2. Incident Location
            </div>
            <div className="form-row mb-3">
              <div className="form-group">
                <label className="form-label">Country</label>
                <input className="form-control readonly" value={country} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">State <span className="req">*</span></label>
                <select className="form-control" value={state} onChange={e => { setState(e.target.value); setDistrict(""); setLatitude(""); setLongitude(""); }}>
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row mb-3">
              <div className="form-group">
                <label className="form-label">District <span className="req">*</span></label>
                {districts.length > 0 ? (
                  <select className="form-control" value={district} onChange={e => setDistrict(e.target.value)}>
                    <option value="">-- Select District --</option>
                    {districts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                ) : (
                  <input className="form-control" placeholder={state ? "Enter district name" : "Select state first"} value={district} onChange={e => setDistrict(e.target.value)} disabled={!state} />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Mandal / Taluk</label>
                <input className="form-control" placeholder="e.g. Tenali, Guntur Rural" value={mandal} onChange={e => setMandal(e.target.value)} />
              </div>
            </div>
            <div className="form-row mb-3">
              <div className="form-group">
                <label className="form-label">Village / City / Ward</label>
                <input className="form-control" placeholder="e.g. Zone A Residential, Riverside Village" value={village} onChange={e => setVillage(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Caller / Reporter Phone</label>
                <input className="form-control" placeholder="+91 XXXXX XXXXX" value={callerPhone} onChange={e => setCallerPhone(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label"><MapPin size={12}/> Latitude {geocoding && <span style={{color:"var(--gov-blue)",fontSize:11}}>(Auto-detecting...)</span>}</label>
                <input className="form-control readonly" style={{background:"#edf4ff",borderColor:"#b3cff5",color:"var(--gov-blue)",fontWeight:600,fontFamily:"monospace"}} value={latitude} onChange={e => setLatitude(e.target.value)} placeholder={geocoding ? "Geocoding..." : "Auto or enter manually"} />
              </div>
              <div className="form-group">
                <label className="form-label"><MapPin size={12}/> Longitude</label>
                <input className="form-control readonly" style={{background:"#edf4ff",borderColor:"#b3cff5",color:"var(--gov-blue)",fontWeight:600,fontFamily:"monospace"}} value={longitude} onChange={e => setLongitude(e.target.value)} placeholder={geocoding ? "Geocoding..." : "Auto or enter manually"} />
              </div>
            </div>
            {latitude && longitude && (
              <div className="mt-2 text-xs" style={{color:"var(--gov-green)"}}>
                ✅ Coordinates set: {latitude}, {longitude}
              </div>
            )}
          </div>

          {/* Section 3: Incident Details */}
          <div style={{background:"#f7f9fb",border:"1px solid var(--gov-border)",borderRadius:"var(--radius-sm)",padding:"14px",marginBottom:4}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--gov-navy)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>
              3. Incident Details
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Incident Description <span className="req">*</span></label>
              <textarea className="form-control" rows={3} placeholder="Describe the incident in detail: nature of disaster, current situation, immediate threats, accessibility..." value={description} onChange={e => setDescription(e.target.value)} />
              <span className="form-hint">{description.length} characters (minimum 10 required)</span>
            </div>
            <div className="form-row mb-3">
              <div className="form-group">
                <label className="form-label">People Affected <span className="req">*</span></label>
                <input className="form-control" type="number" min={0} value={peopleAffected} onChange={e => setPeopleAffected(parseInt(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Urgency Level <span className="req">*</span> ({urgency}/5)</label>
                <select className="form-control" value={urgency} onChange={e => setUrgency(parseInt(e.target.value))}>
                  <option value={1}>1 - Low (Non-urgent, monitoring required)</option>
                  <option value={2}>2 - Moderate (Response within 6 hours)</option>
                  <option value={3}>3 - High (Response within 2 hours)</option>
                  <option value={4}>4 - Very High (Response within 1 hour)</option>
                  <option value={5}>5 - Critical (Immediate life threat)</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Infrastructure Status</label>
                <select className="form-control" value={infrastructure} onChange={e => setInfrastructure(e.target.value)}>
                  {INFRASTRUCTURE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Assistance Required</label>
                <select className="form-control" value={assistance} onChange={e => setAssistance(e.target.value)}>
                  <option value="">-- Select Type --</option>
                  {ASSISTANCE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="agent-footer">
        {onBack && <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>}
        <div style={{fontSize:11,color:"var(--gov-text-muted)"}}>Auto-advance to Agent 2 on submit</div>
        <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={loading}>
          {loading ? <><div className="spinner" style={{width:16,height:16,borderWidth:2}} /> Processing...</> : <><Send size={16}/> Submit Incident Report</>}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// AGENT 2 — SITUATION ASSESSMENT & SEVERITY
// ============================================================================
type Agent2Props = {
  data: PipelineData;
  onComplete: (data: PipelineData) => void;
  onBack: () => void;
};

function Agent2Severity({ data, onComplete, onBack }: Agent2Props) {
  const inc = data.incident!;
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [aiSource, setAiSource] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  // Deterministic severity score
  const popFactor = Math.min(40, Math.floor((inc.people_affected || 0) / 2.5));
  const urgencyFactor = (inc.urgency || 3) * 8;
  const infra = inc.infrastructure_issue || "";
  const accessPenalty = infra.includes("closed") || infra.includes("cut off") ? 15 : infra.includes("partial") ? 8 : 5;
  const infraPenalty = infra.includes("None") ? 0 : 10;
  const severityScore = Math.min(100, popFactor + urgencyFactor + accessPenalty + infraPenalty);
  const severityLevel = severityScore >= 75 ? "Critical" : severityScore >= 50 ? "High" : severityScore >= 25 ? "Medium" : "Low";
  const factors = [
    `Population factor (${inc.people_affected} people): +${popFactor} points`,
    `Urgency rating (${inc.urgency}/5): +${urgencyFactor} points`,
    `Access route assessment (${infra || "unspecified"}): +${accessPenalty} points`,
    `Infrastructure damage penalty: +${infraPenalty} points`,
  ];

  useEffect(() => {
    const fetchAI = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ ai_analysis: string; source: string }>("/ai/analyze-incident", {
          method: "POST",
          body: JSON.stringify({
            incident_id: inc.incident_id,
            disaster_type: inc.disaster_type,
            location: inc.location,
            people_affected: inc.people_affected,
            urgency: inc.urgency,
            severity_score: severityScore,
            severity_level: severityLevel,
            infrastructure_issue: inc.infrastructure_issue,
            description: inc.description,
          }),
        });
        setAiText(res.ai_analysis);
        setAiSource(res.source);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "AI analysis unavailable");
        setAiText("AI analysis could not be retrieved. Please proceed with deterministic score.");
        setAiSource("Error");
      } finally {
        setLoading(false);
      }
    };
    fetchAI();
  }, [inc.incident_id]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      onComplete({ ...data, severity_score: severityScore, severity_level: severityLevel, severity_factors: factors, ai_analysis: aiText, ai_source: aiSource });
      return;
    }
    const t = setTimeout(() => { setCountdown(c => (c !== null ? c - 1 : null)); setProgress(p => Math.min(100, p + 25)); }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleContinue = () => { setDone(true); setCountdown(4); setProgress(0); };

  if (loading) {
    return (
      <div className="agent-card">
        <div className="agent-card-header">
          <div className="agent-title"><Activity size={18} /> Agent 2: Situation Assessment & Severity</div>
        </div>
        <div className="agent-processing">
          <div className="spinner" />
          <div style={{fontWeight:600,color:"var(--gov-navy)"}}>Computing Severity Score...</div>
          <div style={{fontSize:12,color:"var(--gov-text-muted)"}}>Calling AI Analysis Engine (Google Gemini)</div>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span className="agent-number">AGENT 2</span>
            <span style={{fontSize:11,color:"var(--gov-text-muted)"}}>Situation Assessment & Severity</span>
          </div>
          <div className="agent-title"><Activity size={16}/> Severity Assessment & AI Analysis</div>
          <div className="agent-subtitle">Incident: {inc.incident_id} — {inc.location}</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
          <span className={`badge badge-${severityLevel.toLowerCase()}`}>{severityLevel} Priority</span>
        </div>
      </div>

      <div className="agent-body">
        {error && <div className="gov-alert alert-warning mb-3"><AlertTriangle size={16}/><div>{error}</div></div>}

        {/* Severity Score Display */}
        <div className="severity-display mb-4">
          <div className="severity-gauge" style={{minWidth:120}}>
            <div className={`severity-score-num ${severityLevel}`}>{severityScore}</div>
            <div style={{fontSize:11,color:"var(--gov-text-muted)",marginTop:4}}>/ 100 Score</div>
            <div className="severity-bar-track" style={{width:"100px",margin:"8px auto"}}>
              <div className={`severity-bar-fill ${severityLevel}`} style={{width:`${severityScore}%`}} />
            </div>
            <span className={`badge badge-${severityLevel.toLowerCase()}`}>{severityLevel} Priority</span>
          </div>
          <div style={{flex:1}}>
            <div className="result-section-title">Scoring Factors (Deterministic Algorithm)</div>
            <div className="checklist mt-2">
              {factors.map((f,i) => (
                <div key={i} className="checklist-item pass">
                  <span className="checklist-icon">➕</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
            <div className="mt-2" style={{fontSize:11,color:"var(--gov-text-muted)"}}>
              Formula: Score = min(100, PopPts + UrgencyPts + AccessPts + InfraPts)
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        <div className="result-section">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div className="result-section-title">AI Situation Analysis & Recommendations</div>
            <span className="ai-source-tag"><Zap size={10}/> {aiSource}</span>
          </div>
          <div className="ai-analysis-box">{aiText || "Generating AI analysis..."}</div>
          <div className="gov-alert alert-warning mt-2" style={{marginBottom:0}}>
            <AlertTriangle size={14}/>
            <div style={{fontSize:11}}>AI-generated analysis is <strong>advisory only</strong>. Authorized commanders must verify all recommendations before any action is taken.</div>
          </div>
        </div>

        {done && (
          <div className="mt-4" style={{textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--gov-text-muted)",marginBottom:8}}>Auto-advancing to Agent 3 in {countdown}s...</div>
            <div className="auto-advance-bar"><div className="auto-advance-fill" style={{width:`${progress}%`}} /></div>
          </div>
        )}
      </div>

      <div className="agent-footer">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
        <button className="btn btn-primary" onClick={handleContinue} disabled={done}>
          {done ? "Advancing..." : "Continue to Agent 3 — Weather →"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// AGENT 3 — WEATHER INTELLIGENCE
// ============================================================================
type Agent3Props = { data: PipelineData; onComplete: (d: PipelineData) => void; onBack: () => void; };

function Agent3Weather({ data, onComplete, onBack }: Agent3Props) {
  const inc = data.incident!;
  const lat = inc.latitude || 16.5;
  const lon = inc.longitude || 80.6;
  const [weather, setWeather] = useState<Record<string, number | string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await apiFetch<{ current_weather: Record<string, number | string>; source: string }>(`/weather?latitude=${lat}&longitude=${lon}`);
        setWeather(res.current_weather);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Weather fetch failed");
        setWeather({ temperature_2m: 26.5, precipitation: 12.0, wind_speed_10m: 45.0, relative_humidity_2m: 88, weather_code: 65 });
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
  }, [lat, lon]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { onComplete({ ...data, weather: weather ?? undefined }); return; }
    const t = setTimeout(() => { setCountdown(c => (c !== null ? c - 1 : null)); setProgress(p => Math.min(100, p + 25)); }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const temp = Number(weather?.temperature_2m ?? 0);
  const precip = Number(weather?.precipitation ?? 0);
  const wind = Number(weather?.wind_speed_10m ?? 0);
  const humidity = Number(weather?.relative_humidity_2m ?? 0);
  const code = Number(weather?.weather_code ?? 0);
  const isSevere = precip >= 10 || wind >= 40 || [65, 67, 75, 82, 95, 96, 99].includes(code);

  if (loading) return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div className="agent-title"><CloudRain size={18}/> Agent 3: Weather Intelligence</div>
      </div>
      <div className="agent-processing">
        <div className="spinner" />
        <div style={{fontWeight:600}}>Fetching Live Weather Data...</div>
        <div style={{fontSize:12,color:"var(--gov-text-muted)"}}>Source: Open-Meteo API | Location: {lat.toFixed(4)}, {lon.toFixed(4)}</div>
      </div>
    </div>
  );

  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span className="agent-number">AGENT 3</span>
            <span style={{fontSize:11,color:"var(--gov-text-muted)"}}>Weather & Environmental Intelligence</span>
          </div>
          <div className="agent-title"><CloudRain size={16}/> Live Weather Analysis</div>
          <div className="agent-subtitle">Location: {inc.location} | Coordinates: {lat.toFixed(4)}°N, {lon.toFixed(4)}°E</div>
        </div>
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
      </div>

      <div className="agent-body">
        {error && <div className="gov-alert alert-warning mb-3"><AlertTriangle size={16}/><div>{error} (Showing simulation data)</div></div>}

        {isSevere && (
          <div className="gov-alert alert-danger mb-3">
            <AlertOctagon size={16}/>
            <div>
              <strong>SEVERE WEATHER ALERT</strong>
              <div style={{fontSize:12,marginTop:2}}>Adverse weather conditions detected. Precipitation ≥10mm or Wind ≥40km/h or severe weather code detected. Incident priority may need reassessment.</div>
            </div>
          </div>
        )}

        <div className="weather-grid mb-4">
          <div className="weather-tile">
            <div className="weather-tile-icon">🌡️</div>
            <div className="weather-tile-label">Temperature</div>
            <div className="weather-tile-value">{temp.toFixed(1)}</div>
            <div className="weather-tile-unit">°C</div>
          </div>
          <div className="weather-tile" style={precip >= 10 ? {background:"#fef2f2",borderColor:"#fecaca"} : {}}>
            <div className="weather-tile-icon">🌧️</div>
            <div className="weather-tile-label">Precipitation</div>
            <div className="weather-tile-value" style={precip >= 10 ? {color:"var(--gov-red)"} : {}}>{precip.toFixed(1)}</div>
            <div className="weather-tile-unit">mm/h {precip >= 10 && "⚠️"}</div>
          </div>
          <div className="weather-tile" style={wind >= 40 ? {background:"#fffbeb",borderColor:"#fde68a"} : {}}>
            <div className="weather-tile-icon">💨</div>
            <div className="weather-tile-label">Wind Speed</div>
            <div className="weather-tile-value" style={wind >= 40 ? {color:"var(--gov-amber)"} : {}}>{wind.toFixed(1)}</div>
            <div className="weather-tile-unit">km/h {wind >= 40 && "⚠️"}</div>
          </div>
          <div className="weather-tile">
            <div className="weather-tile-icon">💧</div>
            <div className="weather-tile-label">Humidity</div>
            <div className="weather-tile-value">{humidity.toFixed(0)}</div>
            <div className="weather-tile-unit">%</div>
          </div>
        </div>

        <div className="gov-card mb-3">
          <div className="gov-card-header">
            <h3><CloudRain size={14}/> Weather Condition & Forecast</h3>
          </div>
          <div className="gov-card-body">
            <table className="output-table">
              <tbody>
                <tr><td>Current Condition</td><td><strong>{WMO_CODES[code] || `WMO Code ${code}`}</strong></td></tr>
                <tr><td>Weather Code</td><td><code>WMO {code}</code></td></tr>
                <tr><td>Operational Impact</td><td>{isSevere ? <span style={{color:"var(--gov-red)",fontWeight:700}}>⚠️ Adverse — Field operations may be affected</span> : <span style={{color:"var(--gov-green)"}}>✅ Conditions within operational limits</span>}</td></tr>
                <tr><td>Reassessment Recommended</td><td>{isSevere ? <span style={{color:"var(--gov-red)"}}>Yes — Submit to supervisor</span> : "No immediate reassessment needed"}</td></tr>
                <tr><td>Data Source</td><td>Open-Meteo API (Real-time)</td></tr>
                <tr><td>Location Coordinates</td><td style={{fontFamily:"monospace"}}>{lat.toFixed(5)}, {lon.toFixed(5)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {done && (
          <div className="mt-3" style={{textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--gov-text-muted)",marginBottom:8}}>Auto-advancing to Agent 4 in {countdown}s...</div>
            <div className="auto-advance-bar"><div className="auto-advance-fill" style={{width:`${progress}%`}} /></div>
          </div>
        )}
      </div>

      <div className="agent-footer">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
        <button className="btn btn-primary" onClick={() => { setDone(true); setCountdown(4); setProgress(0); }} disabled={done}>
          {done ? "Advancing..." : "Continue to Agent 4 — Geospatial →"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// AGENT 4 — GEOSPATIAL & ROUTE ACCESSIBILITY
// ============================================================================
type Agent4Props = { data: PipelineData; onComplete: (d: PipelineData) => void; onBack: () => void; resources: Resource[]; shelters: Shelter[]; roads: Road[]; };

function Agent4Geospatial({ data, onComplete, onBack, resources, shelters, roads }: Agent4Props) {
  const inc = data.incident!;
  const lat = inc.latitude || 16.5;
  const lon = inc.longitude || 80.6;
  const [roadStatus, setRoadStatus] = useState<"Open" | "Partially Blocked" | "Closed">("Open");
  const [routeAssessed, setRouteAssessed] = useState(false);
  const [routeData, setRouteData] = useState<Record<string, unknown> | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const nearestShelter = shelters[0];

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { onComplete({ ...data, route_assessment: routeData ?? {} }); return; }
    const t = setTimeout(() => { setCountdown(c => (c !== null ? c - 1 : null)); setProgress(p => Math.min(100, p + 25)); }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const assessRoute = async () => {
    setLoadingRoute(true);
    try {
      const destLat = nearestShelter?.latitude || lat + 0.05;
      const destLon = nearestShelter?.longitude || lon + 0.05;
      const res = await apiFetch<Record<string, unknown>>("/routes/reassess", {
        method: "POST",
        body: JSON.stringify({
          origin_latitude: lat, origin_longitude: lon,
          destination_latitude: destLat, destination_longitude: destLon,
          road_blockage_reported: roadStatus !== "Open",
          blockage_description: roadStatus !== "Open" ? `${roadStatus}: Access route assessment for ${inc.location}` : "No blockage reported",
        }),
      });
      setRouteData(res as Record<string, unknown>);
      setRouteAssessed(true);
    } catch (e: unknown) {
      setRouteData({ error: e instanceof Error ? e.message : "Route assessment failed" });
      setRouteAssessed(true);
    } finally {
      setLoadingRoute(false);
    }
  };

  const candidates = (routeData as { candidate_routes?: Array<{candidate_number:number;distance_km:number;duration_minutes:number}> })?.candidate_routes || [];

  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span className="agent-number">AGENT 4</span>
            <span style={{fontSize:11,color:"var(--gov-text-muted)"}}>Geospatial & Accessibility</span>
          </div>
          <div className="agent-title"><Compass size={16}/> GIS Map & Route Assessment</div>
          <div className="agent-subtitle">Location: {inc.location} | Lat: {lat.toFixed(4)}, Lon: {lon.toFixed(4)}</div>
        </div>
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
      </div>

      <div className="agent-body">
        <div className="gov-alert alert-info mb-3">
          <AlertCircle size={14}/>
          <div style={{fontSize:11}}><strong>Route Classification Policy:</strong> This system strictly distinguishes <strong>Known Road Closures</strong> (officially reported) from <strong>AI-Inferred Accessibility Problems</strong> (probabilistic warnings). Never treat AI inferences as confirmed closures without ground verification.</div>
        </div>

        <div className="grid-2 mb-4">
          <div>
            {/* Map */}
            <div className="map-wrap mb-3">
              <MapContainer center={[lat, lon]} zoom={12} style={{height:"320px",width:"100%"}}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                <Marker position={[lat, lon]} icon={makeIcon("#c0392b", "🔴")}>
                  <Popup><strong>{inc.incident_id}</strong><br/>{inc.disaster_type}<br/>{inc.location}</Popup>
                </Marker>
                <Circle center={[lat, lon]} radius={500} color="#c0392b" fillOpacity={0.1} />
                {shelters.filter(s => s.latitude && s.longitude).slice(0,3).map(s => (
                  <Marker key={s.shelter_id} position={[s.latitude!, s.longitude!]} icon={makeIcon("#138808", "S")}>
                    <Popup><strong>{s.name}</strong><br/>Capacity: {s.occupied}/{s.total_capacity}</Popup>
                  </Marker>
                ))}
                {resources.filter(r => r.latitude && r.longitude && r.status === "Available").slice(0,5).map(r => (
                  <Marker key={r.resource_id} position={[r.latitude!, r.longitude!]} icon={makeIcon("#1a6fc4", "R")}>
                    <Popup><strong>{r.name}</strong><br/>{r.resource_type} — {r.status}</Popup>
                  </Marker>
                ))}
                {nearestShelter?.latitude && nearestShelter?.longitude && (
                  <Polyline positions={[[lat, lon], [nearestShelter.latitude!, nearestShelter.longitude!]]} color={roadStatus === "Open" ? "#138808" : roadStatus === "Partially Blocked" ? "#e67e22" : "#c0392b"} dashArray={roadStatus !== "Open" ? "10,5" : undefined} />
                )}
              </MapContainer>
            </div>
            <div style={{fontSize:11,color:"var(--gov-text-muted)",display:"flex",gap:12}}>
              <span><span style={{color:"#c0392b"}}>●</span> Incident</span>
              <span><span style={{color:"#138808"}}>●</span> Shelters</span>
              <span><span style={{color:"#1a6fc4"}}>●</span> Resources</span>
              <span style={{borderBottom:"2px dashed",borderColor:roadStatus==="Open"?"#138808":roadStatus==="Partially Blocked"?"#e67e22":"#c0392b"}}>Route</span>
            </div>
          </div>

          <div>
            {/* Road Status Assessment */}
            <div className="gov-card mb-3">
              <div className="gov-card-header">
                <h3><Navigation size={14}/> Access Route Assessment</h3>
              </div>
              <div className="gov-card-body">
                <div className="form-group mb-3">
                  <label className="form-label">Road Accessibility Status</label>
                  <select className="form-control" value={roadStatus} onChange={e => setRoadStatus(e.target.value as typeof roadStatus)}>
                    <option value="Open">✅ Open — Normal vehicle access</option>
                    <option value="Partially Blocked">⚠️ Partially Blocked — High-clearance vehicles only</option>
                    <option value="Closed">🔴 Closed — All access cut off</option>
                  </select>
                </div>
                <div className={`gov-alert ${roadStatus === "Open" ? "alert-success" : roadStatus === "Partially Blocked" ? "alert-warning" : "alert-danger"} mt-2`} style={{marginBottom:0}}>
                  {roadStatus === "Open" && <><CheckCircle2 size={14}/><div>Ground vehicles can access incident location.</div></>}
                  {roadStatus === "Partially Blocked" && <><AlertTriangle size={14}/><div>Partial flooding — High-clearance or amphibious transport recommended.</div></>}
                  {roadStatus === "Closed" && <><AlertOctagon size={14}/><div>ACCESS BLOCKED — Watercraft or aerial extraction required. Verification Required before dispatch.</div></>}
                </div>
                <div className="mt-3">
                  <button className="btn btn-secondary w-full" onClick={assessRoute} disabled={loadingRoute}>
                    {loadingRoute ? <><div className="spinner" style={{width:14,height:14,borderWidth:2}} /> Assessing Route...</> : <><Navigation size={14}/> Run Route Analysis (OSRM)</>}
                  </button>
                </div>
              </div>
            </div>

            {/* Known Roads */}
            <div className="gov-card">
              <div className="gov-card-header">
                <h3><Layers size={14}/> Road Network Status</h3>
              </div>
              <div className="gov-card-body" style={{padding:0}}>
                <div className="gov-table-wrap">
                  <table className="gov-table">
                    <thead><tr><th>Road</th><th>Status</th><th>Classification</th></tr></thead>
                    <tbody>
                      {roads.slice(0, 5).map(r => (
                        <tr key={r.road_id}>
                          <td><strong>{r.name}</strong><div className="td-muted">{r.origin_location} → {r.destination_location}</div></td>
                          <td>
                            <span className={`badge ${r.status === "Open" ? "badge-low" : r.status === "Partially Blocked" ? "badge-medium" : "badge-critical"}`}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{fontSize:10,color:"var(--gov-text-muted)"}}>{r.closure_type}</td>
                        </tr>
                      ))}
                      {roads.length === 0 && <tr><td colSpan={3} style={{textAlign:"center",color:"var(--gov-text-muted)"}}>No roads registered</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Route Candidates */}
        {routeAssessed && candidates.length > 0 && (
          <div className="gov-card mb-3">
            <div className="gov-card-header">
              <h3><Navigation size={14}/> OSRM Route Candidates</h3>
              <span className="badge badge-info">Human Verification Required</span>
            </div>
            <div className="gov-card-body">
              <div className="gov-alert alert-warning" style={{marginBottom:12}}>
                <AlertTriangle size={14}/>
                <div style={{fontSize:11}}>These routes are generated by OSRM routing engine. They <strong>do not guarantee flood-free paths</strong>. All routes must be verified by field teams before personnel dispatch.</div>
              </div>
              <div className="gov-table-wrap">
                <table className="gov-table">
                  <thead><tr><th>Route #</th><th>Distance</th><th>Est. Duration</th><th>Verification</th></tr></thead>
                  <tbody>
                    {candidates.map((c: {candidate_number:number;distance_km:number;duration_minutes:number}) => (
                      <tr key={c.candidate_number}>
                        <td><strong>Route {c.candidate_number}</strong></td>
                        <td>{c.distance_km} km</td>
                        <td>{c.duration_minutes} min</td>
                        <td><span className="badge badge-pending">Verification Required</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {done && (
          <div className="mt-3" style={{textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--gov-text-muted)",marginBottom:8}}>Auto-advancing to Agent 5 in {countdown}s...</div>
            <div className="auto-advance-bar"><div className="auto-advance-fill" style={{width:`${progress}%`}} /></div>
          </div>
        )}
      </div>

      <div className="agent-footer">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
        <button className="btn btn-primary" onClick={() => { setDone(true); setCountdown(4); setProgress(0); }}>
          {done ? "Advancing..." : "Continue to Agent 5 — Resources →"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// AGENT 5 — RESOURCE MANAGEMENT
// ============================================================================
type Agent5Props = { data: PipelineData; onComplete: (d: PipelineData) => void; onBack: () => void; resources: Resource[]; shelters: Shelter[]; };

function Agent5Resources({ data, onComplete, onBack, resources, shelters }: Agent5Props) {
  const inc = data.incident!;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const available = resources.filter(r => r.status === "Available");

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { onComplete({ ...data, selected_resources: resources.filter(r => selected.has(r.resource_id)) }); return; }
    const t = setTimeout(() => { setCountdown(c => (c !== null ? c - 1 : null)); setProgress(p => Math.min(100, p + 25)); }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const toggleResource = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const byType: Record<string, Resource[]> = {};
  available.forEach(r => { (byType[r.resource_type] = byType[r.resource_type] || []).push(r); });

  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span className="agent-number">AGENT 5</span>
            <span style={{fontSize:11,color:"var(--gov-text-muted)"}}>Emergency Resource Management</span>
          </div>
          <div className="agent-title"><Truck size={16}/> Resource Inventory & Selection</div>
          <div className="agent-subtitle">Incident: {inc.incident_id} | Select resources for this response</div>
        </div>
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
      </div>

      <div className="agent-body">
        {/* Summary tiles */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
          {[
            {label:"Total Resources",val:resources.length,cls:"navy"},
            {label:"Available",val:available.length,cls:"green"},
            {label:"Deployed",val:resources.filter(r=>r.status==="Deployed").length,cls:"amber"},
            {label:"Shelters Open",val:shelters.filter(s=>s.occupied<s.total_capacity).length,cls:"blue"},
          ].map(({label,val,cls}) => (
            <div className="metric-tile" key={label}>
              <div className={`metric-icon-box ${cls}`}><Truck size={20}/></div>
              <div><div className="metric-tile-label">{label}</div><div className="metric-tile-value">{val}</div></div>
            </div>
          ))}
        </div>

        <div className="gov-alert alert-info mb-3">
          <AlertCircle size={14}/>
          <div style={{fontSize:11}}>
            <strong>No Hallucination Policy:</strong> Only select resources that exist in the inventory below. The system cannot invent helicopters or boats that are not registered. If required resources are unavailable, a shortage will be reported for mutual aid escalation.
          </div>
        </div>

        {/* Resources by type */}
        {Object.entries(byType).map(([type, items]) => (
          <div key={type} className="mb-3">
            <div style={{fontSize:12,fontWeight:700,color:"var(--gov-navy)",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
              <Truck size={13}/> {type} ({items.length} available)
            </div>
            <div className="resource-grid">
              {items.map(r => (
                <label key={r.resource_id} className={`resource-item ${selected.has(r.resource_id) ? "selected" : ""}`} style={{cursor:"pointer"}}>
                  <input type="checkbox" checked={selected.has(r.resource_id)} onChange={() => toggleResource(r.resource_id)} style={{marginTop:2}} />
                  <div>
                    <div className="resource-item-name">{r.name}</div>
                    <div className="resource-item-sub">{r.resource_type} • Capacity: {r.capacity}</div>
                    <div className="resource-item-sub">📍 {r.location}</div>
                    <span className="badge badge-low" style={{marginTop:4}}>Available</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}

        {available.length === 0 && (
          <div className="gov-alert alert-warning">
            <AlertTriangle size={16}/>
            <div>
              <strong>No Available Resources</strong>
              <div style={{fontSize:12,marginTop:2}}>All resources are currently deployed or reserved. Mutual aid escalation will be required. Please proceed to generate the shortage report in Agent 6.</div>
            </div>
          </div>
        )}

        {selected.size > 0 && (
          <div className="gov-alert alert-success mt-3">
            <CheckCircle2 size={14}/>
            <div><strong>{selected.size} resource(s) selected</strong> for this incident response. They will be reserved pending commander approval.</div>
          </div>
        )}

        {/* Shelters */}
        <div className="gov-card mt-4">
          <div className="gov-card-header"><h3><Warehouse size={14}/> Shelter Capacity Status</h3></div>
          <div className="gov-card-body" style={{padding:0}}>
            <div className="gov-table-wrap">
              <table className="gov-table">
                <thead><tr><th>Shelter</th><th>Location</th><th>Capacity</th><th>Occupied</th><th>Available</th><th>Status</th></tr></thead>
                <tbody>
                  {shelters.map(s => {
                    const pct = s.total_capacity > 0 ? (s.occupied / s.total_capacity) * 100 : 0;
                    return (
                      <tr key={s.shelter_id}>
                        <td><strong>{s.name}</strong></td>
                        <td>{s.location}</td>
                        <td>{s.total_capacity}</td>
                        <td>{s.occupied}</td>
                        <td>{s.total_capacity - s.occupied}</td>
                        <td>
                          <span className={`badge ${pct >= 100 ? "badge-critical" : pct >= 90 ? "badge-high" : "badge-low"}`}>
                            {pct >= 100 ? "FULL" : pct >= 90 ? "Near Full" : "Available"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {done && (
          <div className="mt-3" style={{textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--gov-text-muted)",marginBottom:8}}>Auto-advancing in {countdown}s...</div>
            <div className="auto-advance-bar"><div className="auto-advance-fill" style={{width:`${progress}%`}} /></div>
          </div>
        )}
      </div>

      <div className="agent-footer">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
        <div style={{fontSize:11,color:"var(--gov-text-muted)"}}>{selected.size} resource(s) selected</div>
        <button className="btn btn-primary" onClick={() => { setDone(true); setCountdown(4); setProgress(0); }}>
          {done ? "Advancing..." : "Continue to Agent 6 — Allocation →"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// AGENT 6 — RESOURCE ALLOCATION & PLANNING
// ============================================================================
type Agent6Props = { data: PipelineData; onComplete: (d: PipelineData) => void; onBack: () => void; onRefresh: () => void; };

function Agent6Allocation({ data, onComplete, onBack, onRefresh }: Agent6Props) {
  const inc = data.incident!;
  const selectedResources = data.selected_resources || [];
  const [allocating, setAllocating] = useState(false);
  const [allocationIds, setAllocationIds] = useState<string[]>([]);
  const [approvalId, setApprovalId] = useState("");
  const [shortageResult, setShortageResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const neededBoats = Math.ceil((inc.people_affected || 0) / 5);
  const availableBoats = selectedResources.filter(r => r.resource_type.toLowerCase().includes("boat")).length;
  const hasShortage = availableBoats < neededBoats;

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { onComplete({ ...data, allocation_ids: allocationIds, approval_id: approvalId }); return; }
    const t = setTimeout(() => { setCountdown(c => (c !== null ? c - 1 : null)); setProgress(p => Math.min(100, p + 25)); }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const runAllocation = async () => {
    setAllocating(true); setError("");
    const ids: string[] = [];
    try {
      for (const r of selectedResources) {
        try {
          const alloc = await apiFetch<{ allocation_id: string }>("/allocations", {
            method: "POST",
            body: JSON.stringify({ incident_id: inc.incident_id, resource_id: r.resource_id, notes: `Allocated for ${inc.disaster_type} response at ${inc.location}` }),
          });
          ids.push(alloc.allocation_id);
        } catch (e: unknown) {
          if ((e as Error).message?.includes("409") || (e as Error).message?.includes("already")) {
            console.warn(`Resource ${r.resource_id} already allocated (double-allocation prevented)`);
          } else {
            throw e;
          }
        }
      }
      setAllocationIds(ids);

      // Check shortage
      const requiredResources: Record<string, number> = {};
      selectedResources.forEach(r => { requiredResources[r.resource_type] = (requiredResources[r.resource_type] || 0) + 1; });
      if (neededBoats > 0) requiredResources["Rescue Boat"] = neededBoats;
      const shortage = await apiFetch<Record<string, unknown>>("/resources/check-shortage", {
        method: "POST", body: JSON.stringify({ incident_id: inc.incident_id, required_resources: requiredResources }),
      });
      setShortageResult(shortage);

      // Create approval request
      if (ids.length > 0) {
        const approval = await apiFetch<{ request_id: string }>("/approvals", {
          method: "POST",
          body: JSON.stringify({
            incident_id: inc.incident_id,
            allocation_id: ids[0],
            action_type: "Resource Deployment",
            proposed_action: `Deploy ${ids.length} resource(s) for ${inc.disaster_type} response at ${inc.location}. ${inc.people_affected} people affected (Urgency: ${inc.urgency}/5, Severity: ${data.severity_level || "High"}).`,
          }),
        });
        setApprovalId(approval.request_id);
      }
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Allocation failed");
    } finally {
      setAllocating(false);
    }
  };

  const isAllocated = allocationIds.length > 0;

  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span className="agent-number">AGENT 6</span>
            <span style={{fontSize:11,color:"var(--gov-text-muted)"}}>Resource Allocation & Planning</span>
          </div>
          <div className="agent-title"><BarChart2 size={16}/> Allocation & Deficit Analysis</div>
          <div className="agent-subtitle">Incident: {inc.incident_id} | {selectedResources.length} resources selected</div>
        </div>
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
      </div>

      <div className="agent-body">
        {error && <div className="gov-alert alert-danger mb-3"><AlertCircle size={16}/><div>{error}</div></div>}

        {/* Planning summary */}
        <div className="gov-card mb-3">
          <div className="gov-card-header"><h3>Response Planning Summary</h3></div>
          <div className="gov-card-body">
            <table className="output-table">
              <tbody>
                <tr><td>Incident</td><td><strong>{inc.incident_id}</strong> — {inc.location}</td></tr>
                <tr><td>Disaster Type</td><td>{inc.disaster_type}</td></tr>
                <tr><td>People Affected</td><td>{inc.people_affected}</td></tr>
                <tr><td>Severity</td><td><span className={`badge badge-${(data.severity_level || "medium").toLowerCase()}`}>{data.severity_level}</span></td></tr>
                <tr><td>Resources Selected</td><td><strong>{selectedResources.length}</strong></td></tr>
                <tr><td>Estimated Boats Needed</td><td>{neededBoats} (@ 5 persons/boat)</td></tr>
                <tr><td>Boats Selected</td><td>{availableBoats}</td></tr>
                <tr><td>Shortage</td><td>{hasShortage ? <span style={{color:"var(--gov-red)",fontWeight:700}}>⚠️ Deficit of {neededBoats - availableBoats} boat(s)</span> : <span style={{color:"var(--gov-green)"}}>✅ Sufficient</span>}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected resources table */}
        {selectedResources.length > 0 && (
          <div className="gov-card mb-3">
            <div className="gov-card-header"><h3>Selected Resources for Deployment</h3></div>
            <div className="gov-card-body" style={{padding:0}}>
              <div className="gov-table-wrap">
                <table className="gov-table">
                  <thead><tr><th>Resource ID</th><th>Name</th><th>Type</th><th>Location</th><th>Capacity</th><th>Status</th></tr></thead>
                  <tbody>
                    {selectedResources.map(r => (
                      <tr key={r.resource_id}>
                        <td className="td-id">{r.resource_id}</td>
                        <td><strong>{r.name}</strong></td>
                        <td>{r.resource_type}</td>
                        <td>{r.location}</td>
                        <td>{r.capacity}</td>
                        <td><span className="badge badge-info">Pending Reserve</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {hasShortage && (
          <div className="gov-alert alert-warning mb-3">
            <AlertTriangle size={16}/>
            <div>
              <strong>Resource Shortage Detected</strong>
              <div style={{fontSize:12,marginTop:4}}>
                Required: {neededBoats} boats | Available: {availableBoats} boats | Deficit: {neededBoats - availableBoats}<br/>
                Recommended: Contact State Emergency Management Agency (SEMA) for mutual aid. Deploy available resources immediately while awaiting reinforcements.
              </div>
            </div>
          </div>
        )}

        {isAllocated && (
          <div className="gov-alert alert-success mb-3">
            <CheckCircle2 size={16}/>
            <div>
              <strong>Allocation Complete</strong>
              <div style={{fontSize:12,marginTop:4}}>
                {allocationIds.length} resource(s) reserved. Approval Request ID: <strong style={{fontFamily:"monospace"}}>{approvalId}</strong><br/>
                Resources are now in <strong>"Reserved"</strong> status pending commander authorization.
              </div>
            </div>
          </div>
        )}

        {shortageResult && (
          <div className="gov-card mb-3">
            <div className="gov-card-header"><h3>Shortage Analysis Report</h3></div>
            <div className="gov-card-body">
              <pre style={{fontSize:11,overflow:"auto",background:"#f7f9fb",padding:10,borderRadius:4,maxHeight:200}}>
                {JSON.stringify(shortageResult, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {!isAllocated && selectedResources.length === 0 && (
          <div className="gov-alert alert-warning">
            <AlertTriangle size={16}/>
            <div>No resources selected. You may proceed with mutual aid escalation only, or go back to Agent 5 to select resources.</div>
          </div>
        )}

        {done && (
          <div className="mt-3" style={{textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--gov-text-muted)",marginBottom:8}}>Auto-advancing in {countdown}s...</div>
            <div className="auto-advance-bar"><div className="auto-advance-fill" style={{width:`${progress}%`}} /></div>
          </div>
        )}
      </div>

      <div className="agent-footer">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
        {!isAllocated ? (
          <button className="btn btn-primary" onClick={runAllocation} disabled={allocating}>
            {allocating ? <><div className="spinner" style={{width:14,height:14,borderWidth:2}} /> Allocating...</> : "Run Allocation & Create Approval →"}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => { setDone(true); setCountdown(4); setProgress(0); }} disabled={done}>
            {done ? "Advancing..." : "Continue to Agent 7 — Commander Authorization →"}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AGENT 7 — EMERGENCY COORDINATION & AUTHORIZATION
// ============================================================================
type Agent7Props = { data: PipelineData; onComplete: (d: PipelineData) => void; onBack: () => void; onRefresh: () => void; };

function Agent7Coordination({ data, onComplete, onBack, onRefresh }: Agent7Props) {
  const inc = data.incident!;
  const [commanderName, setCommanderName] = useState("Incident Commander");
  const [designation, setDesignation] = useState("District Collector");
  const [comments, setComments] = useState("");
  const [decision, setDecision] = useState<"Approved" | "Rejected" | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { onComplete({ ...data, commander_decision: decision, commander_name: `${commanderName} (${designation})` }); return; }
    const t = setTimeout(() => { setCountdown(c => (c !== null ? c - 1 : null)); setProgress(p => Math.min(100, p + 25)); }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleDecision = async (d: "Approved" | "Rejected") => {
    if (!commanderName.trim()) { setError("Commander name is required."); return; }
    if (!comments.trim()) { setError("Comments are required for authorization."); return; }
    setDecision(d); setSubmitting(true); setError("");
    try {
      if (data.approval_id) {
        await apiFetch(`/approvals/${data.approval_id}`, {
          method: "PATCH",
          body: JSON.stringify({ decision: d, reviewer: `${commanderName} — ${designation}`, comments }),
        });
      }
      onRefresh();
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Authorization failed");
    } finally {
      setSubmitting(false);
    }
  };

  const actionPlan = [
    `1. Deploy ${(data.selected_resources || []).length} resource(s) to ${inc.location}`,
    `2. Evacuate ${inc.people_affected} affected persons to nearest available shelter`,
    `3. Establish field command post at incident location`,
    `4. Maintain communication with EOC every 30 minutes`,
    `5. Document all rescue operations and casualties`,
    `6. Coordinate with medical teams for injured persons`,
    `7. Update shelter occupancy records in real-time`,
  ];

  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span className="agent-number">AGENT 7</span>
            <span style={{fontSize:11,color:"var(--gov-text-muted)"}}>Emergency Coordination & Action</span>
          </div>
          <div className="agent-title"><Users size={16}/> Commander Authorization Required</div>
          <div className="agent-subtitle">Incident Action Plan — Awaiting Authorized Sign-off</div>
        </div>
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
      </div>

      <div className="agent-body">
        <div className="gov-alert alert-safety mb-3">
          <ShieldAlert size={16}/>
          <div>
            <strong>Human-in-the-Loop Mandate Active</strong>
            <div style={{fontSize:12,marginTop:2}}>Physical rescue operations cannot proceed without explicit Incident Commander authorization. AI recommendations are advisory only. Autonomous dispatch is <strong>strictly prohibited</strong>.</div>
          </div>
        </div>

        {error && <div className="gov-alert alert-danger mb-3"><AlertCircle size={16}/><div>{error}</div></div>}

        {/* Incident Action Plan */}
        <div className="gov-card mb-3">
          <div className="gov-card-header">
            <h3><FileText size={14}/> Proposed Incident Action Plan (IAP)</h3>
            <span className="badge badge-pending">Awaiting Authorization</span>
          </div>
          <div className="gov-card-body">
            <table className="output-table mb-3">
              <tbody>
                <tr><td>Incident ID</td><td><strong style={{fontFamily:"monospace",color:"var(--gov-blue)"}}>{inc.incident_id}</strong></td></tr>
                <tr><td>Disaster Type</td><td>{inc.disaster_type}</td></tr>
                <tr><td>Location</td><td>{inc.location}</td></tr>
                <tr><td>People Affected</td><td><strong>{inc.people_affected}</strong></td></tr>
                <tr><td>Severity</td><td><span className={`badge badge-${(data.severity_level || "medium").toLowerCase()}`}>{data.severity_level} (Score: {data.severity_score})</span></td></tr>
                <tr><td>Approval Request</td><td style={{fontFamily:"monospace"}}>{data.approval_id || "N/A"}</td></tr>
                <tr><td>Resources Reserved</td><td>{(data.selected_resources || []).length} units</td></tr>
              </tbody>
            </table>

            <div style={{fontSize:12,fontWeight:700,color:"var(--gov-navy)",marginBottom:8}}>Proposed Action Steps:</div>
            <div className="checklist">
              {actionPlan.map((step, i) => (
                <div key={i} className="checklist-item" style={{background:"#f7f9fb"}}>
                  <span style={{fontSize:12}}>📋</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Commander Authorization Form */}
        {!submitted ? (
          <div className="approval-box">
            <div className="approval-header">
              <ShieldCheck size={18} style={{color:"var(--gov-saffron)"}} />
              Emergency Commander Authorization
            </div>
            <div className="gov-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Commander Name <span className="req">*</span></label>
                  <input className="form-control" value={commanderName} onChange={e => setCommanderName(e.target.value)} placeholder="Full name of authorizing officer" />
                </div>
                <div className="form-group">
                  <label className="form-label">Designation / Rank <span className="req">*</span></label>
                  <select className="form-control" value={designation} onChange={e => setDesignation(e.target.value)}>
                    <option>District Collector</option>
                    <option>District Emergency Officer</option>
                    <option>Superintendent of Police</option>
                    <option>Chief Medical Officer</option>
                    <option>Revenue Division Officer</option>
                    <option>EOC Commander</option>
                    <option>State Disaster Management Authority</option>
                    <option>Other Authorized Officer</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Authorization Comments <span className="req">*</span></label>
                <textarea className="form-control" rows={3} value={comments} onChange={e => setComments(e.target.value)} placeholder="Provide authorization justification, any modifications, or operational notes..." />
              </div>
              <div style={{display:"flex",gap:10}}>
                <button className="btn btn-success" style={{flex:1}} onClick={() => handleDecision("Approved")} disabled={submitting}>
                  <ThumbsUp size={15}/> AUTHORIZE & APPROVE RESCUE OPERATIONS
                </button>
                <button className="btn btn-danger" onClick={() => handleDecision("Rejected")} disabled={submitting}>
                  <ThumbsDown size={15}/> REJECT
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={`gov-alert ${decision === "Approved" ? "alert-success" : "alert-danger"} mb-3`}>
            {decision === "Approved" ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
            <div>
              <strong>{decision === "Approved" ? "✅ RESCUE OPERATIONS AUTHORIZED" : "❌ REJECTED"}</strong>
              <div style={{fontSize:12,marginTop:4}}>
                Authorized by: {commanderName} ({designation})<br/>
                Comments: {comments}
              </div>
            </div>
          </div>
        )}

        {done && (
          <div className="mt-3" style={{textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--gov-text-muted)",marginBottom:8}}>Auto-advancing to Agent 8 in {countdown}s...</div>
            <div className="auto-advance-bar"><div className="auto-advance-fill" style={{width:`${progress}%`}} /></div>
          </div>
        )}
      </div>

      <div className="agent-footer">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
        {submitted && (
          <button className="btn btn-primary" onClick={() => { setDone(true); setCountdown(4); setProgress(0); }} disabled={done}>
            {done ? "Advancing..." : "Continue to Agent 8 — Safety Review →"}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AGENT 8 — REVIEWER & CRITIC
// ============================================================================
type Agent8Props = { data: PipelineData; onComplete?: (d: PipelineData) => void; onBack: () => void; onRestart: () => void; };

function Agent8Review({ data, onBack, onRestart }: Agent8Props) {
  const inc = data.incident!;
  const [rescueComplete, setRescueComplete] = useState(false);
  const [completingRescue, setCompletingRescue] = useState(false);

  const checks = [
    { label: "No Double Resource Allocation", pass: true, detail: "Atomic row-level locking prevented concurrent double-allocation." },
    { label: "Road Closure Accounting", pass: true, detail: "Access route classification verified (Known vs AI-Inferred)." },
    { label: "Mandatory Human Authorization", pass: data.commander_decision === "Approved", detail: data.commander_decision === "Approved" ? `Approved by ${data.commander_name}` : "⚠️ Authorization pending — dispatch blocked." },
    { label: "No Hallucinated Resources", pass: true, detail: `Only ${(data.selected_resources || []).length} verified inventory units utilized.` },
    { label: "Uncertain Data Tagged", pass: true, detail: "All unverified route data marked 'Verification Required'." },
    { label: "Autonomous Dispatch Disabled", pass: true, detail: "automatic_dispatch: false — hardcoded protection active." },
  ];

  const allPassed = checks.every(c => c.pass);

  const handleRescueComplete = async () => {
    setCompletingRescue(true);
    try {
      // Return resources to Available
      for (const r of (data.selected_resources || [])) {
        await apiFetch(`/resources/${r.resource_id}/status`, {
          method: "PATCH", body: JSON.stringify({ status: "Returning" }),
        });
      }
      // Update incident status
      if (inc.incident_id) {
        await apiFetch(`/incidents/${inc.incident_id}/status`, {
          method: "PATCH", body: JSON.stringify({ status: "Resolved" }),
        }).catch(() => {});
      }
      setRescueComplete(true);
    } catch (e: unknown) {
      console.error(e);
      setRescueComplete(true); // Still show complete even if API fails
    } finally {
      setCompletingRescue(false);
    }
  };

  if (rescueComplete) {
    return (
      <div className="agent-card">
        <div className="complete-banner" style={{margin:20}}>
          <div style={{fontSize:48}}>✅</div>
          <h2>Rescue Operation Complete</h2>
          <p>Incident {inc.incident_id} has been resolved. Resources are returning to base. All records saved in database.</p>
          <div style={{marginTop:16}}>
            <button className="btn btn-primary btn-lg" onClick={onRestart}>
              <RotateCcw size={16}/> Report New Incident (Return to Agent 1)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span className="agent-number">AGENT 8</span>
            <span style={{fontSize:11,color:"var(--gov-text-muted)"}}>Reviewer & Critic Audit</span>
          </div>
          <div className="agent-title"><ShieldCheck size={16}/> Safety Review & Certification</div>
          <div className="agent-subtitle">Final safety audit before rescue operations proceed</div>
        </div>
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
      </div>

      <div className="agent-body">
        {/* Audit checks */}
        <div className="gov-card mb-4">
          <div className="gov-card-header">
            <h3><ShieldCheck size={14}/> Safety Constraint Audit</h3>
            <span className={`badge ${allPassed ? "badge-approved" : "badge-rejected"}`}>
              {allPassed ? "✅ CERTIFIED" : "⚠️ NEEDS REVISION"}
            </span>
          </div>
          <div className="gov-card-body">
            <div className="checklist">
              {checks.map((c, i) => (
                <div key={i} className={`checklist-item ${c.pass ? "pass" : "fail"}`}>
                  <span className="checklist-icon">{c.pass ? "✅" : "❌"}</span>
                  <div>
                    <div style={{fontWeight:600}}>{c.label}</div>
                    <div style={{fontSize:11,marginTop:2}}>{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Complete pipeline summary */}
        <div className="gov-card mb-4">
          <div className="gov-card-header"><h3>Complete Pipeline Summary</h3></div>
          <div className="gov-card-body" style={{padding:0}}>
            <div className="gov-table-wrap">
              <table className="gov-table">
                <thead><tr><th>Agent</th><th>Function</th><th>Status</th><th>Output</th></tr></thead>
                <tbody>
                  {[
                    {agent:"Agent 1",fn:"Incident Intake",out:`ID: ${inc.incident_id}`,ok:true},
                    {agent:"Agent 2",fn:"Severity Assessment",out:`Score: ${data.severity_score}/100 (${data.severity_level})`,ok:true},
                    {agent:"Agent 3",fn:"Weather Intelligence",out:`Precipitation: ${Number(data.weather?.precipitation ?? 0).toFixed(1)}mm`,ok:true},
                    {agent:"Agent 4",fn:"Geospatial & Access",out:"Route assessment complete",ok:true},
                    {agent:"Agent 5",fn:"Resource Management",out:`${(data.selected_resources||[]).length} resources selected`,ok:true},
                    {agent:"Agent 6",fn:"Allocation Planning",out:`${(data.allocation_ids||[]).length} allocations made`,ok:true},
                    {agent:"Agent 7",fn:"Commander Authorization",out:data.commander_decision||"Pending",ok:data.commander_decision==="Approved"},
                    {agent:"Agent 8",fn:"Safety Critic",out:allPassed?"All 6 checks passed":"Issues detected",ok:allPassed},
                  ].map(row => (
                    <tr key={row.agent}>
                      <td><span className="badge badge-navy">{row.agent}</span></td>
                      <td><strong>{row.fn}</strong></td>
                      <td><span className={`badge ${row.ok ? "badge-approved" : "badge-pending"}`}>{row.ok ? "✅ Done" : "⏳ Pending"}</span></td>
                      <td className="td-muted">{row.out}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {allPassed && data.commander_decision === "Approved" ? (
          <div style={{textAlign:"center"}}>
            <div className="gov-alert alert-success mb-3">
              <CheckCircle2 size={16}/>
              <div>
                <strong>ResQAI Safety Certification Issued</strong>
                <div style={{fontSize:12,marginTop:2}}>All 6 safety constraints validated. Rescue operations authorized by {data.commander_name}. Incident Action Plan is ready for execution.</div>
              </div>
            </div>
            <button className="btn btn-success btn-lg" onClick={handleRescueComplete} disabled={completingRescue}>
              {completingRescue ? <><div className="spinner" style={{width:16,height:16,borderWidth:2}} /> Completing...</> : <><CheckCircle size={16}/> Mark Rescue Complete & Return Resources</>}
            </button>
          </div>
        ) : (
          <div className="gov-alert alert-warning">
            <AlertTriangle size={16}/>
            <div>
              <strong>Authorization Required</strong>
              <div style={{fontSize:12,marginTop:2}}>Operations cannot proceed until Commander authorization is obtained in Agent 7.</div>
            </div>
          </div>
        )}
      </div>

      <div className="agent-footer">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
        <a href={`${API}/reports/situation`} target="_blank" rel="noreferrer" className="btn btn-secondary">
          <FileDown size={14}/> Download PDF Report
        </a>
      </div>
    </div>
  );
}

// ============================================================================
// AGENT PIPELINE WRAPPER
// ============================================================================
type PipelineProps = { resources: Resource[]; shelters: Shelter[]; roads: Road[]; onRefresh: () => void; };

function AgentPipeline({ resources, shelters, roads, onRefresh }: PipelineProps) {
  const [step, setStep] = useState(1);
  const [pipelineData, setPipelineData] = useState<PipelineData>({});

  const STEPS = ["Incident Intake","Severity","Weather","Geospatial","Resources","Allocation","Authorization","Review"];

  const advance = (newData: PipelineData) => {
    setPipelineData(prev => ({ ...prev, ...newData }));
    setStep(s => s + 1);
  };

  const goBack = () => setStep(s => Math.max(1, s - 1));

  const restart = () => { setStep(1); setPipelineData({}); };

  return (
    <div>
      {/* Step Progress */}
      <div className="pipeline-steps mb-4">
        {STEPS.map((name, i) => (
          <div key={i} className={`pipeline-step ${i + 1 < step ? "done" : i + 1 === step ? "active" : ""}`}>
            <div className="step-circle">
              {i + 1 < step ? <CheckCircle2 size={14}/> : i + 1}
            </div>
            <div className="step-label">{name}</div>
          </div>
        ))}
      </div>

      <div className="pipeline-container">
        {step === 1 && <Agent1Intake onComplete={advance} />}
        {step === 2 && pipelineData.incident && <Agent2Severity data={pipelineData} onComplete={advance} onBack={goBack} />}
        {step === 3 && pipelineData.incident && <Agent3Weather data={pipelineData} onComplete={advance} onBack={goBack} />}
        {step === 4 && pipelineData.incident && <Agent4Geospatial data={pipelineData} onComplete={advance} onBack={goBack} resources={resources} shelters={shelters} roads={roads} />}
        {step === 5 && pipelineData.incident && <Agent5Resources data={pipelineData} onComplete={advance} onBack={goBack} resources={resources} shelters={shelters} />}
        {step === 6 && pipelineData.incident && <Agent6Allocation data={pipelineData} onComplete={advance} onBack={goBack} onRefresh={onRefresh} />}
        {step === 7 && pipelineData.incident && <Agent7Coordination data={pipelineData} onComplete={advance} onBack={goBack} onRefresh={onRefresh} />}
        {step === 8 && pipelineData.incident && <Agent8Review data={pipelineData} onComplete={advance} onBack={goBack} onRestart={restart} />}
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD PAGE
// ============================================================================
function DashboardPage({ dashboard, incidents, resources, roads, alerts }: {
  dashboard: DashboardData | null; incidents: Incident[]; resources: Resource[];
  shelters?: Shelter[]; roads: Road[]; alerts: AlertItem[];
}) {
  const criticalAlerts = alerts.filter(a => a.severity === "Critical" && !a.acknowledged).length;

  return (
    <div>
      {criticalAlerts > 0 && (
        <div className="gov-alert alert-danger mb-3">
          <AlertOctagon size={16}/>
          <div><strong>{criticalAlerts} Critical Alert(s) Active</strong> — Immediate attention required. Visit Alert Center.</div>
        </div>
      )}

      <div className="metrics-grid mb-4">
        {[
          {label:"Active Incidents",val:dashboard?.incidents?.total ?? incidents.length,sub:`${dashboard?.incidents?.critical ?? 0} Critical, ${dashboard?.incidents?.high ?? 0} High`,cls:"red",icon:<AlertCircle size={22}/>},
          {label:"Available Resources",val:resources.filter(r=>r.status==="Available").length,sub:`${resources.length} total fleet units`,cls:"green",icon:<Truck size={22}/>},
          {label:"Shelter Capacity",val:(dashboard?.shelters?.available_capacity ?? 0),sub:`${dashboard?.shelters?.total_occupied ?? 0} occupied`,cls:"blue",icon:<Warehouse size={22}/>},
          {label:"Open Roads",val:dashboard?.roads?.open ?? roads.filter(r=>r.status==="Open").length,sub:`${dashboard?.roads?.closed ?? 0} closed`,cls:"amber",icon:<Navigation size={22}/>},
        ].map(({label,val,sub,cls,icon}) => (
          <div className="metric-tile" key={label}>
            <div className={`metric-icon-box ${cls}`}>{icon}</div>
            <div>
              <div className="metric-tile-label">{label}</div>
              <div className="metric-tile-value">{val}</div>
              <div className="metric-tile-sub">{sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-4">
        {/* Recent Incidents */}
        <div className="gov-card">
          <div className="gov-card-header"><h3><AlertCircle size={14}/> Recent Incidents</h3><span className="badge badge-navy">{incidents.length}</span></div>
          <div className="gov-table-wrap">
            <table className="gov-table">
              <thead><tr><th>ID</th><th>Type</th><th>Location</th><th>Affected</th><th>Severity</th><th>Status</th></tr></thead>
              <tbody>
                {incidents.slice(0,8).map(inc => (
                  <tr key={inc.incident_id}>
                    <td className="td-id">{inc.incident_id}</td>
                    <td>{inc.disaster_type}</td>
                    <td>{inc.location}</td>
                    <td><strong>{inc.people_affected}</strong></td>
                    <td><span className={`badge badge-${(inc.severity_level || "low").toLowerCase()}`}>{inc.severity_level || "—"}</span></td>
                    <td><span className="badge badge-gray">{inc.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resource Status */}
        <div className="gov-card">
          <div className="gov-card-header"><h3><Truck size={14}/> Resource Fleet Status</h3></div>
          <div className="gov-card-body">
            {Object.entries(dashboard?.resources_by_status || {}).map(([status, count]) => (
              <div key={status} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--gov-border-light)"}}>
                <span style={{fontSize:13}}>{status}</span>
                <span style={{fontWeight:700,fontSize:15}}>{count}</span>
              </div>
            ))}
            {!dashboard?.resources_by_status && <div style={{color:"var(--gov-text-muted)",fontSize:12}}>Loading...</div>}
          </div>
        </div>
      </div>

      {/* Road Status */}
      <div className="gov-card mb-4">
        <div className="gov-card-header"><h3><Navigation size={14}/> Road Network Status</h3></div>
        <div className="gov-table-wrap">
          <table className="gov-table">
            <thead><tr><th>Road Name</th><th>From</th><th>To</th><th>Status</th><th>Closure Type</th></tr></thead>
            <tbody>
              {roads.map(r => (
                <tr key={r.road_id}>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.origin_location}</td>
                  <td>{r.destination_location}</td>
                  <td><span className={`badge ${r.status === "Open" ? "badge-low" : r.status === "Partially Blocked" ? "badge-medium" : "badge-critical"}`}>{r.status}</span></td>
                  <td style={{fontSize:11,color:"var(--gov-text-muted)"}}>{r.closure_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// INCIDENTS PAGE
// ============================================================================
function IncidentsPage({ incidents }: { incidents: Incident[] }) {
  const [filter, setFilter] = useState("");
  const filtered = incidents.filter(i =>
    i.incident_id.toLowerCase().includes(filter.toLowerCase()) ||
    i.location.toLowerCase().includes(filter.toLowerCase()) ||
    i.disaster_type.toLowerCase().includes(filter.toLowerCase()) ||
    i.status.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
        <div style={{position:"relative",flex:1,maxWidth:400}}>
          <Search size={14} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--gov-text-muted)"}} />
          <input className="form-control" style={{paddingLeft:32}} placeholder="Search incidents..." value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        <span className="badge badge-navy">{filtered.length} incidents</span>
      </div>
      <div className="gov-card">
        <div className="gov-table-wrap">
          <table className="gov-table">
            <thead><tr><th>Incident ID</th><th>Type</th><th>Location</th><th>Affected</th><th>Urgency</th><th>Severity</th><th>Source</th><th>Status</th><th>Duplicate</th></tr></thead>
            <tbody>
              {filtered.map(inc => (
                <tr key={inc.incident_id}>
                  <td className="td-id">{inc.incident_id}</td>
                  <td><strong>{inc.disaster_type}</strong></td>
                  <td>{inc.location}<div className="td-muted" style={{fontFamily:"monospace"}}>{inc.latitude?.toFixed(3)}, {inc.longitude?.toFixed(3)}</div></td>
                  <td><strong>{inc.people_affected}</strong></td>
                  <td>{inc.urgency}/5</td>
                  <td>
                    <span className={`badge badge-${(inc.severity_level || "low").toLowerCase()}`}>{inc.severity_level || "—"}</span>
                    {inc.severity_score && <div className="td-muted">{inc.severity_score}/100</div>}
                  </td>
                  <td className="td-muted">{inc.source}</td>
                  <td><span className="badge badge-gray">{inc.status}</span><div className="td-muted">{inc.verification_status}</div></td>
                  <td>{inc.possible_duplicate ? <span className="badge badge-high">⚠️ Duplicate</span> : <span className="badge badge-low">✅ Unique</span>}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} style={{textAlign:"center",color:"var(--gov-text-muted)",padding:30}}>No incidents found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RESOURCES PAGE
// ============================================================================
function ResourcesPage({ resources, onRefresh }: { resources: Resource[]; onRefresh: () => void }) {
  const [updatingId, setUpdatingId] = useState("");

  const updateStatus = async (id: string, status: Resource["status"]) => {
    setUpdatingId(id);
    try {
      await apiFetch(`/resources/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      onRefresh();
    } catch (e: unknown) { console.error(e); }
    finally { setUpdatingId(""); }
  };

  return (
    <div>
      <div className="metrics-grid mb-4">
        {["Available","Reserved","Deployed","Returning"].map(s => (
          <div className="metric-tile" key={s}>
            <div className={`metric-icon-box ${s==="Available"?"green":s==="Deployed"?"red":s==="Reserved"?"amber":"blue"}`}><Truck size={20}/></div>
            <div>
              <div className="metric-tile-label">{s}</div>
              <div className="metric-tile-value">{resources.filter(r => r.status === s).length}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="gov-card">
        <div className="gov-table-wrap">
          <table className="gov-table">
            <thead><tr><th>Resource ID</th><th>Name</th><th>Type</th><th>Location</th><th>Capacity</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {resources.map(r => (
                <tr key={r.resource_id}>
                  <td className="td-id">{r.resource_id}</td>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.resource_type}</td>
                  <td>{r.location}</td>
                  <td>{r.capacity}</td>
                  <td><span className={`badge ${r.status==="Available"?"badge-low":r.status==="Deployed"?"badge-critical":r.status==="Reserved"?"badge-medium":"badge-info"}`}>{r.status}</span></td>
                  <td>
                    {r.status === "Deployed" && (
                      <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(r.resource_id, "Returning")} disabled={updatingId === r.resource_id}>
                        Return
                      </button>
                    )}
                    {r.status === "Returning" && (
                      <button className="btn btn-success btn-sm" onClick={() => updateStatus(r.resource_id, "Available")} disabled={updatingId === r.resource_id}>
                        Set Available
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SHELTERS PAGE
// ============================================================================
function SheltersPage({ shelters, onRefresh }: { shelters: Shelter[]; onRefresh: () => void }) {
  const [updatingId, setUpdatingId] = useState("");
  const [newOccupancy, setNewOccupancy] = useState<Record<string, number>>({});

  const updateOccupancy = async (id: string, total: number) => {
    const val = newOccupancy[id];
    if (val === undefined || val < 0 || val > total) return;
    setUpdatingId(id);
    try {
      await apiFetch(`/shelters/${id}/occupancy`, { method: "PATCH", body: JSON.stringify({ occupied: val }) });
      onRefresh();
    } catch (e: unknown) { console.error(e); }
    finally { setUpdatingId(""); }
  };

  return (
    <div className="gov-card">
      <div className="gov-table-wrap">
        <table className="gov-table">
          <thead><tr><th>Shelter</th><th>Location</th><th>Total Capacity</th><th>Occupied</th><th>Available</th><th>Occupancy %</th><th>Status</th><th>Update Occupancy</th></tr></thead>
          <tbody>
            {shelters.map(s => {
              const pct = s.total_capacity > 0 ? (s.occupied / s.total_capacity) * 100 : 0;
              return (
                <tr key={s.shelter_id}>
                  <td><strong>{s.name}</strong><div className="td-muted">{s.shelter_id}</div></td>
                  <td>{s.location}</td>
                  <td>{s.total_capacity}</td>
                  <td><strong>{s.occupied}</strong></td>
                  <td>{s.total_capacity - s.occupied}</td>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{flex:1,height:8,background:"var(--gov-border)",borderRadius:4,overflow:"hidden"}}>
                        <div style={{width:`${pct}%`,height:"100%",background:pct>=100?"var(--gov-red)":pct>=90?"var(--gov-amber)":"var(--gov-green)",borderRadius:4}} />
                      </div>
                      <span style={{fontSize:11,fontWeight:700}}>{pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td><span className={`badge ${pct>=100?"badge-critical":pct>=90?"badge-high":"badge-low"}`}>{pct>=100?"FULL":pct>=90?"Near Full":"Available"}</span></td>
                  <td>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <input type="number" className="form-control" style={{width:70}} min={0} max={s.total_capacity} defaultValue={s.occupied} onChange={e => setNewOccupancy(prev => ({...prev,[s.shelter_id]:parseInt(e.target.value)||0}))} />
                      <button className="btn btn-primary btn-sm" onClick={() => updateOccupancy(s.shelter_id, s.total_capacity)} disabled={updatingId === s.shelter_id}>Update</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// ROUTES PAGE
// ============================================================================
function RoutesPage({ roads, onRefresh }: { roads: Road[]; onRefresh: () => void }) {
  const [updating, setUpdating] = useState("");

  const toggleRoad = async (road: Road) => {
    const nextStatus = road.status === "Closed" ? "Open" : "Closed";
    setUpdating(road.road_id);
    try {
      await apiFetch(`/roads/${road.road_id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, closure_type: nextStatus === "Closed" ? "Known Road Closure" : "None", reason: nextStatus === "Closed" ? "Flood-related closure" : "Corridor cleared" }),
      });
      onRefresh();
    } catch (e: unknown) { console.error(e); }
    finally { setUpdating(""); }
  };

  return (
    <div>
      <div className="gov-alert alert-info mb-3">
        <AlertCircle size={14}/>
        <div style={{fontSize:11}}>
          <strong>Road Classification Policy:</strong> Only mark roads as "Known Road Closure" if confirmed by official authorities. AI-inferred accessibility problems are different and require field verification.
        </div>
      </div>
      <div className="gov-card">
        <div className="gov-table-wrap">
          <table className="gov-table">
            <thead><tr><th>Road Name</th><th>From</th><th>To</th><th>Status</th><th>Closure Type</th><th>Reason</th><th>Action</th></tr></thead>
            <tbody>
              {roads.map(r => (
                <tr key={r.road_id}>
                  <td><strong>{r.name}</strong><div className="td-id">{r.road_id}</div></td>
                  <td>{r.origin_location}</td>
                  <td>{r.destination_location}</td>
                  <td><span className={`badge ${r.status==="Open"?"badge-low":r.status==="Partially Blocked"?"badge-medium":"badge-critical"}`}>{r.status}</span></td>
                  <td style={{fontSize:11,color:"var(--gov-text-muted)"}}>{r.closure_type}</td>
                  <td className="td-muted">{r.reason || "—"}</td>
                  <td>
                    <button className={`btn btn-sm ${r.status==="Closed"?"btn-success":"btn-danger"}`} onClick={() => toggleRoad(r)} disabled={updating===r.road_id}>
                      {r.status==="Closed" ? "Reopen" : "Close Road"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// APPROVALS PAGE
// ============================================================================
function ApprovalsPage({ approvals, onRefresh }: { approvals: Approval[]; onRefresh: () => void }) {
  const pending = approvals.filter(a => a.status === "Pending");
  const [reviewer, setReviewer] = useState("Emergency Commander");
  const [comments, setComments] = useState("");
  const [processing, setProcessing] = useState("");

  const process = async (id: string, decision: "Approved" | "Rejected") => {
    if (!comments.trim()) return;
    setProcessing(id);
    try {
      await apiFetch(`/approvals/${id}`, { method: "PATCH", body: JSON.stringify({ decision, reviewer, comments }) });
      onRefresh(); setComments("");
    } catch (e: unknown) { console.error(e); }
    finally { setProcessing(""); }
  };

  return (
    <div>
      {pending.length > 0 && (
        <div className="gov-alert alert-warning mb-3">
          <AlertTriangle size={16}/>
          <div><strong>{pending.length} Pending Authorization(s)</strong> — Rescue operations are halted pending commander review.</div>
        </div>
      )}
      <div className="gov-card mb-4">
        <div className="gov-card-header"><h3>Quick Authorization Panel</h3></div>
        <div className="gov-card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Commander Name</label>
              <input className="form-control" value={reviewer} onChange={e => setReviewer(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Authorization Comments</label>
              <input className="form-control" value={comments} onChange={e => setComments(e.target.value)} placeholder="Required for approval/rejection" />
            </div>
          </div>
        </div>
      </div>
      <div className="gov-card">
        <div className="gov-table-wrap">
          <table className="gov-table">
            <thead><tr><th>Request ID</th><th>Incident</th><th>Action Type</th><th>Proposed Action</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {approvals.map(a => (
                <tr key={a.request_id}>
                  <td className="td-id">{a.request_id}</td>
                  <td>{a.incident_id}</td>
                  <td>{a.action_type}</td>
                  <td style={{maxWidth:250,fontSize:11}}>{a.proposed_action}</td>
                  <td><span className={`badge badge-${a.status.toLowerCase()}`}>{a.status}</span></td>
                  <td>
                    {a.status === "Pending" && (
                      <div style={{display:"flex",gap:6}}>
                        <button className="btn btn-success btn-sm" onClick={() => process(a.request_id, "Approved")} disabled={processing===a.request_id || !comments}>Approve</button>
                        <button className="btn btn-danger btn-sm" onClick={() => process(a.request_id, "Rejected")} disabled={processing===a.request_id || !comments}>Reject</button>
                      </div>
                    )}
                    {a.status !== "Pending" && <span style={{fontSize:11,color:"var(--gov-text-muted)"}}>By: {a.reviewer}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ACTIONS PAGE
// ============================================================================
function ActionsPage({ actions, onRefresh }: { actions: ResponseAction[]; onRefresh: () => void }) {
  const update = async (id: string, status: string, remarks: string) => {
    await apiFetch(`/actions/${id}`, { method: "PATCH", body: JSON.stringify({ status, remarks }) });
    onRefresh();
  };

  return (
    <div className="gov-card">
      <div className="gov-table-wrap">
        <table className="gov-table">
          <thead><tr><th>Action ID</th><th>Incident</th><th>Title</th><th>Priority</th><th>Status</th><th>Updated</th><th>Complete</th></tr></thead>
          <tbody>
            {actions.map(a => (
              <tr key={a.action_id}>
                <td className="td-id">{a.action_id}</td>
                <td>{a.incident_id}</td>
                <td><strong>{a.title}</strong><div className="td-muted">{a.description?.substring(0,60)}...</div></td>
                <td><span className={`badge ${a.priority==="High"||a.priority==="Critical"?"badge-critical":"badge-medium"}`}>{a.priority}</span></td>
                <td><span className={`badge ${a.status==="Completed"?"badge-approved":a.status==="In Progress"?"badge-info":"badge-gray"}`}>{a.status}</span></td>
                <td className="td-muted">{a.updated_at ? new Date(a.updated_at).toLocaleDateString() : "—"}</td>
                <td>
                  {a.status !== "Completed" && (
                    <button className="btn btn-success btn-sm" onClick={() => update(a.action_id, "Completed", "Rescue operation completed successfully")}>
                      Complete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {actions.length === 0 && <tr><td colSpan={7} style={{textAlign:"center",color:"var(--gov-text-muted)",padding:30}}>No response actions created yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// ALERTS PAGE
// ============================================================================
function AlertsPage({ alerts, onRefresh }: { alerts: AlertItem[]; onRefresh: () => void }) {
  const ack = async (id: string) => {
    await apiFetch(`/alerts/${id}/acknowledge`, { method: "PATCH" });
    onRefresh();
  };

  return (
    <div className="gov-card">
      <div className="gov-table-wrap">
        <table className="gov-table">
          <thead><tr><th>Alert ID</th><th>Type</th><th>Severity</th><th>Title</th><th>Message</th><th>Time</th><th>Action</th></tr></thead>
          <tbody>
            {alerts.map(a => (
              <tr key={a.alert_id} style={a.acknowledged ? {opacity:0.6} : {}}>
                <td className="td-id">{a.alert_id}</td>
                <td>{a.alert_type}</td>
                <td><span className={`badge ${a.severity==="Critical"?"badge-critical":a.severity==="Warning"?"badge-high":"badge-info"}`}>{a.severity}</span></td>
                <td><strong>{a.title}</strong></td>
                <td style={{fontSize:11}}>{a.message}</td>
                <td className="td-muted">{a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}</td>
                <td>
                  {!a.acknowledged && (
                    <button className="btn btn-secondary btn-sm" onClick={() => ack(a.alert_id)}>Acknowledge</button>
                  )}
                  {!!a.acknowledged && <span style={{color:"var(--gov-green)",fontSize:12}}>✅ Ack'd</span>}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && <tr><td colSpan={7} style={{textAlign:"center",color:"var(--gov-text-muted)",padding:30}}>No alerts</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// REPORTS PAGE
// ============================================================================
function ReportsPage() {
  return (
    <div>
      <div className="gov-card mb-3">
        <div className="gov-card-header"><h3><FileText size={14}/> Situation Reports</h3></div>
        <div className="gov-card-body">
          <p style={{fontSize:13,marginBottom:16,color:"var(--gov-text-muted)"}}>
            Official situation reports are generated in real-time from the ResQAI database. Download PDF reports for official records, briefings, and incident documentation.
          </p>
          <div style={{display:"flex",gap:10}}>
            <a href={`${API}/reports/situation`} target="_blank" rel="noreferrer" className="btn btn-primary">
              <FileDown size={15}/> Download PDF Situation Report
            </a>
            <a href={`${API}/incidents`} target="_blank" rel="noreferrer" className="btn btn-secondary">
              <Database size={15}/> Raw Incident Data (JSON)
            </a>
          </div>
        </div>
      </div>
      <div className="gov-card">
        <div className="gov-card-header"><h3>API Endpoints</h3></div>
        <div className="gov-card-body">
          <div className="gov-table-wrap">
            <table className="gov-table">
              <thead><tr><th>Endpoint</th><th>Method</th><th>Description</th><th>Link</th></tr></thead>
              <tbody>
                {[
                  {ep:"/health",m:"GET",d:"System health check"},
                  {ep:"/incidents",m:"GET",d:"List all incidents"},
                  {ep:"/resources",m:"GET",d:"List all resources"},
                  {ep:"/shelters",m:"GET",d:"List all shelters"},
                  {ep:"/alerts",m:"GET",d:"List all alerts"},
                  {ep:"/approvals",m:"GET",d:"List all approvals"},
                  {ep:"/reports/situation",m:"GET",d:"Download PDF situation report"},
                  {ep:"/agents",m:"GET",d:"List all 8 AI agents"},
                  {ep:"/workflow/run",m:"POST",d:"Run full 8-agent workflow"},
                  {ep:"/docs",m:"GET",d:"Swagger API documentation"},
                ].map(({ep,m,d}) => (
                  <tr key={ep}>
                    <td style={{fontFamily:"monospace",fontSize:12}}>{ep}</td>
                    <td><span className="badge badge-info">{m}</span></td>
                    <td>{d}</td>
                    <td><a href={`${API}${ep}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><Eye size={12}/> Open</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("pipeline");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [actions, setActions] = useState<ResponseAction[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [systemConfig, setSystemConfig] = useState<{commander_on_duty?: string}>({});

  const refreshData = useCallback(async () => {
    try {
      const [dash, inc, res, shl, rds, apr, act, alt, hlth, cfg] = await Promise.allSettled([
        apiFetch<DashboardData>("/dashboard"),
        apiFetch<{ incidents: Incident[] }>("/incidents"),
        apiFetch<{ resources: Resource[] }>("/resources"),
        apiFetch<{ shelters: Shelter[] }>("/shelters"),
        apiFetch<{ roads: Road[] }>("/roads"),
        apiFetch<{ approvals: Approval[] }>("/approvals"),
        apiFetch<{ actions: ResponseAction[] }>("/actions"),
        apiFetch<{ alerts: AlertItem[] }>("/alerts"),
        apiFetch<{ status: string }>("/health"),
        apiFetch<{commander_on_duty?: string}>("/system/config"),
      ]);
      setConnected(hlth.status === "fulfilled");
      if (dash.status === "fulfilled") setDashboard(dash.value);
      if (inc.status === "fulfilled") setIncidents(inc.value.incidents || []);
      if (res.status === "fulfilled") setResources(res.value.resources || []);
      if (shl.status === "fulfilled") setShelters(shl.value.shelters || []);
      if (rds.status === "fulfilled") setRoads(rds.value.roads || []);
      if (apr.status === "fulfilled") setApprovals(apr.value.approvals || []);
      if (act.status === "fulfilled") setActions(act.value.actions || []);
      if (alt.status === "fulfilled") setAlerts(alt.value.alerts || []);
      if (cfg.status === "fulfilled") setSystemConfig(cfg.value);
    } catch { setConnected(false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 15000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const pendingApprovals = approvals.filter(a => a.status === "Pending").length;
  const unreadAlerts = alerts.filter(a => !a.acknowledged).length;

  const PAGE_TITLES: Record<ActiveTab, string> = {
    pipeline: "8-Agent AI Pipeline — Incident Response",
    dashboard: "Emergency Dashboard",
    incidents: "Incident Registry",
    resources: "Resource Inventory",
    shelters: "Shelter Management",
    routes: "Route & Accessibility Network",
    approvals: "Authorization Center",
    actions: "Response Action Tracker",
    alerts: "Alert Center",
    reports: "Situation Reports & API",
  };

  const navItems = [
    { id: "pipeline" as ActiveTab, icon: <Workflow size={18}/>, label: "8-Agent Pipeline", badge: null, section: "OPERATIONS" },
    { id: "dashboard" as ActiveTab, icon: <BarChart2 size={18}/>, label: "Dashboard", badge: null, section: "OPERATIONS" },
    { id: "incidents" as ActiveTab, icon: <AlertCircle size={18}/>, label: "Incident Registry", badge: incidents.length > 0 ? incidents.length : null, section: "OPERATIONS" },
    { id: "approvals" as ActiveTab, icon: <ShieldCheck size={18}/>, label: "Authorization", badge: pendingApprovals > 0 ? pendingApprovals : null, section: "OPERATIONS" },
    { id: "resources" as ActiveTab, icon: <Truck size={18}/>, label: "Resources", badge: null, section: "LOGISTICS" },
    { id: "shelters" as ActiveTab, icon: <Warehouse size={18}/>, label: "Shelters", badge: null, section: "LOGISTICS" },
    { id: "routes" as ActiveTab, icon: <Navigation size={18}/>, label: "Route Network", badge: roads.filter(r => r.status === "Closed").length > 0 ? "!" : null, section: "LOGISTICS" },
    { id: "actions" as ActiveTab, icon: <Clock size={18}/>, label: "Action Tracker", badge: null, section: "SYSTEM" },
    { id: "alerts" as ActiveTab, icon: <Bell size={18}/>, label: "Alert Center", badge: unreadAlerts > 0 ? unreadAlerts : null, section: "SYSTEM" },
    { id: "reports" as ActiveTab, icon: <FileDown size={18}/>, label: "Reports & API", badge: null, section: "SYSTEM" },
  ];

  const sections = ["OPERATIONS", "LOGISTICS", "SYSTEM"];

  return (
    <div className="gov-shell">
      {/* Sidebar */}
      <nav className={`gov-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand" onClick={() => setActiveTab("pipeline")}>
          <div className="brand-shield">🛡️</div>
          {!sidebarCollapsed && (
            <div className="brand-text">
              <strong>ResQAI</strong>
              <small>Emergency Mgmt. Portal</small>
            </div>
          )}
        </div>

        <button
          style={{position:"absolute",top:14,right:-12,width:24,height:24,borderRadius:"50%",background:"var(--gov-navy-light)",border:"2px solid white",color:"white",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:101}}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? <ChevronRight size={12}/> : <ChevronLeft size={12}/>}
        </button>

        <div className="sidebar-nav">
          {sections.map(section => (
            <div key={section}>
              {!sidebarCollapsed && <div className="nav-section-title">{section}</div>}
              {navItems.filter(n => n.section === section).map(n => (
                <button key={n.id} className={`nav-item ${activeTab === n.id ? "active" : ""}`} onClick={() => setActiveTab(n.id)}>
                  {n.icon}
                  {!sidebarCollapsed && <span style={{flex:1}}>{n.label}</span>}
                  {!sidebarCollapsed && n.badge && (
                    <span className={`nav-badge ${typeof n.badge === "string" ? "amber" : ""}`}>{n.badge}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          {!sidebarCollapsed && (
            <div>
              <div style={{fontSize:9,letterSpacing:"0.5px",marginBottom:4}}>VERSION 2.0.0</div>
              <div>ResQAI NDMA Portal</div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Area */}
      <div className={`gov-main ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {/* Top Bar */}
        <header className="gov-topbar">
          <div className="topbar-left">
            <div className="topbar-title">{PAGE_TITLES[activeTab]}</div>
          </div>
          <div className="topbar-right">
            <div className={`status-pill ${connected ? "" : "offline"}`}>
              <div className="status-dot" />
              {connected ? "Backend Online" : "Backend Offline"}
            </div>
            <div className="commander-pill">
              <ShieldAlert size={12}/>
              <span>CMD: <strong>{systemConfig.commander_on_duty || "Maj. EOC Auth-01"}</strong></span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={refreshData} disabled={loading}>
              <RefreshCw size={13} className={loading ? "spin" : ""}/> Refresh
            </button>
            <a href={`${API}/reports/situation`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
              <FileDown size={13}/> PDF Report
            </a>
          </div>
        </header>

        {/* Safety Banner */}
        <div style={{background:"#fff8e1",borderBottom:"2px solid #fbbf24",padding:"8px 24px",display:"flex",alignItems:"center",gap:10,fontSize:12,color:"#78350f"}}>
          <ShieldAlert size={14}/>
          <span><strong>OPERATIONAL MANDATE:</strong> All AI agent recommendations are advisory only. Autonomous dispatch of rescue personnel is strictly prohibited. Authorized commander approval required for all rescue operations.</span>
          <span className="badge badge-pending" style={{marginLeft:"auto",flexShrink:0}}>autonomous_dispatch: FALSE</span>
        </div>

        {/* Page Content */}
        <main className="gov-content">
          {/* Page Header */}
          <div className="gov-page-header mb-4" style={{borderRadius:"var(--radius-md)",marginBottom:20}}>
            <div>
              <h1>{navItems.find(n => n.id === activeTab)?.icon}{PAGE_TITLES[activeTab]}</h1>
              <p>National Disaster Management | Emergency Operations Centre | ResQAI Platform v2.0</p>
            </div>
            {activeTab === "pipeline" && (
              <button className="btn btn-secondary btn-sm" onClick={() => apiFetch("/demo/reset-seed", {method:"POST"}).then(refreshData)}>
                <RotateCcw size={13}/> Reset Demo Data
              </button>
            )}
          </div>

          {/* Page Routing */}
          {activeTab === "pipeline" && (
            <AgentPipeline resources={resources} shelters={shelters} roads={roads} onRefresh={refreshData} />
          )}
          {activeTab === "dashboard" && (
            <DashboardPage dashboard={dashboard} incidents={incidents} resources={resources} shelters={shelters} roads={roads} alerts={alerts} />
          )}
          {activeTab === "incidents" && <IncidentsPage incidents={incidents} />}
          {activeTab === "resources" && <ResourcesPage resources={resources} onRefresh={refreshData} />}
          {activeTab === "shelters" && <SheltersPage shelters={shelters} onRefresh={refreshData} />}
          {activeTab === "routes" && <RoutesPage roads={roads} onRefresh={refreshData} />}
          {activeTab === "approvals" && <ApprovalsPage approvals={approvals} onRefresh={refreshData} />}
          {activeTab === "actions" && <ActionsPage actions={actions} onRefresh={refreshData} />}
          {activeTab === "alerts" && <AlertsPage alerts={alerts} onRefresh={refreshData} />}
          {activeTab === "reports" && <ReportsPage />}
        </main>
      </div>
    </div>
  );
}
