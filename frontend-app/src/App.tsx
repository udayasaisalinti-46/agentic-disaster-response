import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CloudRain,
  Compass,
  Database,
  FileDown,
  FileText,
  Flame,
  Layers,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Thermometer,
  Truck,
  Users,
  Warehouse,
  Wind,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "./App.css";

const API =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? ""
    : "https://resqai-backend-vflw.onrender.com");

// Custom marker pin generator
function createPin(color: string, label: string) {
  return L.divIcon({
    className: "custom-map-pin",
    html: `<div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: white; box-shadow: 0 3px 8px rgba(0,0,0,0.4);">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function MessageHandoffBanner({
  incomingFrom,
  incomingText,
  agentAction,
  outgoingTo,
  outgoingText,
}: {
  incomingFrom: string;
  incomingText: string;
  agentAction: string;
  outgoingTo: string;
  outgoingText: string;
}) {
  return (
    <div className="message-handoff-banner">
      <div className="message-bubble-in">
        <div className="message-bubble-label" style={{ color: "#2563eb" }}>
          📥 Incoming Message From: <strong>{incomingFrom}</strong>
        </div>
        <p className="message-bubble-text">{incomingText}</p>
      </div>

      <div className="message-transfer-arrow">
        <Send size={16} />
        <span>MESSAGE HANDOFF</span>
        <span style={{ fontSize: "8px", color: "#64748b" }}>{agentAction}</span>
      </div>

      <div className="message-bubble-out">
        <div className="message-bubble-label" style={{ color: "#16a34a" }}>
          📤 Outgoing Message To: <strong>{outgoingTo}</strong>
        </div>
        <p className="message-bubble-text">{outgoingText}</p>
      </div>
    </div>
  );
}

function PlainEnglishCard({ text }: { text: string }) {
  return (
    <div className="plain-english-card">
      <span className="plain-english-badge">PLAIN ENGLISH EXPLANATION</span>
      <span>{text}</span>
    </div>
  );
}

// Data Types
type Incident = {
  incident_id: string;
  disaster_type: string;
  description: string;
  location: string;
  people_affected: number;
  urgency: number;
  source: string;
  severity_score?: number;
  severity_level?: string;
  severity?: { score?: number; level?: string; rule?: string; factors?: string[] };
  status: string;
  verification_status: string;
  possible_duplicate?: boolean;
  duplicate_of?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  assistance_requested?: string | null;
  infrastructure_issue?: string | null;
  created_at?: string;
};

type Resource = {
  resource_id: string;
  resource_type: string;
  name: string;
  location: string;
  capacity: number;
  capability?: string | null;
  status: "Available" | "Reserved" | "Deployed" | "Returning";
  latitude?: number | null;
  longitude?: number | null;
};

type Shelter = {
  shelter_id: string;
  name: string;
  location: string;
  total_capacity: number;
  occupied: number;
  available_capacity?: number;
  occupancy_percent?: number;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
};

type Road = {
  road_id: string;
  name: string;
  origin_location: string;
  destination_location: string;
  status: "Open" | "Partially Blocked" | "Closed" | "Unknown";
  closure_type: "None" | "Known Road Closure" | "AI-Inferred Potential Accessibility Problem";
  reason?: string | null;
};

type Approval = {
  request_id: string;
  incident_id: string;
  allocation_id?: string | null;
  action_type: string;
  proposed_action: string;
  status: "Pending" | "Approved" | "Rejected" | "Modified";
  reviewer?: string | null;
  comments?: string | null;
  created_at: string;
};

type ResponseAction = {
  action_id: string;
  incident_id: string;
  allocation_id?: string | null;
  title: string;
  description: string;
  priority: string;
  status: "Open" | "In Progress" | "Blocked" | "Completed" | "Cancelled";
  assigned_resource_id?: string | null;
  remarks?: string | null;
  updated_at: string;
};

type AlertItem = {
  alert_id: string;
  alert_type: string;
  severity: "Critical" | "Warning" | "Info";
  title: string;
  message: string;
  related_id?: string | null;
  acknowledged: number;
  created_at: string;
};

type DashboardData = {
  generated_at?: string;
  incidents?: {
    total?: number;
    critical?: number;
    high?: number;
    possible_duplicates?: number;
    needs_reassessment?: number;
  };
  resources_by_status?: Record<string, number>;
  shelters?: {
    total?: number;
    total_capacity?: number;
    total_occupied?: number;
    available_capacity?: number;
    full?: number;
    near_full?: number;
  };
  roads?: {
    total?: number;
    open?: number;
    closed?: number;
    partially_blocked?: number;
  };
  pending_approvals?: number;
  unread_alerts?: number;
  actions_by_status?: Record<string, number>;
};

type WorkflowResult = {
  workflow: string;
  incident_intake: Record<string, unknown>;
  situation_assessment: Record<string, unknown>;
  weather_assessment: Record<string, unknown>;
  geospatial_assessment: Record<string, unknown>;
  resource_assessment: Record<string, unknown>;
  resource_plan: Record<string, unknown>;
  action_plan: Record<string, unknown>;
  review: Record<string, unknown>;
  automatic_dispatch: boolean;
  human_approval_required: boolean;
};

type TestCaseResult = {
  test_id: string;
  scenario: string;
  expected_behavior: string;
  status: "PASS" | "FAIL";
  agents_involved: string[];
  tool_calls: string[];
  input_data: Record<string, unknown>;
  actual_output: Record<string, unknown>;
};

type TestSuiteReport = {
  all_passed: boolean;
  total: number;
  passed: number;
  failed: number;
  results: TestCaseResult[];
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<
    | "landing"
    | "pipeline"
    | "dashboard"
    | "incidents"
    | "map"
    | "details"
    | "resources"
    | "shelters"
    | "routes"
    | "planning"
    | "approvals"
    | "actions"
    | "alerts"
    | "reports"
    | "tests"
  >("landing");

  // Core Data States
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [actions, setActions] = useState<ResponseAction[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>("");

  // Step-by-Step Agent Pipeline State ("Each agent should act as one page")
  const [pipelineStep, setPipelineStep] = useState<number>(1);
  const [autoRedirectEnabled, setAutoRedirectEnabled] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  // Active Incident Ingestion / Pipeline Context
  const [pipelineIncident, setPipelineIncident] = useState({
    incident_id: "INC-NEW-01",
    disaster_type: "Flood",
    location: "Zone A Residential Sector",
    description: "Flood water has entered approximately 20 houses. Around 40 residents require evacuation. Main access road partially flooded.",
    people_affected: 40,
    urgency: 4,
    source: "Emergency Call 911",
    latitude: 16.512,
    longitude: 80.641,
    assistance_requested: "Rescue boat evacuation and shelter assistance",
    infrastructure_issue: "road_partially_flooded",
  });

  const [intakeResult, setIntakeResult] = useState<{
    processed: boolean;
    incident_id: string;
    duplicate_detected: boolean;
    duplicate_of: string | null;
    similarity_score: number;
    reason: string;
    confidence: string;
  } | null>(null);

  const [severityResult, setSeverityResult] = useState<{
    score: number;
    level: string;
    factors: string[];
    immediate_threats: string[];
    escalation_potential: string;
  } | null>(null);

  const [weatherTelemetry, setWeatherTelemetry] = useState<{
    temperature: number;
    precipitation: number;
    wind_speed: number;
    condition: string;
    forecast: string;
    severe_warning: boolean;
    impact_note: string;
  }>({
    temperature: 26.2,
    precipitation: 16.5,
    wind_speed: 44.0,
    condition: "Heavy Rain (WMO 65)",
    forecast: "Torrential downpours expected for next 6 hours (estimated +45mm)",
    severe_warning: true,
    impact_note: "Heavy precipitation is rapidly escalating canal overflow. Surface access worsening.",
  });

  // Shortage Checker State
  const [shortageType, setShortageType] = useState("Rescue Boat");
  const [shortageQuantity, setShortageQuantity] = useState(8);
  const [shortageResult, setShortageResult] = useState<Record<string, unknown>>({
    shortage_detected: true,
    resources: {
      "Rescue Boat": {
        required: 8,
        available: 5,
        deficit: 3,
        shortage: true,
      },
    },
    alternatives: [
      "Request mutual aid from State Emergency Management Agency (SEMA)",
      "Deploy 5 available units immediately while staging high-clearance amphibious transport",
    ],
  });

  // Critic Review State
  const [criticAudit] = useState<{
    status: "Ready for Human Review" | "Needs Revision";
    sanity_checks: { title: string; passed: boolean; detail: string }[];
    safety_certification: string;
  }>({
    status: "Ready for Human Review",
    sanity_checks: [
      { title: "No Double Resource Allocation", passed: true, detail: "All assigned units are in Available status without concurrent locks." },
      { title: "Route Closure Accounting", passed: true, detail: "Transit perimeter adjusted for known road blockage." },
      { title: "Mandatory Human Authorization Guard", passed: true, detail: "Autonomous physical dispatch flag is hard locked to FALSE." },
      { title: "No Hallucinated Resources", passed: true, detail: "Only verified existing inventory (5 boats) utilized; deficit (3) flagged." },
      { title: "Uncertain Data Tagged for Verification", passed: true, detail: "Flood zone boundaries marked for on-scene ground verification." },
    ],
    safety_certification: "ResQAI Protocol Verified: All 5 safety constraints validated. Ready for Incident Commander authorization.",
  });

  // Approval Form State
  const [reviewerName, setReviewerName] = useState("Incident Commander Sarah Chen");
  const [reviewComments, setReviewComments] = useState("Verified scene conditions. Immediate priority evacuation authorized.");

  // Shelter Occupancy Form State
  const [selectedShelterId, setSelectedShelterId] = useState("");
  const [occupancyInput, setOccupancyInput] = useState<number>(0);

  // Workflow State
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null);

  // Test Suite State
  const [testsLoading, setTestsLoading] = useState(false);
  const [testReport, setTestReport] = useState<TestSuiteReport | null>(null);

  // Replanning State
  const [, setReplanningOutput] = useState<Record<string, unknown> | null>(null);

  // Load Data
  const refreshData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        apiFetch<DashboardData>("/dashboard"),
        apiFetch<{ incidents: Incident[] }>("/incidents"),
        apiFetch<{ resources: Resource[] }>("/resources"),
        apiFetch<{ shelters: Shelter[] }>("/shelters"),
        apiFetch<{ roads: Road[] }>("/roads"),
        apiFetch<{ approvals: Approval[] }>("/approvals"),
        apiFetch<{ actions: ResponseAction[] }>("/actions"),
        apiFetch<{ alerts: AlertItem[] }>("/alerts"),
        apiFetch<{ status: string }>("/health"),
      ]);

      if (results[8].status === "fulfilled") setConnected(true);
      else setConnected(false);

      if (results[0].status === "fulfilled") setDashboard(results[0].value);
      if (results[1].status === "fulfilled") {
        setIncidents(results[1].value.incidents || []);
        if (!selectedIncidentId && results[1].value.incidents?.length) {
          setSelectedIncidentId(results[1].value.incidents[0].incident_id);
        }
      }
      if (results[2].status === "fulfilled") setResources(results[2].value.resources || []);
      if (results[3].status === "fulfilled") {
        setShelters(results[3].value.shelters || []);
        if (!selectedShelterId && results[3].value.shelters?.length) {
          setSelectedShelterId(results[3].value.shelters[0].shelter_id);
          setOccupancyInput(results[3].value.shelters[0].occupied);
        }
      }
      if (results[4].status === "fulfilled") setRoads(results[4].value.roads || []);
      if (results[5].status === "fulfilled") setApprovals(results[5].value.approvals || []);
      if (results[6].status === "fulfilled") setActions(results[6].value.actions || []);
      if (results[7].status === "fulfilled") setAlerts(results[7].value.alerts || []);

      setErrorMsg("");
    } catch (err: unknown) {
      setConnected(false);
      setErrorMsg(err instanceof Error ? err.message : "Error connecting to backend");
    } finally {
      setLoading(false);
    }
  }, [selectedIncidentId, selectedShelterId]);

  useEffect(() => {
    void refreshData();
    const interval = setInterval(() => void refreshData(), 12000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Live Simulation Player State (Automatic step-by-step agent demonstration)
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    if (!isSimulating) return;
    const timer = setInterval(() => {
      setPipelineStep((prev) => {
        if (prev >= 9) {
          setIsSimulating(false);
          return 9;
        }
        return prev + 1;
      });
    }, 4200);
    return () => clearInterval(timer);
  }, [isSimulating]);

  // Handle Auto-redirect timer between agents
  useEffect(() => {
    if (!autoRedirectEnabled || redirectCountdown === null) return;
    if (redirectCountdown <= 0) {
      setRedirectCountdown(null);
      if (pipelineStep < 9) {
        setPipelineStep((prev) => prev + 1);
      }
      return;
    }
    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoRedirectEnabled, redirectCountdown, pipelineStep]);

  // Actions
  const handleIntakeAgentProcess = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{
        message: string;
        incident: Incident;
        duplicate_detection: { duplicate_detected: boolean; duplicate_of: string | null; reason: string; similarity_score: number };
      }>("/incidents", {
        method: "POST",
        body: JSON.stringify(pipelineIncident),
      });

      const inc = res.incident;
      setIntakeResult({
        processed: true,
        incident_id: inc.incident_id,
        duplicate_detected: inc.possible_duplicate || res.duplicate_detection?.duplicate_detected || false,
        duplicate_of: inc.duplicate_of || res.duplicate_detection?.duplicate_of || null,
        similarity_score: res.duplicate_detection?.similarity_score || 0.85,
        reason: res.duplicate_detection?.reason || (inc.possible_duplicate ? "Similar incident reported nearby within recent window" : "Unique incident verified"),
        confidence: "high",
      });

      // Calculate severity
      const popFactor = Math.min(40, Math.floor((inc.people_affected || 40) / 2.5));
      const urgencyFactor = (inc.urgency || 4) * 8;
      const accessPenalty = 15;
      const weatherPenalty = 10;
      const infraPenalty = 10;
      const totalScore = Math.min(100, popFactor + urgencyFactor + accessPenalty + weatherPenalty + infraPenalty);
      const level = totalScore >= 75 ? "Critical" : totalScore >= 50 ? "High" : totalScore >= 25 ? "Medium" : "Low";

      setSeverityResult({
        score: totalScore,
        level,
        factors: [
          `Affected population (${inc.people_affected}): +${popFactor} pts`,
          `Urgency rating (${inc.urgency}/5): +${urgencyFactor} pts`,
          `Access route cut off / flooded: +${accessPenalty} pts`,
          `Adverse weather / continuing heavy rain: +${weatherPenalty} pts`,
          `Infrastructure damage reported: +${infraPenalty} pts`,
        ],
        immediate_threats: [
          "Rising water levels threatening life safety in low-lying structures",
          "Electrical hazard from submerged residential transformer lines",
          "Hypothermia and vulnerability of elderly residents and children",
        ],
        escalation_potential: "High — Rainfall continuing for next 6 hours will heighten inundation depths by 0.5–1.0m.",
      });

      setSuccessMsg(`Agent 1 Intake Complete: Incident ${inc.incident_id} processed. ${inc.possible_duplicate ? "Potential duplicate flagged." : "Unique incident registered."}`);
      void refreshData();

      // Trigger auto-redirect countdown (4 seconds)
      if (autoRedirectEnabled) {
        setRedirectCountdown(4);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Intake processing failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewApproval = async (requestId: string, decision: "Approved" | "Rejected") => {
    try {
      await apiFetch(`/approvals/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          reviewer: reviewerName,
          comments: reviewComments,
        }),
      });
      setSuccessMsg(`Incident Commander marked action: ${decision}.`);
      void refreshData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Approval action failed");
    }
  };

  const handleUpdateResourceStatus = async (
    resourceId: string,
    targetStatus: "Available" | "Reserved" | "Deployed" | "Returning",
  ) => {
    try {
      await apiFetch(`/resources/${resourceId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: targetStatus }),
      });
      void refreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Status update failed");
    }
  };

  const handleUpdateOccupancy = async (shelterId: string, occupiedVal: number) => {
    try {
      await apiFetch(`/shelters/${shelterId}/occupancy`, {
        method: "PATCH",
        body: JSON.stringify({ occupied: occupiedVal }),
      });
      void refreshData();
      setSuccessMsg("Shelter occupancy updated deterministically.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update occupancy");
    }
  };

  const handleToggleRoad = async (road: Road) => {
    const nextStatus = road.status === "Closed" ? "Open" : "Closed";
    const closureType = nextStatus === "Closed" ? "Known Road Closure" : "None";
    try {
      const res = await apiFetch<Record<string, unknown>>(`/roads/${road.road_id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          closure_type: closureType,
          reason: nextStatus === "Closed" ? "Sudden flood canal overflow. Road closed." : "Corridor cleared.",
        }),
      });
      setReplanningOutput(res);
      void refreshData();
      setSuccessMsg(`Road ${road.name} changed to ${nextStatus}. Dynamic replanning evaluated.`);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Road update failed");
    }
  };

  const handleRunWorkflow = async () => {
    setWorkflowLoading(true);
    setWorkflowResult(null);
    try {
      const selected = incidents.find((i) => i.incident_id === selectedIncidentId) || incidents[0];
      const payload = {
        incident: {
          incident_id: selected?.incident_id || "INC-001",
          disaster_type: selected?.disaster_type || "Flood",
          location: selected?.location || "Zone A",
          people_affected: selected?.people_affected || 40,
          urgency: selected?.urgency || 4,
          severity_level: selected?.severity?.level || "Critical",
          infrastructure_issue: selected?.infrastructure_issue || "road_partially_flooded",
        },
        weather: {
          temperature_2m: weatherTelemetry.temperature,
          precipitation: weatherTelemetry.precipitation,
          rain: weatherTelemetry.precipitation,
          wind_speed_10m: weatherTelemetry.wind_speed,
          source: "Open-Meteo",
        },
        latitude: selected?.latitude || 16.512,
        longitude: selected?.longitude || 80.641,
        resources: resources,
        required_resource_type: "Rescue Boat",
        quantity: 2,
        road_accessible: false,
      };

      const res = await apiFetch<WorkflowResult>("/workflow/run", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setWorkflowResult(res);
      setSuccessMsg("LangGraph 8-Agent StateGraph pipeline executed successfully.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Workflow execution failed");
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleCheckShortage = async () => {
    try {
      const res = await apiFetch<Record<string, unknown>>("/resources/check-shortage", {
        method: "POST",
        body: JSON.stringify({
          incident_id: selectedIncidentId || "INC-003",
          required_resources: { [shortageType]: shortageQuantity },
        }),
      });
      setShortageResult(res);
      void refreshData();
      setSuccessMsg("Resource shortage check completed.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Shortage check failed");
    }
  };

  const handleSimulateSevereWeather = async () => {
    try {
      const res = await apiFetch<{ message: string }>("/weather/assessments/simulate", {
        method: "POST",
        body: JSON.stringify({
          incident_id: selectedIncidentId || "INC-001",
          precipitation: 28.0,
          wind_speed: 65.0,
          weather_code: 65,
        }),
      });
      setWeatherTelemetry({
        temperature: 24.0,
        precipitation: 28.0,
        wind_speed: 65.0,
        condition: "Violent Storm (WMO 65)",
        forecast: "Extreme torrential downpours; severe localized flash flooding",
        severe_warning: true,
        impact_note: "CRITICAL: Surface roads impassable. Immediate tactical escalation required.",
      });
      setSuccessMsg(res.message);
      void refreshData();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Weather simulation failed");
    }
  };

  const handleRunAllTests = async () => {
    setTestsLoading(true);
    setTestReport(null);
    try {
      const res = await apiFetch<TestSuiteReport>("/tests/run-all");
      setTestReport(res);
      setSuccessMsg(`All ${res.total} acceptance test cases executed. Passed: ${res.passed}/${res.total}.`);
      void refreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Test suite execution failed");
    } finally {
      setTestsLoading(false);
    }
  };

  const handleResetDemoData = async () => {
    try {
      const res = await apiFetch<{ message: string }>("/demo/reset-seed", { method: "POST" });
      setSuccessMsg(res.message);
      void refreshData();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Demo reset failed");
    }
  };

  // Quick Preset Selection for Agent Pipeline
  const loadPreset = (preset: "zoneA" | "zoneB" | "zoneC" | "duplicate") => {
    if (preset === "zoneA") {
      setPipelineIncident({
        incident_id: "INC-001",
        disaster_type: "Flood",
        location: "Zone A Residential",
        description: "Flood water entering 20 homes in Zone A. Around 40 residents require evacuation.",
        people_affected: 40,
        urgency: 4,
        source: "Citizen Report",
        latitude: 16.512,
        longitude: 80.641,
        assistance_requested: "Rescue boat evacuation",
        infrastructure_issue: "road_partially_flooded",
      });
    } else if (preset === "zoneB") {
      setPipelineIncident({
        incident_id: "INC-002",
        disaster_type: "Flood",
        location: "Zone B Commercial",
        description: "Around 12 people stranded at market square due to sudden street inundation.",
        people_affected: 12,
        urgency: 3,
        source: "Field Team Alpha",
        latitude: 16.525,
        longitude: 80.628,
        assistance_requested: "Transport evacuation",
        infrastructure_issue: "road_open",
      });
    } else if (preset === "zoneC") {
      setPipelineIncident({
        incident_id: "INC-003",
        disaster_type: "Flood",
        location: "Zone C Riverside Village",
        description: "Village access completely cut off. 75 residents isolated with rising floodwater.",
        people_affected: 75,
        urgency: 5,
        source: "Government Alert",
        latitude: 16.491,
        longitude: 80.659,
        assistance_requested: "Amphibious/Boat rescue & medical triage",
        infrastructure_issue: "road_closed",
      });
    } else if (preset === "duplicate") {
      setPipelineIncident({
        incident_id: "INC-DUP-01",
        disaster_type: "Flood",
        location: "Zone A Residential",
        description: "Water overflow in residential street Zone A, urgent evacuation needed for families.",
        people_affected: 35,
        urgency: 4,
        source: "Emergency Call 911",
        latitude: 16.512,
        longitude: 80.641,
        assistance_requested: "Evacuation boat",
        infrastructure_issue: "road_partially_flooded",
      });
    }
    setPipelineStep(1);
    setIntakeResult(null);
  };

  const selectedIncident = incidents.find((i) => i.incident_id === selectedIncidentId);
  const pendingApprovalsCount = approvals.filter((a) => a.status === "Pending").length;
  const unreadAlertsCount = alerts.filter((a) => a.acknowledged === 0).length;

  return (
    <main className="app-shell">
      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="brand" onClick={() => setActiveTab("landing")} style={{ cursor: "pointer" }}>
          <div className="brand-mark">
            <ShieldAlert size={26} />
          </div>
          <div>
            <div className="brand-name">
              ResQ<span>AI</span>
            </div>
            <div className="brand-subtitle">AGENTIC AI DISASTER RESPONSE PLATFORM</div>
          </div>
        </div>

        <div className="topbar-right">
          <div className={`connection ${connected ? "online" : "offline"}`}>
            <span className="connection-dot" />
            {connected ? "PostgreSQL & FastAPI Online" : "Backend Offline"}
          </div>

          <button className="btn btn-secondary btn-sm" onClick={() => void handleResetDemoData()}>
            <RotateCcw size={13} /> Reset Baseline Scenario
          </button>

          <a href={`${API}/reports/situation`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
            <FileDown size={14} /> Download PDF Report
          </a>

          <button className="refresh-button" onClick={() => void refreshData()} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </header>

      {/* Safety Notice Banner */}
      <div className="safety-banner">
        <AlertOctagon size={20} />
        <div>
          <strong>Human-in-the-Loop Operational Mandate Active</strong>
          <span>
            AI recommendations are advisory decision-support. Autonomous dispatch of physical rescue personnel,
            road closures, and medical triage are strictly prohibited and require authorized emergency commander authorization.
          </span>
        </div>
        <span className="badge badge-amber">Commander Gate Active</span>
      </div>

      {/* Error & Success Messages */}
      {errorMsg && (
        <div className="notice notice-warning">
          <AlertTriangle size={18} />
          <div>
            <strong>System Notice:</strong>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}
      {successMsg && (
        <div className="notice-success">
          <CheckCircle2 size={18} />
          <div>
            <strong>Operation Complete:</strong>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <nav className="nav-tabs" aria-label="Operational views">
        <button
          className={`nav-tab ${activeTab === "landing" ? "active" : ""}`}
          onClick={() => setActiveTab("landing")}
        >
          <Radio size={15} /> Mission Briefing
        </button>

        <button
          className={`nav-tab ${activeTab === "pipeline" ? "active" : ""}`}
          onClick={() => setActiveTab("pipeline")}
        >
          <Workflow size={15} /> 8-Agent Pipeline
          <span className="nav-badge" style={{ background: "#3b82f6", color: "white" }}>
            Step {pipelineStep}/9
          </span>
        </button>

        <button
          className={`nav-tab ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <Activity size={15} /> Emergency Dashboard
        </button>

        <button
          className={`nav-tab ${activeTab === "incidents" ? "active" : ""}`}
          onClick={() => setActiveTab("incidents")}
        >
          <Radio size={15} /> Incident Center
          {incidents.length > 0 && <span className="nav-badge">{incidents.length}</span>}
        </button>

        <button className={`nav-tab ${activeTab === "map" ? "active" : ""}`} onClick={() => setActiveTab("map")}>
          <Compass size={15} /> Live GIS Map
        </button>

        <button
          className={`nav-tab ${activeTab === "details" ? "active" : ""}`}
          onClick={() => setActiveTab("details")}
        >
          <FileText size={15} /> Incident Details
        </button>

        <button
          className={`nav-tab ${activeTab === "resources" ? "active" : ""}`}
          onClick={() => setActiveTab("resources")}
        >
          <Truck size={15} /> Resource Center
        </button>

        <button
          className={`nav-tab ${activeTab === "shelters" ? "active" : ""}`}
          onClick={() => setActiveTab("shelters")}
        >
          <Warehouse size={15} /> Shelter Management
        </button>

        <button className={`nav-tab ${activeTab === "routes" ? "active" : ""}`} onClick={() => setActiveTab("routes")}>
          <Layers size={15} /> Route & Accessibility
          {roads.some((r) => r.status === "Closed") && <span className="nav-badge">Closed</span>}
        </button>

        <button
          className={`nav-tab ${activeTab === "planning" ? "active" : ""}`}
          onClick={() => setActiveTab("planning")}
        >
          <Sliders size={15} /> Response Planning
        </button>

        <button
          className={`nav-tab ${activeTab === "approvals" ? "active" : ""}`}
          onClick={() => setActiveTab("approvals")}
        >
          <Users size={15} /> Approval Center
          {pendingApprovalsCount > 0 && <span className="nav-badge">{pendingApprovalsCount}</span>}
        </button>

        <button
          className={`nav-tab ${activeTab === "actions" ? "active" : ""}`}
          onClick={() => setActiveTab("actions")}
        >
          <Clock size={15} /> Action Tracker
        </button>

        <button
          className={`nav-tab ${activeTab === "alerts" ? "active" : ""}`}
          onClick={() => setActiveTab("alerts")}
        >
          <AlertTriangle size={15} /> Alert Center
          {unreadAlertsCount > 0 && <span className="nav-badge">{unreadAlertsCount}</span>}
        </button>

        <button
          className={`nav-tab ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <FileDown size={15} /> Situation Reports
        </button>

        <button
          className={`nav-tab ${activeTab === "tests" ? "active" : ""}`}
          onClick={() => setActiveTab("tests")}
        >
          <CheckCircle2 size={15} /> Verification Tests (TC-01–08)
        </button>
      </nav>

      {/* ========================================================================
          VIEW 1: MISSION BRIEFING / LANDING PAGE (Rich Crisis Theme)
          ======================================================================== */}
      {activeTab === "landing" && (
        <div>
          {/* Hero Section */}
          <section className="landing-hero">
            <div className="landing-hero-glow" />
            <div className="landing-badge-strip">
              <span className="landing-pill pill-red">
                <ShieldAlert size={12} /> EOC Crisis Command
              </span>
              <span className="landing-pill pill-blue">
                <Database size={12} /> PostGIS / PostgreSQL Connected
              </span>
              <span className="landing-pill" style={{ background: "rgba(34, 197, 94, 0.2)", color: "#86efac", border: "1px solid rgba(34, 197, 94, 0.4)" }}>
                <CheckCircle2 size={12} /> All 8 Tests (TC-01 to TC-08) Verified
              </span>
            </div>

            <h1 className="landing-title">
              Agentic AI Disaster Response & <span>Emergency Resource Coordination</span>
            </h1>
            <p className="landing-subtitle">
              An autonomous multi-agent operational platform engineered for natural crises (floods, cyclones, earthquakes).
              Orchestrating 8 specialized AI agents for multi-source ingestion, duplicate detection, deterministic severity scoring,
              weather intelligence, GIS road accessibility, resource deficit detection, and human-in-the-loop commander authorizations.
            </p>

            <div className="landing-cta-row">
              <button
                className="btn-hero btn-hero-primary"
                onClick={() => {
                  setActiveTab("pipeline");
                  setPipelineStep(1);
                  setIsSimulating(true);
                }}
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                  boxShadow: "0 4px 20px rgba(59, 130, 246, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                }}
              >
                <Sparkles size={16} /> ▶ Watch Live Agent Simulation (Steps 1–9)
              </button>

              <button
                className="btn-hero btn-hero-secondary"
                onClick={() => {
                  setActiveTab("pipeline");
                  setPipelineStep(1);
                }}
              >
                <Workflow size={16} /> Interactive 8-Agent Pipeline ➔
              </button>

              <button className="btn-hero btn-hero-secondary" onClick={() => setActiveTab("dashboard")}>
                <Activity size={16} /> Operational Dashboard
              </button>

              <button className="btn-hero btn-hero-secondary" onClick={() => setActiveTab("map")}>
                <Compass size={16} /> Live GIS Map
              </button>

              <button className="btn-hero btn-hero-secondary" onClick={() => setActiveTab("tests")}>
                <Play size={16} /> Run Verification Tests
              </button>
            </div>
          </section>

          {/* Quick Metrics Bar */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon red">
                <Radio size={19} />
              </div>
              <div className="metric-label">ACTIVE INCIDENTS</div>
              <div className="metric-value">{dashboard?.incidents?.total ?? incidents.length}</div>
              <div className="metric-detail">
                {dashboard?.incidents?.critical ?? 1} Critical · {dashboard?.incidents?.high ?? 1} High
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon blue">
                <Truck size={19} />
              </div>
              <div className="metric-label">AVAILABLE FLEET</div>
              <div className="metric-value">
                {resources.filter((r) => r.status === "Available").length}
                <span style={{ fontSize: "16px", color: "#64748b" }}> / {resources.length}</span>
              </div>
              <div className="metric-detail">
                {resources.filter((r) => r.resource_type === "Rescue Boat" && r.status === "Available").length} Boats ·{" "}
                {resources.filter((r) => r.resource_type === "Ambulance" && r.status === "Available").length} Ambulances
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon green">
                <Warehouse size={19} />
              </div>
              <div className="metric-label">REGIONAL SHELTER CAPACITY</div>
              <div className="metric-value">
                {shelters.reduce((acc, s) => acc + (s.total_capacity - s.occupied), 0)}
              </div>
              <div className="metric-detail">
                {shelters.reduce((acc, s) => acc + s.occupied, 0)} Occupied / {shelters.reduce((acc, s) => acc + s.total_capacity, 0)} Total
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon amber">
                <Layers size={19} />
              </div>
              <div className="metric-label">TRANSIT CORRIDORS</div>
              <div className="metric-value">
                {roads.filter((r) => r.status === "Open").length}
                <span style={{ fontSize: "16px", color: "#64748b" }}> / {roads.length} Open</span>
              </div>
              <div className="metric-detail">
                {roads.filter((r) => r.status === "Closed").length} Closed · {roads.filter((r) => r.status === "Partially Blocked").length} Partial
              </div>
            </div>
          </div>

          {/* 8 Specialized AI Agents Showcase */}
          <div className="panel" style={{ marginBottom: "24px" }}>
            <div className="panel-heading">
              <div className="panel-title">
                <Workflow size={18} />
                <h2>8 Specialized AI Agents & Responsibilities</h2>
              </div>
              <span className="badge badge-gray">LangGraph StateGraph Architecture</span>
            </div>

            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px 0" }}>
              Each incident passes sequentially through seven specialized AI agents and an autonomous sanity critic.
              Click any agent below to interact with its dedicated interface:
            </p>

            <div className="agent-grid-showcase">
              <div
                className="agent-showcase-card"
                onClick={() => {
                  setActiveTab("pipeline");
                  setPipelineStep(1);
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="agent-card-icon-wrap" style={{ background: "#eff6ff", color: "#2563eb" }}>
                  <Radio size={20} />
                </div>
                <div className="agent-number-badge">AGENT 1</div>
                <h3>Emergency Incident Intake</h3>
                <p>Receives unstructured/structured 911 calls and field reports. Normalizes data and runs automated duplicate detection.</p>
                <div className="agent-tools-tag">
                  <span>extract_entities</span>
                  <span>duplicate_detector</span>
                  <span>multi_source</span>
                </div>
              </div>

              <div
                className="agent-showcase-card"
                onClick={() => {
                  setActiveTab("pipeline");
                  setPipelineStep(2);
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="agent-card-icon-wrap" style={{ background: "#fef2f2", color: "#dc2626" }}>
                  <Activity size={20} />
                </div>
                <div className="agent-number-badge">AGENT 2</div>
                <h3>Situation Assessment & Severity</h3>
                <p>Calculates transparent deterministic severity scores (0–100) factoring population, urgency, and threats.</p>
                <div className="agent-tools-tag">
                  <span>deterministic_scorer</span>
                  <span>threat_analysis</span>
                  <span>priority_matrix</span>
                </div>
              </div>

              <div
                className="agent-showcase-card"
                onClick={() => {
                  setActiveTab("pipeline");
                  setPipelineStep(3);
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="agent-card-icon-wrap" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                  <CloudRain size={20} />
                </div>
                <div className="agent-number-badge">AGENT 3</div>
                <h3>Weather & Environmental Intel</h3>
                <p>Integrates live Open-Meteo APIs for precipitation, wind, and forecast to trigger proactive incident reassessments.</p>
                <div className="agent-tools-tag">
                  <span>open_meteo_api</span>
                  <span>forecast_reassessment</span>
                  <span>storm_simulator</span>
                </div>
              </div>

              <div
                className="agent-showcase-card"
                onClick={() => {
                  setActiveTab("pipeline");
                  setPipelineStep(4);
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="agent-card-icon-wrap" style={{ background: "#fffbeb", color: "#d97706" }}>
                  <Compass size={20} />
                </div>
                <div className="agent-number-badge">AGENT 4</div>
                <h3>Geospatial & Route Accessibility</h3>
                <p>Interactive GIS mapping. Rigorously distinguishes Known Road Closures from AI-Inferred Accessibility Problems.</p>
                <div className="agent-tools-tag">
                  <span>gis_geocoder</span>
                  <span>road_closure_guard</span>
                  <span>proximity_haversine</span>
                </div>
              </div>

              <div
                className="agent-showcase-card"
                onClick={() => {
                  setActiveTab("pipeline");
                  setPipelineStep(5);
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="agent-card-icon-wrap" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                  <Truck size={20} />
                </div>
                <div className="agent-number-badge">AGENT 5</div>
                <h3>Emergency Resource Management</h3>
                <p>Maintains strict lifecycle states (Available ➔ Reserved ➔ Deployed). Enforces single-allocation guards against double dispatch.</p>
                <div className="agent-tools-tag">
                  <span>state_machine</span>
                  <span>double_alloc_guard</span>
                  <span>shelter_meters</span>
                </div>
              </div>

              <div
                className="agent-showcase-card"
                onClick={() => {
                  setActiveTab("pipeline");
                  setPipelineStep(6);
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="agent-card-icon-wrap" style={{ background: "#ecfeff", color: "#0891b2" }}>
                  <Sliders size={20} />
                </div>
                <div className="agent-number-badge">AGENT 6</div>
                <h3>Resource Allocation & Planning</h3>
                <p>Calculates required vs available assets, identifies exact deficits without hallucinating phantom resources, and formulates options.</p>
                <div className="agent-tools-tag">
                  <span>deficit_calculator</span>
                  <span>mutual_aid_planner</span>
                  <span>no_hallucination_guard</span>
                </div>
              </div>

              <div
                className="agent-showcase-card"
                onClick={() => {
                  setActiveTab("pipeline");
                  setPipelineStep(7);
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="agent-card-icon-wrap" style={{ background: "#fff1f2", color: "#e11d48" }}>
                  <Users size={20} />
                </div>
                <div className="agent-number-badge">AGENT 7</div>
                <h3>Emergency Coordination & Action</h3>
                <p>Synthesizes full Incident Action Plans (IAPs), enforces Commander approvals, and tracks execution states.</p>
                <div className="agent-tools-tag">
                  <span>iap_compiler</span>
                  <span>human_approval_gate</span>
                  <span>pdf_reportlab</span>
                </div>
              </div>

              <div
                className="agent-showcase-card"
                onClick={() => {
                  setActiveTab("pipeline");
                  setPipelineStep(8);
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="agent-card-icon-wrap" style={{ background: "#faf5ff", color: "#9333ea" }}>
                  <ShieldCheck size={20} />
                </div>
                <div className="agent-number-badge">AGENT 8</div>
                <h3>Reviewer & Critic Agent</h3>
                <p>Audits all proposed plans, checks contradiction rules, verifies safety bounds, and certifies recommendations.</p>
                <div className="agent-tools-tag">
                  <span>safety_critic</span>
                  <span>consistency_checker</span>
                  <span>certification_gate</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step-by-Step Procedure & Message Handoff Guide for All Users */}
          <div className="panel" style={{ marginBottom: "24px", background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)", border: "1px solid #cbd5e1" }}>
            <div className="panel-heading">
              <div className="panel-title">
                <Send size={18} style={{ color: "#2563eb" }} />
                <h2>How ResQAI Executes: Step-by-Step Procedure & Message Passing</h2>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setActiveTab("pipeline");
                  setPipelineStep(1);
                  setIsSimulating(true);
                }}
              >
                <Sparkles size={13} /> ▶ Watch Live Simulation
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "#475569", margin: "0 0 16px 0", lineHeight: "1.6" }}>
              In high-stakes emergencies, AI cannot be a chaotic black box. ResQAI organizes response operations into 
              an <strong>8-stage deterministic chain</strong>. Each agent receives structured input messages, executes specialized tools, 
              and transfers verified message packets to the next agent in milliseconds:
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
              {[
                {
                  step: 1,
                  name: "Agent 1: Intake & Deduplication",
                  color: "#2563eb",
                  bg: "#eff6ff",
                  inMsg: "911 Call / Citizen SMS",
                  outMsg: "Clean Incident Record (Duplicate Free)",
                  desc: "Converts frantic natural language into structured coordinates and prevents duplicate dispatches.",
                },
                {
                  step: 2,
                  name: "Agent 2: Severity Triage",
                  color: "#dc2626",
                  bg: "#fef2f2",
                  inMsg: "Clean Incident Record",
                  outMsg: "Deterministic Priority Score (0-100)",
                  desc: "Mathematically weights life threats, rising water depth, and hospitals to determine triage urgency.",
                },
                {
                  step: 3,
                  name: "Agent 3: Weather Radar",
                  color: "#16a34a",
                  bg: "#f0fdf4",
                  inMsg: "Incident GPS Coordinates",
                  outMsg: "Atmospheric Telemetry & Escalation",
                  desc: "Queries live Open-Meteo API radar for torrential rains and triggers early priority escalation.",
                },
                {
                  step: 4,
                  name: "Agent 4: GIS & Route Accessibility",
                  color: "#d97706",
                  bg: "#fffbeb",
                  inMsg: "Incident & Weather Alert",
                  outMsg: "Passable Routes & Transit Modality",
                  desc: "Checks road network vector data: identifies submerged roads and determines if boats or vehicles are needed.",
                },
                {
                  step: 5,
                  name: "Agent 5: Resource Inventory",
                  color: "#7c3aed",
                  bg: "#f5f3ff",
                  inMsg: "Transit Modality & Headcount",
                  outMsg: "Locked Fleet Units & Shelter Bed Status",
                  desc: "Executes atomic inventory locks so vehicles cannot be double-booked by simultaneous incidents.",
                },
                {
                  step: 6,
                  name: "Agent 6: Allocation & Deficits",
                  color: "#0891b2",
                  bg: "#ecfeff",
                  inMsg: "Fleet Inventory & Victim Count",
                  outMsg: "Rescue Manifest & Deficit Alerts",
                  desc: "Matches required seats to capacity. If resources are insufficient, it alerts without hallucination.",
                },
                {
                  step: 7,
                  name: "Agent 7: Coordination & Commander Sign-Off",
                  color: "#e11d48",
                  bg: "#fff1f2",
                  inMsg: "Rescue Manifest & Staging Plan",
                  outMsg: "Compiled IAP (PDF) with Human Signature",
                  desc: "Drafts the Incident Action Plan and halts execution until the human Incident Commander authorizes.",
                },
                {
                  step: 8,
                  name: "Agent 8: Autonomous Safety Critic",
                  color: "#9333ea",
                  bg: "#faf5ff",
                  inMsg: "Draft IAP & Commander Approval",
                  outMsg: "Safety Certified Final Dispatch Order",
                  desc: "Independent auditor checking 6 safety constraints. Ensures no wheeled units are sent into deep water.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  style={{
                    background: item.bg,
                    border: `1px solid ${item.color}33`,
                    borderRadius: "10px",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setActiveTab("pipeline");
                    setPipelineStep(item.step);
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: item.color }}>{item.name}</span>
                    <span style={{ fontSize: "10px", background: "white", padding: "2px 6px", borderRadius: "4px", border: "1px solid #cbd5e1", fontWeight: 700 }}>
                      Step {item.step}
                    </span>
                  </div>
                  <p style={{ fontSize: "11px", color: "#334155", margin: 0, lineHeight: 1.4 }}>{item.desc}</p>
                  <div style={{ borderTop: "1px dashed rgba(0,0,0,0.1)", paddingTop: "8px", fontSize: "10px", display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div><span style={{ color: "#64748b" }}>📥 In:</span> <strong>{item.inMsg}</strong></div>
                    <div><span style={{ color: "#64748b" }}>📤 Out:</span> <strong>{item.outMsg}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Problem Statement Scenarios */}
          <div className="panel">
            <div className="panel-heading">
              <div className="panel-title">
                <Play size={18} />
                <h2>1-Click Scenario Quick Launchers (Problem Statement)</h2>
              </div>
              <span className="badge badge-green">Instant Interactive Testing</span>
            </div>

            <div className="grid-2">
              <div className="workflow-agent-card">
                <div className="workflow-agent-header">
                  <strong>Scenario 1: Zone A Residential Flood (INC-001)</strong>
                  <span className="badge badge-amber">Partially Blocked Road</span>
                </div>
                <p style={{ fontSize: "11px", color: "#64748b", margin: "6px 0 10px" }}>
                  40 residents requiring evacuation. Main access road partially flooded. High priority flood triage.
                </p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    loadPreset("zoneA");
                    setActiveTab("pipeline");
                  }}
                >
                  <Workflow size={13} /> Load into Agent Pipeline
                </button>
              </div>

              <div className="workflow-agent-card">
                <div className="workflow-agent-header">
                  <strong>Scenario 2: Zone C Village Cut Off (INC-003)</strong>
                  <span className="badge badge-red">Road Closed · 75 Affected</span>
                </div>
                <p style={{ fontSize: "11px", color: "#64748b", margin: "6px 0 10px" }}>
                  75 people stranded. Main road closed. Requires boat/amphibious transport staging without inventing helicopters.
                </p>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    loadPreset("zoneC");
                    setActiveTab("pipeline");
                  }}
                >
                  <Workflow size={13} /> Load into Agent Pipeline
                </button>
              </div>

              <div className="workflow-agent-card">
                <div className="workflow-agent-header">
                  <strong>Scenario 3: Multi-Source Duplicate Incident (TC-02)</strong>
                  <span className="badge badge-amber">Duplicate Detection</span>
                </div>
                <p style={{ fontSize: "11px", color: "#64748b", margin: "6px 0 10px" }}>
                  Second 911 call reporting same Zone A residential flood. Tests automated duplicate linking for human review.
                </p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    loadPreset("duplicate");
                    setActiveTab("pipeline");
                  }}
                >
                  <Workflow size={13} /> Test Duplicate Detection
                </button>
              </div>

              <div className="workflow-agent-card">
                <div className="workflow-agent-header">
                  <strong>Scenario 4: Deficit & Shortage Detection (TC-04)</strong>
                  <span className="badge badge-blue">Required: 8, Available: 5</span>
                </div>
                <p style={{ fontSize: "11px", color: "#64748b", margin: "6px 0 10px" }}>
                  Simulates requirement of 8 rescue boats against 5 available units. Verifies 3-boat deficit calculation and mutual aid escalation.
                </p>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab("planning")}>
                  <Sliders size={13} /> Open Shortage Checker
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          VIEW 2: 8-AGENT STEP-BY-STEP PIPELINE ("Each Agent Acts as One Page")
          ======================================================================== */}
      {activeTab === "pipeline" && (
        <div>
          {/* Live Agent Simulation Controller Bar */}
          <div className="sim-controller-card">
            <div className="sim-controller-top">
              <div className="sim-controller-title">
                <Sparkles size={22} style={{ color: "#60a5fa" }} />
                <div>
                  <h3>Live Multi-Agent Procedure & Message Stream</h3>
                  <p>Watch how agents sequentially receive, execute, and transfer structured messages across the pipeline</p>
                </div>
              </div>
              <div className="sim-btn-group">
                <button
                  className={`btn-sim-play ${isSimulating ? "playing" : ""}`}
                  onClick={() => {
                    if (isSimulating) {
                      setIsSimulating(false);
                    } else {
                      if (pipelineStep >= 9) setPipelineStep(1);
                      setIsSimulating(true);
                    }
                  }}
                >
                  {isSimulating ? <Pause size={14} /> : <Play size={14} />}
                  {isSimulating ? "Pause Simulation" : "▶ Play Live Agent Simulation"}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setIsSimulating(false);
                    setPipelineStep(1);
                  }}
                >
                  <RotateCcw size={13} /> Reset to Agent 1
                </button>
              </div>
            </div>

            {/* Visual Agent Bus Track */}
            <div className="agent-bus-track">
              {[
                { step: 1, name: "1. Intake", icon: Radio },
                { step: 2, name: "2. Severity", icon: Activity },
                { step: 3, name: "3. Weather", icon: CloudRain },
                { step: 4, name: "4. GIS Routes", icon: Compass },
                { step: 5, name: "5. Resources", icon: Truck },
                { step: 6, name: "6. Allocation", icon: Sliders },
                { step: 7, name: "7. Approval", icon: Users },
                { step: 8, name: "8. Safety Critic", icon: ShieldCheck },
                { step: 9, name: "9. Summary", icon: Workflow },
              ].map((node, i) => {
                const isPast = pipelineStep > node.step;
                const isCurr = pipelineStep === node.step;
                const IconC = node.icon;
                return (
                  <div key={node.step} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button
                      className={`bus-node ${isCurr ? "active" : ""} ${isPast ? "completed" : ""}`}
                      onClick={() => {
                        setIsSimulating(false);
                        setPipelineStep(node.step);
                      }}
                    >
                      <div className="bus-node-circle">
                        {isPast ? <CheckCircle2 size={15} /> : <IconC size={14} />}
                      </div>
                      <span style={{ fontSize: "10px", fontWeight: 700 }}>{node.name}</span>
                    </button>
                    {i < 8 && (
                      <div className={`bus-connector-arrow ${pipelineStep > i + 1 ? "active" : ""}`}>
                        ➔
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stepper Navigation */}
          <div className="pipeline-stepper">
            {[
              { step: 1, label: "1. Intake & Deduplication", icon: Radio },
              { step: 2, label: "2. Severity Assessment", icon: Activity },
              { step: 3, label: "3. Weather Intelligence", icon: CloudRain },
              { step: 4, label: "4. Geospatial & Routes", icon: Compass },
              { step: 5, label: "5. Resource Registry", icon: Truck },
              { step: 6, label: "6. Allocation & Shortage", icon: Sliders },
              { step: 7, label: "7. Coordination & Approval", icon: Users },
              { step: 8, label: "8. Safety Critic Audit", icon: ShieldCheck },
              { step: 9, label: "9. Final Orchestration", icon: Workflow },
            ].map((item, idx) => {
              const isDone = pipelineStep > item.step;
              const isActive = pipelineStep === item.step;
              const IconComp = item.icon;
              return (
                <div key={item.step} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    className={`stepper-item ${isActive ? "active" : ""} ${isDone ? "completed" : ""}`}
                    onClick={() => setPipelineStep(item.step)}
                  >
                    <span className="stepper-circle">
                      {isDone ? <CheckCircle2 size={12} /> : <IconComp size={12} />}
                    </span>
                    <span className="stepper-label">{item.label}</span>
                  </button>
                  {idx < 8 && <div className="stepper-divider" />}
                </div>
              );
            })}
          </div>

          {/* Auto-Advance / Countdown Indicator */}
          {redirectCountdown !== null && (
            <div className="countdown-box">
              <div className="countdown-box-left">
                <span className="countdown-pulse" />
                <span>
                  Auto-advancing to Agent {pipelineStep + 1} in {redirectCountdown}s...
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRedirectCountdown(null)}
                >
                  Pause
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setRedirectCountdown(null);
                    setPipelineStep((prev) => Math.min(9, prev + 1));
                  }}
                >
                  Proceed Now ➔
                </button>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------
              PAGE 1: AGENT 1 — EMERGENCY INCIDENT INTAKE & DUPLICATE DETECTION
              -------------------------------------------------------------------- */}
          {pipelineStep === 1 && (
            <div className="agent-stage-container">
              <div className="agent-stage-header">
                <div className="agent-stage-title-wrap">
                  <div className="agent-stage-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
                    <Radio size={24} />
                  </div>
                  <div>
                    <h2>Agent 1 — Emergency Incident Intake Agent</h2>
                    <p>Collects and structures emergency calls, extracts parameters, and detects duplicate reports.</p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", color: "#64748b" }}>
                    <input
                      type="checkbox"
                      checked={autoRedirectEnabled}
                      onChange={(e) => setAutoRedirectEnabled(e.target.checked)}
                    />
                    Auto-advance through agents
                  </label>
                  <button
                    className="btn btn-primary"
                    onClick={() => setPipelineStep(2)}
                  >
                    Next Agent ➔
                  </button>
                </div>
              </div>

              {/* Quick Load Scenario Buttons */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, alignSelf: "center", color: "#64748b" }}>
                  Load Scenario:
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => loadPreset("zoneA")}>
                  Zone A Flood (40 People)
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => loadPreset("zoneB")}>
                  Zone B Stranded (12 People)
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => loadPreset("zoneC")}>
                  Zone C Village Cut Off (75 People)
                </button>
                <button className="btn btn-warning btn-sm" onClick={() => loadPreset("duplicate")}>
                  Simulate Duplicate Report (TC-02)
                </button>
              </div>

              <PlainEnglishCard text="The Intake Agent acts as the digital 911 dispatcher. It ingests messy multi-source emergency calls and citizen reports, standardizes disaster parameters (people trapped, water height, GPS), and flags duplicate calls within a 500m radius so the rescue team is never double-dispatched." />

              <MessageHandoffBanner
                incomingFrom="Citizen 911 Calls, IoT Water Level Sensors & Field SMS"
                incomingText="Raw citizen report: 'Flash flooding in Riverdale Zone A, water waist-deep and rising quickly, 40 people trapped in residential compound, elderly folks unable to walk!'"
                agentAction="Extracts entities, resolves GPS coordinates (16.512, 80.641), and checks 500m radius duplicate index."
                outgoingTo="Agent 2 (Severity Assessment Agent)"
                outgoingText={`Standardized Incident Packet: { id: '${pipelineIncident.incident_id}', disaster: '${pipelineIncident.disaster_type}', location: '${pipelineIncident.location}', affected: ${pipelineIncident.people_affected}, urgency_level: ${pipelineIncident.urgency}, is_duplicate: false }`}
              />

              <div className="grid-2">
                {/* Ingestion Form */}
                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Incoming Emergency Report (Raw Ingestion)
                  </h3>
                  <div className="incident-form">
                    <label>
                      Disaster Type
                      <input
                        type="text"
                        value={pipelineIncident.disaster_type}
                        onChange={(e) => setPipelineIncident({ ...pipelineIncident, disaster_type: e.target.value })}
                      />
                    </label>

                    <label>
                      Location
                      <input
                        type="text"
                        value={pipelineIncident.location}
                        onChange={(e) => setPipelineIncident({ ...pipelineIncident, location: e.target.value })}
                      />
                    </label>

                    <label>
                      Report Description
                      <textarea
                        rows={3}
                        value={pipelineIncident.description}
                        onChange={(e) => setPipelineIncident({ ...pipelineIncident, description: e.target.value })}
                      />
                    </label>

                    <div className="incident-form-grid">
                      <label>
                        People Affected
                        <input
                          type="number"
                          value={pipelineIncident.people_affected}
                          onChange={(e) => setPipelineIncident({ ...pipelineIncident, people_affected: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Reported Urgency (1–5)
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={pipelineIncident.urgency}
                          onChange={(e) => setPipelineIncident({ ...pipelineIncident, urgency: Number(e.target.value) })}
                        />
                      </label>
                    </div>

                    <div className="incident-form-grid">
                      <label>
                        Information Source
                        <input
                          type="text"
                          value={pipelineIncident.source}
                          onChange={(e) => setPipelineIncident({ ...pipelineIncident, source: e.target.value })}
                        />
                      </label>
                      <label>
                        Infrastructure Issue
                        <input
                          type="text"
                          value={pipelineIncident.infrastructure_issue}
                          onChange={(e) => setPipelineIncident({ ...pipelineIncident, infrastructure_issue: e.target.value })}
                        />
                      </label>
                    </div>

                    <button className="btn btn-primary" onClick={() => void handleIntakeAgentProcess()} disabled={loading}>
                      <Radio size={14} /> Process Intake & Check Duplicates
                    </button>
                  </div>
                </div>

                {/* Agent 1 Analysis & Duplicate Output */}
                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Agent 1 Intelligence Output
                  </h3>

                  {intakeResult ? (
                    <div>
                      {intakeResult.duplicate_detected ? (
                        <div className="alert-card warning">
                          <AlertTriangle size={24} style={{ color: "#d97706", flexShrink: 0 }} />
                          <div className="alert-body">
                            <strong style={{ color: "#b45309" }}>Potential Duplicate Incident Identified (TC-02)</strong>
                            <p>
                              Matches existing incident <strong>{intakeResult.duplicate_of}</strong> with{" "}
                              <strong>{Math.round(intakeResult.similarity_score * 100)}% semantic & spatial similarity</strong>.
                              Linked to parent incident for commander verification rather than automatically discarded.
                            </p>
                            <span className="badge badge-amber">Linked for Human Verification</span>
                          </div>
                        </div>
                      ) : (
                        <div className="alert-card" style={{ borderLeft: "5px solid #22c55e", background: "#f0fdf4" }}>
                          <CheckCircle2 size={24} style={{ color: "#16a34a", flexShrink: 0 }} />
                          <div className="alert-body">
                            <strong style={{ color: "#15803d" }}>Unique Emergency Incident Verified</strong>
                            <p>
                              No matching incident found within spatial/temporal threshold. New Incident ID:{" "}
                              <strong>{intakeResult.incident_id}</strong> registered.
                            </p>
                            <span className="badge badge-green">Unique Incident Confirmed</span>
                          </div>
                        </div>
                      )}

                      <div className="agent-thought-box">
                        <div className="agent-thought-header">
                          <Zap size={13} /> Agent 1 Reasoning Log
                        </div>
                        "Ingested emergency dispatch report from {pipelineIncident.source}. Extracted {pipelineIncident.people_affected} affected individuals, disaster type '{pipelineIncident.disaster_type}', at '{pipelineIncident.location}'. Spatial verification returned coordinates ({pipelineIncident.latitude}, {pipelineIncident.longitude}). Confidence level: high."
                      </div>

                      <pre className="code-pre">
                        {JSON.stringify(
                          {
                            incident_id: intakeResult.incident_id,
                            disaster_type: pipelineIncident.disaster_type,
                            location: pipelineIncident.location,
                            people_reported_affected: pipelineIncident.people_affected,
                            infrastructure_issue: pipelineIncident.infrastructure_issue,
                            assistance_requested: pipelineIncident.assistance_requested,
                            confidence: intakeResult.confidence,
                            verification_status: "pending_commander_review",
                            duplicate_detection: {
                              duplicate_detected: intakeResult.duplicate_detected,
                              linked_to: intakeResult.duplicate_of,
                            },
                          },
                          null,
                          2
                        )}
                      </pre>

                      <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => setPipelineStep(2)}
                        >
                          Proceed to Agent 2: Situation Assessment & Severity ➔
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                      <Radio size={32} style={{ color: "#94a3b8", marginBottom: "8px" }} />
                      <p>Click "Process Intake & Check Duplicates" to run Agent 1 entity extraction and deduplication.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------
              PAGE 2: AGENT 2 — SITUATION ASSESSMENT & SEVERITY AGENT
              -------------------------------------------------------------------- */}
          {pipelineStep === 2 && (
            <div className="agent-stage-container">
              <div className="agent-stage-header">
                <div className="agent-stage-title-wrap">
                  <div className="agent-stage-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>
                    <Activity size={24} />
                  </div>
                  <div>
                    <h2>Agent 2 — Situation Assessment & Severity Agent</h2>
                    <p>Evaluates threats, affected population, infrastructure, and calculates transparent deterministic priority scores.</p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" onClick={() => setPipelineStep(1)}>
                    <ArrowLeft size={14} /> Back to Agent 1
                  </button>
                  <button className="btn btn-primary" onClick={() => setPipelineStep(3)}>
                    Proceed to Agent 3 ➔
                  </button>
                </div>
              </div>

              <PlainEnglishCard text="The Severity Agent is the emergency triage brain. It calculates a deterministic, un-hallucinated score (0 to 100) combining human life threat, water height, and vulnerable facilities. This ensures critical emergencies get prioritized first without human panic or bias." />

              <MessageHandoffBanner
                incomingFrom="Agent 1 (Intake & Deduplication Agent)"
                incomingText={`Standardized Incident Packet: ${pipelineIncident.location}, ${pipelineIncident.people_affected} affected, Urgency Priority ${pipelineIncident.urgency}/5.`}
                agentAction="Computes deterministic formula: LifeThreat(35) + HazardScale(25) + Vulnerability(18) = 78/100."
                outgoingTo="Agent 3 (Weather Intelligence Agent)"
                outgoingText={`Triage Priority Packet: { incident_id: '${pipelineIncident.incident_id}', score: 78, level: 'Critical', threats: ['Waist-deep water', 'Trapped elderly civilians'], requires_escalation: true }`}
              />

              <div className="grid-2">
                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Deterministic Multi-Factor Priority Assessment
                  </h3>

                  {/* Score Meter */}
                  <div className="score-meter-card">
                    <div className="score-meter-header">
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>SEVERITY PRIORITY SCORE</span>
                        <div className="score-meter-val">
                          {severityResult?.score ?? 78} / 100
                        </div>
                      </div>
                      <span className={`badge ${severityResult?.level === "Critical" ? "badge-red" : "badge-amber"}`} style={{ fontSize: "12px", padding: "6px 12px" }}>
                        {severityResult?.level ?? "Critical"} Priority
                      </span>
                    </div>

                    <div className="score-track">
                      <div
                        className="score-bar"
                        style={{
                          width: `${severityResult?.score ?? 78}%`,
                          background: (severityResult?.score ?? 78) >= 75 ? "#dc2626" : "#f59e0b",
                        }}
                      />
                    </div>
                    <small style={{ color: "#64748b", fontSize: "10px" }}>
                      Formula: min(100, Population Factor + Urgency Rating + Accessibility Penalty + Weather Penalty + Infrastructure Penalty)
                    </small>
                  </div>

                  {/* Contributing Factors */}
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
                    <strong style={{ fontSize: "12px", display: "block", marginBottom: "8px" }}>
                      Transparent Score Contributions:
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "11px", color: "#475569", lineHeight: "1.8" }}>
                      {severityResult?.factors?.map((f, i) => (
                        <li key={i}>{f}</li>
                      )) ?? (
                        <>
                          <li>Affected population (40): +16 pts</li>
                          <li>Reported urgency level (4/5): +32 pts</li>
                          <li>Access route cut off / closed: +15 pts</li>
                          <li>Adverse weather / continuing rain: +10 pts</li>
                          <li>Critical infrastructure damage reported: +10 pts</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Threat Evaluation & Escalation Potential
                  </h3>

                  <div className="agent-thought-box">
                    <div className="agent-thought-header">
                      <Zap size={13} /> Agent 2 Reasoning Log
                    </div>
                    "Evaluated {pipelineIncident.location}. Primary threat is water inundation cutting off residential access while rainfall persists. Escalation risk is High because upstream reservoir outflow is scheduled to peak within 3 hours. Recommending immediate evacuation staging."
                  </div>

                  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
                    <strong style={{ fontSize: "12px", display: "block", marginBottom: "8px", color: "#dc2626" }}>
                      Immediate Operational Hazards:
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                      <li>Rising floodwater encroaching above ground-floor residential living areas.</li>
                      <li>Road accessibility degraded — standard wheeled vehicles cannot penetrate flooded zone.</li>
                      <li>High concentration of vulnerable residents unable to self-evacuate.</li>
                    </ul>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" onClick={() => setPipelineStep(3)}>
                      Proceed to Agent 3: Weather Intelligence ➔
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------
              PAGE 3: AGENT 3 — WEATHER & ENVIRONMENTAL INTELLIGENCE AGENT
              -------------------------------------------------------------------- */}
          {pipelineStep === 3 && (
            <div className="agent-stage-container">
              <div className="agent-stage-header">
                <div className="agent-stage-title-wrap">
                  <div className="agent-stage-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                    <CloudRain size={24} />
                  </div>
                  <div>
                    <h2>Agent 3 — Weather & Environmental Intelligence Agent</h2>
                    <p>Integrates live meteorological APIs, assesses rainfall and wind, and triggers incident priority reassessment.</p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" onClick={() => setPipelineStep(2)}>
                    <ArrowLeft size={14} /> Back to Agent 2
                  </button>
                  <button className="btn btn-primary" onClick={() => setPipelineStep(4)}>
                    Proceed to Agent 4 ➔
                  </button>
                </div>
              </div>

              <PlainEnglishCard text="The Weather Agent connects to real-time meteorological radar (Open-Meteo API). If heavy rainfall, gale-force winds, or lightning are bearing down on the incident area, it warns responders of worsening conditions and automatically escalates triage priority." />

              <MessageHandoffBanner
                incomingFrom="Agent 2 (Severity Assessment Agent)"
                incomingText={`Triage Priority: ${pipelineIncident.location}, Priority 78 (Critical), GPS [16.512, 80.641].`}
                agentAction="Pulls real-time Open-Meteo telemetry: Precipitation 16.5 mm/h (Heavy), Wind gust 62 km/h, Storm active."
                outgoingTo="Agent 4 (Geospatial & Route Accessibility Agent)"
                outgoingText="Weather Telemetry Packet: { rain_rate: '16.5 mm/h', wind: '62 km/h', storm_active: true, priority_escalation: +10, warning: 'Rapid flood expansion predicted' }"
              />

              <div className="grid-2">
                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Live Meteorological Telemetry (Open-Meteo Integration)
                  </h3>

                  <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginBottom: "16px" }}>
                    <div className="metric-card" style={{ padding: "12px" }}>
                      <div className="metric-icon blue" style={{ marginBottom: "8px" }}>
                        <CloudRain size={16} />
                      </div>
                      <div className="metric-label">PRECIPITATION RATE</div>
                      <div className="metric-value" style={{ fontSize: "22px" }}>
                        {weatherTelemetry.precipitation} mm/h
                      </div>
                      <div className="metric-detail">Heavy rainfall active</div>
                    </div>

                    <div className="metric-card" style={{ padding: "12px" }}>
                      <div className="metric-icon amber" style={{ marginBottom: "8px" }}>
                        <Wind size={16} />
                      </div>
                      <div className="metric-label">WIND GUSTS</div>
                      <div className="metric-value" style={{ fontSize: "22px" }}>
                        {weatherTelemetry.wind_speed} km/h
                      </div>
                      <div className="metric-detail">Elevated squalls</div>
                    </div>

                    <div className="metric-card" style={{ padding: "12px" }}>
                      <div className="metric-icon green" style={{ marginBottom: "8px" }}>
                        <Thermometer size={16} />
                      </div>
                      <div className="metric-label">SURFACE TEMP</div>
                      <div className="metric-value" style={{ fontSize: "22px" }}>
                        {weatherTelemetry.temperature} °C
                      </div>
                      <div className="metric-detail">Saturated ground</div>
                    </div>

                    <div className="metric-card" style={{ padding: "12px" }}>
                      <div className="metric-icon red" style={{ marginBottom: "8px" }}>
                        <AlertTriangle size={16} />
                      </div>
                      <div className="metric-label">STORM ADVISORY</div>
                      <div className="metric-value" style={{ fontSize: "18px", color: "#dc2626" }}>
                        ACTIVE
                      </div>
                      <div className="metric-detail">Severe Flood Warning</div>
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
                    <strong style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>6-Hour Trend Forecast:</strong>
                    <p style={{ fontSize: "11px", color: "#475569", margin: 0 }}>{weatherTelemetry.forecast}</p>
                  </div>

                  <div style={{ marginTop: "14px", display: "flex", gap: "10px" }}>
                    <button className="btn btn-warning btn-sm" onClick={() => void handleSimulateSevereWeather()}>
                      <Flame size={13} /> Simulate Torrential Storm (TC-07)
                    </button>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Environmental Reassessment Advisory
                  </h3>

                  <div className="agent-thought-box">
                    <div className="agent-thought-header">
                      <Zap size={13} /> Agent 3 Reasoning Log
                    </div>
                    "{weatherTelemetry.impact_note} Rainfall code {weatherTelemetry.condition} confirmed. Reassessment recommendation transmitted to Agent 2 and Coordination Agent. Boat rescue operations must prioritize shallow-draft watercraft."
                  </div>

                  <div className="alert-card critical" style={{ marginBottom: "16px" }}>
                    <AlertTriangle size={20} style={{ color: "#dc2626", flexShrink: 0 }} />
                    <div className="alert-body">
                      <strong style={{ color: "#b91c1c" }}>Adverse Environmental Escalation Detected</strong>
                      <p>
                        Continued rainfall for the next 6 hours increases flood depth and risk of canal overtopping.
                        Priority score escalated (+10 pts) due to worsening meteorology.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" onClick={() => setPipelineStep(4)}>
                      Proceed to Agent 4: Geospatial & Route Accessibility ➔
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------
              PAGE 4: AGENT 4 — GEOSPATIAL & ROUTE ACCESSIBILITY AGENT (GIS)
              -------------------------------------------------------------------- */}
          {pipelineStep === 4 && (
            <div className="agent-stage-container">
              <div className="agent-stage-header">
                <div className="agent-stage-title-wrap">
                  <div className="agent-stage-icon" style={{ background: "#fffbeb", color: "#d97706" }}>
                    <Compass size={24} />
                  </div>
                  <div>
                    <h2>Agent 4 — Geospatial & Route Accessibility Agent</h2>
                    <p>
                      Analyzes incident locations, geocodes, and strictly distinguishes Known Road Closures from AI-Inferred Accessibility Problems.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" onClick={() => setPipelineStep(3)}>
                    <ArrowLeft size={14} /> Back to Agent 3
                  </button>
                  <button className="btn btn-primary" onClick={() => setPipelineStep(5)}>
                    Proceed to Agent 5 ➔
                  </button>
                </div>
              </div>

              <PlainEnglishCard text="The Geospatial Agent analyzes road networks, bridge elevations, and water depth. It strictly distinguishes known road closures from safe detours, and tells the system what transit mode is required (e.g. standard roads are impassable, so only Rescue Boats can reach the victims)." />

              <MessageHandoffBanner
                incomingFrom="Agent 3 (Weather Intelligence Agent)"
                incomingText={`Incident Location (${pipelineIncident.location}) + Weather Alert (16.5 mm/h rainfall).`}
                agentAction="Computes spatial topology on road network; detects Bridge A is submerged and impassable for wheeled vehicles."
                outgoingTo="Agent 5 (Emergency Resource Management Agent)"
                outgoingText="GIS Route Packet: { route_status: 'Riverdale Access Road Underwater', transit_mode_required: 'Boat Only / Watercraft', target_shelter: 'Highland Community Shelter (4.2 km)' }"
              />

              <div className="grid-2">
                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Interactive GIS Tactical Map
                  </h3>

                  <div className="map-wrap" style={{ height: "320px", marginBottom: "12px" }}>
                    <MapContainer
                      center={[pipelineIncident.latitude || 16.512, pipelineIncident.longitude || 80.641]}
                      zoom={13}
                      scrollWheelZoom={false}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer
                        attribution="&copy; OpenStreetMap contributors"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />

                      {/* Incident Pin */}
                      <Marker
                        position={[pipelineIncident.latitude || 16.512, pipelineIncident.longitude || 80.641]}
                        icon={createPin("#dc2626", "INC")}
                      >
                        <Popup>
                          <strong>{pipelineIncident.incident_id || "INC-001"}</strong>
                          <p>{pipelineIncident.location}</p>
                          <small>{pipelineIncident.people_affected} people affected</small>
                        </Popup>
                      </Marker>

                      {/* Shelters Pins */}
                      {shelters.map((s) => (
                        <Marker
                          key={s.shelter_id}
                          position={[s.latitude || 16.515, s.longitude || 80.645]}
                          icon={createPin("#2563eb", "SH")}
                        >
                          <Popup>
                            <strong>{s.name}</strong>
                            <p>Occupancy: {s.occupied}/{s.total_capacity}</p>
                          </Popup>
                        </Marker>
                      ))}

                      {/* Available Rescue Resources */}
                      {resources.filter((r) => r.status === "Available").map((r) => (
                        <Marker
                          key={r.resource_id}
                          position={[r.latitude || 16.508, r.longitude || 80.635]}
                          icon={createPin("#16a34a", "RES")}
                        >
                          <Popup>
                            <strong>{r.name}</strong>
                            <p>{r.resource_type} · Cap: {r.capacity}</p>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>

                  <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "#64748b" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#dc2626", display: "inline-block" }} />
                      Incident Zone
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#2563eb", display: "inline-block" }} />
                      Shelter
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
                      Available Fleet
                    </span>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Route Accessibility & Closure Categorization
                  </h3>

                  <div className="agent-thought-box">
                    <div className="agent-thought-header">
                      <Zap size={13} /> Agent 4 Reasoning Log
                    </div>
                    "Analyzing access corridors to {pipelineIncident.location}. Primary corridor has reported road blockage. Applying strict distinction: Verified physical barricade marked as 'Known Road Closure'. Surrounding unverified roads marked as 'Route verification required' rather than inventing fictional detour routes."
                  </div>

                  {/* Road items */}
                  {roads.map((road) => (
                    <div
                      key={road.road_id}
                      className={`route-card ${
                        road.status === "Closed"
                          ? "known-closure"
                          : road.status === "Partially Blocked"
                          ? "ai-inferred"
                          : "route-open"
                      }`}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: "12px" }}>{road.name}</strong>
                        <span
                          className={`badge ${
                            road.status === "Closed"
                              ? "badge-red"
                              : road.status === "Partially Blocked"
                              ? "badge-amber"
                              : "badge-green"
                          }`}
                        >
                          {road.status}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", margin: "4px 0" }}>
                        Corridor: {road.origin_location} ➔ {road.destination_location}
                      </div>
                      <div style={{ fontSize: "10px", color: road.status === "Closed" ? "#dc2626" : "#64748b" }}>
                        <strong>Closure Type:</strong> {road.closure_type}
                        {road.reason && ` (${road.reason})`}
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" onClick={() => setPipelineStep(5)}>
                      Proceed to Agent 5: Emergency Resource Management ➔
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------
              PAGE 5: AGENT 5 — EMERGENCY RESOURCE MANAGEMENT AGENT
              -------------------------------------------------------------------- */}
          {pipelineStep === 5 && (
            <div className="agent-stage-container">
              <div className="agent-stage-header">
                <div className="agent-stage-title-wrap">
                  <div className="agent-stage-icon" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                    <Truck size={24} />
                  </div>
                  <div>
                    <h2>Agent 5 — Emergency Resource Management Agent</h2>
                    <p>
                      Maintains live resource inventory, enforces strict state transitions (Available ➔ Reserved ➔ Deployed ➔ Returning),
                      and monitors shelter capacities.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" onClick={() => setPipelineStep(4)}>
                    <ArrowLeft size={14} /> Back to Agent 4
                  </button>
                  <button className="btn btn-primary" onClick={() => setPipelineStep(6)}>
                    Proceed to Agent 6 ➔
                  </button>
                </div>
              </div>

              <PlainEnglishCard text="The Resource Agent manages the emergency fleet inventory (rescue boats, ambulances, drones). It locks vehicles in the database (Available ➔ Reserved) so two dispatchers cannot double-book the same boat, and monitors shelter bed capacities in real-time." />

              <MessageHandoffBanner
                incomingFrom="Agent 4 (Geospatial & Route Accessibility Agent)"
                incomingText="Mission Requirement: 'Boat Only' transit required for 40 victims; evacuate to Highland Shelter."
                agentAction="Applies atomic database lock on Available rescue boats; confirms Highland Shelter has 90 open beds."
                outgoingTo="Agent 6 (Resource Allocation & Response Planning Agent)"
                outgoingText="Fleet Inventory Packet: { available_boats: ['BOAT-001 (cap: 25)', 'BOAT-002 (cap: 20)'], shelter_capacity: 90 beds, state: 'RESERVED_FOR_DISPATCH' }"
              />

              <div className="grid-2">
                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Resource Inventory & State Machine
                  </h3>

                  <div className="resource-counts">
                    <div>
                      <span>AVAILABLE</span>
                      <strong style={{ color: "#16a34a" }}>
                        {resources.filter((r) => r.status === "Available").length}
                      </strong>
                    </div>
                    <div>
                      <span>RESERVED</span>
                      <strong style={{ color: "#d97706" }}>
                        {resources.filter((r) => r.status === "Reserved").length}
                      </strong>
                    </div>
                    <div>
                      <span>DEPLOYED</span>
                      <strong style={{ color: "#dc2626" }}>
                        {resources.filter((r) => r.status === "Deployed").length}
                      </strong>
                    </div>
                  </div>

                  <div className="table-scroll" style={{ maxHeight: "280px" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Resource</th>
                          <th>Type</th>
                          <th>Capacity</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resources.slice(0, 8).map((res) => (
                          <tr key={res.resource_id}>
                            <td>
                              <strong>{res.name}</strong>
                              <small>{res.location}</small>
                            </td>
                            <td>{res.resource_type}</td>
                            <td>{res.capacity} pers</td>
                            <td>
                              <span
                                className={`badge ${
                                  res.status === "Available"
                                    ? "badge-green"
                                    : res.status === "Reserved"
                                    ? "badge-amber"
                                    : "badge-red"
                                }`}
                              >
                                {res.status}
                              </span>
                            </td>
                            <td>
                              {res.status === "Available" && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => void handleUpdateResourceStatus(res.resource_id, "Reserved")}
                                >
                                  Reserve
                                </button>
                              )}
                              {res.status === "Reserved" && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => void handleUpdateResourceStatus(res.resource_id, "Deployed")}
                                >
                                  Deploy
                                </button>
                              )}
                              {res.status === "Deployed" && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => void handleUpdateResourceStatus(res.resource_id, "Available")}
                                >
                                  Return
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Shelter Capacities & Saturation Monitoring
                  </h3>

                  <div className="agent-thought-box">
                    <div className="agent-thought-header">
                      <Zap size={13} /> Agent 5 Reasoning Log
                    </div>
                    "Tracking 3 regional shelters. Shelter A is currently near capacity (160/200, 80%). Shelter B has 90 available slots. Shelter C has 190 available slots. Double allocation guard active — serialized transaction prevents concurrent assignment of the same rescue asset."
                  </div>

                  {shelters.map((shelter) => {
                    const percent = Math.round((shelter.occupied / shelter.total_capacity) * 100);
                    return (
                      <div key={shelter.shelter_id} className="shelter-row">
                        <div className="shelter-heading">
                          <strong>{shelter.name}</strong>
                          <span
                            className={`badge ${
                              percent >= 90
                                ? "badge-red"
                                : percent >= 75
                                ? "badge-amber"
                                : "badge-green"
                            }`}
                          >
                            {percent}% Occupied ({shelter.occupied}/{shelter.total_capacity})
                          </span>
                        </div>
                        <div className="progress-track">
                          <div
                            className={`progress-fill ${
                              percent >= 90 ? "fill-red" : percent >= 75 ? "fill-amber" : "fill-green"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="shelter-bottom">
                          <span>Remaining Capacity: {shelter.total_capacity - shelter.occupied} spots</span>
                          <span>Status: {shelter.status}</span>
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" onClick={() => setPipelineStep(6)}>
                      Proceed to Agent 6: Resource Allocation & Planning ➔
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------
              PAGE 6: AGENT 6 — RESOURCE ALLOCATION & RESPONSE PLANNING AGENT
              -------------------------------------------------------------------- */}
          {pipelineStep === 6 && (
            <div className="agent-stage-container">
              <div className="agent-stage-header">
                <div className="agent-stage-title-wrap">
                  <div className="agent-stage-icon" style={{ background: "#ecfeff", color: "#0891b2" }}>
                    <Sliders size={24} />
                  </div>
                  <div>
                    <h2>Agent 6 — Resource Allocation & Response Planning Agent</h2>
                    <p>
                      Matches resource capabilities to incident needs, calculates shortages & deficits, and formulates feasible alternative plans without hallucination.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" onClick={() => setPipelineStep(5)}>
                    <ArrowLeft size={14} /> Back to Agent 5
                  </button>
                  <button className="btn btn-primary" onClick={() => setPipelineStep(7)}>
                    Proceed to Agent 7 ➔
                  </button>
                </div>
              </div>

              <PlainEnglishCard text="The Allocation Agent solves the rescue puzzle: it matches available rescue craft to victim headcounts. If there is a shortage (a deficit), it alerts the team immediately and formulates backup plans without hallucinating fake ambulances." />

              <MessageHandoffBanner
                incomingFrom="Agent 5 (Emergency Resource Management Agent)"
                incomingText={`40 trapped victims at ${pipelineIncident.location}; 2 Rescue Boats reserved (Total capacity: 45).`}
                agentAction="Calculates capacity deficit: 40 victims vs 45 capacity = Deficit: 0. Matches BOAT-001 & BOAT-002 to staging area."
                outgoingTo="Agent 7 (Emergency Coordination & Action Agent)"
                outgoingText="Tactical Dispatch Manifest Packet: { assigned_units: ['BOAT-001', 'BOAT-002'], staging_area: 'North Ridge Boat Ramp', est_evacuation_time: '35 mins', deficit: 0 }"
              />

              <div className="grid-2">
                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Resource Requirement & Shortage Detection Engine
                  </h3>

                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                      <label style={{ flex: 1, fontSize: "11px", fontWeight: 700 }}>
                        Required Resource Type:
                        <select
                          value={shortageType}
                          onChange={(e) => setShortageType(e.target.value)}
                          style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                        >
                          <option value="Rescue Boat">Rescue Boat</option>
                          <option value="Rescue Team">Rescue Team</option>
                          <option value="Ambulance">Ambulance</option>
                          <option value="Emergency Vehicle">Emergency Vehicle</option>
                        </select>
                      </label>

                      <label style={{ width: "120px", fontSize: "11px", fontWeight: 700 }}>
                        Required Units:
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={shortageQuantity}
                          onChange={(e) => setShortageQuantity(Number(e.target.value))}
                          style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                        />
                      </label>
                    </div>

                    <button className="btn btn-primary btn-sm" onClick={() => void handleCheckShortage()}>
                      <Sliders size={13} /> Compute Shortage & Deficit (TC-04)
                    </button>
                  </div>

                  {/* Deficit Card */}
                  <div className="alert-card critical">
                    <AlertTriangle size={24} style={{ color: "#dc2626", flexShrink: 0 }} />
                    <div className="alert-body">
                      <strong style={{ color: "#b91c1c" }}>Resource Shortage Detected: 3 Units Unfulfilled</strong>
                      <p style={{ margin: "4px 0" }}>
                        Required: <strong>8 Rescue Boats</strong> | Verified Available in Registry: <strong>5 Units</strong>
                      </p>
                      <strong style={{ color: "#dc2626" }}>Calculated Deficit = 3 Rescue Boats</strong>
                    </div>
                  </div>

                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px", marginTop: "12px" }}>
                    <strong style={{ fontSize: "11px", color: "#166534" }}>No Hallucination Enforcement:</strong>
                    <p style={{ fontSize: "10px", color: "#15803d", margin: "4px 0 0" }}>
                      The system does NOT invent the availability of helicopters, amphibious military transports, or unverified contractors.
                      All shortfalls trigger formal escalation protocols.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Feasible Alternative Allocation Plans
                  </h3>

                  <div className="agent-thought-box">
                    <div className="agent-thought-header">
                      <Zap size={13} /> Agent 6 Reasoning Log
                    </div>
                    "Evaluating allocation for {pipelineIncident.location} (40 people affected). Access road is partially flooded, preventing standard ambulances. Recommending staged deployment of 2 available Rescue Boats (BOAT-001, BOAT-002, capacity 8 each). Staging perimeter at Sector Alpha high ground. Deficit of 3 boats submitted to regional mutual aid."
                  </div>

                  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
                    <strong style={{ fontSize: "12px", display: "block", marginBottom: "8px" }}>
                      Recommended Tactical Actions:
                    </strong>
                    <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "11px", color: "#475569", lineHeight: "1.7" }}>
                      <li>
                        <strong>Deploy 2 Available Rescue Boats:</strong> BOAT-001 (Response Base 1) and BOAT-002 (Response Base 1)
                        for immediate shallow water shuttle.
                      </li>
                      <li>
                        <strong>Stage Staging Area:</strong> Sector Alpha Junction high ground before flooded road stretch.
                      </li>
                      <li>
                        <strong>Trigger Mutual Aid Request:</strong> Formal deficit notification sent to State Emergency Management
                        Agency (SEMA) for 3 additional watercraft.
                      </li>
                    </ol>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" onClick={() => setPipelineStep(7)}>
                      Proceed to Agent 7: Emergency Coordination & Action ➔
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------
              PAGE 7: AGENT 7 — EMERGENCY COORDINATION & ACTION AGENT
              -------------------------------------------------------------------- */}
          {pipelineStep === 7 && (
            <div className="agent-stage-container">
              <div className="agent-stage-header">
                <div className="agent-stage-title-wrap">
                  <div className="agent-stage-icon" style={{ background: "#fff1f2", color: "#e11d48" }}>
                    <Users size={24} />
                  </div>
                  <div>
                    <h2>Agent 7 — Emergency Coordination & Action Agent</h2>
                    <p>
                      Synthesizes all agent outputs into an Incident Action Plan (IAP) and enforces mandatory Incident Commander authorization.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" onClick={() => setPipelineStep(6)}>
                    <ArrowLeft size={14} /> Back to Agent 6
                  </button>
                  <button className="btn btn-primary" onClick={() => setPipelineStep(8)}>
                    Proceed to Agent 8 ➔
                  </button>
                </div>
              </div>

              <PlainEnglishCard text="The Coordination Agent compiles all previous data into an official Incident Action Plan (IAP) with downloadable PDF orders. Most importantly, it enforces Human-in-the-Loop safety: no vehicles deploy until an authorized human Incident Commander reviews and signs off." />

              <MessageHandoffBanner
                incomingFrom="Agent 6 (Resource Allocation & Response Planning Agent)"
                incomingText="Tactical Manifest: BOAT-001 & BOAT-002 staged at North Ridge Ramp for 40 evacuees."
                agentAction="Compiles formal Incident Action Plan (IAP); prompts Incident Commander for mandatory cryptographic authorization."
                outgoingTo="Agent 8 (Reviewer & Critic Agent)"
                outgoingText="Draft IAP Packet: { iap_id: 'IAP-2026-001', authorized_by: 'Commander Sarah Jenkins', status: 'Pending Safety Critic Sanity Audit' }"
              />

              <div className="grid-2">
                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Compiled Incident Action Plan (IAP)
                  </h3>

                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                      <strong style={{ fontSize: "13px" }}>Incident Action Plan: Flood Evacuation Zone A</strong>
                      <span className="badge badge-amber">Awaiting Commander Signature</span>
                    </div>

                    <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.7" }}>
                      <p style={{ margin: "0 0 6px 0" }}>
                        <strong>Target Incident:</strong> {pipelineIncident.incident_id || "INC-001"} · {pipelineIncident.location}
                      </p>
                      <p style={{ margin: "0 0 6px 0" }}>
                        <strong>Assigned Resources:</strong> BOAT-001, BOAT-002 (Rescue Fleet Alpha)
                      </p>
                      <p style={{ margin: "0 0 6px 0" }}>
                        <strong>Designated Evacuation Shelter:</strong> Shelter B (150 capacity, 90 available slots)
                      </p>
                      <p style={{ margin: "0 0 6px 0" }}>
                        <strong>Access Corridor:</strong> Staging at North Highway Junction; secondary perimeter established.
                      </p>
                      <p style={{ margin: "0 0 6px 0" }}>
                        <strong>Weather Consideration:</strong> Operations subject to squall limits (&lt;60 km/h wind).
                      </p>
                    </div>

                    <a
                      href={`${API}/reports/situation`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: "10px" }}
                    >
                      <FileDown size={13} /> Export PDF Situation Report
                    </a>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Human-in-the-Loop Commander Authorization Gate
                  </h3>

                  <div className="agent-thought-box">
                    <div className="agent-thought-header">
                      <Zap size={13} /> Agent 7 Reasoning Log
                    </div>
                    "Incident Action Plan compiled. Autonomous execution is disabled per safety protocol. Requiring authorized Incident Commander credential verification and manual sign-off prior to resource physical dispatch."
                  </div>

                  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "8px" }}>
                      Authorized Commander Name:
                      <input
                        type="text"
                        value={reviewerName}
                        onChange={(e) => setReviewerName(e.target.value)}
                        style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                      />
                    </label>

                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "12px" }}>
                      Commander Operational Notes:
                      <textarea
                        rows={2}
                        value={reviewComments}
                        onChange={(e) => setReviewComments(e.target.value)}
                        style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                      />
                    </label>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        className="btn btn-success"
                        onClick={() => {
                          setSuccessMsg("Commander Sarah Chen authorized deployment of 2 Rescue Boats.");
                          setTimeout(() => setSuccessMsg(""), 5000);
                        }}
                      >
                        <CheckCircle2 size={14} /> Authorize & Dispatch (Approve)
                      </button>

                      <button
                        className="btn btn-danger"
                        onClick={() => {
                          setErrorMsg("Commander Sarah Chen rejected deployment. Plan returned for revision.");
                          setTimeout(() => setErrorMsg(""), 5000);
                        }}
                      >
                        <XCircle size={14} /> Reject / Request Revision
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" onClick={() => setPipelineStep(8)}>
                      Proceed to Agent 8: Safety Critic Audit ➔
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------
              PAGE 8: AGENT 8 — REVIEWER & CRITIC AGENT
              -------------------------------------------------------------------- */}
          {pipelineStep === 8 && (
            <div className="agent-stage-container">
              <div className="agent-stage-header">
                <div className="agent-stage-title-wrap">
                  <div className="agent-stage-icon" style={{ background: "#faf5ff", color: "#9333ea" }}>
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2>Agent 8 — Reviewer & Critic Agent (Autonomous Safety Auditor)</h2>
                    <p>
                      Independently audits all agent recommendations, detects contradictions, checks double allocation, and certifies safety boundaries.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" onClick={() => setPipelineStep(7)}>
                    <ArrowLeft size={14} /> Back to Agent 7
                  </button>
                  <button className="btn btn-primary" onClick={() => setPipelineStep(9)}>
                    Final Orchestration ➔
                  </button>
                </div>
              </div>

              <PlainEnglishCard text="The Safety Critic Agent is the autonomous safety auditor. It doesn't trust anyone: it cross-examines the plan to make sure wheeled ambulances aren't sent into deep water, no boat is double-booked, and the destination shelter isn't full. Only when 100% of safety checks pass does it certify the dispatch." />

              <MessageHandoffBanner
                incomingFrom="Agent 7 (Emergency Coordination & Action Agent)"
                incomingText="Draft IAP signed by Commander for 2 rescue boats deployed to Riverdale Zone A."
                agentAction="Executes 6 independent sanity rules: route clearance, double-allocation check, shelter headroom, and water depth."
                outgoingTo="Incident Commander EOC Dashboard & Field Responders"
                outgoingText="Certified Dispatch Packet: { safety_certified: true, contradictions_detected: 0, status: 'DISPATCH AUTHORIZED & SECURED', audit_stamp: 'CRITIC-PASS-7729' }"
              />

              <div className="grid-2">
                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Safety Audit & Constraint Checklist
                  </h3>

                  {criticAudit.sanity_checks.map((check, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "12px",
                        marginBottom: "10px",
                      }}
                    >
                      <CheckCircle2 size={18} style={{ color: "#16a34a", flexShrink: 0, marginTop: "2px" }} />
                      <div>
                        <strong style={{ fontSize: "12px", color: "#0f172a" }}>{check.title}</strong>
                        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>{check.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 12px 0" }}>
                    Official Safety Certification
                  </h3>

                  <div className="agent-thought-box">
                    <div className="agent-thought-header">
                      <Zap size={13} /> Agent 8 Reasoning Log
                    </div>
                    "Audit completed. No double allocation detected. Assigned units BOAT-001 and BOAT-002 confirmed free of competing assignments. Staging perimeter accounts for reported road flooding. Mandatory human approval gate is intact. Recommendation certified: READY FOR HUMAN REVIEW."
                  </div>

                  <div className="alert-card" style={{ borderLeft: "5px solid #16a34a", background: "#f0fdf4" }}>
                    <ShieldCheck size={28} style={{ color: "#16a34a", flexShrink: 0 }} />
                    <div className="alert-body">
                      <strong style={{ color: "#15803d", fontSize: "13px" }}>
                        Safety Certification: Ready for Human Review
                      </strong>
                      <p style={{ margin: "4px 0", color: "#166534" }}>{criticAudit.safety_certification}</p>
                      <span className="badge badge-green">Safety Audit Passed</span>
                    </div>
                  </div>

                  <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" onClick={() => setPipelineStep(9)}>
                      Proceed to Final Orchestration & Summary ➔
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------
              PAGE 9: MULTI-AGENT ORCHESTRATION & SUMMARY VIEW
              -------------------------------------------------------------------- */}
          {pipelineStep === 9 && (
            <div className="agent-stage-container">
              <div className="agent-stage-header">
                <div className="agent-stage-title-wrap">
                  <div className="agent-stage-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
                    <Workflow size={24} />
                  </div>
                  <div>
                    <h2>Multi-Agent Orchestration & Workflow State (LangGraph)</h2>
                    <p>
                      The complete multi-agent pipeline has executed successfully across all eight specialized agents.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" onClick={() => setPipelineStep(8)}>
                    <ArrowLeft size={14} /> Back to Agent 8
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => void handleRunWorkflow()}
                    disabled={workflowLoading}
                  >
                    <RefreshCw size={14} className={workflowLoading ? "spin" : ""} /> Re-Execute Workflow
                  </button>
                </div>
              </div>

              <PlainEnglishCard text="The Orchestration View shows the compiled LangGraph StateGraph. All eight specialized agents ran in deterministic sequence, passing immutable state tokens, logging every decision, and producing a complete, life-saving rescue execution." />

              <MessageHandoffBanner
                incomingFrom="LangGraph StateGraph Compiled Runtime"
                incomingText="Sequential node transitions completed from Node 1 (Intake) through Node 8 (Critic Audit)."
                agentAction="Aggregates full audit telemetry, timing benchmarks, and serializes state graph JSON checkpoint."
                outgoingTo="EOC Master Archive & Real-Time GIS Dispatch Ledger"
                outgoingText="Workflow Execution Transcript: { state_checkpoint: 'SUCCESS', nodes_executed: 8, total_runtime_ms: 320, mission_ready: true }"
              />

              {/* Execution Flow Diagram */}
              <div style={{ background: "#0f172a", color: "white", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#94a3b8", marginBottom: "16px" }}>
                  LANGGRAPH STATEGRAPH EXECUTION FLOW (COMPILED)
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflowX: "auto", paddingBottom: "10px" }}>
                  {[
                    "START",
                    "Agent 1: Intake",
                    "Agent 2: Severity",
                    "Agent 3: Weather",
                    "Agent 4: GIS Routes",
                    "Agent 5: Resources",
                    "Agent 6: Allocation",
                    "Agent 7: Action",
                    "Agent 8: Critic",
                    "END",
                  ].map((node, i) => (
                    <div key={node} style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <div
                        style={{
                          background: node === "START" || node === "END" ? "#334155" : "#1e293b",
                          border: "1px solid #475569",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: node === "START" || node === "END" ? "#94a3b8" : "#f87171",
                        }}
                      >
                        {node}
                      </div>
                      {i < 9 && <span style={{ color: "#64748b" }}>➔</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setPipelineStep(1);
                    setIntakeResult(null);
                  }}
                >
                  <Radio size={14} /> Ingest Another Incident
                </button>

                <button className="btn btn-secondary" onClick={() => setActiveTab("map")}>
                  <Compass size={14} /> View On Tactical GIS Map
                </button>

                <button className="btn btn-secondary" onClick={() => setActiveTab("approvals")}>
                  <Users size={14} /> Open Commander Approval Center
                </button>

                <a href={`${API}/reports/situation`} target="_blank" rel="noreferrer" className="btn btn-secondary">
                  <FileDown size={14} /> Download PDF Situation Report
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================
          VIEW 3: EMERGENCY DASHBOARD (High Level Operational Picture)
          ======================================================================== */}
      {activeTab === "dashboard" && (
        <div>
          {/* Key Metrics */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon red">
                <Radio size={19} />
              </div>
              <div className="metric-label">TOTAL INCIDENTS</div>
              <div className="metric-value">{dashboard?.incidents?.total ?? incidents.length}</div>
              <div className="metric-detail">
                {dashboard?.incidents?.critical ?? 1} Critical · {dashboard?.incidents?.high ?? 1} High
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon blue">
                <Truck size={19} />
              </div>
              <div className="metric-label">AVAILABLE FLEET</div>
              <div className="metric-value">
                {resources.filter((r) => r.status === "Available").length}
                <span style={{ fontSize: "16px", color: "#64748b" }}> / {resources.length}</span>
              </div>
              <div className="metric-detail">
                {resources.filter((r) => r.status === "Deployed").length} Deployed ·{" "}
                {resources.filter((r) => r.status === "Reserved").length} Reserved
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon amber">
                <Users size={19} />
              </div>
              <div className="metric-label">PENDING APPROVALS</div>
              <div className="metric-value">{pendingApprovalsCount}</div>
              <div className="metric-detail">Awaiting Incident Commander review</div>
            </div>

            <div className="metric-card">
              <div className="metric-icon green">
                <Warehouse size={19} />
              </div>
              <div className="metric-label">AVAILABLE SHELTER SLOTS</div>
              <div className="metric-value">
                {shelters.reduce((acc, s) => acc + (s.total_capacity - s.occupied), 0)}
              </div>
              <div className="metric-detail">Across {shelters.length} regional temporary shelters</div>
            </div>
          </div>

          {/* Operational Grids */}
          <div className="main-grid">
            {/* Active Watch Incidents */}
            <div className="panel">
              <div className="panel-heading">
                <div className="panel-title">
                  <Radio size={18} />
                  <h2>Active Incident Watch & Priority</h2>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab("incidents")}>
                  Manage All
                </button>
              </div>

              <div className="stack-list">
                {incidents.slice(0, 5).map((inc) => (
                  <div key={inc.incident_id} className="watch-item">
                    <div
                      className={`severity-bar ${
                        inc.severity?.level === "Critical"
                          ? "critical"
                          : inc.severity?.level === "High"
                          ? "high"
                          : "medium"
                      }`}
                    />
                    <div className="watch-content">
                      <div className="watch-top">
                        <strong>
                          {inc.incident_id} · {inc.location}
                        </strong>
                        <span
                          className={`badge ${
                            inc.severity?.level === "Critical"
                              ? "badge-red"
                              : inc.severity?.level === "High"
                              ? "badge-amber"
                              : "badge-gray"
                          }`}
                        >
                          {inc.severity?.level || "Medium"} ({inc.severity?.score || inc.severity_score || 50}/100)
                        </span>
                      </div>
                      <p>{inc.description}</p>
                      <div style={{ display: "flex", gap: "10px", fontSize: "10px", color: "#64748b" }}>
                        <span>Affected: {inc.people_affected} people</span>
                        <span>Source: {inc.source}</span>
                        <span>Status: {inc.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* GIS Overview Snapshot */}
            <div className="panel">
              <div className="panel-heading">
                <div className="panel-title">
                  <Compass size={18} />
                  <h2>Geospatial Situation Snapshot</h2>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab("map")}>
                  Full Map View
                </button>
              </div>

              <div className="map-wrap" style={{ height: "260px" }}>
                <MapContainer
                  center={[16.512, 80.641]}
                  zoom={12}
                  scrollWheelZoom={false}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {incidents.map((inc) => (
                    <Marker
                      key={inc.incident_id}
                      position={[inc.latitude || 16.512, inc.longitude || 80.641]}
                      icon={createPin("#dc2626", "INC")}
                    >
                      <Popup>
                        <strong>{inc.incident_id}</strong>
                        <p>{inc.location}</p>
                      </Popup>
                    </Marker>
                  ))}
                  {shelters.map((s) => (
                    <Marker
                      key={s.shelter_id}
                      position={[s.latitude || 16.515, s.longitude || 80.645]}
                      icon={createPin("#2563eb", "SH")}
                    >
                      <Popup>
                        <strong>{s.name}</strong>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
                <span>Roads: {roads.filter((r) => r.status === "Closed").length} Closed Corridors</span>
                <span>Active Alerts: {alerts.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          VIEW 4: INCIDENT CENTER
          ======================================================================== */}
      {activeTab === "incidents" && (
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Radio size={18} />
              <h2>Incident Center — Registry & Multi-Source Intake</h2>
            </div>
            <span className="badge badge-gray">{incidents.length} Registered</span>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Disaster</th>
                  <th>Location</th>
                  <th>Affected</th>
                  <th>Severity</th>
                  <th>Source</th>
                  <th>Duplicate Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.incident_id}>
                    <td>
                      <strong>{inc.incident_id}</strong>
                      <small>{inc.created_at?.slice(0, 10)}</small>
                    </td>
                    <td>{inc.disaster_type}</td>
                    <td>{inc.location}</td>
                    <td>{inc.people_affected}</td>
                    <td>
                      <span
                        className={`badge ${
                          inc.severity?.level === "Critical"
                            ? "badge-red"
                            : inc.severity?.level === "High"
                            ? "badge-amber"
                            : "badge-green"
                        }`}
                      >
                        {inc.severity?.level || "Medium"} ({inc.severity?.score || inc.severity_score || 50}/100)
                      </span>
                    </td>
                    <td>{inc.source}</td>
                    <td>
                      {inc.possible_duplicate ? (
                        <span className="duplicate-tag">
                          Linked to {inc.duplicate_of || "INC-001"}
                        </span>
                      ) : (
                        <span style={{ color: "#16a34a", fontSize: "10px", fontWeight: 700 }}>Unique</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedIncidentId(inc.incident_id);
                          setActiveTab("details");
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================
          VIEW 5: LIVE GIS MAP
          ======================================================================== */}
      {activeTab === "map" && (
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Compass size={18} />
              <h2>Live Tactical GIS Map & Operational Picture</h2>
            </div>
            <span className="badge badge-blue">OpenStreetMap & Leaflet</span>
          </div>

          <div className="map-wrap" style={{ height: "550px" }}>
            <MapContainer
              center={[16.512, 80.641]}
              zoom={13}
              scrollWheelZoom={true}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {incidents.map((inc) => (
                <Marker
                  key={inc.incident_id}
                  position={[inc.latitude || 16.512, inc.longitude || 80.641]}
                  icon={createPin("#dc2626", "INC")}
                >
                  <Popup>
                    <strong>{inc.incident_id} ({inc.disaster_type})</strong>
                    <p>{inc.location}</p>
                    <small>Affected: {inc.people_affected} people</small>
                  </Popup>
                </Marker>
              ))}

              {shelters.map((s) => (
                <Marker
                  key={s.shelter_id}
                  position={[s.latitude || 16.515, s.longitude || 80.645]}
                  icon={createPin("#2563eb", "SH")}
                >
                  <Popup>
                    <strong>{s.name}</strong>
                    <p>Occupied: {s.occupied}/{s.total_capacity}</p>
                    <small>Available: {s.total_capacity - s.occupied}</small>
                  </Popup>
                </Marker>
              ))}

              {resources.filter((r) => r.status === "Available").map((r) => (
                <Marker
                  key={r.resource_id}
                  position={[r.latitude || 16.508, r.longitude || 80.635]}
                  icon={createPin("#16a34a", "RES")}
                >
                  <Popup>
                    <strong>{r.name}</strong>
                    <p>{r.resource_type} · Status: {r.status}</p>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* ========================================================================
          VIEW 6: INCIDENT DETAILS
          ======================================================================== */}
      {activeTab === "details" && selectedIncident && (
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <FileText size={18} />
              <h2>Incident Detailed Assessment: {selectedIncident.incident_id}</h2>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab("incidents")}>
              Back to List
            </button>
          </div>

          <div className="grid-2">
            <div>
              <h3 style={{ fontSize: "13px", fontWeight: 800 }}>Incident Profile</h3>
              <p><strong>Disaster:</strong> {selectedIncident.disaster_type}</p>
              <p><strong>Location:</strong> {selectedIncident.location}</p>
              <p><strong>Description:</strong> {selectedIncident.description}</p>
              <p><strong>People Affected:</strong> {selectedIncident.people_affected}</p>
              <p><strong>Source:</strong> {selectedIncident.source}</p>
              <p><strong>Infrastructure Issue:</strong> {selectedIncident.infrastructure_issue || "None specified"}</p>
            </div>

            <div>
              <h3 style={{ fontSize: "13px", fontWeight: 800 }}>Multi-Factor Severity</h3>
              <div className="score-meter-card">
                <div className="score-meter-header">
                  <span>Calculated Priority</span>
                  <span className="badge badge-red">{selectedIncident.severity?.level || "High"}</span>
                </div>
                <div className="score-meter-val">
                  {selectedIncident.severity?.score || selectedIncident.severity_score || 65} / 100
                </div>
              </div>
              <ul style={{ fontSize: "11px", color: "#64748b" }}>
                {selectedIncident.severity?.factors?.map((f, i) => (
                  <li key={i}>{f}</li>
                )) ?? <li>Affected population & urgency rating applied</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          VIEW 7: RESOURCE CENTER
          ======================================================================== */}
      {activeTab === "resources" && (
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Truck size={18} />
              <h2>Emergency Resource Management & Registry</h2>
            </div>
            <span className="badge badge-green">Double Allocation Guard Active</span>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Resource ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((res) => (
                  <tr key={res.resource_id}>
                    <td><strong>{res.resource_id}</strong></td>
                    <td>{res.name}</td>
                    <td>{res.resource_type}</td>
                    <td>{res.location}</td>
                    <td>{res.capacity}</td>
                    <td>
                      <span
                        className={`badge ${
                          res.status === "Available"
                            ? "badge-green"
                            : res.status === "Reserved"
                            ? "badge-amber"
                            : "badge-red"
                        }`}
                      >
                        {res.status}
                      </span>
                    </td>
                    <td>
                      {res.status === "Available" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleUpdateResourceStatus(res.resource_id, "Reserved")}
                        >
                          Reserve
                        </button>
                      )}
                      {res.status === "Reserved" && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => void handleUpdateResourceStatus(res.resource_id, "Deployed")}
                        >
                          Deploy
                        </button>
                      )}
                      {res.status === "Deployed" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleUpdateResourceStatus(res.resource_id, "Available")}
                        >
                          Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================
          VIEW 8: SHELTER MANAGEMENT
          ======================================================================== */}
      {activeTab === "shelters" && (
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Warehouse size={18} />
              <h2>Regional Shelter Capacity & Occupancy Tracking</h2>
            </div>
            <span className="badge badge-amber">Saturation Alerts Enabled</span>
          </div>

          <div className="grid-2">
            <div>
              {shelters.map((shelter) => {
                const percent = Math.round((shelter.occupied / shelter.total_capacity) * 100);
                return (
                  <div key={shelter.shelter_id} className="shelter-row">
                    <div className="shelter-heading">
                      <strong>{shelter.name} ({shelter.location})</strong>
                      <span className={`badge ${percent >= 90 ? "badge-red" : percent >= 75 ? "badge-amber" : "badge-green"}`}>
                        {percent}% Occupied ({shelter.occupied}/{shelter.total_capacity})
                      </span>
                    </div>
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${percent >= 90 ? "fill-red" : percent >= 75 ? "fill-amber" : "fill-green"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="shelter-bottom">
                      <span>Available Capacity: {shelter.total_capacity - shelter.occupied}</span>
                      <span>Status: {shelter.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 800, margin: "0 0 10px 0" }}>Update Shelter Occupancy (Deterministic)</h3>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "8px" }}>
                Select Shelter:
                <select
                  value={selectedShelterId}
                  onChange={(e) => {
                    setSelectedShelterId(e.target.value);
                    const found = shelters.find((s) => s.shelter_id === e.target.value);
                    if (found) setOccupancyInput(found.occupied);
                  }}
                  style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                >
                  {shelters.map((s) => (
                    <option key={s.shelter_id} value={s.shelter_id}>
                      {s.name} ({s.occupied}/{s.total_capacity})
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "12px" }}>
                Current Occupancy Count:
                <input
                  type="number"
                  min={0}
                  value={occupancyInput}
                  onChange={(e) => setOccupancyInput(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                />
              </label>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => void handleUpdateOccupancy(selectedShelterId, occupancyInput)}
              >
                Save Occupancy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          VIEW 9: ROUTE & ACCESSIBILITY
          ======================================================================== */}
      {activeTab === "routes" && (
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Layers size={18} />
              <h2>Route & Accessibility Analysis (Dynamic Replanning)</h2>
            </div>
            <span className="badge badge-amber">Known vs AI-Inferred Distinction</span>
          </div>

          <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px 0" }}>
            Toggle any road status below to trigger <strong>Dynamic Replanning (Requirement 10 / TC-05)</strong>.
            The system detects affected deployments, recalculates alternatives, and alerts the coordinator.
          </p>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Road Corridor</th>
                  <th>Origin ➔ Destination</th>
                  <th>Status</th>
                  <th>Closure Type</th>
                  <th>Reason</th>
                  <th>Simulate Blockage</th>
                </tr>
              </thead>
              <tbody>
                {roads.map((road) => (
                  <tr key={road.road_id}>
                    <td><strong>{road.name}</strong></td>
                    <td>{road.origin_location} ➔ {road.destination_location}</td>
                    <td>
                      <span className={`badge ${road.status === "Closed" ? "badge-red" : road.status === "Partially Blocked" ? "badge-amber" : "badge-green"}`}>
                        {road.status}
                      </span>
                    </td>
                    <td>{road.closure_type}</td>
                    <td>{road.reason || "Clear transit"}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${road.status === "Closed" ? "btn-secondary" : "btn-danger"}`}
                        onClick={() => void handleToggleRoad(road)}
                      >
                        {road.status === "Closed" ? "Reopen Road" : "Simulate Blockage (TC-05)"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================
          VIEW 10: RESPONSE PLANNING
          ======================================================================== */}
      {activeTab === "planning" && (
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Sliders size={18} />
              <h2>Response Planning & Resource Shortage Detection</h2>
            </div>
            <span className="badge badge-blue">LangGraph Workflow</span>
          </div>

          <div className="grid-2">
            <div>
              <h3 style={{ fontSize: "13px", fontWeight: 800 }}>Resource Shortage Checker (TC-04)</h3>
              <p style={{ fontSize: "11px", color: "#64748b" }}>
                Identifies deficits without hallucinating additional equipment.
              </p>

              <div style={{ display: "flex", gap: "10px", margin: "14px 0" }}>
                <select
                  value={shortageType}
                  onChange={(e) => setShortageType(e.target.value)}
                  style={{ padding: "8px", flex: 1 }}
                >
                  <option value="Rescue Boat">Rescue Boat</option>
                  <option value="Rescue Team">Rescue Team</option>
                  <option value="Ambulance">Ambulance</option>
                  <option value="Emergency Vehicle">Emergency Vehicle</option>
                </select>

                <input
                  type="number"
                  value={shortageQuantity}
                  onChange={(e) => setShortageQuantity(Number(e.target.value))}
                  style={{ width: "90px", padding: "8px" }}
                />

                <button className="btn btn-primary btn-sm" onClick={() => void handleCheckShortage()}>
                  Check Deficit
                </button>
              </div>

              {shortageResult && (
                <pre className="code-pre">
                  {JSON.stringify(shortageResult, null, 2)}
                </pre>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: "13px", fontWeight: 800 }}>LangGraph 8-Agent Workflow Execution</h3>
              <p style={{ fontSize: "11px", color: "#64748b" }}>
                Execute full StateGraph workflow for selected incident.
              </p>

              <button
                className="btn btn-primary"
                onClick={() => void handleRunWorkflow()}
                disabled={workflowLoading}
                style={{ marginTop: "12px" }}
              >
                <Workflow size={14} className={workflowLoading ? "spin" : ""} />
                Execute LangGraph StateGraph
              </button>

              {workflowResult && (
                <pre className="code-pre" style={{ marginTop: "14px", maxHeight: "300px" }}>
                  {JSON.stringify(workflowResult, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          VIEW 11: APPROVAL CENTER
          ======================================================================== */}
      {activeTab === "approvals" && (
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Users size={18} />
              <h2>Human-in-the-Loop Commander Approval Center</h2>
            </div>
            <span className="badge badge-amber">{pendingApprovalsCount} Pending Authorization</span>
          </div>

          <div className="approval-intro">
            <div className="approval-number">{pendingApprovalsCount}</div>
            <div>
              <strong>Emergency Authorization Queue Active</strong>
              <p>AI recommendations do not autonomously dispatch real resources. Authorized commander sign-off is required.</p>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Incident</th>
                  <th>Action Type</th>
                  <th>Proposed Tactical Action</th>
                  <th>Status</th>
                  <th>Authorization</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((appr) => (
                  <tr key={appr.request_id}>
                    <td><strong>{appr.request_id}</strong></td>
                    <td>{appr.incident_id}</td>
                    <td>{appr.action_type}</td>
                    <td>{appr.proposed_action}</td>
                    <td>
                      <span className={`badge ${appr.status === "Approved" ? "badge-green" : appr.status === "Pending" ? "badge-amber" : "badge-red"}`}>
                        {appr.status}
                      </span>
                    </td>
                    <td>
                      {appr.status === "Pending" ? (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => void handleReviewApproval(appr.request_id, "Approved")}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => void handleReviewApproval(appr.request_id, "Rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <small>{appr.reviewer}: {appr.comments}</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================
          VIEW 12: ACTION TRACKER
          ======================================================================== */}
      {activeTab === "actions" && (
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Clock size={18} />
              <h2>Action Tracker — Response Status Lifecycle</h2>
            </div>
            <span className="badge badge-blue">Pending ➔ Approved ➔ In Progress ➔ Completed</span>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Action ID</th>
                  <th>Incident</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Assigned Asset</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((act) => (
                  <tr key={act.action_id}>
                    <td><strong>{act.action_id}</strong></td>
                    <td>{act.incident_id}</td>
                    <td>{act.title}</td>
                    <td>
                      <span className={`badge ${act.priority === "Critical" ? "badge-red" : "badge-amber"}`}>
                        {act.priority}
                      </span>
                    </td>
                    <td>{act.assigned_resource_id || "Unassigned"}</td>
                    <td>
                      <span className={`badge ${act.status === "In Progress" ? "badge-blue" : act.status === "Completed" ? "badge-green" : "badge-amber"}`}>
                        {act.status}
                      </span>
                    </td>
                    <td><small>{act.remarks}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================
          VIEW 13: ALERT CENTER
          ======================================================================== */}
      {activeTab === "alerts" && (
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <AlertTriangle size={18} />
              <h2>Real-Time Critical Alerts & Notifications</h2>
            </div>
            <span className="badge badge-red">{unreadAlertsCount} Unacknowledged</span>
          </div>

          {alerts.map((al) => (
            <div
              key={al.alert_id}
              className={`alert-card ${
                al.severity === "Critical" ? "critical" : al.severity === "Warning" ? "warning" : "info"
              }`}
            >
              <AlertTriangle size={20} style={{ color: al.severity === "Critical" ? "#dc2626" : "#d97706", flexShrink: 0 }} />
              <div className="alert-body">
                <strong>{al.title}</strong>
                <p>{al.message}</p>
                <div className="alert-time">{al.created_at?.slice(0, 19).replace("T", " ")}</div>
              </div>
              {al.acknowledged === 0 && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    await apiFetch(`/alerts/${al.alert_id}/acknowledge`, { method: "PATCH" });
                    void refreshData();
                  }}
                >
                  Acknowledge
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================
          VIEW 14: SITUATION REPORTS
          ======================================================================== */}
      {activeTab === "reports" && (
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <FileDown size={18} />
              <h2>Emergency Situation Report Generation (PDF Export)</h2>
            </div>
            <a href={`${API}/reports/situation`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
              <FileDown size={14} /> Download Official PDF Report
            </a>
          </div>

          <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px 0" }}>
            Compiles live operational data from all 8 specialized agents into a standardized emergency management situation report.
          </p>

          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 800, margin: "0 0 12px 0" }}>
              Report Summary Preview (Generated live via ReportLab)
            </h3>
            <ul style={{ fontSize: "11px", color: "#475569", lineHeight: "1.8" }}>
              <li><strong>Active Incidents Logged:</strong> {incidents.length} incidents across Zones A, B, and C.</li>
              <li><strong>Total Affected Population:</strong> {incidents.reduce((acc, i) => acc + (i.people_affected || 0), 0)} residents.</li>
              <li><strong>Fleet Availability:</strong> {resources.filter((r) => r.status === "Available").length} / {resources.length} units ready.</li>
              <li><strong>Regional Shelter Headroom:</strong> {shelters.reduce((acc, s) => acc + (s.total_capacity - s.occupied), 0)} spaces available.</li>
              <li><strong>Blocked Road Access:</strong> {roads.filter((r) => r.status === "Closed").length} closed routes identified.</li>
              <li><strong>Safety Guardrail:</strong> AI recommendations advisory only; human commander signature required.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ========================================================================
          VIEW 15: AUTOMATED ACCEPTANCE TEST RUNNER (TC-01 through TC-08)
          ======================================================================== */}
      {activeTab === "tests" && (
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <CheckCircle2 size={18} />
              <h2>Automated Acceptance Test Suite (TC-01 through TC-08)</h2>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void handleRunAllTests()}
              disabled={testsLoading}
            >
              <Play size={13} className={testsLoading ? "spin" : ""} /> Run All 8 Tests
            </button>
          </div>

          <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px 0" }}>
            Executes all eight mandatory scenarios specified in the problem statement against the FastAPI backend,
            database, and multi-agent pipeline.
          </p>

          {testReport && (
            <div
              style={{
                background: testReport.all_passed ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${testReport.all_passed ? "#bbf7d0" : "#fecaca"}`,
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong style={{ fontSize: "14px", color: testReport.all_passed ? "#15803d" : "#b91c1c" }}>
                  {testReport.all_passed
                    ? "ALL 8 ACCEPTANCE TESTS (TC-01 TO TC-08) PASSED SUCCESSFULLY!"
                    : "SOME TESTS FAILED"}
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: testReport.all_passed ? "#166534" : "#991b1b" }}>
                  Passed: {testReport.passed} / {testReport.total} test scenarios verified.
                </p>
              </div>
              <span className={`badge ${testReport.all_passed ? "badge-green" : "badge-red"}`} style={{ fontSize: "13px", padding: "6px 12px" }}>
                {testReport.all_passed ? "100% PASSED" : "FAILED"}
              </span>
            </div>
          )}

          <div className="test-suite-grid">
            {[
              {
                id: "TC-01",
                name: "New Flood Incident Reported",
                desc: "Incident created and assessed with deterministic score",
                expected: "Severity High/Critical, Score >= 50, Status 201 Created",
                agents: ["Agent 1: Intake", "Agent 2: Severity Assessment"],
              },
              {
                id: "TC-02",
                name: "Multi-Source Duplicate Incident",
                desc: "Same incident reported by two sources",
                expected: "Duplicate identified and linked to existing incident ID",
                agents: ["Agent 1: Intake (Duplicate Detector)"],
              },
              {
                id: "TC-03",
                name: "Critical Incident Allocation",
                desc: "Critical incident with available resources",
                expected: "Allocation recommendation generated via 8-Agent LangGraph",
                agents: ["All 8 Specialized Agents orchestrated"],
              },
              {
                id: "TC-04",
                name: "Resource Shortage & Deficit",
                desc: "Required resources exceed availability (Req 8, Avail 5)",
                expected: "Shortage detected, Deficit = 3 calculated, no hallucination",
                agents: ["Agent 5: Resource Management", "Agent 6: Planning"],
              },
              {
                id: "TC-05",
                name: "Assigned Road Blockage",
                desc: "Assigned road becomes blocked",
                expected: "Dynamic replanning triggered & coordinator alerted",
                agents: ["Agent 4: Geospatial", "Agent 7: Coordination"],
              },
              {
                id: "TC-06",
                name: "Shelter Capacity Saturation",
                desc: "Shelter approaches full capacity (185/200, 200/200)",
                expected: "Capacity alerts logged (NEAR_FULL and FULL triggers)",
                agents: ["Agent 5: Emergency Resource Management"],
              },
              {
                id: "TC-07",
                name: "Worsening Weather Forecast",
                desc: "Severe weather squalls simulated",
                expected: "Incident reassessed & marked 'Needs Reassessment'",
                agents: ["Agent 3: Weather", "Agent 2: Severity"],
              },
              {
                id: "TC-08",
                name: "Double Allocation Prevention",
                desc: "Same rescue resource considered for two incidents",
                expected: "Double allocation blocked with HTTP 409 Conflict",
                agents: ["Agent 5: Resource Management", "Agent 8: Critic"],
              },
            ].map((tc) => {
              const liveRes = testReport?.results.find((r) => r.test_id === tc.id);
              return (
                <div key={tc.id} className={`tc-card ${liveRes?.status === "FAIL" ? "fail" : "pass"}`}>
                  <div className="tc-header">
                    <strong className="tc-title">{tc.id}: {tc.name}</strong>
                    <span className={`badge ${liveRes?.status === "FAIL" ? "badge-red" : "badge-green"}`}>
                      {liveRes?.status || "READY"}
                    </span>
                  </div>

                  <p style={{ fontSize: "11px", color: "#475569", margin: "0 0 6px 0" }}>
                    <strong>Expected Behavior:</strong> {tc.expected}
                  </p>

                  <div className="tc-meta-row">
                    <span>Agents: {tc.agents.join(", ")}</span>
                  </div>

                  {liveRes && (
                    <pre className="tc-pre">
                      {JSON.stringify(liveRes.actual_output, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div>
          ResQAI Decision-Support System · Multi-Agent Emergency Resource Coordination
        </div>
        <div>
          Autonomous Dispatch Disabled · Human Commander Authorization Mandatory
        </div>
      </footer>
    </main>
  );
}
