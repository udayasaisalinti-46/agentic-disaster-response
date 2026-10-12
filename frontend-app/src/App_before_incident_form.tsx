
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudRain,
  MapPin,
  Radio,
  RefreshCw,
  ShieldAlert,
  Truck,
  Users,
  Warehouse,
  Workflow,
} from "lucide-react";
import { MapContainer, TileLayer } from "react-leaflet";
import "./App.css";

const API = "";

type Incident = {
  incident_id?: number | string;
  disaster_type?: unknown;
  description?: unknown;
  location?: unknown;
  people_affected?: number;
  urgency?: unknown;
  severity_score?: number;
  severity_level?: unknown;
  severity?: {
    score?: number;
    level?: unknown;
    rule?: string;
  } | null;
  status?: unknown;
  verification_status?: unknown;
  possible_duplicate?: boolean;
  duplicate_of?: number | string | null;
  created_at?: string;
};

type Resource = {
  resource_id?: number | string;
  resource_type?: unknown;
  name?: unknown;
  location?: unknown;
  capacity?: number;
  status?: unknown;
};

type Shelter = {
  shelter_id?: number | string;
  name?: unknown;
  location?: unknown;
  total_capacity?: number;
  occupied?: number;
  available_capacity?: number;
  status?: unknown;
};

type Approval = {
  request_id?: number | string;
  incident_id?: number | string;
  action_type?: unknown;
  proposed_action?: unknown;
  status?: unknown;
  created_at?: string;
};

type ResponseAction = {
  action_id?: number | string;
  incident_id?: number | string;
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  status?: unknown;
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
  pending_approvals?: number;
  actions_by_status?: Record<string, number>;
  note?: string;
};

type Agent = string | {
  name?: string;
  agent_name?: string;
};

