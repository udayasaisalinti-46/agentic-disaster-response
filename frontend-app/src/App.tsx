import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudRain,
  Compass,
  FileDown,
  FileText,
  Layers,
  MapPin,
  Radio,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Sliders,
  Truck,
  Users,
  Warehouse,
  Workflow,
} from "lucide-react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "";

// Custom marker pin generator
function createPin(color: string, label: string) {
  return L.divIcon({
    className: "custom-map-pin",
    html: `<div style="background-color: ${color}; width: 26px; height: 26px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
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
  severity?: { score?: number; level?: string; rule?: string };
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
  >("dashboard");

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

  // Workflow State
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null);

  // New Incident Form State
  const [newIncident, setNewIncident] = useState({
    disaster_type: "Flood",
    location: "Zone A Residential",
    description: "Flood water entering residences. Multiple families stranded requiring evacuation.",
    people_affected: 40,
    urgency: 4,
    source: "Citizen Report",
    latitude: 16.512,
    longitude: 80.641,
    assistance_requested: "Rescue boat and temporary shelter",
    infrastructure_issue: "road_partially_flooded",
  });

  // Approval Review Form State
  const [reviewerName, setReviewerName] = useState("Commander Sarah Chen");
  const [reviewComments, setReviewComments] = useState("Verified on-scene conditions. Authorized for deployment.");

  // Shelter Occupancy Form State
  const [selectedShelterId, setSelectedShelterId] = useState("");
  const [occupancyInput, setOccupancyInput] = useState<number>(0);

  // Shortage Checker State
  const [shortageType, setShortageType] = useState("Rescue Boat");
  const [shortageQuantity, setShortageQuantity] = useState(8);
  const [shortageResult, setShortageResult] = useState<Record<string, unknown> | null>(null);

  // Replanning State
  const [replanningOutput, setReplanningOutput] = useState<Record<string, unknown> | null>(null);

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

  // Actions
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ message: string; incident: Incident }>("/incidents", {
        method: "POST",
        body: JSON.stringify(newIncident),
      });
      setSuccessMsg(res.message);
      void refreshData();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create incident");
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
      setSuccessMsg(`Request ${decision.toLowerCase()} successfully.`);
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
      setSuccessMsg("Shelter occupancy updated.");
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
          reason: nextStatus === "Closed" ? "Flood waters overtopping embankment." : "Route cleared.",
        }),
      });
      setReplanningOutput(res);
      void refreshData();
      setSuccessMsg(`Road status changed to ${nextStatus}. Dynamic replanning evaluated.`);
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
          temperature_2m: 26.0,
          precipitation: 16.0,
          rain: 16.0,
          wind_speed_10m: 45.0,
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
      setSuccessMsg("LangGraph 8-Agent Workflow completed successfully.");
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
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Shortage check failed");
    }
  };

  const handleSimulateWeather = async () => {
    try {
      const res = await apiFetch<{ message: string }>("/weather/assessments/simulate", {
        method: "POST",
        body: JSON.stringify({
          incident_id: selectedIncidentId || "INC-001",
          precipitation: 25.0,
          wind_speed: 60.0,
          weather_code: 65,
        }),
      });
      setSuccessMsg(res.message);
      void refreshData();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Weather simulation failed");
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await apiFetch(`/alerts/${alertId}/acknowledge`, { method: "PATCH" });
      void refreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to acknowledge alert");
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

  const selectedIncident = incidents.find((i) => i.incident_id === selectedIncidentId);
  const pendingApprovalsCount = approvals.filter((a) => a.status === "Pending").length;
  const unreadAlertsCount = alerts.filter((a) => a.acknowledged === 0).length;

  return (
    <main className="app-shell">
      {/* Header Topbar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <ShieldAlert size={26} />
          </div>
          <div>
            <div className="brand-name">
              ResQ<span>AI</span>
            </div>
            <div className="brand-subtitle">AGENTIC AI DISASTER RESPONSE SYSTEM</div>
          </div>
        </div>

        <div className="topbar-right">
          <div className={`connection ${connected ? "online" : "offline"}`}>
            <span className="connection-dot" />
            {connected ? "PostgreSQL & FastAPI Online" : "Backend Disconnected"}
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

      {/* Hero Welcome & Operational Banner */}
      <section className="welcome">
        <div>
          <div className="eyebrow">
            <Radio size={13} /> EMERGENCY OPERATIONS CENTER · DECISION-SUPPORT
          </div>
          <h1>
            Emergency Resource <span>Coordination Center</span>
          </h1>
          <p>Multi-agent orchestration, GIS road accessibility, and human-in-the-loop disaster response.</p>
        </div>

        <div className="updated">
          <Clock size={14} />
          <span>Auto-refresh active (12s)</span>
        </div>
      </section>

      {/* Safety Notice Banner */}
      <div className="safety-banner">
        <AlertOctagon size={20} />
        <div>
          <strong>Operational Safeguard Active: Autonomous Dispatch Disabled</strong>
          <span>
            AI recommendations are advisory. All resource dispatches, road closures, and evacuations require
            authorized emergency commander verification.
          </span>
        </div>
        <span className="badge badge-amber">Human-in-the-Loop Required</span>
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

      {/* Navigation Tabs (12 Required Functional Pages) */}
      <nav className="nav-tabs" aria-label="Operational views">
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
          <Workflow size={15} /> Response Planning
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
          <CheckCircle2 size={15} /> Action Tracker
        </button>

        <button className={`nav-tab ${activeTab === "alerts" ? "active" : ""}`} onClick={() => setActiveTab("alerts")}>
          <AlertTriangle size={15} /> Alert Center
          {unreadAlertsCount > 0 && <span className="nav-badge">{unreadAlertsCount}</span>}
        </button>

        <button
          className={`nav-tab ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <Sliders size={15} /> Situation Reports & Tools
        </button>
      </nav>

      {/* =========================================================================
          PAGE 1: EMERGENCY DASHBOARD
      ========================================================================= */}
      {activeTab === "dashboard" && (
        <div>
          {/* Key Metrics Grid */}
          <section className="metrics-grid">
            <MetricCard
              icon={<Activity />}
              label="Total Active Incidents"
              value={dashboard?.incidents?.total ?? incidents.length}
              detail={`${dashboard?.incidents?.critical ?? 0} Critical · ${dashboard?.incidents?.high ?? 0} High`}
              color="red"
            />
            <MetricCard
              icon={<Truck />}
              label="Available Resources"
              value={dashboard?.resources_by_status?.Available ?? 0}
              detail={`${dashboard?.resources_by_status?.Reserved ?? 0} Reserved · ${dashboard?.resources_by_status?.Deployed ?? 0} Deployed`}
              color="blue"
            />
            <MetricCard
              icon={<Users />}
              label="Pending Approvals"
              value={dashboard?.pending_approvals ?? pendingApprovalsCount}
              detail="Human authorization required"
              color="amber"
            />
            <MetricCard
              icon={<Warehouse />}
              label="Available Shelter Capacity"
              value={dashboard?.shelters?.available_capacity ?? 0}
              detail={`${dashboard?.shelters?.near_full ?? 0} Near-Full · ${dashboard?.shelters?.full ?? 0} Saturated`}
              color="green"
            />
          </section>

          {/* Operational Overview Grid */}
          <div className="main-grid">
            <Panel title="Emergency Map Snapshot" icon={<Compass size={18} />}>
              <div className="map-wrap">
                <MapContainer center={[16.51, 80.64]} zoom={11} scrollWheelZoom={false}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {incidents.map((inc) => (
                    <Marker
                      key={inc.incident_id}
                      position={[inc.latitude || 16.512, inc.longitude || 80.641]}
                      icon={createPin(
                        inc.severity?.level === "Critical" ? "#dc2626" : "#f97316",
                        inc.incident_id.slice(-3),
                      )}
                    >
                      <Popup>
                        <strong>
                          {inc.incident_id}: {inc.disaster_type}
                        </strong>
                        <p>{inc.description}</p>
                        <small>
                          People: {inc.people_affected} | Severity: {inc.severity?.level}
                        </small>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
                <div className="map-caption">
                  <MapPin size={13} /> Interactive GIS map preview. Open <strong>Live GIS Map</strong> tab for
                  full-screen view.
                </div>
              </div>
            </Panel>

            <Panel title="Priority Incident Watchlist" icon={<AlertTriangle size={18} />}>
              <div className="stack-list">
                {incidents
                  .filter((i) => i.severity?.level === "Critical" || i.severity?.level === "High")
                  .slice(0, 5)
                  .map((inc) => (
                    <div className="watch-item" key={inc.incident_id}>
                      <div className={`severity-bar ${inc.severity?.level?.toLowerCase()}`} />
                      <div className="watch-content">
                        <div className="watch-top">
                          <strong>
                            {inc.disaster_type} — {inc.location}
                          </strong>
                          <span
                            className={`badge ${inc.severity?.level === "Critical" ? "badge-red" : "badge-amber"}`}
                          >
                            {inc.severity?.level} ({inc.severity_score}/100)
                          </span>
                        </div>
                        <p>{inc.description}</p>
                        <small>
                          ID: {inc.incident_id} · Affected: {inc.people_affected} · Status: {inc.status}
                          {inc.possible_duplicate && " · [POSSIBLE DUPLICATE]"}
                        </small>
                      </div>
                    </div>
                  ))}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAGE 2: INCIDENT CENTER
      ========================================================================= */}
      {activeTab === "incidents" && (
        <div>
          <div className="main-grid">
            {/* Create Incident Form */}
            <Panel title="Multi-Source Incident Registration (Intake Agent)" icon={<Radio size={18} />}>
              <form onSubmit={handleCreateIncident} className="incident-form">
                <div className="incident-form-grid">
                  <label>
                    Disaster Type
                    <select
                      value={newIncident.disaster_type}
                      onChange={(e) => setNewIncident({ ...newIncident, disaster_type: e.target.value })}
                    >
                      <option value="Flood">Flood</option>
                      <option value="Cyclone">Cyclone</option>
                      <option value="Earthquake">Earthquake</option>
                      <option value="Wildfire">Wildfire</option>
                      <option value="Landslide">Landslide</option>
                      <option value="Industrial">Industrial Accident</option>
                    </select>
                  </label>

                  <label>
                    Information Source
                    <select
                      value={newIncident.source}
                      onChange={(e) => setNewIncident({ ...newIncident, source: e.target.value })}
                    >
                      <option value="Emergency Call">Emergency Call (911/112)</option>
                      <option value="Field Team">Field Rescue Team</option>
                      <option value="Weather Service">Weather & Meteorological Service</option>
                      <option value="IoT Sensor">IoT Water-Level Sensor</option>
                      <option value="Government Alert">Government Emergency Alert</option>
                      <option value="Citizen Report">Citizen Report</option>
                    </select>
                  </label>

                  <label>
                    Location / Zone Name
                    <input
                      type="text"
                      value={newIncident.location}
                      onChange={(e) => setNewIncident({ ...newIncident, location: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    People Reported Affected
                    <input
                      type="number"
                      min={0}
                      value={newIncident.people_affected}
                      onChange={(e) => setNewIncident({ ...newIncident, people_affected: Number(e.target.value) })}
                      required
                    />
                  </label>

                  <label>
                    Urgency Rating (1 - 5)
                    <select
                      value={newIncident.urgency}
                      onChange={(e) => setNewIncident({ ...newIncident, urgency: Number(e.target.value) })}
                    >
                      <option value={1}>1 - Minor monitoring</option>
                      <option value={2}>2 - Low urgency</option>
                      <option value={3}>3 - Moderate urgency</option>
                      <option value={4}>4 - High urgency / Rapid response</option>
                      <option value={5}>5 - Critical / Life-threatening</option>
                    </select>
                  </label>

                  <label>
                    Infrastructure Issue
                    <select
                      value={newIncident.infrastructure_issue}
                      onChange={(e) => setNewIncident({ ...newIncident, infrastructure_issue: e.target.value })}
                    >
                      <option value="none">None reported</option>
                      <option value="road_partially_flooded">Road partially flooded</option>
                      <option value="road_closed">Main access road closed / cut off</option>
                      <option value="bridge_damaged">Bridge compromised</option>
                      <option value="power_outage">Power grid failure</option>
                    </select>
                  </label>

                  <label>
                    Latitude
                    <input
                      type="number"
                      step="0.0001"
                      value={newIncident.latitude}
                      onChange={(e) => setNewIncident({ ...newIncident, latitude: Number(e.target.value) })}
                    />
                  </label>

                  <label>
                    Longitude
                    <input
                      type="number"
                      step="0.0001"
                      value={newIncident.longitude}
                      onChange={(e) => setNewIncident({ ...newIncident, longitude: Number(e.target.value) })}
                    />
                  </label>
                </div>

                <label>
                  Requested Assistance
                  <input
                    type="text"
                    value={newIncident.assistance_requested}
                    onChange={(e) => setNewIncident({ ...newIncident, assistance_requested: e.target.value })}
                    placeholder="e.g. Evacuation boats, medical kit, helicopter transfer"
                  />
                </label>

                <label>
                  Incident Description
                  <textarea
                    rows={3}
                    value={newIncident.description}
                    onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                    required
                  />
                </label>

                <button type="submit" className="btn btn-primary">
                  <Send size={15} /> Ingest & Assess Incident
                </button>
              </form>
            </Panel>

            {/* Incidents Register Table */}
            <Panel title="Incident Register & Duplicate Review" icon={<FileText size={18} />}>
              <div className="table-scroll" style={{ maxHeight: "480px" }}>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type & Location</th>
                      <th>Affected</th>
                      <th>Priority</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc) => (
                      <tr
                        key={inc.incident_id}
                        onClick={() => {
                          setSelectedIncidentId(inc.incident_id);
                          setActiveTab("details");
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <strong>{inc.incident_id}</strong>
                          <small>{inc.source}</small>
                          {inc.possible_duplicate && (
                            <span className="duplicate-tag">Duplicate: {inc.duplicate_of}</span>
                          )}
                        </td>
                        <td>
                          <strong>{inc.disaster_type}</strong>
                          <span>{inc.location}</span>
                        </td>
                        <td>{inc.people_affected}</td>
                        <td>
                          <span
                            className={`badge ${inc.severity?.level === "Critical" ? "badge-red" : "badge-amber"}`}
                          >
                            {inc.severity?.level} ({inc.severity_score})
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-gray">{inc.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAGE 3: LIVE GIS MAP
      ========================================================================= */}
      {activeTab === "map" && (
        <Panel title="Live GIS Operational Picture (OpenStreetMap & Leaflet)" icon={<Compass size={18} />}>
          <div style={{ height: "550px", borderRadius: "8px", overflow: "hidden" }}>
            <MapContainer center={[16.51, 80.64]} zoom={12} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Incidents Pins */}
              {incidents.map((inc) => (
                <Marker
                  key={`map-inc-${inc.incident_id}`}
                  position={[inc.latitude || 16.512, inc.longitude || 80.641]}
                  icon={createPin(inc.severity?.level === "Critical" ? "#dc2626" : "#f97316", "INC")}
                >
                  <Popup>
                    <div style={{ fontSize: "12px" }}>
                      <strong style={{ color: "#dc2626" }}>
                        {inc.incident_id}: {inc.disaster_type}
                      </strong>
                      <p style={{ margin: "4px 0" }}>{inc.description}</p>
                      <div>
                        <strong>Location:</strong> {inc.location}
                      </div>
                      <div>
                        <strong>Affected:</strong> {inc.people_affected}
                      </div>
                      <div>
                        <strong>Priority:</strong> {inc.severity?.level} ({inc.severity_score}/100)
                      </div>
                      <div>
                        <strong>Road Status:</strong> {inc.infrastructure_issue}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Resources Pins */}
              {resources.map((res) => (
                <Marker
                  key={`map-res-${res.resource_id}`}
                  position={[res.latitude || 16.51, res.longitude || 80.64]}
                  icon={createPin(res.status === "Available" ? "#16a34a" : "#2563eb", "RES")}
                >
                  <Popup>
                    <div style={{ fontSize: "12px" }}>
                      <strong style={{ color: "#16a34a" }}>
                        {res.name} ({res.resource_type})
                      </strong>
                      <div>
                        <strong>Status:</strong> {res.status}
                      </div>
                      <div>
                        <strong>Capacity:</strong> {res.capacity}
                      </div>
                      <div>
                        <strong>Capability:</strong> {res.capability}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Shelters Pins */}
              {shelters.map((shl) => (
                <Marker
                  key={`map-shl-${shl.shelter_id}`}
                  position={[shl.latitude || 16.515, shl.longitude || 80.642]}
                  icon={createPin("#7c3aed", "SHL")}
                >
                  <Popup>
                    <div style={{ fontSize: "12px" }}>
                      <strong style={{ color: "#7c3aed" }}>{shl.name}</strong>
                      <div>
                        <strong>Occupancy:</strong> {shl.occupied} / {shl.total_capacity} (
                        {Math.round((shl.occupied / shl.total_capacity) * 100)}%)
                      </div>
                      <div>
                        <strong>Available:</strong> {shl.total_capacity - shl.occupied} spaces
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div
            style={{
              display: "flex",
              gap: "20px",
              marginTop: "12px",
              fontSize: "11px",
              color: "#475569",
              flexWrap: "wrap",
            }}
          >
            <span>
              🔴 <strong>Red/Orange:</strong> Incident Sites (Critical / High)
            </span>
            <span>
              🟢 <strong>Green:</strong> Available Resources
            </span>
            <span>
              🔵 <strong>Blue:</strong> Deployed / Reserved Resources
            </span>
            <span>
              🟣 <strong>Purple:</strong> Emergency Shelters
            </span>
          </div>
        </Panel>
      )}

      {/* =========================================================================
          PAGE 4: INCIDENT DETAILS
      ========================================================================= */}
      {activeTab === "details" && (
        <div>
          <div style={{ marginBottom: "16px", display: "flex", gap: "10px", alignItems: "center" }}>
            <label style={{ fontSize: "12px", fontWeight: "700" }}>Select Incident for Deep Assessment:</label>
            <select
              value={selectedIncidentId}
              onChange={(e) => setSelectedIncidentId(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              {incidents.map((i) => (
                <option key={i.incident_id} value={i.incident_id}>
                  {i.incident_id} — {i.disaster_type} ({i.location}) [{i.severity?.level}]
                </option>
              ))}
            </select>
          </div>

          {selectedIncident ? (
            <div className="main-grid">
              <Panel title={`Assessment: ${selectedIncident.incident_id}`} icon={<FileText size={18} />}>
                <div style={{ display: "grid", gap: "12px", fontSize: "12px" }}>
                  <div>
                    <strong>Disaster Type:</strong> {selectedIncident.disaster_type}
                  </div>
                  <div>
                    <strong>Location:</strong> {selectedIncident.location}
                  </div>
                  <div>
                    <strong>Description:</strong> {selectedIncident.description}
                  </div>
                  <div>
                    <strong>People Affected:</strong> {selectedIncident.people_affected} residents
                  </div>
                  <div>
                    <strong>Reported Urgency:</strong> {selectedIncident.urgency} / 5
                  </div>
                  <div>
                    <strong>Infrastructure Issue:</strong> {selectedIncident.infrastructure_issue || "None"}
                  </div>
                  <div>
                    <strong>Assistance Requested:</strong> {selectedIncident.assistance_requested || "General relief"}
                  </div>
                  <div>
                    <strong>Source:</strong> {selectedIncident.source}
                  </div>
                  <div>
                    <strong>Verification Status:</strong> {selectedIncident.verification_status}
                  </div>
                  {selectedIncident.possible_duplicate && (
                    <div style={{ background: "#fef3c7", padding: "10px", borderRadius: "6px", color: "#92400e" }}>
                      ⚠️ <strong>Duplicate Link:</strong> Matches {selectedIncident.duplicate_of}. Review required.
                    </div>
                  )}
                </div>
              </Panel>

              <Panel title="Priority Assessment Methodology (Agent 2)" icon={<Workflow size={18} />}>
                <div style={{ fontSize: "12px" }}>
                  <div style={{ marginBottom: "12px" }}>
                    <span
                      className={`badge ${selectedIncident.severity?.level === "Critical" ? "badge-red" : "badge-amber"}`}
                      style={{ fontSize: "14px", padding: "6px 12px" }}
                    >
                      Priority Level: {selectedIncident.severity?.level} ({selectedIncident.severity_score}/100)
                    </span>
                  </div>

                  <p>
                    <strong>Calculation Rule:</strong> Deterministic multi-factor model factoring affected population,
                    urgency, route accessibility, and infrastructure impact.
                  </p>

                  <div className="workflow-agent-card">
                    <strong>Contributing Factors:</strong>
                    <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                      <li>
                        Affected Population: +
                        {Math.min(40, Math.floor(selectedIncident.people_affected / 2.5))} pts
                      </li>
                      <li>Reported Urgency Rating ({selectedIncident.urgency}/5): +{selectedIncident.urgency * 8} pts</li>
                      <li>
                        Infrastructure Impact: +
                        {selectedIncident.infrastructure_issue && selectedIncident.infrastructure_issue !== "none"
                          ? 10
                          : 0}{" "}
                        pts
                      </li>
                    </ul>
                  </div>

                  <button className="btn btn-primary" onClick={() => void handleRunWorkflow()}>
                    <Workflow size={14} /> Run Response Plan for this Incident
                  </button>
                </div>
              </Panel>
            </div>
          ) : (
            <p>No incident selected.</p>
          )}
        </div>
      )}

      {/* =========================================================================
          PAGE 5: RESOURCE CENTER
      ========================================================================= */}
      {activeTab === "resources" && (
        <Panel title="Emergency Resource Registry (Agent 5)" icon={<Truck size={18} />}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Resource ID</th>
                  <th>Type & Name</th>
                  <th>Location</th>
                  <th>Capacity</th>
                  <th>Capability</th>
                  <th>Current Status</th>
                  <th>Status Lifecycle Action</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((res) => (
                  <tr key={res.resource_id}>
                    <td>
                      <strong>{res.resource_id}</strong>
                    </td>
                    <td>
                      <strong>{res.name}</strong>
                      <small>{res.resource_type}</small>
                    </td>
                    <td>{res.location}</td>
                    <td>{res.capacity}</td>
                    <td>{res.capability || "General"}</td>
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
                          className="btn btn-warning btn-sm"
                          onClick={() => void handleUpdateResourceStatus(res.resource_id, "Reserved")}
                        >
                          Reserve
                        </button>
                      )}
                      {res.status === "Reserved" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleUpdateResourceStatus(res.resource_id, "Available")}
                        >
                          Release to Available
                        </button>
                      )}
                      {res.status === "Deployed" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleUpdateResourceStatus(res.resource_id, "Returning")}
                        >
                          Mark Returning
                        </button>
                      )}
                      {res.status === "Returning" && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => void handleUpdateResourceStatus(res.resource_id, "Available")}
                        >
                          Mark Available
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* =========================================================================
          PAGE 6: SHELTER MANAGEMENT
      ========================================================================= */}
      {activeTab === "shelters" && (
        <div>
          <div className="main-grid">
            <Panel title="Shelter Capacity Monitor" icon={<Warehouse size={18} />}>
              <div className="stack-list">
                {shelters.map((shl) => {
                  const cap = shl.total_capacity || 1;
                  const occ = shl.occupied || 0;
                  const pct = Math.round((occ / cap) * 100);
                  const isFull = pct >= 100;
                  const isNear = pct >= 90;

                  return (
                    <div className="shelter-row" key={shl.shelter_id}>
                      <div className="shelter-heading">
                        <div>
                          <strong>{shl.name}</strong>
                          <small>{shl.location}</small>
                        </div>
                        <span
                          className={`badge ${isFull ? "badge-red" : isNear ? "badge-amber" : "badge-green"}`}
                        >
                          {pct}% Occupied
                        </span>
                      </div>

                      <div className="progress-track">
                        <div
                          className={`progress-fill ${isFull ? "fill-red" : isNear ? "fill-amber" : "fill-green"}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>

                      <div className="shelter-bottom">
                        <span>
                          {occ} / {cap} Occupied
                        </span>
                        <span>{Math.max(0, cap - occ)} Spaces Remaining</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Interactive Shelter Occupancy Updater (TC-06)" icon={<Sliders size={18} />}>
              <div style={{ fontSize: "12px" }}>
                <p>
                  Update shelter occupancy live to evaluate automatic saturation thresholds (<strong>&gt;= 90%</strong>{" "}
                  triggers <em>NEAR_FULL</em> alert, <strong>100%</strong> triggers <em>FULL</em> alert).
                </p>

                <div style={{ display: "grid", gap: "12px", marginTop: "14px" }}>
                  <label>
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
                          {s.name} (Cap: {s.total_capacity}, Occ: {s.occupied})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    New Occupancy Count:
                    <input
                      type="number"
                      value={occupancyInput}
                      onChange={(e) => setOccupancyInput(Number(e.target.value))}
                      style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                    />
                  </label>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="btn btn-warning"
                      onClick={() => {
                        const targetShelter = shelters.find((s) => s.shelter_id === selectedShelterId);
                        if (targetShelter) {
                          const val = Math.floor(targetShelter.total_capacity * 0.92);
                          setOccupancyInput(val);
                          void handleUpdateOccupancy(selectedShelterId, val);
                        }
                      }}
                    >
                      Simulate 92% (Near Full)
                    </button>

                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        const targetShelter = shelters.find((s) => s.shelter_id === selectedShelterId);
                        if (targetShelter) {
                          setOccupancyInput(targetShelter.total_capacity);
                          void handleUpdateOccupancy(selectedShelterId, targetShelter.total_capacity);
                        }
                      }}
                    >
                      Simulate 100% (Full)
                    </button>

                    <button
                      className="btn btn-primary"
                      onClick={() => void handleUpdateOccupancy(selectedShelterId, occupancyInput)}
                    >
                      Save Custom Occupancy
                    </button>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAGE 7: ROUTE & ACCESSIBILITY
      ========================================================================= */}
      {activeTab === "routes" && (
        <div>
          <div className="main-grid">
            <Panel title="Road Network Accessibility (Agent 4 & Dynamic Replanning)" icon={<Layers size={18} />}>
              <div className="stack-list">
                {roads.map((road) => (
                  <div className="watch-item" key={road.road_id}>
                    <div className="watch-content">
                      <div className="watch-top">
                        <strong>{road.name}</strong>
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
                      <p>
                        Route: {road.origin_location} ➔ {road.destination_location}
                      </p>
                      <small>
                        Classification: <strong>{road.closure_type}</strong> | Reason: {road.reason || "None"}
                      </small>
                      <div style={{ marginTop: "10px" }}>
                        <button
                          className={`btn btn-sm ${road.status === "Closed" ? "btn-success" : "btn-danger"}`}
                          onClick={() => void handleToggleRoad(road)}
                        >
                          {road.status === "Closed" ? "Reopen Road" : "Mark Closed (Trigger TC-05 Replanning)"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Dynamic Replanning Output (TC-05)" icon={<Workflow size={18} />}>
              {replanningOutput ? (
                <div>
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "12px", borderRadius: "8px" }}>
                    <strong style={{ color: "#991b1b" }}>Replanning Triggered:</strong>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>{String(replanningOutput.recommendation)}</p>
                    <small>
                      Affected Incidents: {JSON.stringify(replanningOutput.affected_incidents)} | Affected Deployments:{" "}
                      {Number(replanningOutput.affected_deployments_count)}
                    </small>
                  </div>
                  <pre className="code-pre" style={{ marginTop: "12px" }}>
                    {JSON.stringify(replanningOutput, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="empty-state">
                  Click &quot;Mark Closed&quot; on any road to test dynamic replanning and affected deployment re-routing.
                </p>
              )}
            </Panel>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAGE 8: RESPONSE PLANNING
      ========================================================================= */}
      {activeTab === "planning" && (
        <div>
          <div className="main-grid">
            <Panel title="LangGraph Multi-Agent Orchestrator" icon={<Workflow size={18} />}>
              <div style={{ fontSize: "12px" }}>
                <p>Execute all eight specialized agents sequentially through a LangGraph StateGraph.</p>

                <div style={{ margin: "14px 0" }}>
                  <button className="btn btn-primary" onClick={() => void handleRunWorkflow()} disabled={workflowLoading}>
                    {workflowLoading ? "Orchestrating 8 Agents..." : "Run Multi-Agent Disaster Response Plan"}
                  </button>
                </div>

                {workflowResult && (
                  <div>
                    <div className="workflow-agent-card">
                      <div className="workflow-agent-header">
                        <strong>1. Incident Intake & 2. Situation Assessment</strong>
                        <span className="badge badge-green">Passed</span>
                      </div>
                      <p>
                        Severity Assessment:{" "}
                        {String(
                          (workflowResult.situation_assessment as Record<string, unknown>)?.severity_level,
                        )}{" "}
                        (Score:{" "}
                        {String(
                          (workflowResult.situation_assessment as Record<string, unknown>)?.severity_score,
                        )}
                        /100)
                      </p>
                    </div>

                    <div className="workflow-agent-card">
                      <div className="workflow-agent-header">
                        <strong>3. Weather & 4. Geospatial Intelligence</strong>
                        <span className="badge badge-green">Verified</span>
                      </div>
                      <p>
                        Accessibility:{" "}
                        {String(
                          (workflowResult.geospatial_assessment as Record<string, unknown>)?.accessibility,
                        )}{" "}
                        ({String(
                          (workflowResult.geospatial_assessment as Record<string, unknown>)?.closure_type,
                        )})
                      </p>
                    </div>

                    <div className="workflow-agent-card">
                      <div className="workflow-agent-header">
                        <strong>5. Resource & 6. Allocation Planning</strong>
                        <span className="badge badge-green">Generated</span>
                      </div>
                      <p>
                        Recommended:{" "}
                        {String(
                          (workflowResult.resource_plan as Record<string, unknown>)?.recommended_quantity,
                        )}{" "}
                        units | Shortage:{" "}
                        {String((workflowResult.resource_plan as Record<string, unknown>)?.shortage)}
                      </p>
                    </div>

                    <div className="workflow-agent-card">
                      <div className="workflow-agent-header">
                        <strong>7. Coordination & 8. Reviewer / Critic</strong>
                        <span className="badge badge-green">
                          {String((workflowResult.review as Record<string, unknown>)?.review_status)}
                        </span>
                      </div>
                      <p>
                        Automatic Dispatch: <strong>FALSE</strong> | Human Approval Required: <strong>TRUE</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="Resource Shortage Detector (TC-04)" icon={<Truck size={18} />}>
              <div style={{ fontSize: "12px" }}>
                <p>Test shortage detection and mutual-aid deficit calculation without phantom resource hallucination.</p>

                <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                  <label>
                    Resource Type:
                    <select
                      value={shortageType}
                      onChange={(e) => setShortageType(e.target.value)}
                      style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                    >
                      <option value="Rescue Boat">Rescue Boat (Baseline: 5 Available)</option>
                      <option value="Ambulance">Ambulance (Baseline: 6 Available)</option>
                      <option value="Rescue Team">Rescue Team (Baseline: 4 Available)</option>
                    </select>
                  </label>

                  <label>
                    Required Quantity:
                    <input
                      type="number"
                      value={shortageQuantity}
                      onChange={(e) => setShortageQuantity(Number(e.target.value))}
                      style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                    />
                  </label>

                  <button className="btn btn-warning" onClick={() => void handleCheckShortage()}>
                    Evaluate Shortage & Deficit
                  </button>
                </div>

                {shortageResult && (
                  <div style={{ marginTop: "14px" }}>
                    <div
                      style={{
                        background: shortageResult.shortage_detected ? "#fff7ed" : "#f0fdf4",
                        border: "1px solid #fed7aa",
                        padding: "12px",
                        borderRadius: "8px",
                      }}
                    >
                      <strong>
                        {shortageResult.shortage_detected ? "⚠️ Resource Shortage Detected" : "✅ Fleet Sufficient"}
                      </strong>
                      <p style={{ margin: "4px 0" }}>{String(shortageResult.recommendation)}</p>
                    </div>
                    <pre className="code-pre" style={{ marginTop: "10px" }}>
                      {JSON.stringify(shortageResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAGE 9: APPROVAL CENTER
      ========================================================================= */}
      {activeTab === "approvals" && (
        <Panel title="Human-in-the-Loop Authorization Center" icon={<Users size={18} />}>
          <div style={{ marginBottom: "16px", display: "grid", gap: "10px", gridTemplateColumns: "1fr 2fr" }}>
            <label style={{ fontSize: "12px", fontWeight: "600" }}>
              Authorizing Official / Commander:
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </label>
            <label style={{ fontSize: "12px", fontWeight: "600" }}>
              Operational Remarks & Conditions:
              <input
                type="text"
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </label>
          </div>

          <div className="stack-list">
            {approvals.map((req) => (
              <div className="approval-row" key={req.request_id}>
                <div className="approval-icon">
                  <Clock size={16} />
                </div>
                <div className="approval-info">
                  <strong>{req.proposed_action}</strong>
                  <small>
                    Request #{req.request_id} · Incident #{req.incident_id} · Type: {req.action_type}
                    {req.reviewer && ` · Reviewer: ${req.reviewer}`}
                  </small>
                </div>
                <div>
                  {req.status === "Pending" ? (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => void handleReviewApproval(req.request_id, "Approved")}
                      >
                        Approve & Deploy
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => void handleReviewApproval(req.request_id, "Rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className={`badge ${req.status === "Approved" ? "badge-green" : "badge-red"}`}>
                      {req.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* =========================================================================
          PAGE 10: ACTION TRACKER
      ========================================================================= */}
      {activeTab === "actions" && (
        <Panel title="Response Action Tracker" icon={<CheckCircle2 size={18} />}>
          <div className="stack-list">
            {actions.map((act) => (
              <div className="action-row" key={act.action_id}>
                <div className="action-info">
                  <strong>{act.title}</strong>
                  <p>{act.description}</p>
                  <small>
                    Action #{act.action_id} · Incident #{act.incident_id} · Resource #{act.assigned_resource_id || "Unassigned"}
                  </small>
                </div>
                <div className="action-badges">
                  <span className="badge badge-amber">{act.priority}</span>
                  <span className={`badge ${act.status === "In Progress" ? "badge-blue" : "badge-green"}`}>
                    {act.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* =========================================================================
          PAGE 11: ALERT CENTER
      ========================================================================= */}
      {activeTab === "alerts" && (
        <Panel title="Real-Time Emergency Alerts Hub (Requirement 14)" icon={<AlertTriangle size={18} />}>
          <div className="stack-list">
            {alerts.map((al) => (
              <div className={`alert-card ${al.severity.toLowerCase()}`} key={al.alert_id}>
                <AlertTriangle size={18} color={al.severity === "Critical" ? "#dc2626" : "#f59e0b"} />
                <div className="alert-body">
                  <strong>{al.title}</strong>
                  <p>{al.message}</p>
                  <span className="alert-time">
                    Alert ID: {al.alert_id} · Type: {al.alert_type} · Time: {al.created_at}
                  </span>
                </div>
                <div>
                  {al.acknowledged === 0 ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => void handleAcknowledgeAlert(al.alert_id)}>
                      Acknowledge
                    </button>
                  ) : (
                    <span className="badge badge-gray">Acknowledged</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* =========================================================================
          PAGE 12: SITUATION REPORTS & TOOLS
      ========================================================================= */}
      {activeTab === "reports" && (
        <div>
          <div className="main-grid">
            <Panel title="Emergency Situation Reports (ReportLab PDF)" icon={<FileDown size={18} />}>
              <p style={{ fontSize: "12px", lineHeight: "1.6" }}>
                Generate an official, structured emergency situation report containing incident registers, priority
                methodology, weather telemetry, shelter capacities, road transit conditions, active deployments, and
                safety notices.
              </p>

              <div style={{ marginTop: "18px" }}>
                <a href={`${API}/reports/situation`} target="_blank" rel="noreferrer" className="btn btn-primary">
                  <FileDown size={15} /> Download Official PDF Situation Report
                </a>
              </div>
            </Panel>

            <Panel title="Environmental & Weather Simulator (TC-07)" icon={<CloudRain size={18} />}>
              <p style={{ fontSize: "12px" }}>
                Trigger worsening weather conditions (rainfall &gt; 20mm, winds &gt; 50km/h) to evaluate reactive
                reassessment across active flood incidents.
              </p>

              <div style={{ marginTop: "16px" }}>
                <button className="btn btn-warning" onClick={() => void handleSimulateWeather()}>
                  <CloudRain size={15} /> Simulate Severe Storm (TC-07 Reassessment)
                </button>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <span>ResQAI · Agentic AI Disaster Response & Resource Coordination Platform</span>
        <span>Decision-support prototype. Authorized emergency commander approval mandated.</span>
      </footer>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
  color: string;
}) {
  return (
    <section className="metric-card">
      <div className={`metric-icon ${color}`}>{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
    </section>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div className="panel-title">
          <span className="panel-icon">{icon}</span>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}
