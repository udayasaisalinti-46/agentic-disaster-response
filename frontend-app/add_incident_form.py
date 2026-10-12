from pathlib import Path

path = Path("src/App.tsx")
source = path.read_text(encoding="utf-8")

if "Incident registration" in source:
    raise SystemExit("Incident registration already appears in App.tsx. No changes made.")

# Add form state after the existing dashboard refresh timestamp state.
state_anchor = '  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);'
state_insert = '''
  const [incidentForm, setIncidentForm] = useState({
    disaster_type: "Flood",
    description: "",
    location: "",
    people_affected: "0",
    urgency: "3",
    source: "Manual report",
  });
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentMessage, setIncidentMessage] = useState("");
  const [incidentError, setIncidentError] = useState("");
  const [submittedIncident, setSubmittedIncident] = useState<Incident | null>(null);
'''
if source.count(state_anchor) != 1:
    raise SystemExit("Could not safely locate the dashboard state section. No changes made.")
source = source.replace(state_anchor, state_anchor + state_insert, 1)

# Add the form submission handler after refresh() is declared.
effect_anchor = '  useEffect(() => {\\n    void refresh();'
handler = '''
  async function submitIncident(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIncidentError("");
    setIncidentMessage("");
    setSubmittedIncident(null);

    const people = Number(incidentForm.people_affected);
    const urgency = Number(incidentForm.urgency);

    if (!Number.isInteger(people) || people < 0 || people > 10000000) {
      setIncidentError("People affected must be a whole number from 0 to 10,000,000.");
      return;
    }
    if (!Number.isInteger(urgency) || urgency < 1 || urgency > 5) {
      setIncidentError("Urgency must be an integer from 1 to 5.");
      return;
    }

    const payload = {
      disaster_type: incidentForm.disaster_type.trim(),
      description: incidentForm.description.trim(),
      location: incidentForm.location.trim(),
      people_affected: people,
      urgency,
      source: incidentForm.source.trim(),
    };

    if (payload.disaster_type.length < 2 || payload.disaster_type.length > 50) {
      setIncidentError("Disaster type must contain 2–50 characters.");
      return;
    }
    if (payload.description.length < 5 || payload.description.length > 1000) {
      setIncidentError("Description must contain 5–1,000 characters.");
      return;
    }
    if (payload.location.length < 2 || payload.location.length > 200) {
      setIncidentError("Location must contain 2–200 characters.");
      return;
    }
    if (payload.source.length < 2 || payload.source.length > 100) {
      setIncidentError("Source must contain 2–100 characters.");
      return;
    }

    setIncidentSubmitting(true);
    try {
      const response = await fetch("/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = result?.detail;
        const message = Array.isArray(detail)
          ? detail.map((item: { msg?: string }) => item.msg ?? "Invalid input").join("; ")
          : typeof detail === "string"
            ? detail
            : `Incident registration failed (HTTP ${response.status}).`;
        throw new Error(message);
      }

      const created = result?.incident as Incident | undefined;
      if (created) setSubmittedIncident(created);

      setIncidentMessage(
        typeof result?.message === "string"
          ? result.message
          : "Incident registered. Verification is still required."
      );

      setIncidentForm({
        disaster_type: "Flood",
        description: "",
        location: "",
        people_affected: "0",
        urgency: "3",
        source: "Manual report",
      });

      await refresh();
    } catch (error) {
      setIncidentError(
        error instanceof Error ? error.message : "Could not register incident."
      );
    } finally {
      setIncidentSubmitting(false);
    }
  }

'''
if source.count(effect_anchor) != 1:
    raise SystemExit("Could not safely locate the refresh effect. No changes made.")
source = source.replace(effect_anchor, handler + effect_anchor, 1)

# Insert the registration panel after the safety banner and before dashboard metrics.
panel_anchor = '      <section className="metrics-grid">'
panel = '''
      <Panel
        title="Incident registration"
        icon={<Radio size={18} />}
      >
        <p className="panel-footnote">
          Register an incoming report. Severity is calculated by the backend;
          every new report still requires human verification.
        </p>

        <form onSubmit={submitIncident} className="incident-form">
          <div className="incident-form-grid">
            <label>
              Disaster type
              <select
                required
                value={incidentForm.disaster_type}
                onChange={(event) =>
                  setIncidentForm((current) => ({
                    ...current,
                    disaster_type: event.target.value,
                  }))
                }
              >
                <option>Flood</option>
                <option>Cyclone</option>
                <option>Earthquake</option>
                <option>Fire</option>
                <option>Landslide</option>
                <option>Road accident</option>
                <option>Medical emergency</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              Incident location
              <input
                required
                minLength={2}
                maxLength={200}
                placeholder="Town, village, landmark or area"
                value={incidentForm.location}
                onChange={(event) =>
                  setIncidentForm((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              People affected
              <input
                required
                type="number"
                min={0}
                max={10000000}
                step={1}
                value={incidentForm.people_affected}
                onChange={(event) =>
                  setIncidentForm((current) => ({
                    ...current,
                    people_affected: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Urgency (1–5)
              <select
                required
                value={incidentForm.urgency}
                onChange={(event) =>
                  setIncidentForm((current) => ({
                    ...current,
                    urgency: event.target.value,
                  }))
                }
              >
                <option value="1">1 — Lowest reported urgency</option>
                <option value="2">2</option>
                <option value="3">3 — Moderate</option>
                <option value="4">4</option>
                <option value="5">5 — Highest reported urgency</option>
              </select>
            </label>

            <label>
              Report source
              <input
                required
                minLength={2}
                maxLength={100}
                placeholder="Caller, field team, official report..."
                value={incidentForm.source}
                onChange={(event) =>
                  setIncidentForm((current) => ({
                    ...current,
                    source: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <label>
            Incident description
            <textarea
              required
              minLength={5}
              maxLength={1000}
              rows={3}
              placeholder="Describe what was reported, when it occurred, and any known impact."
              value={incidentForm.description}
              onChange={(event) =>
                setIncidentForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>

          {incidentError && (
            <div className="notice notice-warning" role="alert">
              <AlertTriangle size={18} />
              <div>
                <strong>Registration not completed</strong>
                <p>{incidentError}</p>
              </div>
            </div>
          )}

          {incidentMessage && (
            <div className="notice notice-success" role="status">
              <CheckCircle2 size={18} />
              <div>
                <strong>{incidentMessage}</strong>
                {submittedIncident && (
                  <p>
                    Incident #{submittedIncident.incident_id ?? "created"}
                    {" · "}Severity: {getSeverityLevel(submittedIncident)}
                    {getSeverityScore(submittedIncident) !== undefined
                      ? ` (score ${getSeverityScore(submittedIncident)})`
                      : ""}
                    {" · "}Verification: {safeText(
                      submittedIncident.verification_status,
                      "Verification Required"
                    )}
                    {submittedIncident.possible_duplicate
                      ? ` · Possible duplicate of incident #${submittedIncident.duplicate_of ?? "an existing record"}; human review required.`
                      : ""}
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="refresh-button"
            disabled={incidentSubmitting || !connected}
          >
            <Radio size={16} />
            {incidentSubmitting ? "Registering..." : "Register incident"}
          </button>
          {!connected && (
            <p className="panel-footnote">
              Connect to the backend before registering an incident.
            </p>
          )}
        </form>
      </Panel>

'''
if source.count(panel_anchor) != 1:
    raise SystemExit("Could not safely locate the dashboard metrics section. No changes made.")
source = source.replace(panel_anchor, panel + panel_anchor, 1)

path.write_text(source, encoding="utf-8")
print("Incident registration form added to src/App.tsx")