async function getJSON<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`);

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function listFrom<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (data && typeof data === "object") {
    const value = (data as Record<string, unknown>)[key];

    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return [];
}

function safeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return fallback;
}

function titleCase(value?: unknown): string {
  const text = safeText(value);

  if (!text) {
    return "Unknown";
  }

  return text
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Backend severity is returned as incident.severity.level.
 * Fallback fields support older API response formats.
 */
function getSeverityLevel(incident: Incident): string {
  return safeText(
    incident.severity?.level ?? incident.severity_level,
    "Unknown",
  );
}

function getSeverityScore(incident: Incident): number | undefined {
  const score =
    incident.severity?.score ?? incident.severity_score;

  return typeof score === "number" && Number.isFinite(score)
    ? score
    : undefined;
}

function severityClass(value: unknown): string {
  const level = safeText(value).toLowerCase();

  if (level === "critical") return "critical";
  if (level === "high") return "high";
  if (level === "medium") return "medium";
  if (level === "low") return "low";

  return "unknown";
}

function Badge({ value }: { value?: unknown }) {
  const level = safeText(value, "unknown").toLowerCase();

  const style =
    level.includes("critical") ||
    level.includes("rejected") ||
    level.includes("blocked")
      ? "badge-red"
      : level.includes("pending") ||
          level.includes("reserved") ||
          level.includes("review") ||
          level.includes("verification required")
        ? "badge-amber"
        : level.includes("available") ||
            level.includes("approved") ||
            level.includes("completed")
          ? "badge-green"
          : "badge-gray";

  return (
    <span className={`badge ${style}`}>
      {titleCase(value)}
    </span>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div className="panel-title">
          <span className="panel-icon">{icon}</span>
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

export default function App() {
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [actions, setActions] = useState<ResponseAction[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        getJSON<unknown>("/health"),
        getJSON<DashboardData>("/dashboard"),
        getJSON<unknown>("/incidents"),
        getJSON<unknown>("/resources"),
        getJSON<unknown>("/shelters"),
        getJSON<unknown>("/approvals"),
        getJSON<unknown>("/actions"),
        getJSON<unknown>("/agents"),
      ]);

      const health = results[0];

      setConnected(
        health.status === "fulfilled" &&
          (
            !health.value ||
            typeof health.value !== "object" ||
            (health.value as Record<string, unknown>).status !== "error"
          ),
      );

      const failed = results.filter(
        (result) => result.status === "rejected",
      );

      if (failed.length === results.length) {
        throw new Error(
          "Cannot reach the backend. Check that FastAPI is running on port 8000.",
        );
      }

      if (results[1].status === "fulfilled") {
        setDashboard(results[1].value as DashboardData);
      }

      if (results[2].status === "fulfilled") {
        setIncidents(
          listFrom<Incident>(results[2].value, "incidents"),
        );
      }

      if (results[3].status === "fulfilled") {
        setResources(
          listFrom<Resource>(results[3].value, "resources"),
        );
      }

      if (results[4].status === "fulfilled") {
        setShelters(
          listFrom<Shelter>(results[4].value, "shelters"),
        );
      }

      if (results[5].status === "fulfilled") {
        setApprovals(
          listFrom<Approval>(results[5].value, "approvals"),
        );
      }

      if (results[6].status === "fulfilled") {
        setActions(
          listFrom<ResponseAction>(results[6].value, "actions"),
        );
      }

      if (results[7].status === "fulfilled") {
        setAgents(
          listFrom<Agent>(results[7].value, "agents"),
        );
      }

      setError(
        failed.length > 0
          ? `${failed.length} data source(s) could not be loaded. Some panels may be incomplete.`
          : "",
      );

      setLastUpdated(new Date());
    } catch (exception) {
      setConnected(false);

      setError(
        exception instanceof Error
          ? exception.message
          : "Could not load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const timer = window.setInterval(() => {
      void refresh();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [refresh]);

  const stats = dashboard?.incidents;

  const available =
    dashboard?.resources_by_status?.Available ?? 0;

  const reserved =
    dashboard?.resources_by_status?.Reserved ?? 0;

  const deployed =
    dashboard?.resources_by_status?.Deployed ?? 0;

  const shelterInfo = dashboard?.shelters;

  const pending = approvals.filter(
    (approval) =>
      safeText(approval.status).toLowerCase() === "pending",
  );

  // Derive priority from the nested severity object returned by FastAPI.
  const urgentIncidents = incidents
    .filter((incident) => {
      const level = getSeverityLevel(incident).toLowerCase();

      return level === "critical" || level === "high";
    })
    .sort((a, b) => {
      const levelOrder: Record<string, number> = {
        critical: 0,
        high: 1,
      };

      const aOrder =
        levelOrder[getSeverityLevel(a).toLowerCase()] ?? 2;

      const bOrder =
        levelOrder[getSeverityLevel(b).toLowerCase()] ?? 2;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      return (getSeverityScore(b) ?? 0) -
        (getSeverityScore(a) ?? 0);
    });

  // Calculate counts from loaded incident records as a fallback.
  const loadedCritical = incidents.filter(
    (incident) =>
      getSeverityLevel(incident).toLowerCase() === "critical",
  ).length;

  const loadedHigh = incidents.filter(
    (incident) =>
      getSeverityLevel(incident).toLowerCase() === "high",
  ).length;

  const duplicateCount = incidents.filter(
    (incident) => incident.possible_duplicate === true,
  ).length;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <ShieldAlert size={25} />
          </div>

          <div>
            <div className="brand-name">
              ResQ<span>AI</span>
            </div>

            <div className="brand-subtitle">
              DISASTER RESPONSE COORDINATION
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <div
            className={`connection ${
              connected ? "online" : "offline"
            }`}
          >
            <span className="connection-dot" />
            {connected
              ? "Backend connected"
              : "Backend unavailable"}
          </div>

          <button
            className="refresh-button"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw
              size={15}
              className={loading ? "spin" : ""}
            />
            Refresh
          </button>
        </div>
      </header>

      <section className="welcome">
        <div>
          <div className="eyebrow">
            <Radio size={14} />
            EMERGENCY OPERATIONS CENTER
          </div>

          <h1>
            Disaster Response <span>Dashboard</span>
          </h1>

          <p>
            Monitor incidents, coordinate resources, and review
            response recommendations.
          </p>
        </div>

        <div className="updated">
          <Clock size={15} />
          <span>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : "Waiting for data"}
          </span>
        </div>
      </section>

      {error && (
        <div className="notice notice-warning">
          <AlertTriangle size={18} />
          <div>
            <strong>Data connection notice</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="safety-banner">
        <ShieldAlert size={18} />

        <div>
          <strong>Human oversight enabled</strong>
          <span>
            Recommendations are for decision support only. Verify
            incident information and obtain approval before deployment.
          </span>
        </div>

        <Badge value="Manual approval required" />
      </div>

      <section className="metrics-grid">
        <Metric
          icon={<Activity />}
          label="Total incidents"
          value={stats?.total ?? incidents.length}
          detail={`${stats?.critical ?? loadedCritical} critical incidents`}
          color="red"
        />

        <Metric
          icon={<Truck />}
          label="Available resources"
          value={available}
          detail={`${reserved} reserved · ${deployed} deployed`}
          color="blue"
        />

        <Metric
          icon={<Clock />}
          label="Pending approvals"
          value={dashboard?.pending_approvals ?? pending.length}
          detail="Awaiting human review"
          color="amber"
        />

        <Metric
          icon={<Warehouse />}
          label="Shelter capacity"
          value={shelterInfo?.available_capacity ?? 0}
          detail={`${shelterInfo?.near_full ?? 0} near-full shelters`}
          color="green"
        />
      </section>

      <div className="main-grid">
        <Panel
          title="Incident overview"
          icon={<AlertTriangle size={18} />}
        >
          <div className="incident-summary">
            <div>
              <span className="dot dot-red" />
              Critical
              <strong>{stats?.critical ?? loadedCritical}</strong>
            </div>

            <div>
              <span className="dot dot-orange" />
              High
              <strong>{stats?.high ?? loadedHigh}</strong>
            </div>

            <div>
              <span className="dot dot-blue" />
              All incidents
              <strong>{stats?.total ?? incidents.length}</strong>
            </div>
          </div>

          <div className="map-wrap">
            <MapContainer
              center={[17.0, 81.0]}
              zoom={6}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </MapContainer>

            <div className="map-caption">
              <MapPin size={14} />
              Regional reference map. Incident pins require verified
              coordinates.
            </div>
          </div>

          <div className="map-footer">
            <span>
              <span className="dot dot-red" />
              Critical / high watchlist: {urgentIncidents.length}
            </span>

            <span>
              {incidents.length} loaded records · {duplicateCount} possible
              duplicates
            </span>
          </div>
        </Panel>

        <Panel
          title="Priority incident watchlist"
          icon={<ShieldAlert size={18} />}
        >
          {urgentIncidents.length === 0 ? (
            <Empty
              text={
                incidents.length === 0
                  ? "No incident records loaded."
                  : "No critical or high-priority incidents in the loaded records."
              }
            />
          ) : (
            <div className="stack-list">
              {urgentIncidents.slice(0, 6).map((incident, index) => (
                <div
                  className="watch-item"
                  key={incident.incident_id ?? index}
                >
                  <div
                    className={`severity-bar ${severityClass(
                      getSeverityLevel(incident),
                    )}`}
                  />

                  <div className="watch-content">
                    <div className="watch-top">
                      <strong>
                        {titleCase(incident.disaster_type)}
                      </strong>

                      <Badge value={getSeverityLevel(incident)} />
                    </div>

                    <div className="muted">
                      <MapPin size={13} />
                      {safeText(
                        incident.location,
                        "Location not recorded",
                      )}
                    </div>

                    <p>
                      {safeText(
                        incident.description,
                        "No incident description supplied.",
                      )}
                    </p>

                    <small>
                      Incident #{incident.incident_id ?? "—"} ·{" "}
                      {titleCase(incident.status)}
                      {getSeverityScore(incident) !== undefined
                        ? ` · Score ${getSeverityScore(incident)}`
                        : ""}
                    </small>

                    {incident.possible_duplicate && (
                      <div className="duplicate-tag">
                        Possible duplicate — review required
                      </div>
                    )}

                    {safeText(incident.verification_status).toLowerCase() ===
                      "verification required" && (
                      <small className="verification-note">
                        Verification required before operational action.
                      </small>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="main-grid">
        <Panel
          title="Incident register"
          icon={<Radio size={18} />}
        >
          {incidents.length === 0 ? (
            <Empty text="No incident records loaded." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Location</th>
                    <th>Severity</th>
                    <th>Verification</th>
                  </tr>
                </thead>

                <tbody>
                  {incidents.slice(0, 10).map((incident, index) => (
                    <tr key={incident.incident_id ?? index}>
                      <td>
                        <strong>
                          {titleCase(incident.disaster_type)}
                        </strong>

                        <small>
                          #{incident.incident_id ?? "—"}
                        </small>

                        {incident.possible_duplicate && (
                          <span className="duplicate-tag">
                            Possible duplicate
                          </span>
                        )}
                      </td>

                      <td>
                        {safeText(incident.location, "—")}
                      </td>

                      <td>
                        <Badge value={getSeverityLevel(incident)} />
                      </td>

                      <td>
                        <Badge
                          value={
                            incident.verification_status ??
                            "Verification Required"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="panel-footnote">
            Possible duplicates remain in the register until an authorized
            reviewer resolves them.
          </p>
        </Panel>

        <Panel
          title="Resource inventory"
          icon={<Truck size={18} />}
        >
          <div className="resource-counts">
            <div>
              <span>Available</span>
              <strong>{available}</strong>
            </div>

            <div>
              <span>Reserved</span>
              <strong>{reserved}</strong>
            </div>

            <div>
              <span>Deployed</span>
              <strong>{deployed}</strong>
            </div>
          </div>

          {resources.length === 0 ? (
            <Empty text="No resource records loaded." />
          ) : (
            <div className="stack-list compact-list">
              {resources.slice(0, 8).map((resource, index) => (
                <div
                  className="resource-row"
                  key={resource.resource_id ?? index}
                >
                  <div className="resource-symbol">
                    <Truck size={17} />
                  </div>

                  <div className="resource-info">
                    <strong>
                      {safeText(
                        resource.name,
                        titleCase(resource.resource_type),
                      )}
                    </strong>

                    <small>
                      {safeText(
                        resource.location,
                        "Location not recorded",
                      )}{" "}
                      · Capacity {resource.capacity ?? "—"}
                    </small>
                  </div>

                  <Badge value={resource.status} />
                </div>
              ))}
            </div>
          )}

          <p className="panel-footnote">
            Inventory is read-only on this dashboard. Allocation and
            deployment require authorized backend actions.
          </p>
        </Panel>
      </div>

      <div className="main-grid">
        <Panel
          title="Shelter capacity"
          icon={<Warehouse size={18} />}
        >
          <div className="shelter-summary">
            <div>
              <span>Total capacity</span>
              <strong>{shelterInfo?.total_capacity ?? 0}</strong>
            </div>

            <div>
              <span>Occupancy</span>
              <strong>{shelterInfo?.total_occupied ?? 0}</strong>
            </div>

            <div>
              <span>Remaining</span>
              <strong>{shelterInfo?.available_capacity ?? 0}</strong>
            </div>
          </div>

          {shelters.length === 0 ? (
            <Empty text="No shelter records loaded." />
          ) : (
            <div className="stack-list">
              {shelters.slice(0, 8).map((shelter, index) => {
                const capacity = shelter.total_capacity ?? 0;
                const occupied = shelter.occupied ?? 0;

                const percent =
                  capacity > 0
                    ? Math.min(
                        100,
                        Math.round((occupied / capacity) * 100),
                      )
                    : 0;

                return (
                  <div
                    className="shelter-row"
                    key={shelter.shelter_id ?? index}
                  >
                    <div className="shelter-heading">
                      <div>
                        <strong>
                          {safeText(
                            shelter.name,
                            `Shelter ${shelter.shelter_id ?? index + 1}`,
                          )}
                        </strong>

                        <small>
                          {safeText(
                            shelter.location,
                            "Location not recorded",
                          )}
                        </small>
                      </div>

                      <strong>{percent}%</strong>
                    </div>

                    <div className="progress-track">
                      <div
                        className={`progress-fill ${
                          percent >= 90
                            ? "fill-red"
                            : percent >= 75
                              ? "fill-amber"
                              : "fill-green"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="shelter-bottom">
                      <span>{occupied} occupied</span>

                      <span>
                        {shelter.available_capacity ??
                          Math.max(0, capacity - occupied)}{" "}
                        spaces left
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Human approval queue"
          icon={<Users size={18} />}
        >
          <div className="approval-intro">
            <div className="approval-number">
              {pending.length}
            </div>

            <div>
              <strong>Pending requests</strong>
              <p>Review proposed actions before execution.</p>
            </div>
          </div>

          {approvals.length === 0 ? (
            <Empty text="No approval requests loaded." />
          ) : (
            <div className="stack-list">
              {approvals.slice(0, 8).map((approval, index) => (
                <div
                  className="approval-row"
                  key={approval.request_id ?? index}
                >
                  <div className="approval-icon">
                    <Clock size={16} />
                  </div>

                  <div className="approval-info">
                    <strong>
                      {safeText(
                        approval.proposed_action,
                        titleCase(approval.action_type),
                      )}
                    </strong>

                    <small>
                      Request #{approval.request_id ?? "—"} · Incident #
                      {approval.incident_id ?? "—"}
                    </small>
                  </div>

                  <Badge value={approval.status} />
                </div>
              ))}
            </div>
          )}

          <p className="panel-footnote">
            This view does not approve or reject requests.
          </p>
        </Panel>
      </div>

      <div className="main-grid">
        <Panel
          title="Response action tracker"
          icon={<CheckCircle2 size={18} />}
        >
          {actions.length === 0 ? (
            <Empty text="No response actions loaded." />
          ) : (
            <div className="stack-list">
              {actions.slice(0, 8).map((action, index) => (
                <div
                  className="action-row"
                  key={action.action_id ?? index}
                >
                  <div className="action-info">
                    <strong>
                      {safeText(action.title, "Response action")}
                    </strong>

                    <p>
                      {safeText(
                        action.description,
                        "No description provided.",
                      )}
                    </p>

                    <small>
                      Action #{action.action_id ?? "—"} · Incident #
                      {action.incident_id ?? "—"}
                    </small>
                  </div>

                  <div className="action-badges">
                    <Badge value={action.priority} />
                    <Badge value={action.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Multi-agent system"
          icon={<Workflow size={18} />}
        >
          <div className="agent-note">
            <CloudRain size={17} />
            <span>
              Specialized roles support assessment and coordination.
              Actual execution depends on the backend workflow.
            </span>
          </div>

          {agents.length === 0 ? (
            <Empty text="Agent registry unavailable." />
          ) : (
            <div className="agent-list">
              {agents.map((agent, index) => {
                const rawName =
                  typeof agent === "string"
                    ? agent
                    : agent?.name ??
                      agent?.agent_name ??
                      `Agent ${index + 1}`;

                const name = safeText(
                  rawName,
                  `Agent ${index + 1}`,
                );

                return (
                  <div
                    className="agent-row"
                    key={`${name}-${index}`}
                  >
                    <span className="agent-node">
                      <Workflow size={14} />
                    </span>

                    <span>
                      {titleCase(
                        name
                          .replace(/_agent$/i, "")
                          .replaceAll("_", " "),
                      )}
                    </span>

                    <span className="agent-label">
                      Registered
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <footer className="footer">
        <span>
          ResQAI · Emergency coordination prototype
        </span>

        <span>
          {dashboard?.note ??
            "Dashboard data may be incomplete or unverified."}
        </span>
      </footer>
    </main>
  );
}

function Metric({
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
      <div className={`metric-icon ${color}`}>
        {icon}
      </div>

      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
    </section>
  );
}
