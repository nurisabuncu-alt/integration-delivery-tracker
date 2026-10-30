(() => {
  const STORAGE_KEY = "integration-sp-estimator-v4";
  const LOCAL_TRANSFER_ID = "2026-10-29-local";
  const PORTFOLIO_SOURCE = "integration-templates-sep-oct-2026";
  const RATES_VERSION = 6; // v6: phase rates from corrected Onur Jan–Oct workflow medians
  const ASSIGNEES = ["Uygar", "Onur", "Cihan", "John", "Unassigned"];
  const PHASE_KEYS = ["initiate", "mapping", "package", "adapt", "commence", "transition"];
  // Initiate alone doesn't prove delivery work happened — kickoff calls land there
  const DELIVERY_PHASE_KEYS = ["mapping", "package", "adapt", "commence", "transition"];
  // Under this many build hours with no delivery phase logged, a project is a touchpoint
  const RL_TOUCHPOINT_MAX_HOURS = 5;
  const PHASE_LABELS = {
    initiate: "Initiate",
    mapping: "Mapping",
    package: "Package",
    adapt: "Adapt (E2E)",
    commence: "Commence",
    transition: "Transition",
  };
  const PROJECT_STATUSES = ["InProgress", "OnHold", "Cancelled", "Complete"];
  const OKR_PHASE_KEYS = [
    "projectManagement",
    "mapping",
    "design",
    "development",
    "proofOfDelivery",
  ];
  const OKR_PHASE_LABELS = {
    projectManagement: "Project Management",
    mapping: "Mapping",
    design: "Design",
    development: "Development",
    proofOfDelivery: "Proof of Delivery",
  };
  const OKR_OBJECTIVES = [
    "Activated ARR",
    "MindCloud Integration Development",
    "Training",
    "CData - MindCloud Migration",
    "Hubspot Migration",
    "Operational Excellence",
  ];
  const OKR_PROJECT_TYPES = ["Integration", "API Support", "Training", "Misc"];
  const OKR_CONFIDENCE = ["Not set", "On track", "At risk", "Off track", "Complete"];
  const COMPLIANCE_PHASES = [
    "Initiate",
    "Mapping",
    "Package",
    "Adapt",
    "Commence",
    "Transition",
    "Completed",
  ];
  const COMPLIANCE_STATUSES = ["Not started", "In progress", "Complete", "N/A"];
  const COMPLIANCE_CONTROLS = [
    {
      id: "projectPlan",
      label: "Rocketlane Project Plan",
      duePhase: "Initiate",
      critical: true,
      description: "Detailed tasks, owners, due dates, and dependencies are maintained.",
    },
    {
      id: "designDocument",
      label: "Integration Design Document",
      duePhase: "Mapping",
      critical: true,
      description: "Architecture, mappings, business rules, errors, notifications, and logging are documented.",
    },
    {
      id: "designSignoff",
      label: "Design Sign-off",
      duePhase: "Mapping",
      critical: true,
      description: "The customer approved the design before build progressed.",
    },
    {
      id: "e2eTests",
      label: "End-to-End Test Documentation",
      duePhase: "Package",
      critical: true,
      description: "Use-case tests include steps, expected results, and negative scenarios.",
    },
    {
      id: "uatTests",
      label: "UAT Test Documentation",
      duePhase: "Adapt",
      critical: true,
      description: "Customer acceptance scenarios and expected results are documented.",
    },
    {
      id: "testSignoff",
      label: "UAT / E2E Sign-off",
      duePhase: "Commence",
      critical: true,
      description: "Successful acceptance testing is approved before production release.",
    },
    {
      id: "closureSignoff",
      label: "Closure Sign-off",
      duePhase: "Completed",
      critical: true,
      description: "Final documentation, handover, and closure are acknowledged.",
    },
    {
      id: "timesheets",
      label: "Timesheets",
      duePhase: "Initiate",
      recurring: true,
      critical: false,
      description: "Time is entered against project tasks within two to three business days.",
    },
    {
      id: "statusCalls",
      label: "Project Status Calls",
      duePhase: "Initiate",
      recurring: true,
      critical: false,
      description: "Accomplishments, open items, next actions, and timeline are reviewed.",
    },
  ];

  const QUARTER_FOCUS = {
    full: "Full lifecycle this quarter",
    design_build: "Design + Build this quarter",
    build_test: "Build + Test this quarter",
    golive: "Go-live / Hypercare this quarter",
  };

  const LOOKUPS = {
    typeBase: { Generic: 3, Custom: 5, "Premium API Support": 10, Misc: 0, Other: 2 },
    categoryWeight: { ERP: 0, "Custom Carrier": 0, EDI: 0, Store: 0, Other: 0 },
    flowSP: { Standard: 1, Complex: 2, Insane: 3 },
    dependency: { Stable: 0, Moderate: 1, Unstable: 3 },
    mapping: { Simple: 0, Moderate: 0, Complex: 0 },
    connection: {
      Other: 0,
      "Logiwa Hosted SFTP": 1,
      AS2: 3,
      "Remote Server": 2,
    },
    effort: { "New Development": 4, Customization: 2, Migration: 3 },
  };

  const DEFAULT_RATES = {
    // Generic base from Onur Jan–Oct 2026 CSV medians (quarter-hour rows kept as logged).
    // Custom ×1.15 matches the package median (3.9 → 4.5). Adapt 2.1 × 1.15 = 2.4.
    // Complex / Insane stay 2× / 3×. Custom mapping median (11.9h, n=2) is not used.
    initiateFlat: 2,
    mappingStandard: 1.3,
    mappingComplex: 2.6,
    mappingInsane: 3.9,
    packageStandard: 3.9,
    packageComplex: 7.8,
    packageInsane: 11.7,
    adaptPerFlow: 2.1,
    commenceFlat: 4,
    commenceERP: 12,
    transitionFlat: 4,
    meetingsOverhead: 0.2,
    migrationPackageMultiplier: 0.7,
    dependencyStable: 1,
    dependencyModerate: 1.15,
    dependencyUnstable: 1.3,
    typeHoursGeneric: 1,
    typeHoursOther: 1.1,
    typeHoursCustom: 1.15,
  };

  const RATE_LABELS = {
    initiateFlat: "Initiate (flat h)",
    mappingStandard: "Mapping × Standard (Generic base)",
    mappingComplex: "Mapping × Complex (Generic base)",
    mappingInsane: "Mapping × Insane (Generic base)",
    packageStandard: "Package × Standard (Generic base)",
    packageComplex: "Package × Complex (Generic base)",
    packageInsane: "Package × Insane (Generic base)",
    adaptPerFlow: "Adapt × total workflows (Generic base)",
    commenceFlat: "Commence (flat)",
    commenceERP: "Commence ERP cutover",
    transitionFlat: "Transition (flat)",
    meetingsOverhead: "Meetings overhead when Weeks is blank",
    migrationPackageMultiplier: "Migration package multiplier",
    dependencyStable: "Dependency Stable × hours",
    dependencyModerate: "Dependency Moderate × hours",
    dependencyUnstable: "Dependency Unstable × hours",
    typeHoursGeneric: "Type hours × Generic",
    typeHoursOther: "Type hours × Other",
    typeHoursCustom: "Type hours × Custom",
  };

  function uid() {
    return "p-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function n(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }

  function normalizeAssignee(a) {
    const s = (a || "").trim();
    if (!s) return "Unassigned";
    // Saved data may reference a teammate no longer on the roster
    return ASSIGNEES.includes(s) ? s : "Unassigned";
  }

  function phaseIndex(phase) {
    const index = COMPLIANCE_PHASES.indexOf(phase);
    return index >= 0 ? index : 0;
  }

  function inferCompliancePhase(p) {
    if (p.status === "Complete") return "Completed";
    const actual = p.actualByPhase || {};
    const phaseMap = {
      initiate: "Initiate",
      mapping: "Mapping",
      package: "Package",
      adapt: "Adapt",
      commence: "Commence",
      transition: "Transition",
    };
    for (let i = PHASE_KEYS.length - 1; i >= 0; i--) {
      const key = PHASE_KEYS[i];
      if (n(actual[key]) > 0) return phaseMap[key];
    }
    return "Initiate";
  }

  function blankComplianceControl() {
    return {
      status: "Not started",
      dueDate: "",
      completedDate: "",
      evidence: "",
      notes: "",
    };
  }

  function ensureCompliance(p) {
    if (!p.compliance || typeof p.compliance !== "object") p.compliance = {};
    const compliance = p.compliance;
    if (!COMPLIANCE_PHASES.includes(compliance.phase)) {
      compliance.phase = inferCompliancePhase(p);
    }
    if (typeof compliance.owner !== "string") {
      compliance.owner = normalizeAssignee(p.assignee);
    }
    if (typeof compliance.inScope !== "boolean") {
      compliance.inScope = p.type !== "Misc" && p.type !== "Other";
    }
    if (!compliance.controls || typeof compliance.controls !== "object") {
      compliance.controls = {};
    }
    COMPLIANCE_CONTROLS.forEach((definition) => {
      const existing = compliance.controls[definition.id];
      compliance.controls[definition.id] = Object.assign(
        blankComplianceControl(),
        existing && typeof existing === "object" ? existing : {}
      );
      if (!COMPLIANCE_STATUSES.includes(compliance.controls[definition.id].status)) {
        compliance.controls[definition.id].status = "Not started";
      }
    });
    return compliance;
  }

  function todayIso() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function complianceResult(p) {
    const compliance = ensureCompliance(p);
    if (p.status === "Cancelled" || !compliance.inScope) {
      return {
        score: null,
        status: "Excluded",
        applicable: 0,
        complete: 0,
        overdue: [],
        criticalOverdue: [],
        nextAction:
          p.status === "Cancelled"
            ? "Cancelled project — excluded from compliance"
            : "Outside compliance scope",
        controls: [],
      };
    }

    const currentPhaseIndex = phaseIndex(compliance.phase);
    const today = todayIso();
    const controls = COMPLIANCE_CONTROLS.map((definition) => {
      const record = compliance.controls[definition.id];
      const applicable =
        definition.recurring || phaseIndex(definition.duePhase) <= currentPhaseIndex;
      const future = !applicable;
      const excluded = record.status === "N/A";
      const points =
        record.status === "Complete" ? 1 : record.status === "In progress" ? 0.5 : 0;
      const overdueByDate =
        Boolean(record.dueDate) &&
        record.dueDate < today &&
        record.status !== "Complete" &&
        !excluded;
      const overdueByPhase =
        applicable &&
        !definition.recurring &&
        currentPhaseIndex > phaseIndex(definition.duePhase) &&
        record.status !== "Complete" &&
        !excluded;
      return {
        definition,
        record,
        applicable,
        future,
        excluded,
        points,
        overdue: overdueByDate || overdueByPhase,
      };
    });

    const scored = controls.filter((control) => control.applicable && !control.excluded);
    const earned = scored.reduce((sum, control) => sum + control.points, 0);
    const score = scored.length ? Math.round((earned / scored.length) * 100) : 100;
    const overdue = controls.filter((control) => control.overdue);
    const criticalOverdue = overdue.filter((control) => control.definition.critical);
    let status = score >= 90 ? "Compliant" : score >= 70 ? "Watch" : "At Risk";
    if (criticalOverdue.length) status = "At Risk";

    const candidates = [
      ...criticalOverdue,
      ...overdue.filter((control) => !control.definition.critical),
      ...controls.filter(
        (control) =>
          control.applicable &&
          control.definition.critical &&
          !control.excluded &&
          control.record.status !== "Complete"
      ),
      ...controls.filter(
        (control) =>
          control.applicable &&
          !control.excluded &&
          control.record.status !== "Complete"
      ),
      ...controls.filter((control) => control.future),
    ];
    const next = candidates[0];
    const nextAction = next
      ? `${next.overdue ? "Overdue: " : next.future ? "Next: " : "Complete: "}${
          next.definition.label
        }`
      : "All applicable controls complete";

    return {
      score,
      status,
      applicable: scored.length,
      complete: scored.filter((control) => control.record.status === "Complete").length,
      overdue,
      criticalOverdue,
      nextAction,
      controls,
    };
  }

  /** Premium and Misc: enter total hours directly; skip IMPACT phase model. */
  function isDirectHoursType(type) {
    return type === "Premium API Support" || type === "Misc";
  }

  /** Other: entered hours per quarter, not an IMPACT lifecycle. */
  function isQuarterHoursType(type) {
    return type === "Other";
  }

  function hasFlowEstimate(p) {
    return n(p.std) + n(p.cpx) + n(p.ins) > 0;
  }

  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function ensureHoursByQuarter(p) {
    if (!p.hoursByQuarter || typeof p.hoursByQuarter !== "object") p.hoursByQuarter = {};
    return p.hoursByQuarter;
  }

  function ensureHoursByMonth(p) {
    if (!p.hoursByMonth || typeof p.hoursByMonth !== "object") p.hoursByMonth = {};
    return p.hoursByMonth;
  }

  function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function monthsInQuarter(qStr) {
    const { q, year } = parseQuarter(qStr);
    const start = (q - 1) * 3 + 1;
    return [0, 1, 2].map((offset) => {
      const month = start + offset;
      return { month, year, key: monthKey(year, month), label: MONTH_NAMES[month - 1] };
    });
  }

  function selectedMonth() {
    const month = n(state.month);
    if (month < 1 || month > 12) return 0;
    if (!monthsInQuarter(state.quarter).some((item) => item.month === month)) return 0;
    return month;
  }

  function periodName() {
    const month = selectedMonth();
    return month ? `${MONTH_NAMES[month - 1]} ${state.year}` : state.quarter;
  }

  function quarterHasMonthHours(p, quarter) {
    const byMonth = ensureHoursByMonth(p);
    return monthsInQuarter(quarter).some((item) => {
      const value = byMonth[item.key];
      return value != null && value !== "";
    });
  }

  function monthHoursOf(p, year, month) {
    return n(ensureHoursByMonth(p)[monthKey(year, month)]);
  }

  function quarterHoursOf(p, quarter) {
    if (quarterHasMonthHours(p, quarter)) {
      return monthsInQuarter(quarter).reduce(
        (sum, item) => sum + n(ensureHoursByMonth(p)[item.key]),
        0
      );
    }
    return n(ensureHoursByQuarter(p)[quarter]);
  }

  function projectHasMonthHours(p) {
    const byMonth = ensureHoursByMonth(p);
    return Object.keys(byMonth).some((key) => n(byMonth[key]) > 0);
  }

  /** Premium / Misc: Rocketlane monthly hours win. The package budget is used only when no month is filled. */
  function directHoursInQuarter(p, quarter, month) {
    if (quarterHasMonthHours(p, quarter)) {
      if (month) return monthHoursOf(p, parseQuarter(quarter).year, month);
      return quarterHoursOf(p, quarter);
    }
    if (projectHasMonthHours(p)) return 0;
    if (!p.phaseQuarters || p.phaseQuarters.package !== quarter) return 0;
    const total = n(p.premiumHours);
    if (!month) return total;
    return total * monthShareOfQuarter(quarter, month);
  }

  function totalQuarterHours(p) {
    const quarters = new Set(Object.keys(ensureHoursByQuarter(p)));
    Object.keys(ensureHoursByMonth(p)).forEach((key) => {
      const match = String(key).match(/^(\d{4})-(\d{2})$/);
      if (!match) return;
      quarters.add(quarterId(Number(match[1]), Math.ceil(Number(match[2]) / 3)));
    });
    return [...quarters].reduce((sum, quarter) => sum + quarterHoursOf(p, quarter), 0);
  }

  /** September and October imports were stored on the quarter. Keep them on those months. */
  function migrateImportedMonthHours(p) {
    if (!String(p.id || "").startsWith("rl-")) return;
    const byMonth = ensureHoursByMonth(p);
    const byQuarter = ensureHoursByQuarter(p);
    [
      ["Q3 2026", "2026-09"],
      ["Q4 2026", "2026-10"],
    ].forEach(([quarter, key]) => {
      if (quarterHasMonthHours(p, quarter)) return;
      if (n(byQuarter[quarter]) > 0) byMonth[key] = n(byQuarter[quarter]);
    });
  }

  function dependencyHoursMultiplier(dependency, rates) {
    if (dependency === "Unstable") return n(rates.dependencyUnstable) || 1.3;
    if (dependency === "Moderate") return n(rates.dependencyModerate) || 1.15;
    return n(rates.dependencyStable) || 1;
  }

  /**
   * Weekly calls are 0.5 h for each week after the first two.
   * Kickoff is 1 h. Blank weeks keeps the percent overhead.
   */
  function meetingPlan(p, rates, deliveryHours) {
    if (isDirectHoursType(p.type) || !hasFlowEstimate(p)) {
      return { hours: 0, mode: "none", calls: 0, kickoff: 0, weeks: null };
    }
    if (p.weeks == null || p.weeks === "") {
      return {
        hours: deliveryHours * (n(rates.meetingsOverhead) || 0.2),
        mode: "overhead",
        calls: 0,
        kickoff: 0,
        weeks: null,
      };
    }
    const weeks = Math.max(0, n(p.weeks));
    const calls = Math.max(0, weeks - 2);
    const kickoff = weeks > 0 ? 1 : 0;
    return { hours: calls * 0.5 + kickoff, mode: "weeks", calls, kickoff, weeks };
  }

  function meetingSummary(plan) {
    if (!plan || plan.mode === "none") return "Meetings";
    if (plan.mode === "overhead") return "Meetings (20% until Weeks is set)";
    return `Meetings · ${plan.calls} × 0.5 h calls + ${plan.kickoff} h kickoff`;
  }

  /** Scales Mapping/Package/Adapt only. Generic base rates × this. Premium/Misc skip. */
  function typeHoursMultiplier(type, rates) {
    if (type === "Custom") return n(rates.typeHoursCustom) || 1.15;
    if (type === "Other") return n(rates.typeHoursOther) || 1.1;
    if (type === "Generic") return n(rates.typeHoursGeneric) || 1;
    // Fallback for unknown / legacy labels → treat like Other
    return n(rates.typeHoursOther) || 1.1;
  }

  /** Always import as Misc (direct hours) — not IMPACT delivery models. User sets planned hours. */
  const RL_IMPORT_AS_MISC = [
    "Hubspot <-> Jira Integration (Internal)",
    "Radial RFIL Integration",
    "Logiwa IO - Generic Integration Setup",
  ];

  function isForcedMiscImport(projectName) {
    const name = String(projectName || "").toLowerCase();
    return (
      name.startsWith("team tasks · ") ||
      RL_IMPORT_AS_MISC.some((x) => x.toLowerCase() === name)
    );
  }

  function isTeamTaskAbsence(row) {
    const text = `${row.TaskOrActivityName || ""} ${row.Notes || ""}`.toLowerCase();
    return (
      /annual leave|out sick|vacation|\bpto\b/.test(text) ||
      // Rocketlane also contains date-range leave entries such as
      // "20052026-21052026 - Onur" without an explicit leave label.
      /^\d{8}-\d{8}\s*-\s*(onur|uygar|cihan)\b/.test(text.trim())
    );
  }

  function teamTaskTopic(row) {
    const task = String(row.TaskOrActivityName || "").trim();
    const text = `${task} ${row.Notes || ""}`.toLowerCase();
    if (/mindcloud|m.ndcloud|\bmc\b|cdata/.test(text)) return "MindCloud & CData";
    if (/velociraptor/.test(text)) return "Velociraptor";
    if (/\bai\b|agent|generator|automation|rocketlane api/.test(text)) {
      return "AI & Automation";
    }
    if (/documentation|newsletter|knowledge|one.?pager|guide|training|learning/.test(text)) {
      return "Documentation & Enablement";
    }
    if (/review|workshop|presentation|prep|uygar \/ nuri|cihan \/ nuri|weekly|bi.?weekly|meeting/.test(text)) {
      return "Reviews & Planning";
    }
    if (/improvement|workflow update|update.*workflow|update.*wf|generic wf|standardis|merge order|parameter|task count|inventory sync/.test(text)) {
      return "Integration Improvements";
    }
    if (/monitor|error notification|email|ticket|issue|troubleshoot|check/.test(text)) {
      return "Monitoring & Support";
    }
    if (!task) return "General & Unspecified";
    return "Project Support";
  }

  function mapAssigneeFromRl(userName) {
    const s = String(userName || "").toLowerCase();
    if (s.includes("onur")) return "Onur";
    if (s.includes("cihan")) return "Cihan";
    if (s.includes("uygar")) return "Uygar";
    if (s.includes("parlier") || s === "john") return "John";
    return "Unassigned";
  }

  const RL_KEY_STORAGE = "integration-delivery-rl-key";
  let rocketlaneSearchResults = [];

  function projectSource(p) {
    if (p && (p.source === "rocketlane" || p.source === "manual")) return p.source;
    if (String(p && p.id || "").startsWith("rl-")) return "rocketlane";
    return "manual";
  }

  function projectSourceLabel(p) {
    return projectSource(p) === "rocketlane" ? "Rocketlane" : "Manual";
  }

  function mapRocketlaneStatus(label) {
    const value = String(label || "").toLowerCase();
    if (value === "completed") return "Complete";
    if (value === "cancelled") return "Cancelled";
    if (value === "on hold") return "OnHold";
    return "InProgress";
  }

  function inferTypeFromRl(projectName, templateName) {
    const pl = String(projectName || "").toLowerCase();
    const tl = String(templateName || "").toLowerCase();
    if (pl.includes("premium api") || pl.includes("premium support") || tl.includes("premium")) {
      return "Premium API Support";
    }
    if (tl.includes("generic") || pl.includes("generic")) return "Generic";
    if (tl.includes("custom") || pl.includes("custom")) return "Custom";
    if (pl.includes("misc") || pl.includes("newsletter") || pl.includes("improvement list")) {
      return "Misc";
    }
    return "Custom";
  }

  /** Calls, tickets and 1-1s are overhead — covered by the meetings %, not phase evidence. */
  function isOverheadCategory(categoryName) {
    return /^(meeting|team meetings|case support|email support)/i.test(
      String(categoryName || "").trim()
    );
  }

  /**
   * Map an RL time entry to an IMPACT phase. PhaseName wins, then task-name keywords,
   * then CategoryName — most rows leave PhaseName blank but do tag a category.
   */
  function mapRlPhase(phaseName, taskName, categoryName) {
    if (isOverheadCategory(categoryName)) return null;
    const ph = String(phaseName || "").toLowerCase();
    if (ph) {
      if (/transition|hyper.?care/.test(ph)) return "transition";
      if (/commence|go.?live/.test(ph)) return "commence";
      if (/adapt/.test(ph)) return "adapt";
      if (/package|development|api\/webhook/.test(ph)) return "package";
      if (/mapping|design/.test(ph)) return "mapping";
      if (/initiate|project prep|analysis and setup|discovery/.test(ph)) return "initiate";
    }
    const t = String(taskName || "").toLowerCase();
    if (t) {
      if (/hyper.?care|transition/.test(t)) return "transition";
      if (/go.?live|commence|cutover/.test(t)) return "commence";
      if (/\buat\b|end.?to.?end|\be2e\b|adapt/.test(t)) return "adapt";
      if (/develop|build|package/.test(t)) return "package";
      if (/design|mapping/.test(t)) return "mapping";
      if (/kick.?off|initiate|project prep|discovery/.test(t)) return "initiate";
    }
    const cat = String(categoryName || "").trim().toLowerCase();
    if (cat === "development" || cat === "configuration" || cat === "setup") return "package";
    if (cat === "test") return "adapt";
    if (cat === "design" || cat === "analysis") return "mapping";
    return null;
  }

  /** Phase inclusion: p.phasesActive null/missing = all phases included. */
  function isPhaseActive(p, key) {
    return !p.phasesActive || p.phasesActive[key] !== false;
  }

  function quarterFromDate(dateStr) {
    const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const q = Math.floor((month - 1) / 3) + 1;
    return quarterId(year, q);
  }

  function parseCsvText(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const src = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      const next = src[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch !== "\r") {
        field += ch;
      }
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    if (!rows.length) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1).filter((r) => r.some((c) => String(c || "").trim())).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] != null ? r[idx] : "";
      });
      return obj;
    });
  }

  function reverseEstimateStdWorkflows(totalHours, type, rates, phasesActive) {
    const hrs = n(totalHours);
    if (hrs <= 0) return 1;
    if (isDirectHoursType(type)) return 0;
    const on = (k) => !phasesActive || phasesActive[k] !== false;
    const typeMult = typeHoursMultiplier(type, rates);
    // Stable, no ERP: (flats + (map+pkg+adapt)*N*typeMult) * 1.2 ≈ hrs — only included phases count
    const perWf =
      ((on("mapping") ? n(rates.mappingStandard) : 0) +
        (on("package") ? n(rates.packageStandard) : 0) +
        (on("adapt") ? n(rates.adaptPerFlow) : 0)) *
      typeMult;
    const meetings = n(rates.meetingsOverhead) || 0.2;
    const flat =
      (on("initiate") ? n(rates.initiateFlat) : 0) +
      (on("commence") ? n(rates.commenceFlat) : 0) +
      (on("transition") ? n(rates.transitionFlat) : 0);
    if (perWf <= 0) return 1;
    const deliveryTarget = hrs / (1 + meetings);
    const nStd = Math.round((deliveryTarget - flat) / perWf);
    return Math.max(1, Math.min(12, nStd));
  }

  /**
   * Decide which quarter each IMPACT phase belongs to.
   * Priority: place each phase in the quarter where that phase's time was actually logged.
   * Phases with no logged time fall back to a heuristic spread across the build-hour span
   * (early phases → first active quarter, delivery → peak, late phases → last).
   */
  function buildPhaseQuartersFromActuals(agg, peakQ) {
    const byPhaseQuarter = agg.byPhaseQuarter || {};
    const buildByQuarter = agg.byQuarterBuild || agg.byQuarter || {};

    // Quarters that saw meaningful build work (ignore trivial <10% stragglers like a lone call)
    const buildTotal = Object.values(buildByQuarter).reduce((s, h) => s + h, 0);
    const activeQuarters = Object.keys(buildByQuarter)
      .filter((q) => buildByQuarter[q] > 0 && (buildTotal <= 0 || buildByQuarter[q] / buildTotal >= 0.1))
      .sort();
    const span = activeQuarters.length ? activeQuarters : Object.keys(buildByQuarter).sort();
    const first = span[0] || peakQ;
    const last = span[span.length - 1] || peakQ;
    const mid = peakQ || span[Math.floor(span.length / 2)] || first;

    // Heuristic fallback for phases without actual data
    const fallback = {
      initiate: first,
      mapping: first,
      package: mid,
      adapt: mid,
      commence: last,
      transition: last,
    };

    const phaseQuarters = {};
    PHASE_KEYS.forEach((k) => {
      const pq = byPhaseQuarter[k];
      if (pq && Object.keys(pq).length) {
        // Quarter where this phase logged the most time
        phaseQuarters[k] = Object.keys(pq).sort((a, b) => pq[b] - pq[a])[0];
      } else {
        phaseQuarters[k] = fallback[k];
      }
    });
    return { focus: "full", phaseQuarters };
  }

  function aggregateRlRows(rows, rates, options) {
    const minHours = options.minHours != null ? options.minHours : 5;
    const focusQuarter = options.focusQuarter || null;
    const minFocusShare = options.minFocusShare != null ? options.minFocusShare : 0;
    const map = new Map();

    for (const row of rows) {
      const rawProject = String(row.ProjectName || "").trim();
      if (!rawProject) continue;
      const isTeamTask = rawProject.toLowerCase() === "integrations team tasks";
      if (isTeamTask && isTeamTaskAbsence(row)) continue;
      const assignee = mapAssigneeFromRl(row.UserName);
      const project = isTeamTask
        ? `Team Tasks · ${teamTaskTopic(row)} · ${assignee}`
        : rawProject;
      const hours = n(String(row.TrackedTime || "").replace(",", "."));
      if (hours <= 0) continue;
      const q = quarterFromDate(row.Date);
      const template = row.TemplateName || "";
      if (!map.has(project)) {
        map.set(project, {
          name: project,
          template,
          totalHours: 0,
          buildHours: 0,
          byPerson: {},
          byQuarter: {},
          byQuarterBuild: {},
          byPhase: {},
          byPhaseQuarter: {},
          isTeamTaskTopic: isTeamTask,
        });
      }
      const agg = map.get(project);
      if (!agg.template && template) agg.template = template;
      agg.totalHours += hours;
      const overhead = isOverheadCategory(row.CategoryName);
      if (!overhead) agg.buildHours += hours;
      agg.byPerson[assignee] = (agg.byPerson[assignee] || 0) + hours;
      if (q) {
        agg.byQuarter[q] = (agg.byQuarter[q] || 0) + hours;
        if (!overhead) agg.byQuarterBuild[q] = (agg.byQuarterBuild[q] || 0) + hours;
      }
      const phase = mapRlPhase(row.PhaseName, row.TaskOrActivityName, row.CategoryName);
      if (phase) {
        agg.byPhase[phase] = (agg.byPhase[phase] || 0) + hours;
        if (q) {
          if (!agg.byPhaseQuarter[phase]) agg.byPhaseQuarter[phase] = {};
          agg.byPhaseQuarter[phase][q] = (agg.byPhaseQuarter[phase][q] || 0) + hours;
        }
      }
    }

    const projects = [];
    let skippedLow = 0;
    let skippedFocus = 0;
    for (const agg of map.values()) {
      if (agg.totalHours < minHours) {
        skippedLow++;
        continue;
      }
      if (focusQuarter && minFocusShare > 0) {
        const focusHrs = agg.byQuarter[focusQuarter] || 0;
        const share = agg.totalHours > 0 ? focusHrs / agg.totalHours : 0;
        if (focusHrs <= 0 || share < minFocusShare) {
          skippedFocus++;
          continue;
        }
      }

      const observedPhases = PHASE_KEYS.filter((k) => (agg.byPhase[k] || 0) > 0);
      const mappedHours = observedPhases.reduce((s, k) => s + agg.byPhase[k], 0);
      // Measured against build hours: meeting/ticket hours are overhead and never map to a phase
      const phaseCoverage = agg.buildHours > 0 ? mappedHours / agg.buildHours : 0;
      const hasDeliveryEvidence = DELIVERY_PHASE_KEYS.some((k) => (agg.byPhase[k] || 0) > 0);

      // Calls and tickets with barely any build work logged are a touchpoint, not a delivery
      // project — costing it as a full lifecycle would invent tens of hours of work.
      const isTouchpoint =
        !hasDeliveryEvidence && agg.buildHours < RL_TOUCHPOINT_MAX_HOURS;
      const forcedMisc = isForcedMiscImport(agg.name);
      const type =
        forcedMisc || isTouchpoint ? "Misc" : inferTypeFromRl(agg.name, agg.template);
      const primary =
        Object.keys(agg.byPerson).sort((a, b) => agg.byPerson[b] - agg.byPerson[a])[0] ||
        "Unassigned";
      // Peak quarter from build hours (meetings shouldn't decide where delivery lands)
      const peakSource =
        Object.keys(agg.byQuarterBuild).length ? agg.byQuarterBuild : agg.byQuarter;
      const peakQ =
        Object.keys(peakSource).sort((a, b) => peakSource[b] - peakSource[a])[0] ||
        state.quarter;
      const spread = buildPhaseQuartersFromActuals(agg, peakQ);
      const pl = agg.name.toLowerCase();
      const erpCutover = /acumatica|netsuite|sage|epicor|erp|intacct/.test(pl);
      const effort = /migration|cdata/.test(pl) || /migration/.test(agg.template.toLowerCase())
        ? "Migration"
        : "New Development";

      const p = blankProject(peakQ);
      p.name = agg.name;
      p.assignee = primary === "Unassigned" ? "Unassigned" : primary;
      p.type = type;
      p.status = "InProgress";
      p.effort = effort;
      p.erpCutover = erpCutover;
      p.dependency = "Stable";
      p.category = /edi|sps|commerce.?hub/.test(pl)
        ? "EDI"
        : erpCutover
          ? "ERP"
          : /shop|tiktok|amazon|magento|shopify|bigcommerce|squarespace/.test(pl)
            ? "Store"
            : "Other";
      p.phaseQuarters = spread.phaseQuarters;
      p.quarterFocus = spread.focus;
      p.actualHours = Math.round(agg.totalHours * 10) / 10;
      p.actualByQuarter = { ...agg.byQuarter };
      p.actualByPhase = { ...agg.byPhase };

      // Include only phases that have logged time; no phase info at all = keep full lifecycle.
      // Guard: many RL rows have blank phases — only trust the filter when at least half
      // the project's hours are phase-mappable, otherwise one stray tagged entry would
      // collapse the estimate to a single phase. Tiny projects are the exception: the tagged
      // phases are the only signal there, and a full lifecycle would dwarf the actuals.
      const trustPhases =
        phaseCoverage >= 0.5 || agg.buildHours < RL_TOUCHPOINT_MAX_HOURS;
      const manualForcedMisc = forcedMisc && !agg.isTeamTaskTopic;
      if (agg.isTeamTaskTopic) {
        p.phasesActive = null;
        p.useActualByQuarter = true;
        p.notes = `Special Team Tasks topic: ${p.actualHours}h after excluding annual and sick leave. Quarter usage follows the dated time entries.`;
      } else if (forcedMisc) {
        p.phasesActive = null;
        p.notes = `RL import: ${p.actualHours}h actual to date — forced Misc. Set planned hours for this quarter.`;
      } else if (observedPhases.length && trustPhases && !isDirectHoursType(type)) {
        p.phasesActive = {};
        PHASE_KEYS.forEach((k) => {
          p.phasesActive[k] = observedPhases.includes(k);
        });
        p.notes = `RL import: ${p.actualHours}h actual. Phases with time: ${observedPhases
          .map((k) => PHASE_LABELS[k])
          .join(", ")}. Review Std/Cpx/Dependency.`;
      } else {
        p.phasesActive = null;
        if (isTouchpoint) {
          p.notes = `RL import: ${p.actualHours}h actual — mostly calls/tickets (${
            Math.round(agg.buildHours * 10) / 10
          }h build work, no delivery phase logged), booked as Misc hours.`;
        } else {
          const why = observedPhases.length
            ? `phase info too sparse (${Math.round(phaseCoverage * 100)}% of build hours tagged)`
            : "no phase info";
          p.notes = `RL import: ${p.actualHours}h actual (${why} — full lifecycle). Review Std/Cpx/Dependency.`;
        }
      }

      if (isDirectHoursType(type)) {
        p.std = 0;
        p.cpx = 0;
        p.ins = 0;
        // Manual forced-Misc streams start at 0. Team Task topics use dated actual hours.
        p.premiumHours = manualForcedMisc ? 0 : Math.round(agg.totalHours * 10) / 10;
      } else {
        p.premiumHours = 0;
        p.std = reverseEstimateStdWorkflows(agg.totalHours, type, rates, p.phasesActive);
        p.cpx = 0;
        p.ins = 0;
      }
      projects.push(p);
    }

    projects.sort((a, b) => (b.actualHours || 0) - (a.actualHours || 0));
    return { projects, skippedLow, skippedFocus, totalRaw: map.size };
  }

  async function importRocketlaneCsvFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return;
    const allRows = [];
    for (const file of files) {
      const text = await file.text();
      const rows = parseCsvText(text);
      if (!rows.length || !("ProjectName" in rows[0]) || !("TrackedTime" in rows[0])) {
        alert(`Skipped ${file.name}: not a Rocketlane time report CSV (need ProjectName, TrackedTime).`);
        continue;
      }
      allRows.push(...rows);
    }
    if (!allRows.length) {
      alert("No valid Rocketlane CSV rows found.");
      return;
    }

    const { projects, skippedLow, skippedFocus, totalRaw } = aggregateRlRows(
      allRows,
      state.rates,
      {
        minHours: 0,
        focusQuarter: null,
        minFocusShare: 0,
      }
    );
    if (!projects.length) {
      alert(
        `No projects to import after filters.\nRaw projects: ${totalRaw}\nSkipped empty/excluded: ${skippedLow}`
      );
      return;
    }

    const replace = confirm(
      `Ready to import ${projects.length} projects from ${files.length} file(s).\n` +
        `(HubSpot / Radial / Logiwa IO Setup import as Misc at 0 planned hours. Team Tasks are grouped by topic/person; leave is excluded.)\n\n` +
        `OK = replace current portfolio\nCancel = add/merge (skip duplicate names)`
    );

    if (replace) {
      state.projects = projects;
      state.selectedId = projects[0]?.id || null;
    } else {
      const existing = new Set(state.projects.map((p) => p.name.toLowerCase()));
      let added = 0;
      for (const p of projects) {
        if (existing.has(p.name.toLowerCase())) continue;
        state.projects.push(p);
        existing.add(p.name.toLowerCase());
        added++;
      }
      alert(`Merged ${added} new projects (${projects.length - added} duplicates skipped).`);
    }
    // Point year/quarter at the busiest imported quarter if possible
    const qHours = {};
    projects.forEach((p) => {
      Object.entries(p.actualByQuarter || {}).forEach(([q, h]) => {
        qHours[q] = (qHours[q] || 0) + h;
      });
    });
    const bestQ = Object.keys(qHours).sort((a, b) => qHours[b] - qHours[a])[0];
    if (bestQ) {
      const { year } = parseQuarter(bestQ);
      state.year = year;
      state.quarter = bestQ;
    }
    render();
  }

  function quarterId(year, q) {
    return `Q${q} ${year}`;
  }

  function quarterBounds(qStr) {
    const { q, year } = parseQuarter(qStr);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const endDay = new Date(year, endMonth, 0).getDate();
    return {
      start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
      end: `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
    };
  }

  /** Parent IMPACT shells on Rocketlane templates (not "Insert SO - Development" lines). */
  const PHASE_SHELL_NAMES = {
    initiate: [
      "host system setup",
      "integration account setup",
      "integration - kick off",
      "kickoff call",
      "kick-off and project analysis meeting",
      "initiate",
    ],
    mapping: [
      "design documents",
      "integration - high level design architecture",
      "review design document and test scenarios",
      "internal integration design review",
      "mapping",
    ],
    package: ["development", "package"],
    adapt: [
      "functional tests",
      "integration process - functional tests",
      "end-to-end testing",
      "end-to-end test scenario final review",
      "adapt",
    ],
    commence: [
      "go live",
      "go-live",
      "1st week of go live",
      "checkpoint for go-live",
      "commence",
    ],
    transition: ["hypercare", "integration hypercare", "transition"],
  };

  function mapShellTaskToPhase(taskName) {
    const name = String(taskName || "")
      .trim()
      .toLowerCase();
    if (!name) return null;
    for (let i = 0; i < PHASE_KEYS.length; i++) {
      const key = PHASE_KEYS[i];
      if (PHASE_SHELL_NAMES[key].indexOf(name) >= 0) return key;
    }
    return null;
  }

  function dateToQuarter(dateStr, fallbackQ) {
    return quarterFromDate(dateStr) || fallbackQ;
  }

  /**
   * Spread IMPACT phases along the Rocketlane project start→due timeline.
   * Initiate lands near start, Transition near due, so Generic/Custom hours can span quarters.
   */
  function phaseQuartersFromPlan(start, due, fallbackQ) {
    const startOk = start && /^\d{4}-\d{2}-\d{2}$/.test(start);
    const dueOk = due && /^\d{4}-\d{2}-\d{2}$/.test(due);
    if (!startOk && !dueOk) return defaultPhaseQuarters(fallbackQ);
    if (!startOk || !dueOk || start === due) {
      return defaultPhaseQuarters(dateToQuarter(due || start, fallbackQ));
    }
    const startMs = Date.parse(start + "T00:00:00Z");
    const dueMs = Date.parse(due + "T00:00:00Z");
    if (!(dueMs > startMs)) return defaultPhaseQuarters(dateToQuarter(due, fallbackQ));
    const result = {};
    const last = PHASE_KEYS.length - 1;
    PHASE_KEYS.forEach((key, index) => {
      const ms = startMs + ((dueMs - startMs) * index) / last;
      const d = new Date(ms);
      result[key] = quarterId(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) + 1);
    });
    return result;
  }

  /** Prefer dated IMPACT shell tasks; fill gaps from the project start→due spread. */
  function phaseQuartersFromRocketlaneTasks(tasks, start, due, fallbackQ) {
    const base = phaseQuartersFromPlan(start, due, fallbackQ);
    const datesByPhase = {};
    (tasks || []).forEach((task) => {
      const phase = mapShellTaskToPhase(task.taskName || task.name);
      if (!phase) return;
      const date = task.dueDate || task.startDate;
      if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return;
      if (!datesByPhase[phase]) datesByPhase[phase] = [];
      datesByPhase[phase].push(String(date).slice(0, 10));
    });
    PHASE_KEYS.forEach((key) => {
      const dates = datesByPhase[key];
      if (!dates || !dates.length) return;
      dates.sort();
      base[key] = dateToQuarter(dates[dates.length - 1], base[key]);
    });
    return base;
  }

  function phaseAssignedToQuarter(p, quarter) {
    return PHASE_KEYS.some((key) => p.phaseQuarters && p.phaseQuarters[key] === quarter);
  }

  /** null when the row has no project plan. Otherwise whether start–due covers the quarter. */
  function planOverlapsQuarter(p, quarter) {
    const start = p.planStart || "";
    const due = p.planDue || "";
    if (!start && !due) return null;
    const bounds = quarterBounds(quarter);
    return (start || due) <= bounds.end && (due || start) >= bounds.start;
  }

  function planDueInQuarter(p, quarter) {
    const due = p.planDue || p.planStart || "";
    if (!due) return false;
    const bounds = quarterBounds(quarter);
    return due >= bounds.start && due <= bounds.end;
  }

  function rocketlaneTemplateName(apiProject) {
    const sources = apiProject && apiProject.sources;
    if (!Array.isArray(sources)) return "";
    for (let i = 0; i < sources.length; i++) {
      const name = sources[i] && sources[i].templateName;
      if (name) return String(name);
    }
    return "";
  }

  /** Development subtasks only; SO / PO / TO / WO / Items CRUD collapse to one flow each. */
  function developmentFlowKey(taskName) {
    const raw = String(taskName || "").trim();
    if (!raw.endsWith(" - Development") || raw === "Development") return null;
    let stem = raw.slice(0, -" - Development".length).trim();
    if (!stem) return null;
    const edi = stem.match(/^(\d{3})\b/);
    if (edi) return "EDI " + edi[1];
    stem = stem.replace(/^\d+\s+/, "").replace(/ \(Inbound\)/gi, "").replace(/ \(Outbound\)/gi, "").trim();
    const doc = stem.replace(/^(Insert|Update|Cancel|Create|Delete|Receive|Fulfill)\s+/i, "").trim();
    const grouped = {
      "shipment order": "Shipment Order",
      "sales order": "Sales Order",
      "purchase order": "Purchase Order",
      "transfer order": "Transfer Order",
      "work order": "Work Order",
      items: "Items",
    };
    if (grouped[doc.toLowerCase()]) return grouped[doc.toLowerCase()];
    const paren = stem.match(/^\((.+)\)$/);
    if (paren) {
      const label = paren[1];
      if (/^Purchase Order$/i.test(label)) return "EDI 850";
      if (/^Ship Notice$/i.test(label)) return "EDI 856";
      if (/^Invoice$/i.test(label)) return "EDI 810";
      if (/^Warehouse Shipping Advice$/i.test(label)) return "EDI 945";
      if (/^Warehouse Shipping Order$/i.test(label)) return "EDI 940";
    }
    return stem;
  }

  function countDevelopmentFlows(tasks) {
    const keys = new Set();
    (tasks || []).forEach((task) => {
      const key = developmentFlowKey(task.taskName || task.name);
      if (key) keys.add(key);
    });
    return keys.size;
  }

  async function rocketlaneGetJson(apiKey, path) {
    let lastError = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      let response;
      try {
        response = await fetch(`/rocketlane${path}`, {
          cache: "no-store",
          headers: { "api-key": apiKey, accept: "application/json" },
        });
      } catch (error) {
        const detail = String((error && error.message) || error || "network error");
        lastError = new Error(
          /failed to fetch|networkerror|load failed/i.test(detail)
            ? "Preview server did not respond. Reload this page, then sync again."
            : detail
        );
        if (attempt === 4) throw lastError;
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        continue;
      }
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;
      const message = payload.error || payload.message || `Rocketlane returned ${response.status}`;
      lastError = new Error(
        typeof message === "string" ? message : `Rocketlane returned ${response.status}`
      );
      if (![429, 502, 503].includes(response.status) || attempt === 4) throw lastError;
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : attempt * 2500;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    throw lastError || new Error("Rocketlane request failed");
  }

  async function fetchRocketlaneProject(apiKey, projectId) {
    const payload = await rocketlaneGetJson(
      apiKey,
      `/api/1.0/projects/${encodeURIComponent(projectId)}?includeFields=budgetedHours,allocatedHours`
    );
    return payload.data || payload;
  }

  async function fetchRocketlaneMonthHours(apiKey, projectId) {
    const totals = {};
    let path =
      `/api/1.0/time-entries?pageSize=100&date.ge=2025-01-01&date.le=2026-12-31&projectId.eq=${encodeURIComponent(projectId)}`;
    let guard = 0;
    while (path && guard < 40) {
      guard += 1;
      const payload = await rocketlaneGetJson(apiKey, path);
      const page = Array.isArray(payload.data) ? payload.data : [];
      page.forEach((row) => {
        const date = String(row.date || "");
        if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return;
        const key = date.slice(0, 7);
        totals[key] = (totals[key] || 0) + n(row.minutes) / 60;
      });
      const next = payload.pagination && payload.pagination.hasMore && payload.pagination.nextPage;
      if (!next) break;
      path = String(next).replace(/^https?:\/\/api\.rocketlane\.com/i, "");
      if (!path.startsWith("/")) path = "/" + path.replace(/^\/+/, "");
    }
    Object.keys(totals).forEach((key) => {
      const hours = Math.round(totals[key] * 100) / 100;
      if (hours > 0) totals[key] = hours;
      else delete totals[key];
    });
    return totals;
  }

  async function fetchRocketlaneTasks(apiKey, projectId) {
    const tasks = [];
    let path = `/api/1.0/tasks?project.eq=${encodeURIComponent(projectId)}&pageSize=100`;
    let guard = 0;
    while (path && guard < 40) {
      guard += 1;
      const payload = await rocketlaneGetJson(apiKey, path);
      const page = Array.isArray(payload.data) ? payload.data : [];
      page.forEach((task) => tasks.push(task));
      const next = payload.pagination && payload.pagination.hasMore && payload.pagination.nextPage;
      if (!next) break;
      path = String(next).replace(/^https?:\/\/api\.rocketlane\.com/i, "");
      if (!path.startsWith("/")) path = "/" + path.replace(/^\/+/, "");
    }
    return tasks;
  }

  async function fetchRocketlaneAllocationQuarters(apiKey, projectId) {
    const quarters = new Set();
    let path =
      `/api/1.0/resource-allocations?startDate=2025-01-01&endDate=2026-12-31&pageSize=100&projectId.eq=${encodeURIComponent(projectId)}`;
    let guard = 0;
    while (path && guard < 20) {
      guard += 1;
      const payload = await rocketlaneGetJson(apiKey, path);
      const page = Array.isArray(payload.data) ? payload.data : [];
      page.forEach((row) => {
        const start = row.startDate;
        const end = row.endDate || start;
        if (!start || !/^\d{4}-\d{2}-\d{2}/.test(start)) return;
        const startDate = new Date(String(start).slice(0, 10) + "T00:00:00Z");
        const endDate = new Date(String(end).slice(0, 10) + "T00:00:00Z");
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;
        let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
        const last = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
        while (cursor <= last) {
          quarters.add(quarterId(cursor.getUTCFullYear(), Math.floor(cursor.getUTCMonth() / 3) + 1));
          cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
        }
      });
      const next = payload.pagination && payload.pagination.hasMore && payload.pagination.nextPage;
      if (!next) break;
      path = String(next).replace(/^https?:\/\/api\.rocketlane\.com/i, "");
      if (!path.startsWith("/")) path = "/" + path.replace(/^\/+/, "");
    }
    return [...quarters];
  }

  /** Rocketlane phase names → IMPACT keys. One plan phase can cover two IMPACT phases. */
  function impactKeysFromPhaseName(name) {
    const n = String(name || "").trim().toLowerCase();
    if (n.startsWith("initiate") || n.startsWith("analysis")) return ["initiate"];
    if (n.startsWith("design") || n.startsWith("mapping")) return ["mapping"];
    if (n.startsWith("package")) return ["package"];
    if (n.startsWith("development")) return ["package", "adapt"];
    if (n.startsWith("adapt") || n.startsWith("end to end") || n.startsWith("end-to-end")) return ["adapt"];
    if (n.startsWith("commence") || n.startsWith("go live") || n.startsWith("go-live") || n === "launch") {
      return ["commence"];
    }
    if (
      n.startsWith("transition") ||
      n.startsWith("hypercare") ||
      n.startsWith("hyper care") ||
      n.startsWith("closure")
    ) {
      return ["transition"];
    }
    return [];
  }

  function phaseDueMapFromRows(rows) {
    const dues = {};
    (rows || []).forEach((row) => {
      const due = String(row.dueDate || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return;
      impactKeysFromPhaseName(row.phaseName || row.name).forEach((key) => {
        if (!dues[key] || due > dues[key]) dues[key] = due;
      });
    });
    const latest = PHASE_KEYS.map((key) => dues[key]).filter(Boolean).sort().pop();
    if (latest && !dues.commence) dues.commence = latest;
    if (latest && !dues.transition) dues.transition = dues.commence;
    return Object.keys(dues).length ? dues : null;
  }

  function quartersFromPhaseDueDates(dues, fallbackQuarters) {
    const result = Object.assign({}, fallbackQuarters || {});
    if (!dues) return Object.keys(result).length ? result : null;
    PHASE_KEYS.forEach((key) => {
      const quarter = quarterFromDate(dues[key]);
      if (quarter) result[key] = quarter;
    });
    return result;
  }

  function phaseDueDatesFor(project) {
    const map = window.PHASE_DUE_DATES_2026 || {};
    const id = String(project.id || "").replace(/^rl-/, "");
    const dues = map[id];
    return dues && typeof dues === "object" ? dues : null;
  }

  async function fetchRocketlanePhaseRows(apiKey, projectId) {
    const rows = [];
    let path = `/api/1.0/phases?projectId=${encodeURIComponent(projectId)}&pageSize=100`;
    let guard = 0;
    while (path && guard < 10) {
      guard += 1;
      const payload = await rocketlaneGetJson(apiKey, path);
      const page = Array.isArray(payload.data) ? payload.data : [];
      page.forEach((row) => rows.push(row));
      const next = payload.pagination && payload.pagination.hasMore && payload.pagination.nextPage;
      if (!next) break;
      path = String(next).replace(/^https?:\/\/api\.rocketlane\.com/i, "");
      if (!path.startsWith("/")) path = "/" + path.replace(/^\/+/, "");
    }
    return rows;
  }

  function quartersForYear(year) {
    return [1, 2, 3, 4].map((q) => quarterId(year, q));
  }

  function weekdaysInQuarter(qStr) {
    const { q, year } = parseQuarter(qStr);
    const startMonth = (q - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 1);
    let weekdays = 0;
    for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) weekdays += 1;
    }
    return weekdays;
  }

  function weekdaysInMonth(year, month) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    let weekdays = 0;
    for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) weekdays += 1;
    }
    return weekdays;
  }

  function monthShareOfQuarter(qStr, month) {
    if (!month || !monthsInQuarter(qStr).some((item) => item.month === month)) return 1;
    const days = weekdaysInQuarter(qStr);
    if (!days) return 0;
    return weekdaysInMonth(parseQuarter(qStr).year, month) / days;
  }

  function capacityHoursForQuarter(qStr) {
    return weekdaysInQuarter(qStr) * 6;
  }

  function allQuarterOptions(year) {
    // Allow assigning phases to adjacent years too
    const y = n(year) || 2026;
    return [...quartersForYear(y - 1), ...quartersForYear(y), ...quartersForYear(y + 1)];
  }

  function parseQuarter(qStr) {
    const m = String(qStr).match(/^Q([1-4])\s+(\d{4})$/);
    if (!m) return { q: 3, year: 2026 };
    return { q: Number(m[1]), year: Number(m[2]) };
  }

  function shiftQuarter(qStr, delta) {
    let { q, year } = parseQuarter(qStr);
    q += delta;
    while (q > 4) {
      q -= 4;
      year += 1;
    }
    while (q < 1) {
      q += 4;
      year -= 1;
    }
    return quarterId(year, q);
  }

  function applyQuarterFocus(p, focus, anchorQ) {
    const prev = shiftQuarter(anchorQ, -1);
    const next = shiftQuarter(anchorQ, 1);
    const map = {
      full: {
        initiate: anchorQ,
        mapping: anchorQ,
        package: anchorQ,
        adapt: anchorQ,
        commence: anchorQ,
        transition: anchorQ,
      },
      design_build: {
        initiate: anchorQ,
        mapping: anchorQ,
        package: anchorQ,
        adapt: next,
        commence: next,
        transition: next,
      },
      build_test: {
        initiate: prev,
        mapping: prev,
        package: anchorQ,
        adapt: anchorQ,
        commence: next,
        transition: next,
      },
      golive: {
        initiate: prev,
        mapping: prev,
        package: prev,
        adapt: prev,
        commence: anchorQ,
        transition: anchorQ,
      },
    };
    p.quarterFocus = focus in map ? focus : "full";
    p.phaseQuarters = Object.assign({}, map[p.quarterFocus]);
    return p;
  }

  function ensurePhaseQuarters(p, fallbackQ) {
    if (!p.quarterFocus) p.quarterFocus = "full";
    if (!p.phaseQuarters) {
      applyQuarterFocus(p, p.quarterFocus, fallbackQ);
      return p;
    }
    PHASE_KEYS.forEach((k) => {
      if (!p.phaseQuarters[k]) p.phaseQuarters[k] = fallbackQ;
    });
    return p;
  }

  function blankProject(defaultQ) {
    const p = {
      id: uid(),
      name: "New project",
      assignee: "Unassigned",
      type: "Custom",
      status: "InProgress",
      category: "EDI",
      effort: "New Development",
      std: 1,
      cpx: 0,
      ins: 0,
      dependency: "Stable",
      mapping: "Simple",
      connection: "Other",
      erpCutover: false,
      premiumHours: 0,
      weeks: null,
      okr: 0,
      notes: "",
      quarterFocus: "full",
      phaseQuarters: null,
      phasesActive: null,
    };
    applyQuarterFocus(p, "full", defaultQ);
    return p;
  }

  function defaultPhaseQuarters(q) {
    return {
      initiate: q,
      mapping: q,
      package: q,
      adapt: q,
      commence: q,
      transition: q,
    };
  }

  function proj(overrides, defaultQ) {
    const p = Object.assign(blankProject(defaultQ), overrides);
    if (overrides.phaseQuarters) {
      p.phaseQuarters = Object.assign(defaultPhaseQuarters(defaultQ), overrides.phaseQuarters);
      p.quarterFocus = overrides.quarterFocus || "full";
    } else if (overrides.quarterFocus) {
      applyQuarterFocus(p, overrides.quarterFocus, defaultQ);
    }
    return p;
  }

  function sampleProjects(year) {
    const q1 = quarterId(year, 1);
    const q2 = quarterId(year, 2);
    const q3 = quarterId(year, 3);
    const q4 = quarterId(year, 4);
    return [
      proj(
        {
          name: "Drive Fulfillment - SPS Commerce - EDI 856",
          assignee: "Onur",
          category: "EDI",
          std: 1,
          okr: 0.15,
          notes: "Mostly Q2 design/build",
          phaseQuarters: {
            initiate: q2,
            mapping: q2,
            package: q2,
            adapt: q3,
            commence: q3,
            transition: q3,
          },
        },
        q2
      ),
      proj(
        {
          name: "Hydrofarm - Ares Sales EDI Project 943, 944",
          assignee: "Onur",
          category: "EDI",
          std: 2,
          okr: 0.1,
          notes: "Build in Q2, wrap Q3",
          phaseQuarters: {
            initiate: q2,
            mapping: q2,
            package: q2,
            adapt: q2,
            commence: q3,
            transition: q3,
          },
        },
        q2
      ),
      proj(
        {
          name: "Beautylish Netsuite Work Order Development",
          assignee: "Onur",
          category: "ERP",
          std: 0,
          cpx: 2,
          okr: 0.15,
          notes: "Heavy package in Q3",
          phaseQuarters: defaultPhaseQuarters(q3),
        },
        q3
      ),
      proj(
        {
          name: "Paleovalley - Acumatica Integration Project",
          assignee: "Uygar",
          category: "ERP",
          std: 0,
          cpx: 4,
          dependency: "Moderate",
          mapping: "Moderate",
          erpCutover: true,
          okr: 0.2,
          notes: "Design Q2, go-live Q3",
          phaseQuarters: {
            initiate: q2,
            mapping: q2,
            package: q2,
            adapt: q3,
            commence: q3,
            transition: q3,
          },
        },
        q2
      ),
      proj(
        {
          name: "KSP <> SPS Commerce EDI (850 & 856)",
          assignee: "Uygar",
          category: "EDI",
          std: 2,
          okr: 0.15,
          notes: "Q3 design-heavy",
          phaseQuarters: {
            initiate: q3,
            mapping: q3,
            package: q4,
            adapt: q4,
            commence: q4,
            transition: q4,
          },
        },
        q3
      ),
      proj(
        {
          name: "Priority Fulfillment - ApparelMagic Custom",
          assignee: "Cihan",
          category: "ERP",
          std: 0,
          cpx: 3,
          okr: 0.2,
          notes: "Spanning Q2–Q3",
          phaseQuarters: {
            initiate: q2,
            mapping: q2,
            package: q3,
            adapt: q3,
            commence: q3,
            transition: q3,
          },
        },
        q2
      ),
      proj(
        {
          name: "Apparel Magic - Generic Integration",
          assignee: "Cihan",
          type: "Generic",
          category: "ERP",
          std: 4,
          okr: 0.15,
          notes: "Full lifecycle in Q3",
          phaseQuarters: defaultPhaseQuarters(q3),
        },
        q3
      ),
      proj(
        {
          name: "ONELIVE - Sage Intacct - Billing Integration",
          assignee: "Onur",
          category: "ERP",
          std: 1,
          okr: 0.05,
          notes: "Early Q4 start",
          phaseQuarters: defaultPhaseQuarters(q4),
        },
        q4
      ),
    ];
  }

  /** Onur Integrations Team Tasks, Jan–13 Oct 2026, leave excluded. Hours sit on each quarter. */
  function onurTeamTaskProjects() {
    const rows = window.ONUR_TEAM_TASKS_2026;
    if (!Array.isArray(rows)) return [];
    return rows.map((row, index) => {
      const hours = {};
      Object.keys(row.hours || {}).forEach((q) => {
        hours[q] = n(row.hours[q]);
      });
      return proj(
        {
          id: "tt-onur-" + String(index + 1).padStart(3, "0"),
          name: row.name,
          assignee: "Onur",
          type: "Other",
          status: "InProgress",
          category: "Other",
          std: 0,
          cpx: 0,
          ins: 0,
          premiumHours: 0,
          hoursByQuarter: hours,
          notes: "Integrations Team Tasks · " + (row.topic || "General & Unspecified"),
        },
        "Q3 2026"
      );
    });
  }

  /** Integration-template projects with September or October 2026 activity. */
  function integrationTemplateProjects() {
    const rows = window.INTEGRATION_PROJECTS_SEP_OCT_2026;
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
      const hours = {};
      const byMonth = {};
      const assignee = normalizeAssignee(row.assignee);
      const planStart = row.planStart || "";
      const planDue = row.planDue || "";
      const phaseDues = (window.PHASE_DUE_DATES_2026 || {})[String(row.id)] || null;
      const phaseQuarters =
        quartersFromPhaseDueDates(
          phaseDues,
          phaseQuartersFromPlan(planStart, planDue, "Q3 2026")
        ) || phaseQuartersFromPlan(planStart, planDue, "Q3 2026");
      return proj(
        {
          id: "rl-" + row.id,
          name: row.name,
          assignee,
          type: row.type || "Other",
          status: row.status || "InProgress",
          category: row.category || "Other",
          std: n(row.std),
          cpx: n(row.cpx),
          ins: n(row.ins),
          premiumHours: n(row.premiumHours),
          planStart,
          planDue,
          phaseDueDates: phaseDues ? Object.assign({}, phaseDues) : undefined,
          hoursByQuarter: hours,
          hoursByMonth: byMonth,
          phaseQuarters,
          quarterFocus: "full",
          notes: [row.template, row.customer].filter(Boolean).join(" · "),
          compliance: {
            phase: row.status === "Complete" ? "Completed" : "Initiate",
            owner: assignee,
            inScope: true,
          },
        },
        phaseQuarters.package
      );
    });
  }

  function applyTemplateClassification(data) {
    if (!data || data.templateFlows2026 || !Array.isArray(data.projects)) return data;
    const byId = {};
    integrationTemplateProjects().forEach((project) => {
      byId[project.id] = project;
    });
    data.projects.forEach((project) => {
      const seed = byId[project.id];
      if (!seed) return;
      project.type = seed.type;
      project.std = n(seed.std);
      project.cpx = n(seed.cpx);
      project.ins = n(seed.ins);
      project.premiumHours = n(seed.premiumHours);
    });
    data.templateFlows2026 = true;
    return data;
  }

  /** EDI and transfer-order rows on this project are template UAT reviews, not built flows. */
  function applyLentifulFlowCorrection(data) {
    if (!data || data.lentifulFlowCorrection || !Array.isArray(data.projects)) return data;
    const project = data.projects.find((p) => p.id === "rl-1381445");
    if (project) project.std = 1;
    data.lentifulFlowCorrection = true;
    return data;
  }

  /** Std counts are Development subtasks, with SO / PO / TO CRUD grouped as one flow. */
  function applyDevelopmentSubtaskFlows(data) {
    if (!data || data.developmentSubtasks2026 || !Array.isArray(data.projects)) return data;
    const byId = {};
    integrationTemplateProjects().forEach((project) => {
      byId[project.id] = project;
    });
    data.projects.forEach((project) => {
      const seed = byId[project.id];
      if (!seed) return;
      project.std = n(seed.std);
      project.cpx = 0;
      project.ins = 0;
    });
    data.developmentSubtasks2026 = true;
    return data;
  }

  /** Place each Rocketlane project in the quarter of its own start and due dates. */
  function applyProjectPlanQuarters(data) {
    if (!data || data.projectPlanQuarters2026 || !Array.isArray(data.projects)) return data;
    const byId = {};
    integrationTemplateProjects().forEach((project) => {
      byId[project.id] = project;
    });
    data.projects.forEach((project) => {
      const seed = byId[project.id];
      if (!seed || !seed.planDue) return;
      project.planStart = seed.planStart;
      project.planDue = seed.planDue;
      project.phaseQuarters = Object.assign({}, seed.phaseQuarters);
      project.quarterFocus = "full";
    });
    data.projectPlanQuarters2026 = true;
    return data;
  }

  /**
   * Generic/Custom: spread calculated IMPACT hours across the plan timeline
   * (Initiate near start … Transition near due), not only the due-date quarter.
   */
  function applyPhaseTimelineSpread(data) {
    if (!data || data.phaseTimelineSpread2026 || !Array.isArray(data.projects)) return data;
    data.projects.forEach((project) => {
      if (!project.planStart && !project.planDue) return;
      if (project.type !== "Generic" && project.type !== "Custom") {
        if (isDirectHoursType(project.type)) {
          project.phaseQuarters = defaultPhaseQuarters(
            dateToQuarter(project.planDue || project.planStart, "Q3 2026")
          );
        }
        return;
      }
      project.phaseQuarters = phaseQuartersFromPlan(
        project.planStart,
        project.planDue,
        "Q3 2026"
      );
      project.quarterFocus = "full";
    });
    data.phaseTimelineSpread2026 = true;
    return data;
  }

  /** Place the six IMPACT phases across the quarters that actually have allocations. */
  function phaseQuartersAcross(quarters) {
    const list = (quarters || []).slice().sort((a, b) => {
      const left = parseQuarter(a);
      const right = parseQuarter(b);
      return left.year - right.year || left.q - right.q;
    });
    if (!list.length) return null;
    const result = {};
    const last = list.length - 1;
    const phaseLast = PHASE_KEYS.length - 1;
    PHASE_KEYS.forEach((key, index) => {
      result[key] = list[Math.round((index * last) / phaseLast)];
    });
    return result;
  }

  function allocationQuartersFor(project) {
    const map = window.ALLOCATION_TIMELINE_2026 || {};
    const id = String(project.id || "").replace(/^rl-/, "");
    const quarters = map[id];
    return Array.isArray(quarters) && quarters.length ? quarters : null;
  }

  /** Generic/Custom flow hours follow Rocketlane resource allocations, including October work past the project due date. */
  function applyAllocationPhaseQuarters(data) {
    if (!data || data.allocationPhaseQuarters2026 || !Array.isArray(data.projects)) return data;
    data.projects.forEach((project) => {
      if (project.type !== "Generic" && project.type !== "Custom") return;
      if (!hasFlowEstimate(project)) return;
      const quarters = allocationQuartersFor(project);
      const spread = quarters && phaseQuartersAcross(quarters);
      if (!spread) return;
      project.phaseQuarters = spread;
      project.quarterFocus = "full";
      project.allocationQuarters = quarters.slice();
    });
    data.allocationPhaseQuarters2026 = true;
    return data;
  }

  /** Generic/Custom hours follow each Rocketlane phase due date, not the project due date. */
  function applyPhaseDueQuarters(data) {
    if (!data || data.phaseDueQuarters2026 || !Array.isArray(data.projects)) return data;
    data.projects.forEach((project) => {
      if (project.type !== "Generic" && project.type !== "Custom") return;
      const dues = phaseDueDatesFor(project);
      const spread = dues && quartersFromPhaseDueDates(dues, project.phaseQuarters);
      if (!spread) return;
      project.phaseQuarters = spread;
      project.phaseDueDates = Object.assign({}, dues);
      project.quarterFocus = "full";
    });
    data.phaseDueQuarters2026 = true;
    return data;
  }

  /** Workflow estimates replace logged month hours. Month cells stay blank while a flow count is set. */
  function clearMonthHoursForFlows(p) {
    if (!hasFlowEstimate(p)) return;
    p.hoursByMonth = {};
    p.hoursByQuarter = {};
  }

  function applyClearFlowMonthHours(data) {
    if (!data || data.flowMonthHoursCleared2026 || !Array.isArray(data.projects)) return data;
    data.projects.forEach(clearMonthHoursForFlows);
    data.flowMonthHoursCleared2026 = true;
    return data;
  }

  /** Timesheet months are not imported. Hours already stored on a project stay. */
  function applyPremiumMonthHours(data) {
    if (!data || data.premiumMonthHours2026) return data;
    data.premiumMonthHours2026 = true;
    return data;
  }

  /** Timesheet months are not imported. Hours already stored on a project stay. */
  function applyFullYearMonthHours(data) {
    if (!data || data.fullYearMonthHours2026) return data;
    data.fullYearMonthHours2026 = true;
    return data;
  }

  function blankOkrPhases(values) {
    const phases = {};
    OKR_PHASE_KEYS.forEach((key) => {
      phases[key] = Math.max(0, Math.min(100, n(values && values[key])));
    });
    return phases;
  }

  function okrProgressSnapshot(projectId) {
    const source = window.OKR_PROGRESS_2026 || {};
    const row = source[String(projectId || "").replace(/^rl-/, "")];
    return row && typeof row === "object" ? blankOkrPhases(row.phases || row) : blankOkrPhases();
  }

  function okrProjectType(project) {
    if (project && project.type === "Premium API Support") return "API Support";
    if (project && (project.type === "Other" || project.type === "Misc")) return "Misc";
    return "Integration";
  }

  function okrObjectiveForProject(project) {
    return project && (project.type === "Other" || project.type === "Misc")
      ? "Operational Excellence"
      : "Activated ARR";
  }

  function okrRow(overrides) {
    return Object.assign(
      {
        id: "okr-" + uid(),
        quarter: "Q4 2026",
        objective: "Activated ARR",
        keyResult: "New key result",
        details: "",
        goal: 100,
        achievementOverride: null,
        weight: 0,
        feedback: "",
        managerReview: "",
        projectType: "Integration",
        owner: "Unassigned",
        confidence: "Not set",
        rocketlaneProjectId: "",
        evidence: "",
        phases: blankOkrPhases(),
        phaseOverrides: {},
        syncSource: "Manual",
        syncedAt: "",
      },
      overrides || {},
      {
        phases: blankOkrPhases(overrides && overrides.phases),
        phaseOverrides: Object.assign({}, overrides && overrides.phaseOverrides),
      }
    );
  }

  function sampleOkrRows() {
    const rows = [
      ["Activated ARR", "Develop MS Dynamics Integration for RXO", "* Analyse customization requirements\n* Develop and test customization requirements\n* Sign off from the customer", 10, "Integration", ""],
      ["Activated ARR", "Analyse and Design Put to Light Integration for Radial", "* Communicate gaps with Product and Operations\n* Design the integration", 5, "Integration", "1393067"],
      ["MindCloud Integration Development", "Develop SPS Commerce Integration", "Design, develop, validate and document the integration in MindCloud", 5, "Integration", "1503530"],
      ["Activated ARR", "Audit Integration Improvements for existing Integrations", "Document existing integrations in detail and prioritize improvements", 10, "Misc", ""],
      ["MindCloud Integration Development", "Paccurate Embedded UI Development", "", 5, "Integration", "1423385"],
      ["Activated ARR", "Develop Receiving Report & Purchase Order Document Email Integration for Armstrong", "", 10, "Integration", ""],
      ["Activated ARR", "Scale Value Ops with AI", "Collaborate with Tech to incorporate the Integration Agent with Logiwa IO; review and improve other AI agents; add auditors to current agents.", 5, "Misc", ""],
      ["Activated ARR", "Create Embedded Self-Service Integration Rollout", "Amazon Vendor Central, Amazon Buy Shipping, Netsuite, and Veeqo", 10, "Integration", ""],
      ["Training", "Integration Workshop for Support Team", "", 5, "Training", ""],
      ["Activated ARR", "Develop Opex Integration for Fulfillment Australia", "", 10, "Integration", ""],
      ["Activated ARR", "Develop Barcode Parsing Integration for NCW", "", 10, "Integration", ""],
      ["Activated ARR", "Standard SAP Integration Analysis", "", 5, "Integration", ""],
      ["Activated ARR", "Develop Netsuite Item Fulfillment Integration for Team01", "* Analyse customization requirements\n* Develop and test customization requirements\n* Sign off from the customer", 10, "Integration", ""],
    ];
    return rows.map(([objective, keyResult, details, weight, projectType, projectId]) => {
      const linked = projectId
        ? integrationTemplateProjects().find((project) => project.id === "rl-" + projectId)
        : null;
      return okrRow({
        objective,
        keyResult,
        details,
        weight,
        projectType,
        owner: linked ? normalizeAssignee(linked.assignee) : "Unassigned",
        rocketlaneProjectId: projectId,
        phases: projectId ? okrProgressSnapshot(projectId) : blankOkrPhases(),
        syncSource: projectId ? "Rocketlane snapshot" : "Manual",
        syncedAt:
          projectId && window.OKR_PROGRESS_2026 && window.OKR_PROGRESS_2026[projectId]
            ? window.OKR_PROGRESS_2026[projectId].syncedAt || ""
            : "",
      });
    });
  }

  function ensureOkrState(data) {
    if (!data.okr || typeof data.okr !== "object") {
      data.okr = { quarter: "Q4 2026", rows: sampleOkrRows() };
    }
    if (!data.okr.quarter) data.okr.quarter = "Q4 2026";
    if (!data.okr.userFilter) data.okr.userFilter = "__all__";
    if (!Array.isArray(data.okr.rows)) data.okr.rows = [];
    data.okr.rows = data.okr.rows.map((row) => okrRow(row));
    if (!data.okrVersion) data.okrVersion = 1;
    return data;
  }

  function quarterForManualOkr(project, rates, fallback) {
    const worked = okrQuarterForOwnerProject(project, rates);
    if (worked) return worked;
    const candidates = [];
    if (fallback) candidates.push(fallback);
    [1, 2, 3, 4].forEach((quarterNumber) => candidates.push(quarterId(2026, quarterNumber)));
    for (const quarter of candidates) {
      if (phaseAssignedToQuarter(project, quarter)) return quarter;
    }
    return fallback || "Q4 2026";
  }

  /** Put a manually entered estimator project on the OKR sheet. An unlinked key result with the same name is reused. */
  function linkManualProjectToOkr(data, project, quarterOverride) {
    if (!project || project.source !== "manual" || project.complianceOnly || project.status === "Cancelled") {
      return false;
    }
    ensureOkrState(data);
    const projectId = String(project.id || "");
    if (!projectId) return false;
    const rates = data.rates || DEFAULT_RATES;
    const name = String(project.name || "").trim();
    let row = data.okr.rows.find((item) => String(item.rocketlaneProjectId || "") === projectId);
    const named =
      name && name.toLowerCase() !== "new project"
        ? data.okr.rows.find(
            (item) =>
              item !== row &&
              !item.rocketlaneProjectId &&
              String(item.keyResult || "").trim().toLowerCase() === name.toLowerCase()
          )
        : null;
    if (named) {
      if (row) data.okr.rows = data.okr.rows.filter((item) => item !== row);
      row = named;
      row.rocketlaneProjectId = projectId;
    }
    const quarter = quarterOverride || quarterForManualOkr(project, rates, data.quarter || data.okr.quarter);
    if (!row) {
      data.okr.rows.push(
        okrRow({
          quarter,
          objective: okrObjectiveForProject(project),
          keyResult: name || "New project",
          details: project.notes || "",
          projectType: okrProjectType(project),
          owner: normalizeAssignee(project.assignee),
          rocketlaneProjectId: projectId,
          phases: blankOkrPhases(),
          syncSource: "Estimator project",
          syncName: true,
        })
      );
      return true;
    }
    row.owner = normalizeAssignee(project.assignee);
    if (row.syncName || !row.keyResult || row.keyResult === "New project") {
      row.keyResult = name || row.keyResult;
    }
    if (!row.quarter) row.quarter = quarter;
    if (!row.syncSource || row.syncSource === "Manual") row.syncSource = "Estimator project";
    return false;
  }

  function applyOkrManualEstimatorProjects(data) {
    if (!data || data.okrManualEstimator2026 || !Array.isArray(data.projects)) return data;
    ensureOkrState(data);
    data.projects.forEach((project) => linkManualProjectToOkr(data, project));
    data.okr.rows.forEach((row) => {
      if (
        !row.rocketlaneProjectId &&
        String(row.keyResult || "") === "Integration Workshop for Support Team" &&
        normalizeAssignee(row.owner) === "Unassigned"
      ) {
        row.owner = "Cihan";
      }
    });
    data.okrManualEstimator2026 = true;
    return data;
  }

  /** Place each owner's Rocketlane project on the latest 2026 quarter where it has work. */
  function okrQuarterForOwnerProject(project, rates) {
    let chosen = "";
    [1, 2, 3, 4].forEach((quarterNumber) => {
      const quarter = quarterId(2026, quarterNumber);
      if (calcForQuarter(project, rates, quarter, null).hasWorkInQuarter) chosen = quarter;
    });
    return chosen;
  }

  function applyOkrOwnerProjects(data) {
    if (!data || data.okrOwnerProjects2026 || !Array.isArray(data.projects)) return data;
    ensureOkrState(data);
    const owners = new Set(["Uygar", "Onur", "John", "Cihan"]);
    const linked = new Set(
      data.okr.rows.map((row) => String(row.rocketlaneProjectId || "")).filter(Boolean)
    );
    data.projects.forEach((project) => {
      if (!String(project.id || "").startsWith("rl-") || project.status === "Cancelled") return;
      const owner = normalizeAssignee(project.assignee);
      if (!owners.has(owner)) return;
      const projectId = String(project.id).replace(/^rl-/, "");
      if (linked.has(projectId)) return;
      const quarter = okrQuarterForOwnerProject(project, data.rates || DEFAULT_RATES);
      if (!quarter) return;
      data.okr.rows.push(
        okrRow({
          quarter,
          objective: okrObjectiveForProject(project),
          keyResult: project.name,
          details: project.notes || "",
          weight: 0,
          projectType: okrProjectType(project),
          owner,
          rocketlaneProjectId: projectId,
          phases: okrProgressSnapshot(projectId),
          syncSource: "Rocketlane project",
        })
      );
      linked.add(projectId);
    });
    data.okrOwnerProjects2026 = true;
    return data;
  }

  /** Refresh Rocketlane phase progress on linked rows. Manual rows and typed fields stay. */
  function applyOkrRocketlaneRefresh(data) {
    if (!data || data.okrRocketlaneRefreshOct26) return data;
    ensureOkrState(data);
    const progress = window.OKR_PROGRESS_2026 || {};
    (data.okr.rows || []).forEach((row) => {
      const projectId = String(row.rocketlaneProjectId || "");
      if (!projectId || !progress[projectId] || !progress[projectId].phases) return;
      const snap = progress[projectId];
      OKR_PHASE_KEYS.forEach((key) => {
        if (row.phaseOverrides && row.phaseOverrides[key]) return;
        row.phases[key] = Math.max(0, Math.min(100, n(snap.phases[key])));
      });
      const overrideCount = OKR_PHASE_KEYS.filter((key) => row.phaseOverrides && row.phaseOverrides[key]).length;
      row.syncSource = `Rocketlane · ${n(snap.taskCount)} tasks${
        overrideCount ? ` · ${overrideCount} manual override${overrideCount === 1 ? "" : "s"}` : ""
      }`;
      if (snap.syncedAt) row.syncedAt = snap.syncedAt;
    });
    data.okrRocketlaneRefreshOct26 = true;
    return data;
  }

  /** Hours and phase dues end in Q3. The 2 Dec project due date is not a Q4 assignment. */
  function applyApparelMagicQuarters(data) {
    if (!data || data.apparelMagicQuarters2026 || !Array.isArray(data.projects)) return data;
    const project = data.projects.find((item) => item.id === "rl-1349780");
    if (project) {
      project.phaseQuarters = {
        initiate: "Q2 2026",
        mapping: "Q3 2026",
        package: "Q3 2026",
        adapt: "Q3 2026",
        commence: "Q3 2026",
        transition: "Q3 2026",
      };
      project.phaseDueDates = { commence: "2026-07-14", transition: "2026-09-25" };
      project.quarterFocus = "full";
    }
    if (data.okr && Array.isArray(data.okr.rows)) {
      data.okr.rows.forEach((row) => {
        if (String(row.rocketlaneProjectId || "") === "1349780" && row.quarter === "Q4 2026") {
          row.quarter = "Q3 2026";
        }
      });
    }
    data.apparelMagicQuarters2026 = true;
    return data;
  }

  function baselineProjects(year) {
    const integration = integrationTemplateProjects();
    if (integration.length) return integration;
    return sampleProjects(year).concat(onurTeamTaskProjects());
  }

  function applyRocketlanePortfolioAdditions(data) {
    if (!data || data.rocketlanePortfolioOct19 || !Array.isArray(data.projects)) return data;
    const additionIds = new Set(["rl-1172883", "rl-1486950"]);
    integrationTemplateProjects()
      .filter((project) => additionIds.has(project.id))
      .forEach((project) => {
        if (!data.projects.some((existing) => existing.id === project.id)) {
          data.projects.push(project);
        }
      });

    const cin7 = data.projects.find((project) => project.id === "rl-1172883");
    const legacyCin7 = data.projects.find((project) => project.id === "mc-cin7");
    if (cin7 && legacyCin7) {
      cin7.status = "Complete";
      cin7.assignee = legacyCin7.assignee;
      cin7.compliance = legacyCin7.compliance;
      cin7.notes = [cin7.notes, legacyCin7.notes].filter(Boolean).join(" · ");
      if (data.selectedId === legacyCin7.id) data.selectedId = cin7.id;
      if (data.selectedComplianceId === legacyCin7.id) data.selectedComplianceId = cin7.id;
      data.projects = data.projects.filter((project) => project.id !== legacyCin7.id);
    }
    data.rocketlanePortfolioOct19 = true;
    return data;
  }

  function applyOnAirDirectAddition(data) {
    if (!data || data.onAirDirectPortfolio2026 || !Array.isArray(data.projects)) return data;
    const seed = integrationTemplateProjects().find((project) => project.id === "rl-1314855");
    if (seed && !data.projects.some((project) => project.id === seed.id)) {
      data.projects.push(seed);
    }
    data.onAirDirectPortfolio2026 = true;
    return data;
  }

  /** Integration-template projects created in 2026 that were outside the earlier Sep–Oct window. */
  function applyCreated2026Projects(data) {
    if (!data || data.createdProjects2026 || !Array.isArray(data.projects)) return data;
    const ids = new Set([
      "rl-1034119",
      "rl-1035379",
      "rl-1047248",
      "rl-1049911",
      "rl-1051192",
      "rl-1051225",
      "rl-1051229",
      "rl-1085829",
      "rl-1085853",
      "rl-1111518",
      "rl-1166823",
      "rl-1176203",
      "rl-1178205",
      "rl-1212696",
      "rl-1281972",
      "rl-1299892",
      "rl-1318212",
      "rl-1335311",
      "rl-1409844",
      "rl-1503530",
    ]);
    integrationTemplateProjects()
      .filter((project) => ids.has(project.id))
      .forEach((project) => {
        if (!data.projects.some((existing) => existing.id === project.id)) {
          data.projects.push(project);
        }
      });
    data.createdProjects2026 = true;
    return data;
  }

  function applyJohnPortfolio(data) {
    if (!data || data.johnPortfolio2026 || !Array.isArray(data.projects)) return data;
    const billing = data.projects.find((project) => project.id === "rl-1439931");
    if (billing) {
      if (!billing.assignee || billing.assignee === "Unassigned") billing.assignee = "John";
      const compliance = ensureCompliance(billing);
      if (!compliance.owner || compliance.owner === "Unassigned") compliance.owner = "John";
      const months = ensureHoursByMonth(billing);
      if (!n(months["2026-08"])) months["2026-08"] = 3;
    }
    integrationTemplateProjects()
      .filter((project) => project.id === "rl-762726" || project.id === "rl-762746")
      .forEach((project) => {
        if (!data.projects.some((existing) => existing.id === project.id)) {
          data.projects.push(project);
        }
      });
    data.johnPortfolio2026 = true;
    return data;
  }

  const PIPELINE_PROJECT_MATCH = {
    Paleovalley: "rl-995132",
    "Hydrofarm - Super7 - Netsuite Project": "rl-1104966",
    "KSP Fulfillment - SPS Commerce EDI Project": "rl-1156938",
    "Badger Fulfillment - Antelopepets Phase 2 - Netsuite Project": "rl-1207984",
    "Beautylish - Work Order": "rl-1324285",
    "American Warehouse - CCT": "rl-1363071",
    "Badger - Lentiful - Cin7 Improvement": "rl-1381445",
    "Onelive - Sage Intacct": "rl-1387898",
  };

  function scoreToComplianceStatus(value) {
    if (value == null || value === "") return "Not started";
    const score = Number(value);
    if (score >= 1) return "Complete";
    if (score >= 0.5) return "In progress";
    return "Not started";
  }

  function applyPipelineRow(p, row) {
    if (row.status) p.status = row.status;
    if (row.owner) p.assignee = normalizeAssignee(row.owner);
    if (row.category) p.category = row.category;
    const compliance = ensureCompliance(p);
    if (COMPLIANCE_PHASES.includes(row.phase)) compliance.phase = row.phase;
    if (row.owner) compliance.owner = normalizeAssignee(row.owner);
    compliance.inScope = p.status !== "Cancelled";
    Object.keys(row.controls || {}).forEach((id) => {
      if (!compliance.controls[id]) return;
      compliance.controls[id].status = scoreToComplianceStatus(row.controls[id]);
    });
    if (row.designDue) compliance.controls.designDocument.dueDate = row.designDue;
    if (row.designDone) compliance.controls.designDocument.completedDate = row.designDone;
    const pipelineNote = ["Project Pipeline", row.partner, row.retailer].filter(Boolean).join(" · ");
    if (pipelineNote && !String(p.notes || "").includes("Project Pipeline")) {
      p.notes = [p.notes, pipelineNote].filter(Boolean).join(" · ");
    }
    return p;
  }

  function applyPipelineCompliance(data) {
    const rows = window.PIPELINE_COMPLIANCE_2026;
    if (!data || data.pipelineCompliance2026 || !Array.isArray(rows) || !rows.length) return data;
    if (!Array.isArray(data.projects)) data.projects = [];
    rows.forEach((row) => {
      const matchId = PIPELINE_PROJECT_MATCH[row.name];
      let project = matchId ? data.projects.find((p) => p.id === matchId) : null;
      if (project) return;
      const id = "pipe-" + row.id;
      if (data.projects.some((p) => p.id === id)) return;
      project = proj(
        {
          id,
          name: row.displayName || row.name,
          assignee: row.owner || "Unassigned",
          type: "Other",
          status: row.status || "InProgress",
          category: row.category || "Other",
          std: 0,
          cpx: 0,
          ins: 0,
          premiumHours: 0,
          hoursByQuarter: {},
          hoursByMonth: {},
          notes: "",
          complianceOnly: true,
          compliance: { inScope: true, phase: "Initiate", owner: row.owner || "Unassigned" },
        },
        "Q3 2026"
      );
      data.projects.push(project);
      applyPipelineRow(project, row);
    });
    data.pipelineCompliance2026 = true;
    return data;
  }

  function applyMcRow(project, row) {
    project.status = row.status || "Complete";
    const compliance = ensureCompliance(project);
    compliance.phase = COMPLIANCE_PHASES.includes(row.phase) ? row.phase : "Completed";
    compliance.inScope = true;
    if (row.owner) {
      const owner = normalizeAssignee(row.owner);
      project.assignee = owner;
      compliance.owner = owner;
    }
    ["projectPlan", "e2eTests", "closureSignoff", "timesheets"].forEach((id) => {
      if (!compliance.controls[id]) return;
      compliance.controls[id].status = scoreToComplianceStatus(row.controls && row.controls[id]);
    });
    const design = compliance.controls.designDocument;
    if (design) {
      if (row.designDue) design.dueDate = row.designDue;
      if (row.designDone) {
        design.completedDate = row.designDone;
        design.status = "Complete";
      } else {
        design.status = scoreToComplianceStatus(row.controls && row.controls.designDocument);
      }
    }
    ["designSignoff", "uatTests", "testSignoff", "statusCalls"].forEach((id) => {
      if (compliance.controls[id]) compliance.controls[id].status = "N/A";
    });
    const bits = ["MC tracker"];
    if (row.engineer) bits.push(`Engineer ${row.engineer}`);
    if (row.testEnvironment === "No") bits.push("No test environment");
    if (Number(row.accountSetup) >= 1) bits.push("Account setup complete");
    if (row.notes) bits.push(row.notes);
    if (!String(project.notes || "").includes("MC tracker")) {
      project.notes = [project.notes, bits.join(" · ")].filter(Boolean).join(" · ");
    }
    return project;
  }

  function applyMcCompliance(data) {
    const rows = window.MC_COMPLIANCE_2026;
    if (!data || data.mcCompliance2026 || !Array.isArray(rows) || !rows.length) return data;
    if (!Array.isArray(data.projects)) data.projects = [];
    rows.forEach((row) => {
      if (row.matchId && data.projects.some((p) => p.id === row.matchId)) return;
      const id = "mc-" + row.id;
      if (data.projects.some((p) => p.id === id)) return;
      const project = proj(
        {
          id,
          name: row.name,
          assignee: row.owner || "Unassigned",
          type: "Other",
          status: "Complete",
          category: "ERP",
          source: "manual",
          std: 0,
          cpx: 0,
          ins: 0,
          premiumHours: 0,
          hoursByQuarter: {},
          hoursByMonth: {},
          notes: "",
          complianceOnly: true,
          compliance: {
            inScope: true,
            phase: "Completed",
            owner: row.owner || "Unassigned",
          },
        },
        "Q3 2026"
      );
      data.projects.push(project);
      applyMcRow(project, row);
    });
    data.mcCompliance2026 = true;
    return data;
  }

  function mergeOnurTeamTasks(data) {
    if (!data || data.onurTeamTasks2026) return data;
    const extra = onurTeamTaskProjects();
    if (!extra.length) return data;
    if (!Array.isArray(data.projects)) data.projects = [];
    const ids = new Set(data.projects.map((p) => p.id));
    extra.forEach((p) => {
      if (!ids.has(p.id)) data.projects.push(p);
    });
    data.onurTeamTasks2026 = true;
    return data;
  }

  /** Drop Team Task projects that are no longer in the source list. */
  function pruneOnurTeamTasks(data) {
    const extra = onurTeamTaskProjects();
    if (!extra.length || !data || !Array.isArray(data.projects)) return data;
    const ids = new Set(extra.map((p) => p.id));
    data.projects = data.projects.filter(
      (p) => !String(p.id || "").startsWith("tt-onur-") || ids.has(p.id)
    );
    return data;
  }

  function calcLifecycle(p, rates) {
    if (p.status === "Cancelled") {
      return {
        totalSP: 0,
        periodWeightSP: 0,
        phases: zeroPhases(),
        deliveryHours: 0,
        meetingsHours: 0,
        meetingPlan: { hours: 0, mode: "none", calls: 0, kickoff: 0, weeks: null },
        estimatedHours: 0,
        isDirectHours: false,
      };
    }

    const directHours = isDirectHoursType(p.type);
    const monthlyOnly = !directHours && !hasFlowEstimate(p);
    let totalSP =
      (LOOKUPS.typeBase[p.type] || 0) +
      (LOOKUPS.categoryWeight[p.category] || 0) +
      n(p.std) * LOOKUPS.flowSP.Standard +
      n(p.cpx) * LOOKUPS.flowSP.Complex +
      n(p.ins) * LOOKUPS.flowSP.Insane +
      (LOOKUPS.dependency[p.dependency] || 0) +
      (LOOKUPS.mapping[p.mapping] || 0) +
      (LOOKUPS.connection[p.connection] || 0);
    if (!directHours && !monthlyOnly) totalSP += LOOKUPS.effort[p.effort] || 0;

    // Premium / Misc: SP stays a complexity score (not × hours). Hours = entered total.
    // Work % uses hours, so a 20h package does not dominate a 70h delivery project.
    const periodWeightSP = totalSP;
    const phases = zeroPhases();

    if (monthlyOnly) {
      phases.package = totalQuarterHours(p);
    } else if (directHours) {
      phases.package = n(p.premiumHours);
    } else {
      const mig = p.effort === "Migration" ? rates.migrationPackageMultiplier : 1;
      const typeMult = typeHoursMultiplier(p.type, rates);
      const depMult = dependencyHoursMultiplier(p.dependency, rates);
      phases.initiate = rates.initiateFlat;
      phases.mapping =
        (n(p.std) * rates.mappingStandard +
          n(p.cpx) * rates.mappingComplex +
          n(p.ins) * rates.mappingInsane) *
        typeMult;
      phases.package =
        (n(p.std) * rates.packageStandard +
          n(p.cpx) * rates.packageComplex +
          n(p.ins) * rates.packageInsane) *
        mig *
        typeMult;
      phases.adapt =
        (n(p.std) + n(p.cpx) + n(p.ins)) * rates.adaptPerFlow * typeMult;
      phases.commence = p.erpCutover ? rates.commenceERP : rates.commenceFlat;
      phases.transition = rates.transitionFlat;
      // Dependency scales all IMPACT delivery hours; meetings apply after
      PHASE_KEYS.forEach((k) => {
        phases[k] *= depMult;
        if (!isPhaseActive(p, k)) phases[k] = 0;
      });
    }

    const deliveryHours = PHASE_KEYS.reduce((s, k) => s + phases[k], 0);
    const plan = meetingPlan(p, rates, deliveryHours);

    return {
      totalSP,
      periodWeightSP,
      phases,
      deliveryHours,
      meetingsHours: plan.hours,
      meetingPlan: plan,
      estimatedHours: deliveryHours + plan.hours,
      isDirectHours: directHours || monthlyOnly,
    };
  }

  function zeroPhases() {
    return {
      initiate: 0,
      mapping: 0,
      package: 0,
      adapt: 0,
      commence: 0,
      transition: 0,
    };
  }

  function emptyQuarterResult(life) {
    return {
      ...life,
      phaseHoursInQ: zeroPhases(),
      deliveryInQ: 0,
      meetingsInQ: 0,
      quarterHours: 0,
      quarterSP: 0,
      hasWorkInQuarter: false,
    };
  }

  /** Slice lifecycle into the selected quarter */
  function calcForQuarter(p, rates, quarter, month) {
    const life = calcLifecycle(p, rates);
    ensurePhaseQuarters(p, quarter);

    // Other hours are entered per quarter. Team Task topics keep imported dated hours.
    const monthOnly = !isDirectHoursType(p.type) && !hasFlowEstimate(p);
    const planned = planOverlapsQuarter(p, quarter);
    const enteredHere = quarterHoursOf(p, quarter) > 0;
    if (planned === false && !phaseAssignedToQuarter(p, quarter) && !enteredHere) {
      return emptyQuarterResult(life);
    }
    if (isDirectHoursType(p.type) && !p.useActualByQuarter) {
      const monthApplies =
        month && monthsInQuarter(quarter).some((item) => item.month === month);
      const quarterHours = directHoursInQuarter(p, quarter, monthApplies ? month : 0);
      const phaseHoursInQ = zeroPhases();
      phaseHoursInQ.package = quarterHours;
      return {
        ...life,
        phaseHoursInQ,
        deliveryInQ: quarterHours,
        meetingsInQ: 0,
        quarterHours,
        quarterSP: quarterHours > 0 ? life.totalSP : 0,
        hasWorkInQuarter: quarterHours > 0 || (planned === true && !monthApplies),
      };
    }
    if (monthOnly || (isDirectHoursType(p.type) && p.useActualByQuarter)) {
      const monthApplies =
        month && monthsInQuarter(quarter).some((item) => item.month === month);
      const useDatedActuals = isDirectHoursType(p.type) && p.useActualByQuarter;
      let quarterHours = useDatedActuals
        ? n(p.actualByQuarter?.[quarter])
        : quarterHoursOf(p, quarter);
      if (monthApplies) {
        quarterHours = useDatedActuals
          ? quarterHours * monthShareOfQuarter(quarter, month)
          : monthHoursOf(p, parseQuarter(quarter).year, month);
      }
      const phaseHoursInQ = zeroPhases();
      phaseHoursInQ.package = quarterHours;
      const quarterSP =
        isQuarterHoursType(p.type) && life.estimatedHours > 0
          ? life.totalSP * (quarterHours / life.estimatedHours)
          : quarterHours > 0
            ? life.totalSP
            : 0;
      return {
        ...life,
        phaseHoursInQ,
        deliveryInQ: quarterHours,
        meetingsInQ: 0,
        quarterHours,
        quarterSP,
        hasWorkInQuarter:
          (planned === true &&
            !month &&
            planDueInQuarter(p, quarter) &&
            phaseAssignedToQuarter(p, quarter)) ||
          quarterHours > 0,
      };
    }

    const phaseHoursInQ = {};
    let deliveryInQ = 0;
    PHASE_KEYS.forEach((k) => {
      const hrs = p.phaseQuarters[k] === quarter ? life.phases[k] : 0;
      phaseHoursInQ[k] = hrs;
      deliveryInQ += hrs;
    });

    const meetingsInQ =
      life.deliveryHours > 0
        ? life.meetingsHours * (deliveryInQ / life.deliveryHours)
        : 0;

    let quarterSP = 0;
    if (life.isDirectHours) {
      // Premium / Misc: full Total SP counts in the quarter where hours are assigned
      quarterSP = p.phaseQuarters.package === quarter ? life.totalSP : 0;
    } else if (life.deliveryHours > 0) {
      quarterSP = life.totalSP * (deliveryInQ / life.deliveryHours);
    }

    return addEnteredMonthHours(
      applyMonthSlice(
        {
          ...life,
          phaseHoursInQ,
          deliveryInQ,
          meetingsInQ,
          quarterHours: deliveryInQ + meetingsInQ,
          quarterSP,
          hasWorkInQuarter: deliveryInQ > 0 || quarterSP > 0,
        },
        quarter,
        month
      ),
      p,
      quarter,
      month
    );
  }

  function enteredMonthHours(p, quarter, month) {
    const monthApplies =
      month && monthsInQuarter(quarter).some((item) => item.month === month);
    if (monthApplies) return monthHoursOf(p, parseQuarter(quarter).year, month);
    if (!isQuarterHoursType(p.type) && !quarterHasMonthHours(p, quarter)) return 0;
    return quarterHoursOf(p, quarter);
  }

  function addEnteredMonthHours(result, p, quarter, month) {
    if (isDirectHoursType(p.type)) return result;
    if (hasFlowEstimate(p) && p.source !== "manual") return result;
    const extra = enteredMonthHours(p, quarter, month);
    if (!extra) return result;
    return {
      ...result,
      phaseHoursInQ: {
        ...result.phaseHoursInQ,
        package: n(result.phaseHoursInQ.package) + extra,
      },
      deliveryInQ: result.deliveryInQ + extra,
      quarterHours: result.quarterHours + extra,
      hasWorkInQuarter: true,
    };
  }

  function applyMonthSlice(result, quarter, month) {
    const share = monthShareOfQuarter(quarter, month);
    if (share === 1) return result;
    const phaseHoursInQ = {};
    PHASE_KEYS.forEach((key) => {
      phaseHoursInQ[key] = result.phaseHoursInQ[key] * share;
    });
    const quarterHours = result.quarterHours * share;
    const quarterSP = result.quarterSP * share;
    return {
      ...result,
      phaseHoursInQ,
      deliveryInQ: result.deliveryInQ * share,
      meetingsInQ: result.meetingsInQ * share,
      quarterHours,
      quarterSP,
      hasWorkInQuarter: quarterHours > 0 || quarterSP > 0,
    };
  }

  let publishedRocketlaneSyncChanged = false;

  function addPublishedRocketlaneProjects(data) {
    const sync = window.ROCKETLANE_SYNC;
    const incoming = sync && Array.isArray(sync.projects) ? sync.projects : [];
    if (!incoming.length || !data) return false;
    if (!Array.isArray(data.projects)) data.projects = [];
    let changed = false;
    incoming.forEach((project) => {
      if (!project || !project.id) return;
      const existing = data.projects.find((item) => item.id === project.id);
      if (!existing) {
        const copy = JSON.parse(JSON.stringify(project));
        copy.hoursByMonth = {};
        copy.hoursByQuarter = {};
        data.projects.push(copy);
        changed = true;
        return;
      }
      if (project.updateFlowCount && existing.flowCountFromTasks !== false && n(existing.std) !== n(project.std)) {
        existing.std = n(project.std);
        existing.cpx = 0;
        existing.ins = 0;
        existing.flowCountFromTasks = true;
        changed = true;
      }
    });
    return changed;
  }

  function addPublishedRocketlaneOkrRows(data) {
    const sync = window.ROCKETLANE_SYNC;
    const incoming = sync && Array.isArray(sync.okrRows) ? sync.okrRows : [];
    if (!incoming.length || !data) return false;
    ensureOkrState(data);
    let changed = false;
    incoming.forEach((row) => {
      const linkId = String(row && row.rocketlaneProjectId || "");
      if (!linkId) return;
      if (data.okr.rows.some((item) => String(item.rocketlaneProjectId || "") === linkId)) return;
      data.okr.rows.push(JSON.parse(JSON.stringify(row)));
      changed = true;
    });
    return changed;
  }

  function applyPublishedRocketlaneOkr(data) {
    const sync = window.ROCKETLANE_SYNC;
    const phases = sync && sync.okrPhases;
    if (!data || !phases) return false;
    ensureOkrState(data);
    let changed = false;
    (data.okr.rows || []).forEach((row) => {
      const projectId = String(row.rocketlaneProjectId || "");
      const snap = phases[projectId] || phases[projectId.split("~")[0]];
      if (!projectId || !snap || !snap.phases) return;
      const project = data.projects.find(
        (item) => String(item.id) === projectId || String(item.id) === "rl-" + projectId
      );
      if (!project || !String(project.id).startsWith("rl-")) return;
      if (row.syncedAt && snap.syncedAt && String(row.syncedAt) >= String(snap.syncedAt)) return;
      if (!row.phases) row.phases = blankOkrPhases();
      if (!row.phaseOverrides) row.phaseOverrides = {};
      let phaseChanged = false;
      OKR_PHASE_KEYS.forEach((key) => {
        if (row.phaseOverrides[key]) return;
        const next = Math.max(0, Math.min(100, n(snap.phases[key])));
        if (n(row.phases[key]) !== next) {
          row.phases[key] = next;
          phaseChanged = true;
        }
      });
      if (!phaseChanged) return;
      const overrideCount = OKR_PHASE_KEYS.filter((key) => row.phaseOverrides[key]).length;
      row.syncSource = `Rocketlane · ${n(snap.taskCount)} tasks${
        overrideCount ? ` · ${overrideCount} manual override${overrideCount === 1 ? "" : "s"}` : ""
      }`;
      if (snap.syncedAt) row.syncedAt = snap.syncedAt;
      changed = true;
    });
    return changed;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let data = raw ? JSON.parse(raw) : null;
      if (window.LOCAL_SNAPSHOT && (!data || data.localTransferId !== LOCAL_TRANSFER_ID)) {
        data = JSON.parse(JSON.stringify(window.LOCAL_SNAPSHOT));
        data.localTransferId = LOCAL_TRANSFER_ID;
      }
      if (!data) return null;
      if (!data.rates) data.rates = { ...DEFAULT_RATES };
      else data.rates = { ...DEFAULT_RATES, ...data.rates };
      // Migrate to Generic-base rates + Type hour multipliers
      if ((data.ratesVersion || 1) < 4) {
        [
          "mappingStandard",
          "mappingComplex",
          "mappingInsane",
          "packageStandard",
          "packageComplex",
          "packageInsane",
          "adaptPerFlow",
          "typeHoursGeneric",
          "typeHoursOther",
          "typeHoursCustom",
        ].forEach((key) => {
          data.rates[key] = DEFAULT_RATES[key];
        });
        data.ratesVersion = 4;
      }
      // Calibrate Package to the observed per-workflow median while preserving
      // Standard / Complex / Insane multipliers (1× / 2× / 3×).
      if ((data.ratesVersion || 1) < 5) {
        ["packageStandard", "packageComplex", "packageInsane"].forEach((key) => {
          data.rates[key] = DEFAULT_RATES[key];
        });
        data.ratesVersion = 5;
      }
      // Corrected Onur CSV: quarter-hour rows are real hours, not 10×.
      // Generic medians — Mapping 1.3, Package 3.9, Adapt 2.1. Custom ×1.15.
      if ((data.ratesVersion || 1) < 6) {
        [
          "mappingStandard",
          "mappingComplex",
          "mappingInsane",
          "packageStandard",
          "packageComplex",
          "packageInsane",
          "adaptPerFlow",
          "typeHoursOther",
          "typeHoursCustom",
        ].forEach((key) => {
          data.rates[key] = DEFAULT_RATES[key];
        });
        data.ratesVersion = 6;
      }
      if (!data.year) data.year = 2026;
      if (!data.quarter) data.quarter = quarterId(data.year, 3);
      data.month = n(data.month);
      if (data.month < 1 || data.month > 12) data.month = 0;
      if (!data.userFilter) data.userFilter = "__all__";
      if (!data.uiMode) data.uiMode = "quick";
      if (!data.uiTab) data.uiTab = "estimator";
      if (!data.complianceFilters || typeof data.complianceFilters !== "object") {
        data.complianceFilters = { status: "Scored", owner: "All", phase: "All", source: "All" };
      }
      if (!data.complianceFilters.source) data.complianceFilters.source = "All";
      if (n(data.complianceVersion) < 1) {
        data.complianceFilters.status = "Scored";
        data.complianceVersion = 1;
      }
      if (!data.selectedComplianceId) data.selectedComplianceId = null;
      if (!Array.isArray(data.projects)) data.projects = sampleProjects(data.year);
      if (data.portfolioSource !== PORTFOLIO_SOURCE && integrationTemplateProjects().length) {
        const ids = new Set(data.projects.map((project) => project.id));
        integrationTemplateProjects().forEach((project) => {
          if (!ids.has(project.id)) data.projects.push(project);
        });
        data.portfolioSource = PORTFOLIO_SOURCE;
        data.onurTeamTasks2026 = true;
      } else {
        mergeOnurTeamTasks(data);
        pruneOnurTeamTasks(data);
      }
      if (addPublishedRocketlaneProjects(data)) publishedRocketlaneSyncChanged = true;
      data.projects.forEach((p) => {
        p.assignee = normalizeAssignee(p.assignee);
        if (!p.id) p.id = uid();
        if (!p.quarterFocus) p.quarterFocus = "full";
        ensurePhaseQuarters(p, data.quarter);
        ensureCompliance(p);
        migrateImportedMonthHours(p);
      });
      applyPipelineCompliance(data);
      applyMcCompliance(data);
      applyRocketlanePortfolioAdditions(data);
      applyOnAirDirectAddition(data);
      applyCreated2026Projects(data);
      applyJohnPortfolio(data);
      applyTemplateClassification(data);
      applyLentifulFlowCorrection(data);
      applyDevelopmentSubtaskFlows(data);
      applyProjectPlanQuarters(data);
      applyPhaseTimelineSpread(data);
      applyAllocationPhaseQuarters(data);
      applyPhaseDueQuarters(data);
      applyClearFlowMonthHours(data);
      applyPremiumMonthHours(data);
      applyFullYearMonthHours(data);
      ensureOkrState(data);
      applyOkrOwnerProjects(data);
      applyOkrManualEstimatorProjects(data);
      applyOkrRocketlaneRefresh(data);
      if (addPublishedRocketlaneOkrRows(data)) publishedRocketlaneSyncChanged = true;
      if (applyPublishedRocketlaneOkr(data)) publishedRocketlaneSyncChanged = true;
      applyApparelMagicQuarters(data);
      return data;
    } catch {
      return null;
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  let state = load() || {
    year: 2026,
    quarter: quarterId(2026, 3),
    month: 0,
    rates: { ...DEFAULT_RATES },
    ratesVersion: RATES_VERSION,
    projects: baselineProjects(2026),
    portfolioSource: PORTFOLIO_SOURCE,
    onurTeamTasks2026: true,
    selectedId: null,
    userFilter: "__all__",
    uiMode: "quick",
    uiTab: "estimator",
    complianceFilters: { status: "Scored", owner: "All", phase: "All", source: "All" },
    complianceVersion: 1,
    selectedComplianceId: null,
    okr: { quarter: "Q4 2026", rows: sampleOkrRows() },
    okrVersion: 1,
  };
  applyOkrOwnerProjects(state);
  applyOkrManualEstimatorProjects(state);
  if (window.LOCAL_SNAPSHOT && state.localTransferId === LOCAL_TRANSFER_ID) {
    let storedTransferId = null;
    try {
      storedTransferId = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null").localTransferId;
    } catch (error) {
      storedTransferId = null;
    }
    if (storedTransferId !== LOCAL_TRANSFER_ID) save();
  }
  if (publishedRocketlaneSyncChanged) save();

  function isQuick() {
    return state.uiMode !== "full";
  }

  const els = {
    yearInput: document.getElementById("yearInput"),
    quarterFilter: document.getElementById("quarterFilter"),
    monthFilter: document.getElementById("monthFilter"),
    userFilter: document.getElementById("userFilter"),
    sections: document.getElementById("portfolioSections"),
    userReport: document.getElementById("userReport"),
    reportQuarterLabel: document.getElementById("reportQuarterLabel"),
    phaseQuarterForm: document.getElementById("phaseQuarterForm"),
    quickFocusForm: document.getElementById("quickFocusForm"),
    phaseDetail: document.getElementById("phaseDetail"),
    detailTitle: document.getElementById("detailTitle"),
    detailHeading: document.getElementById("detailHeading"),
    ledeText: document.getElementById("ledeText"),
    portfolioHint: document.getElementById("portfolioHint"),
    configForm: document.getElementById("configForm"),
    configPanel: document.getElementById("configPanel"),
    statSPWrap: document.getElementById("statSPWrap"),
    btnModeQuick: document.getElementById("btnModeQuick"),
    btnModeFull: document.getElementById("btnModeFull"),
    statProjects: document.getElementById("statProjects"),
    statProjectsLabel: document.getElementById("statProjectsLabel"),
    statSP: document.getElementById("statSP"),
    statSPLabel: document.getElementById("statSPLabel"),
    statHours: document.getElementById("statHours"),
    statHoursLabel: document.getElementById("statHoursLabel"),
    statCapacity: document.getElementById("statCapacity"),
    statCapacityNote: document.getElementById("statCapacityNote"),
    statUtilization: document.getElementById("statUtilization"),
    statActive: document.getElementById("statActive"),
    capacityQuarterLabel: document.getElementById("capacityQuarterLabel"),
    capacityChart: document.getElementById("capacityChart"),
    quarterChart: document.getElementById("quarterChart"),
    phaseChart: document.getElementById("phaseChart"),
    projectChart: document.getElementById("projectChart"),
    btnTabEstimator: document.getElementById("btnTabEstimator"),
    btnTabCompliance: document.getElementById("btnTabCompliance"),
    btnTabOkr: document.getElementById("btnTabOkr"),
    estimatorView: document.getElementById("estimatorView"),
    complianceView: document.getElementById("complianceView"),
    okrView: document.getElementById("okrView"),
    okrPortfolioScore: document.getElementById("okrPortfolioScore"),
    okrKeyResults: document.getElementById("okrKeyResults"),
    okrTotalWeight: document.getElementById("okrTotalWeight"),
    okrOnTrack: document.getElementById("okrOnTrack"),
    okrAtRisk: document.getElementById("okrAtRisk"),
    okrLinked: document.getElementById("okrLinked"),
    okrQuarterFilter: document.getElementById("okrQuarterFilter"),
    okrUserFilter: document.getElementById("okrUserFilter"),
    okrQuarterLabel: document.getElementById("okrQuarterLabel"),
    okrObjectiveSummary: document.getElementById("okrObjectiveSummary"),
    okrTable: document.getElementById("okrTable"),
    okrRlApiKey: document.getElementById("okrRlApiKey"),
    okrSyncStatus: document.getElementById("okrSyncStatus"),
    btnOkrAdd: document.getElementById("btnOkrAdd"),
    btnOkrAddProjects: document.getElementById("btnOkrAddProjects"),
    btnOkrSync: document.getElementById("btnOkrSync"),
    btnOkrExport: document.getElementById("btnOkrExport"),
    compliancePortfolioScore: document.getElementById("compliancePortfolioScore"),
    complianceGood: document.getElementById("complianceGood"),
    complianceWatch: document.getElementById("complianceWatch"),
    complianceRisk: document.getElementById("complianceRisk"),
    complianceCritical: document.getElementById("complianceCritical"),
    complianceExcluded: document.getElementById("complianceExcluded"),
    complianceStatusFilter: document.getElementById("complianceStatusFilter"),
    complianceOwnerFilter: document.getElementById("complianceOwnerFilter"),
    compliancePhaseFilter: document.getElementById("compliancePhaseFilter"),
    complianceSourceFilter: document.getElementById("complianceSourceFilter"),
    rocketlanePicker: document.getElementById("rocketlanePicker"),
    rlApiKey: document.getElementById("rlApiKey"),
    rlSearch: document.getElementById("rlSearch"),
    rlSearchStatus: document.getElementById("rlSearchStatus"),
    rlSearchResults: document.getElementById("rlSearchResults"),
    complianceTable: document.getElementById("complianceTable"),
    complianceDetailTitle: document.getElementById("complianceDetailTitle"),
    complianceProfile: document.getElementById("complianceProfile"),
    complianceChecklist: document.getElementById("complianceChecklist"),
  };

  function optionList(values, selected) {
    return values
      .map(
        (v) =>
          `<option value="${escapeAttr(v)}"${v === selected ? " selected" : ""}>${escapeHtml(v)}</option>`
      )
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function fmt(nVal, digits = 1) {
    return Number(nVal || 0).toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function complianceStatusClass(status) {
    return String(status || "").toLowerCase().replace(/\s+/g, "-");
  }

  function safeEvidenceUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function applyTabChrome() {
    const complianceOpen = state.uiTab === "compliance";
    const okrOpen = state.uiTab === "okr";
    const estimatorOpen = !complianceOpen && !okrOpen;
    document.body.classList.toggle("tab-compliance", complianceOpen);
    document.body.classList.toggle("tab-okr", okrOpen);
    els.estimatorView.classList.toggle("hidden", !estimatorOpen);
    els.complianceView.classList.toggle("hidden", !complianceOpen);
    els.okrView.classList.toggle("hidden", !okrOpen);
    els.estimatorView.setAttribute("aria-hidden", String(!estimatorOpen));
    els.complianceView.setAttribute("aria-hidden", String(!complianceOpen));
    els.okrView.setAttribute("aria-hidden", String(!okrOpen));
    els.btnTabEstimator.classList.toggle("active", estimatorOpen);
    els.btnTabCompliance.classList.toggle("active", complianceOpen);
    els.btnTabOkr.classList.toggle("active", okrOpen);
    els.btnTabEstimator.setAttribute("aria-selected", String(estimatorOpen));
    els.btnTabCompliance.setAttribute("aria-selected", String(complianceOpen));
    els.btnTabOkr.setAttribute("aria-selected", String(okrOpen));
    if (complianceOpen) {
      els.ledeText.textContent =
        "Phase-aware project controls, evidence, overdue gates, and the next required action.";
    } else if (okrOpen) {
      els.ledeText.textContent =
        "Linked key results are weighted by allocated quarter hours divided by one person's quarter capacity. Result is achievement times that weight.";
    } else {
      els.ledeText.textContent =
        "Quick estimate: type, flows, assignee, quarter → hours and Work %.";
    }
  }

  function complianceRows() {
    return state.projects.map((p) => ({ p, result: complianceResult(p) }));
  }

  function renderCompliance() {
    const rows = complianceRows();
    const scored = rows.filter((row) => row.result.status !== "Excluded");
    const portfolioScore = scored.length
      ? Math.round(
          scored.reduce((sum, row) => sum + n(row.result.score), 0) / scored.length
        )
      : 0;
    els.compliancePortfolioScore.textContent = `${portfolioScore}%`;
    els.complianceGood.textContent = String(
      scored.filter((row) => row.result.status === "Compliant").length
    );
    els.complianceWatch.textContent = String(
      scored.filter((row) => row.result.status === "Watch").length
    );
    els.complianceRisk.textContent = String(
      scored.filter((row) => row.result.status === "At Risk").length
    );
    els.complianceCritical.textContent = String(
      scored.reduce((sum, row) => sum + row.result.criticalOverdue.length, 0)
    );
    els.complianceExcluded.textContent = String(rows.length - scored.length);
    els.compliancePortfolioScore.className =
      "stat-value " +
      (portfolioScore >= 90
        ? "metric-good"
        : portfolioScore >= 70
          ? "metric-warn"
          : "metric-danger");

    const filters = state.complianceFilters || {
      status: "Scored",
      owner: "All",
      phase: "All",
      source: "All",
    };
    if (!filters.source) filters.source = "All";
    const owners = [...new Set(rows.map((row) => ensureCompliance(row.p).owner || "Unassigned"))]
      .sort((a, b) => a.localeCompare(b));
    els.complianceStatusFilter.innerHTML = optionList(
      ["Scored", "At Risk", "Watch", "Compliant", "Excluded", "All"],
      filters.status || "Scored"
    );
    els.complianceOwnerFilter.innerHTML = optionList(["All", ...owners], filters.owner || "All");
    els.compliancePhaseFilter.innerHTML = optionList(
      ["All", ...COMPLIANCE_PHASES],
      filters.phase || "All"
    );
    els.complianceSourceFilter.innerHTML = optionList(
      ["All", "Rocketlane", "Manual"],
      filters.source
    );

    const priority = { "At Risk": 0, Watch: 1, Compliant: 2, Excluded: 3 };
    const visible = rows
      .filter((row) => {
        const compliance = ensureCompliance(row.p);
        const statusMatch =
          filters.status === "All" ||
          (filters.status === "Scored"
            ? row.result.status !== "Excluded"
            : row.result.status === filters.status);
        const ownerMatch = filters.owner === "All" || compliance.owner === filters.owner;
        const phaseMatch = filters.phase === "All" || compliance.phase === filters.phase;
        const sourceMatch =
          filters.source === "All" || projectSourceLabel(row.p) === filters.source;
        return statusMatch && ownerMatch && phaseMatch && sourceMatch;
      })
      .sort(
        (a, b) =>
          priority[a.result.status] - priority[b.result.status] ||
          n(a.result.score) - n(b.result.score) ||
          a.p.name.localeCompare(b.p.name)
      );

    if (!visible.some((row) => row.p.id === state.selectedComplianceId)) {
      state.selectedComplianceId = visible[0]?.p.id || null;
    }

    const groups =
      filters.source === "All"
        ? ["Rocketlane", "Manual"]
        : [filters.source];
    const body = groups
      .map((source) => {
        const groupRows = visible.filter((row) => projectSourceLabel(row.p) === source);
        if (!groupRows.length) return "";
        const band = `<tr class="source-band"><td colspan="9">${escapeHtml(source)} · ${groupRows.length}</td></tr>`;
        return (
          band +
          groupRows
            .map(({ p, result }) => {
              const compliance = ensureCompliance(p);
              return `<tr data-compliance-id="${escapeAttr(p.id)}"${
                p.id === state.selectedComplianceId ? ' class="selected"' : ""
              }>
                <td><strong>${escapeHtml(p.name)}</strong><span class="table-sub">${escapeHtml(
                  projectSourceLabel(p)
                )} · ${escapeHtml(p.status)}</span></td>
                <td>${escapeHtml(compliance.owner || "Unassigned")}</td>
                <td>${escapeHtml(compliance.phase)}</td>
                <td><span class="compliance-pill ${complianceStatusClass(result.status)}">${escapeHtml(
                  result.status
                )}</span></td>
                <td class="mono num">${result.score == null ? "—" : `${result.score}%`}</td>
                <td class="mono num">${result.complete}/${result.applicable}</td>
                <td class="mono num ${result.overdue.length ? "metric-danger" : ""}">${
                  result.overdue.length
                }</td>
                <td>${escapeHtml(result.nextAction)}</td>
                <td><button type="button" class="btn danger" data-compliance-del="${escapeAttr(
                  p.id
                )}">Delete</button></td>
              </tr>`;
            })
            .join("")
        );
      })
      .join("");

    els.complianceTable.innerHTML = body
      ? `<table class="compliance-table">
          <thead><tr>
            <th>Project</th><th>Owner</th><th>Phase</th><th>Status</th>
            <th>Score</th><th>Controls</th><th>Overdue</th><th>Next action</th><th></th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>`
      : '<p class="empty-state">No projects match these compliance filters.</p>';

    renderComplianceDetail(rows);
  }

  function renderComplianceDetail(rows) {
    const row = rows.find(({ p }) => p.id === state.selectedComplianceId);
    if (!row) {
      els.complianceDetailTitle.textContent = "Select a project.";
      els.complianceProfile.className = "compliance-profile empty-state";
      els.complianceProfile.textContent = "No project selected.";
      els.complianceChecklist.className = "compliance-checklist empty-state";
      els.complianceChecklist.textContent = "No project selected.";
      return;
    }

    const { p, result } = row;
    const compliance = ensureCompliance(p);
    els.complianceDetailTitle.textContent = `${p.name} · ${result.nextAction}`;
    els.complianceProfile.className = "compliance-profile";
    els.complianceProfile.innerHTML = `
      <div class="compliance-profile-score">
        <span class="compliance-score">${result.score == null ? "—" : `${result.score}%`}</span>
        <span class="compliance-pill ${complianceStatusClass(result.status)}">${escapeHtml(
          result.status
        )}</span>
      </div>
      <div class="compliance-profile-grid">
        <label>Compliance owner
          <input type="text" data-compliance-profile="owner" value="${escapeAttr(
            compliance.owner
          )}" />
        </label>
        <label>Current IMPACT phase
          <select data-compliance-profile="phase">${optionList(
            COMPLIANCE_PHASES,
            compliance.phase
          )}</select>
        </label>
        <label class="compliance-scope">
          <input type="checkbox" data-compliance-profile="inScope"${
            compliance.inScope ? " checked" : ""
          } />
          Included in compliance
        </label>
      </div>
      <div class="compliance-context">
        <span>Estimator assignee <strong>${escapeHtml(normalizeAssignee(p.assignee))}</strong></span>
        <span>Type <strong>${escapeHtml(p.type)}</strong></span>
        <span>Project status <strong>${escapeHtml(p.status)}</strong></span>
      </div>
      <div class="compliance-next-action">
        <span>Next required action</span>
        <strong>${escapeHtml(result.nextAction)}</strong>
      </div>`;

    els.complianceChecklist.className = "compliance-checklist";
    els.complianceChecklist.innerHTML = result.controls
      .map((control) => {
        const { definition, record } = control;
        const evidenceUrl = safeEvidenceUrl(record.evidence);
        const stateLabel = control.future
          ? "Not due"
          : control.excluded
            ? "N/A"
            : control.overdue
              ? "Overdue"
              : record.status;
        const rowClass = [
          "compliance-control",
          control.future ? "future" : "",
          control.overdue ? "overdue" : "",
          definition.critical ? "critical" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<article class="${rowClass}" data-control-id="${definition.id}">
          <div class="compliance-control-head">
            <div>
              <h3>${escapeHtml(definition.label)}</h3>
              <p>${escapeHtml(definition.description)}</p>
            </div>
            <div class="control-badges">
              ${definition.critical ? '<span class="control-tag">Critical</span>' : ""}
              <span class="control-tag">Due ${escapeHtml(definition.duePhase)}</span>
              <span class="control-state ${control.overdue ? "metric-danger" : ""}">${escapeHtml(
                stateLabel
              )}</span>
            </div>
          </div>
          <div class="compliance-control-fields">
            <label>Status
              <select data-compliance-control="${definition.id}" data-compliance-field="status">
                ${optionList(COMPLIANCE_STATUSES, record.status)}
              </select>
            </label>
            <label>Due date
              <input type="date" data-compliance-control="${definition.id}" data-compliance-field="dueDate" value="${escapeAttr(
                record.dueDate
              )}" />
            </label>
            <label>Completed
              <input type="date" data-compliance-control="${definition.id}" data-compliance-field="completedDate" value="${escapeAttr(
                record.completedDate
              )}" />
            </label>
            <label>Evidence URL
              <input type="text" data-compliance-control="${definition.id}" data-compliance-field="evidence" value="${escapeAttr(
                record.evidence
              )}" placeholder="https://…" />
            </label>
            <label class="control-notes">Notes
              <input type="text" data-compliance-control="${definition.id}" data-compliance-field="notes" value="${escapeAttr(
                record.notes
              )}" />
            </label>
            ${
              evidenceUrl
                ? `<a class="evidence-link" href="${escapeAttr(
                    evidenceUrl
                  )}" target="_blank" rel="noopener">Open evidence</a>`
                : ""
            }
          </div>
        </article>`;
      })
      .join("");
  }

  function computeAll() {
    return state.projects.filter((p) => !p.complianceOnly).map((p) => {
      ensurePhaseQuarters(p, state.quarter);
      return {
        p,
        c: calcForQuarter(p, state.rates, state.quarter, selectedMonth()),
        assignee: normalizeAssignee(p.assignee),
      };
    });
  }

  function groupByUser(computed) {
    const map = new Map();
    for (const row of computed) {
      const key = row.assignee;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.keys()]
      .sort((a, b) => {
        if (a === "Unassigned") return 1;
        if (b === "Unassigned") return -1;
        return a.localeCompare(b);
      })
      .map((k) => ({ user: k, rows: map.get(k) }));
  }

  function userTotals(rows) {
    const active = rows.filter((x) => x.p.status !== "Cancelled" && x.c.hasWorkInQuarter);
    return {
      projects: active.length,
      sp: active.reduce((s, x) => s + x.c.quarterSP, 0),
      hours: active.reduce((s, x) => s + x.c.quarterHours, 0),
      // Work % denominator = quarter hours (effort share), not SP×hours
      weight: active.reduce((s, x) => s + x.c.quarterHours, 0),
    };
  }

  function reportUsers(filter) {
    if (filter && filter !== "__all__") {
      return filter === "Unassigned" ? [] : [filter];
    }
    return ASSIGNEES.filter((user) => user !== "Unassigned");
  }

  function rowsForQuarter(quarter, filter, wholeQuarter) {
    const month = wholeQuarter ? 0 : selectedMonth();
    return state.projects
      .filter((p) => !p.complianceOnly)
      .map((p) => ({
        p,
        c: calcForQuarter(p, state.rates, quarter, month),
        assignee: normalizeAssignee(p.assignee),
      }))
      .filter(
        (row) =>
          row.p.status !== "Cancelled" &&
          row.c.hasWorkInQuarter &&
          (filter === "__all__" || row.assignee === filter)
      );
  }

  function renderDashboard(filter) {
    const users = reportUsers(filter);
    const personCapacity = selectedMonth()
      ? weekdaysInMonth(state.year, selectedMonth()) * 6
      : capacityHoursForQuarter(state.quarter);
    const selectedRows = rowsForQuarter(state.quarter, filter);
    const totalHours = selectedRows.reduce((sum, row) => sum + row.c.quarterHours, 0);
    const totalCapacity = users.length * personCapacity;
    const utilization = totalCapacity > 0 ? totalHours / totalCapacity : 0;

    els.statCapacity.textContent = `${fmt(totalCapacity, 0)} h`;
    els.statCapacityNote.textContent = `${selectedMonth() ? weekdaysInMonth(state.year, selectedMonth()) : weekdaysInQuarter(state.quarter)} weekdays × 6 h × ${users.length} ${users.length === 1 ? "person" : "people"}`;
    els.statUtilization.textContent = `${(utilization * 100).toFixed(1)}%`;
    els.statUtilization.className =
      "stat-value " + (utilization > 1 ? "metric-danger" : utilization >= 0.85 ? "metric-warn" : "metric-good");
    els.capacityQuarterLabel.textContent = periodName();

    const userRows = users.map((user) => {
      const hours = rowsForQuarter(state.quarter, user).reduce(
        (sum, row) => sum + row.c.quarterHours,
        0
      );
      return { user, hours, pct: personCapacity > 0 ? hours / personCapacity : 0 };
    });
    const unassignedHours = rowsForQuarter(state.quarter, "Unassigned").reduce(
      (sum, row) => sum + row.c.quarterHours,
      0
    );
    if ((filter === "__all__" || filter === "Unassigned") && unassignedHours > 0) {
      userRows.push({ user: "Unassigned", hours: unassignedHours, pct: 0, unassigned: true });
    }

    els.capacityChart.innerHTML =
      userRows
        .map((row) => {
          const width = row.unassigned ? 0 : Math.min(row.pct * 100, 100);
          const overflow = row.pct > 1 ? row.pct - 1 : 0;
          const tone = row.unassigned
            ? "unassigned"
            : row.pct > 1
              ? "over"
              : row.pct >= 0.85
                ? "near"
                : "available";
          return `<div class="capacity-row ${tone}">
            <div class="capacity-label"><strong>${escapeHtml(row.user)}</strong><span>${fmt(row.hours, 1)} / ${row.unassigned ? "—" : fmt(personCapacity, 0)} h</span></div>
            <div class="bar-track" role="img" aria-label="${escapeAttr(row.user)} capacity ${(row.pct * 100).toFixed(1)}%">
              <span class="bar-fill" style="width:${width.toFixed(1)}%"></span>
              ${overflow > 0 ? `<span class="bar-overflow">+${fmt(overflow * personCapacity, 1)} h</span>` : ""}
            </div>
            <strong class="capacity-pct">${row.unassigned ? "Assign" : `${(row.pct * 100).toFixed(1)}%`}</strong>
          </div>`;
        })
        .join("") || '<p class="empty-state">No capacity available for this filter.</p>';

    const quarterData = quartersForYear(state.year).map((quarter) => {
      const hours = rowsForQuarter(quarter, filter, true).reduce(
        (sum, row) => sum + row.c.quarterHours,
        0
      );
      const capacity = reportUsers(filter).length * capacityHoursForQuarter(quarter);
      return { quarter, hours, capacity, pct: capacity > 0 ? hours / capacity : 0 };
    });
    const maxQuarterHours = Math.max(...quarterData.map((item) => item.hours), 1);
    els.quarterChart.innerHTML = quarterData
      .map(
        (item) => `<div class="quarter-column${item.quarter === state.quarter ? " active" : ""}">
          <div class="quarter-bar-area">
            <span class="quarter-bar" style="height:${Math.max((item.hours / maxQuarterHours) * 100, item.hours > 0 ? 3 : 0).toFixed(1)}%"></span>
          </div>
          <strong>${escapeHtml(item.quarter.replace(` ${state.year}`, ""))}</strong>
          <span>${fmt(item.hours, 0)} h</span>
          <small>${(item.pct * 100).toFixed(1)}% cap.</small>
        </div>`
      )
      .join("");

    const phaseTotals = Object.fromEntries(PHASE_KEYS.map((key) => [key, 0]));
    selectedRows.forEach(({ c }) => {
      PHASE_KEYS.forEach((key) => {
        phaseTotals[key] += c.phaseHoursInQ[key];
      });
    });
    const maxPhase = Math.max(...Object.values(phaseTotals), 1);
    els.phaseChart.innerHTML = PHASE_KEYS.map(
      (key) => `<div class="phase-chart-row">
        <span>${escapeHtml(PHASE_LABELS[key])}</span>
        <div class="mini-track"><i style="width:${((phaseTotals[key] / maxPhase) * 100).toFixed(1)}%"></i></div>
        <strong>${fmt(phaseTotals[key], 1)} h</strong>
      </div>`
    ).join("");

    const topProjects = [...selectedRows]
      .sort((a, b) => b.c.quarterHours - a.c.quarterHours)
      .slice(0, 6);
    const maxProject = Math.max(...topProjects.map((row) => row.c.quarterHours), 1);
    els.projectChart.innerHTML =
      topProjects
        .map(
          ({ p, c, assignee }) => `<div class="project-chart-row">
            <div class="project-chart-label"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(assignee)}</span></div>
            <div class="mini-track"><i style="width:${((c.quarterHours / maxProject) * 100).toFixed(1)}%"></i></div>
            <strong>${fmt(c.quarterHours, 1)} h</strong>
          </div>`
        )
        .join("") || '<p class="empty-state">No project effort in this quarter.</p>';
  }

  function captureFocus() {
    const active = document.activeElement;
    if (!active) return null;
    const inSections = els.sections.contains(active);
    const inPhase = els.phaseQuarterForm.contains(active);
    const inQuick = els.quickFocusForm.contains(active);
    if (!inSections && !inPhase && !inQuick) return null;
    const tr = active.closest("tr[data-id]");
    return {
      scope: inQuick ? "quick" : inPhase ? "phase" : "row",
      id: tr ? tr.getAttribute("data-id") : state.selectedId,
      field:
        active.getAttribute("data-f") ||
        active.getAttribute("data-mhours") ||
        active.getAttribute("data-phase-q") ||
        active.getAttribute("data-qhours") ||
        active.getAttribute("data-focus"),
      start: active.selectionStart,
      end: active.selectionEnd,
    };
  }

  function restoreFocus(focus) {
    if (!focus || !focus.field) return;
    let el = null;
    if (focus.scope === "phase") {
      el =
        els.phaseQuarterForm.querySelector(`[data-phase-q="${CSS.escape(focus.field)}"]`) ||
        els.phaseQuarterForm.querySelector(`[data-qhours="${CSS.escape(focus.field)}"]`) ||
        els.phaseQuarterForm.querySelector(`[data-mhours="${CSS.escape(focus.field)}"]`);
    } else if (focus.scope === "quick") {
      el = els.quickFocusForm.querySelector(`[data-focus="${focus.field}"]`);
    } else if (focus.id) {
      const row = els.sections.querySelector(`tr[data-id="${CSS.escape(focus.id)}"]`);
      el = row
        ? row.querySelector(`[data-f="${CSS.escape(focus.field)}"]`) ||
          row.querySelector(`[data-mhours="${CSS.escape(focus.field)}"]`)
        : null;
    }
    if (!el) return;
    el.focus();
    if (typeof focus.start === "number" && el.setSelectionRange) {
      try {
        el.setSelectionRange(focus.start, focus.end);
      } catch (_) {}
    }
  }

  function setMonthHours(p, key, raw) {
    if (hasFlowEstimate(p) && p.source !== "manual") {
      clearMonthHoursForFlows(p);
      return;
    }
    const byMonth = ensureHoursByMonth(p);
    if (String(raw).trim() === "") delete byMonth[key];
    else byMonth[key] = n(raw);
    const match = String(key).match(/^(\d{4})-(\d{2})$/);
    if (!match) return;
    delete ensureHoursByQuarter(p)[quarterId(Number(match[1]), Math.ceil(Number(match[2]) / 3))];
  }

  function monthHoursInput(item, byMonth, title) {
    const raw = byMonth[item.key];
    const shown = raw == null || raw === "" ? "" : n(raw);
    const hint = title || item.label + " hours, added on top of the flow calculation.";
    return `<label class="month-cell"><span>${MONTH_SHORT[item.month - 1]}</span><input data-mhours="${escapeAttr(item.key)}" type="number" min="0" step="0.1" value="${shown}" title="${escapeAttr(hint)}" /></label>`;
  }

  function otherMonthCells(p) {
    const byMonth = ensureHoursByMonth(p);
    const tracked = isDirectHoursType(p.type);
    return monthsInQuarter(state.quarter)
      .map((item) => {
        const hint = tracked
          ? item.label + " hours from Rocketlane. Edit to override."
          : undefined;
        return `<td>${monthHoursInput(item, byMonth, hint)}</td>`;
      })
      .join("");
  }

  function okrHoursWeight(hours, quarter) {
    const capacity = capacityHoursForQuarter(quarter);
    if (!(hours > 0) || !(capacity > 0)) return null;
    return (hours / capacity) * 100;
  }

  function renderRow(p, c, teamHoursWeight, userHoursWeight) {
    const teamPct =
      teamHoursWeight > 0 && p.status !== "Cancelled" ? c.quarterHours / teamHoursWeight : 0;
    const userPct =
      userHoursWeight > 0 && p.status !== "Cancelled" ? c.quarterHours / userHoursWeight : 0;
    const selected = p.id === state.selectedId ? " selected" : "";
    const cancelled = p.status === "Cancelled" ? " cancelled" : "";
    const inactive = !c.hasWorkInQuarter && p.status !== "Cancelled" ? " row-inactive" : "";
    const directHours = isDirectHoursType(p.type);
    const weeksCell = directHours
      ? `<td class="mono num">—</td>`
      : `<td class="col-narrow"><input data-f="weeks" type="number" min="0" step="1" value="${p.weeks == null || p.weeks === "" ? "" : n(p.weeks)}" title="Project length in weeks. Meetings on the flow hours = (weeks − 2) × 0.5 h weekly calls + 1 h kickoff. Blank keeps the 20% overhead. Entered month hours are not marked up." /></td>`;
    const quarterTotalHours = calcForQuarter(p, state.rates, state.quarter, null).quarterHours;
    const okrShare = p.status === "Cancelled" ? null : okrHoursWeight(quarterTotalHours, state.quarter);
    const quarterCapacity = capacityHoursForQuarter(state.quarter);
    const okrCell = `<td class="mono num" title="${escapeAttr(
      okrShare == null
        ? "No allocated hours in this quarter"
        : `${fmt(quarterTotalHours, 1)} allocated hours of ${fmt(quarterCapacity, 0)} quarter hours`
    )}">${okrShare == null ? "—" : okrShare.toFixed(1) + "%"}</td>`;
    const quarterTotal = `<td class="mono num" title="Flow hours in this quarter plus entered month hours">${fmt(quarterTotalHours, 1)}</td>`;
    const monthCells = otherMonthCells(p);
    if (isQuick()) {
      const flowCells = directHours
        ? `<td class="col-narrow"><input data-f="premiumHours" type="number" min="0" step="0.1" value="${n(p.premiumHours)}" title="Rocketlane budgeted package hours. Month columns are the tracked hours and can be edited." /></td>
           <td class="mono num">—</td>`
        : `<td class="flow-count"><input data-f="std" type="number" min="0" step="1" value="${n(p.std)}" title="Standard flows. Hours use the Mapping, Package, and Adapt rates." /></td>
           <td class="flow-count"><input data-f="cpx" type="number" min="0" step="1" value="${n(p.cpx)}" title="Complex flows. Hours use the Mapping, Package, and Adapt rates." /></td>`;
      return `<tr class="${selected}${cancelled}${inactive}" data-id="${escapeAttr(p.id)}">
        <td class="col-project"><input data-f="name" type="text" value="${escapeAttr(p.name)}" placeholder="Project name" /></td>
        <td class="col-med"><select data-f="assignee">${optionList(ASSIGNEES, normalizeAssignee(p.assignee))}</select></td>
        <td class="col-med"><select data-f="type">${optionList(Object.keys(LOOKUPS.typeBase), p.type)}</select></td>
        <td class="col-med"><select data-f="status">${optionList(PROJECT_STATUSES, p.status)}</select></td>
        ${flowCells}
        ${monthCells}
        <td class="col-med"><select data-f="dependency" title="Scales delivery hours">${optionList(Object.keys(LOOKUPS.dependency), p.dependency)}</select></td>
        <td class="col-narrow"><input data-f="erpCutover" type="checkbox" ${p.erpCutover ? "checked" : ""} title="ERP go-live hours" /></td>
        ${weeksCell}
        ${quarterTotal}
        <td class="mono num">${(userPct * 100).toFixed(1)}%</td>
        <td class="mono num">${(teamPct * 100).toFixed(1)}%</td>
        ${okrCell}
        <td><button type="button" class="btn danger" data-del="${escapeAttr(p.id)}" title="Remove">✕</button></td>
      </tr>`;
    }

    const flowCells = directHours
      ? `<td class="mono num">—</td><td class="mono num">—</td>
         <td class="col-narrow"><input data-f="premiumHours" type="number" min="0" step="0.1" value="${n(p.premiumHours)}" title="Rocketlane budgeted package hours. Month columns are the tracked hours and can be edited." /></td>`
      : `<td class="flow-count"><input data-f="std" type="number" min="0" step="1" value="${n(p.std)}" title="Standard flows" /></td>
         <td class="flow-count"><input data-f="cpx" type="number" min="0" step="1" value="${n(p.cpx)}" title="Complex flows" /></td>
         <td class="flow-count"><input data-f="ins" type="number" min="0" step="1" value="${n(p.ins)}" title="Insane flows" /></td>`;
    return `<tr class="${selected}${cancelled}${inactive}" data-id="${escapeAttr(p.id)}">
      <td class="col-project"><input data-f="name" type="text" value="${escapeAttr(p.name)}" placeholder="Project name" /></td>
      <td class="col-med"><select data-f="assignee">${optionList(ASSIGNEES, normalizeAssignee(p.assignee))}</select></td>
      <td class="col-med"><select data-f="type">${optionList(Object.keys(LOOKUPS.typeBase), p.type)}</select></td>
      <td class="col-med"><select data-f="status">${optionList(PROJECT_STATUSES, p.status)}</select></td>
      <td class="col-med"><select data-f="category">${optionList(Object.keys(LOOKUPS.categoryWeight), p.category)}</select></td>
      <td class="col-med"><select data-f="effort">${optionList(Object.keys(LOOKUPS.effort), p.effort)}</select></td>
      ${flowCells}
      ${monthCells}
      <td class="col-med"><select data-f="dependency">${optionList(Object.keys(LOOKUPS.dependency), p.dependency)}</select></td>
      <td class="col-med"><select data-f="mapping">${optionList(Object.keys(LOOKUPS.mapping), p.mapping)}</select></td>
      <td class="col-med"><select data-f="connection">${optionList(Object.keys(LOOKUPS.connection), p.connection)}</select></td>
      <td class="col-narrow"><input data-f="erpCutover" type="checkbox" ${p.erpCutover ? "checked" : ""} /></td>
      ${weeksCell}
      ${quarterTotal}
      <td class="mono num" title="Full lifecycle SP">${fmt(c.totalSP, 0)}</td>
      <td class="mono num" title="SP attributed to ${escapeAttr(periodName())}">${fmt(c.quarterSP, 1)}</td>
      <td class="mono num">${fmt(c.quarterHours, 1)}</td>
      <td class="mono num" title="Share of this user's quarter hours">${(userPct * 100).toFixed(1)}%</td>
      <td class="mono num" title="Share of team quarter hours">${(teamPct * 100).toFixed(1)}%</td>
      ${okrCell}
      <td><button type="button" class="btn danger" data-del="${escapeAttr(p.id)}" title="Remove">✕</button></td>
    </tr>`;
  }

  function tableHeader() {
    const months = monthsInQuarter(state.quarter);
    const quarterTotalHead = `Q${parseQuarter(state.quarter).q} total`;
    const periodHead = selectedMonth() ? `${MONTH_SHORT[selectedMonth() - 1]} hrs` : "Q hrs";
    const spHead = selectedMonth() ? `${MONTH_SHORT[selectedMonth() - 1]} SP` : "Q SP";
    const monthHeads = months
      .map(
        (item) =>
          `<th class="col-narrow" title="${escapeAttr(item.label + " hours, added on top of the flow calculation")}">${MONTH_SHORT[item.month - 1]}</th>`
      )
      .join("");
    if (isQuick()) {
      return `<thead><tr>
        <th>Project</th><th>Assignee</th><th>Type</th><th>Status</th>
        <th class="flow-count" title="Standard flows">Std<span class="th-sub">flows</span></th><th class="flow-count" title="Complex flows">Cpx<span class="th-sub">flows</span></th>
        ${monthHeads}<th>Dependency</th><th>ERP</th><th>Weeks</th>
        <th title="Flow hours in this quarter plus entered month hours">${quarterTotalHead}</th><th>User %</th><th>Team %</th><th title="Allocated quarter hours ÷ one person's quarter capacity (weekdays × 6 h)">OKR</th><th></th>
      </tr></thead>`;
    }
    return `<thead><tr>
      <th>Project</th><th>Assignee</th><th>Type</th><th>Status</th><th>Category</th><th>Effort</th>
      <th class="flow-count" title="Standard flows">Std<span class="th-sub">flows</span></th><th class="flow-count" title="Complex flows">Cpx<span class="th-sub">flows</span></th><th class="flow-count" title="Insane flows">Ins<span class="th-sub">flows</span></th>
      ${monthHeads}<th>Dependency</th><th>Mapping</th><th>Connection</th>
      <th>ERP</th><th>Weeks</th><th title="Flow hours in this quarter plus entered month hours">${quarterTotalHead}</th><th>Total SP</th><th>${spHead}</th><th>${periodHead}</th><th>User %</th><th>Team %</th><th title="Allocated quarter hours ÷ one person's quarter capacity (weekdays × 6 h)">OKR</th><th></th>
    </tr></thead>`;
  }

  function applyModeChrome() {
    document.body.classList.toggle("mode-quick", isQuick());
    document.body.classList.toggle("mode-full", !isQuick());
    els.btnModeQuick.classList.toggle("active", isQuick());
    els.btnModeFull.classList.toggle("active", !isQuick());
    els.statSPWrap.classList.toggle("hidden-mode", isQuick());
    els.ledeText.textContent = isQuick()
      ? "Quick estimate: type, flows, assignee, quarter → hours and Work %."
      : "Full estimate: all attributes, per-phase quarters, and story points.";
    els.portfolioHint.textContent = isQuick()
      ? "Std and Cpx calculate flow hours. Month columns add entered hours on top. The quarter total is both."
      : "Std, Cpx, and Ins calculate flow hours. Month columns add entered hours on top. The quarter total is both.";
    els.detailHeading.textContent = isQuick()
      ? "Selected project — flows and monthly hours"
      : "Selected project — phases by quarter";
  }

  function okrRowsForQuarter() {
    ensureOkrState(state);
    const userFilter = state.okr.userFilter || "__all__";
    return state.okr.rows.filter(
      (row) =>
        row.quarter === state.okr.quarter &&
        (userFilter === "__all__" || normalizeAssignee(row.owner) === userFilter)
    );
  }

  function okrLinkedProject(row) {
    const projectId = String(row && row.rocketlaneProjectId || "");
    if (!projectId) return null;
    return (
      state.projects.find(
        (project) =>
          String(project.id || "") === projectId || String(project.id || "") === "rl-" + projectId
      ) || null
    );
  }

  function okrApplicablePhaseKeys(row) {
    const project = okrLinkedProject(row);
    if (!project || !project.phaseQuarters) return OKR_PHASE_KEYS.slice();
    const quarter = row.quarter;
    const assignments = {
      projectManagement: ["initiate"],
      mapping: ["mapping"],
      design: ["package"],
      development: ["package"],
      proofOfDelivery: ["adapt", "commence", "transition"],
    };
    return OKR_PHASE_KEYS.filter((key) =>
      assignments[key].some((phase) => project.phaseQuarters[phase] === quarter)
    );
  }

  function okrPhaseAchievement(row) {
    const keys = okrApplicablePhaseKeys(row);
    const values = keys.map((key) => n(row.phases && row.phases[key]));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function okrAchievement(row) {
    if (
      row.achievementOverride !== null &&
      row.achievementOverride !== undefined &&
      row.achievementOverride !== ""
    ) {
      return Math.max(0, Math.min(200, n(row.achievementOverride)));
    }
    return okrPhaseAchievement(row);
  }

  let okrHourPools = null;

  function buildOkrHourPools(quarter) {
    const byProject = {};
    state.projects.forEach((project) => {
      if (project.complianceOnly) return;
      const result = calcForQuarter(project, state.rates, quarter, null);
      const hours = project.status === "Cancelled" || !result.hasWorkInQuarter ? 0 : result.quarterHours;
      const projectId = String(project.id || "").replace(/^rl-/, "");
      if (projectId) byProject[projectId] = hours;
    });
    return { quarter, byProject, capacity: capacityHoursForQuarter(quarter) };
  }

  function okrPools(quarter) {
    if (!okrHourPools || okrHourPools.quarter !== quarter) okrHourPools = buildOkrHourPools(quarter);
    return okrHourPools;
  }

  /** Linked rows use allocated quarter hours ÷ one person's quarter capacity. Manual rows keep the typed weight. */
  function okrEffectiveWeight(row) {
    const project = okrLinkedProject(row);
    if (!project) return Math.max(0, n(row.weight));
    const pools = okrPools(row.quarter);
    const hours = pools.byProject[String(row.rocketlaneProjectId || "")] || 0;
    if (hours <= 0 || pools.capacity <= 0) return 0;
    return (hours / pools.capacity) * 100;
  }

  function okrWeightCell(row) {
    const project = okrLinkedProject(row);
    if (!project) {
      return `<td class="okr-number"><input type="number" min="0" max="100" step="0.1" value="${n(row.weight)}" data-okr-field="weight" title="Manual weight. Linked projects use allocated quarter hours divided by quarter capacity." /></td>`;
    }
    const pools = okrPools(row.quarter);
    const hours = pools.byProject[String(row.rocketlaneProjectId || "")] || 0;
    if (hours <= 0 || pools.capacity <= 0) {
      return `<td class="okr-number" title="No allocated hours in ${escapeAttr(row.quarter)}"><div class="okr-progress-cell"><strong>—</strong><span class="okr-row-source">No hours this quarter</span></div></td>`;
    }
    const weight = okrEffectiveWeight(row);
    return `<td class="okr-number" title="${escapeAttr(`${fmt(hours, 1)} allocated hours of ${fmt(pools.capacity, 0)} quarter hours`)}"><div class="okr-progress-cell"><strong>${fmt(weight, 1)}%</strong><span class="okr-row-source">Hours</span></div></td>`;
  }

  function okrWeightedResult(row) {
    const achievement = okrAchievement(row);
    if (achievement === null) return 0;
    const goal = Math.max(1, n(row.goal) || 100);
    return Math.min(1, achievement / goal) * Math.max(0, okrEffectiveWeight(row));
  }

  function okrConfidenceFor(row) {
    if (row.confidence && row.confidence !== "Not set") return row.confidence;
    const achievement = okrAchievement(row);
    if (achievement === null) return "Not set";
    if (achievement >= Math.max(100, n(row.goal))) return "Complete";
    if (achievement >= 70) return "On track";
    if (achievement >= 40) return "At risk";
    return "Off track";
  }

  function okrConfidenceClass(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, "-");
  }

  function okrProjectOptions(selected) {
    const projects = state.projects
      .filter((project) => !project.complianceOnly && project.status !== "Cancelled")
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return (
      `<option value="">Manual / unlinked</option>` +
      projects
        .map((project) => {
          const id = String(project.id).replace(/^rl-/, "");
          const label = project.source === "manual" ? `${project.name} (estimator)` : project.name;
          return `<option value="${escapeAttr(id)}"${id === String(selected || "") ? " selected" : ""}>${escapeHtml(label)}</option>`;
        })
        .join("")
    );
  }

  function okrPhaseCell(row, key) {
    const value = Math.max(0, Math.min(100, n(row.phases && row.phases[key])));
    const applicable = okrApplicablePhaseKeys(row).includes(key);
    const quarterNote = applicable ? "Counts in this quarter" : `Outside ${row.quarter}`;
    return `<td class="okr-phase${applicable ? "" : " okr-phase-out"}" title="${escapeAttr(quarterNote)}">
      <div class="okr-progress-cell">
        <input type="number" min="0" max="100" step="1" value="${value}" data-okr-phase="${key}" aria-label="${escapeAttr(OKR_PHASE_LABELS[key])} percent" />
        <span class="okr-row-source">${applicable ? "This quarter" : "Other quarter"}</span>
        <div class="okr-progress-track"><span style="width:${value}%"></span></div>
      </div>
    </td>`;
  }

  function renderOkr() {
    ensureOkrState(state);
    okrHourPools = null;
    const rows = okrRowsForQuarter();
    const totalWeight = rows.reduce((sum, row) => sum + okrEffectiveWeight(row), 0);
    const weighted = rows.reduce((sum, row) => sum + okrWeightedResult(row), 0);
    const assessableWeight = rows.reduce(
      (sum, row) => sum + (okrAchievement(row) === null ? 0 : okrEffectiveWeight(row)),
      0
    );
    const normalizedScore = assessableWeight > 0 ? (weighted / assessableWeight) * 100 : 0;
    const confidences = rows.map(okrConfidenceFor);

    els.okrPortfolioScore.textContent = `${fmt(normalizedScore, 1)}%`;
    els.okrKeyResults.textContent = String(rows.length);
    els.okrTotalWeight.textContent = `${fmt(totalWeight, 1)}%`;
    const singleOwner = (state.okr.userFilter || "__all__") !== "__all__";
    els.okrTotalWeight.classList.toggle("okr-weight-warning", singleOwner && totalWeight > 100.05);
    els.okrTotalWeight.title =
      "Each linked key result is that project's allocated quarter hours divided by one person's quarter capacity (weekdays × 6 h). The total does not have to be 100%. Manual rows keep the weight you type.";
    els.okrOnTrack.textContent = String(
      confidences.filter((value) => value === "On track" || value === "Complete").length
    );
    els.okrAtRisk.textContent = String(
      confidences.filter((value) => value === "At risk" || value === "Off track").length
    );
    els.okrLinked.textContent = String(rows.filter((row) => row.rocketlaneProjectId).length);
    els.okrQuarterLabel.textContent = state.okr.quarter;

    const okrYear = parseQuarter(state.okr.quarter).year || state.year || 2026;
    const quarterOptions = quartersForYear(okrYear);
    els.okrQuarterFilter.innerHTML = optionList(quarterOptions, state.okr.quarter);
    const userFilter = state.okr.userFilter || "__all__";
    els.okrUserFilter.innerHTML =
      `<option value="__all__"${userFilter === "__all__" ? " selected" : ""}>All users</option>` +
      ASSIGNEES.map(
        (user) =>
          `<option value="${escapeAttr(user)}"${userFilter === user ? " selected" : ""}>${escapeHtml(user)}</option>`
      ).join("");

    const byObjective = {};
    rows.forEach((row) => {
      const key = row.objective || "Unassigned objective";
      if (!byObjective[key]) byObjective[key] = { rows: 0, weight: 0, assessableWeight: 0, result: 0 };
      byObjective[key].rows += 1;
      byObjective[key].weight += okrEffectiveWeight(row);
      if (okrAchievement(row) !== null) byObjective[key].assessableWeight += okrEffectiveWeight(row);
      byObjective[key].result += okrWeightedResult(row);
    });
    els.okrObjectiveSummary.innerHTML = Object.keys(byObjective)
      .sort()
      .map((objective) => {
        const item = byObjective[objective];
        const score = item.assessableWeight > 0 ? (item.result / item.assessableWeight) * 100 : 0;
        return `<span class="okr-objective-chip">${escapeHtml(objective)} <strong>${fmt(score, 0)}% · ${item.rows} KR</strong></span>`;
      })
      .join("");

    if (!rows.length) {
      els.okrTable.innerHTML =
        '<p class="empty-state">No key results for this quarter. Add a key result or import the quarter projects.</p>';
      return;
    }

    const header = `<thead><tr>
      <th class="okr-objective">Objective</th>
      <th class="okr-key-result">Key Result</th>
      <th class="okr-number" title="Average of phases assigned to this quarter, unless you enter a value">Achievement</th>
      <th class="okr-number" title="Linked projects: allocated quarter hours ÷ quarter capacity (weekdays × 6 h). Manual rows: the weight you type.">Weight</th>
      <th class="okr-number" title="min(Achievement ÷ Goal, 1) × Weight">Result</th>
      <th class="okr-details">Details</th>
      <th class="okr-owner">Owner</th>
      <th class="okr-type">Project Type</th>
      <th class="okr-number">Goal</th>
      <th class="okr-phase">Project Management</th>
      <th class="okr-phase">Mapping</th>
      <th class="okr-phase">Design</th>
      <th class="okr-phase">Development</th>
      <th class="okr-phase">Proof of Delivery</th>
      <th class="okr-type">Confidence</th>
      <th class="okr-notes">Feedback</th>
      <th class="okr-notes">Manager Review</th>
      <th class="okr-link">Project</th>
      <th class="okr-notes">Evidence</th>
      <th class="okr-actions-cell">Remove</th>
    </tr></thead>`;

    els.okrTable.innerHTML = `<table class="okr-table">${header}<tbody>${rows
      .map((row) => {
        const achievement = okrAchievement(row);
        const phaseAchievement = okrPhaseAchievement(row);
        const manualAchievement =
          row.achievementOverride !== null &&
          row.achievementOverride !== undefined &&
          row.achievementOverride !== "";
        const result = okrWeightedResult(row);
        const confidence = okrConfidenceFor(row);
        const applicablePhases = okrApplicablePhaseKeys(row);
        const automaticAchievementLabel = achievement === null
          ? "No phases this quarter"
          : `${applicablePhases.length} phase${applicablePhases.length === 1 ? "" : "s"} · ${fmt(achievement, 1)}%`;
        const phasePlaceholder = phaseAchievement === null ? "—" : fmt(phaseAchievement, 0);
        const phaseTitle = phaseAchievement === null
          ? `No linked delivery phases are assigned to ${row.quarter}. Enter an achievement manually if needed.`
          : `Enter an achievement manually, or clear this field to use the ${fmt(phaseAchievement, 1)}% average of phases assigned to ${row.quarter}.`;
        const source = row.rocketlaneProjectId
          ? `${row.syncSource || "Rocketlane"}${row.syncedAt ? ` · ${new Date(row.syncedAt).toLocaleString()}` : ""}`
          : "Manual";
        return `<tr data-okr-id="${escapeAttr(row.id)}">
          <td class="okr-objective"><input type="text" list="okr-objectives" value="${escapeAttr(row.objective)}" data-okr-field="objective" /></td>
          <td class="okr-key-result"><textarea data-okr-field="keyResult">${escapeHtml(row.keyResult)}</textarea></td>
          <td class="okr-number"><div class="okr-progress-cell"><input type="number" min="0" max="200" step="1" value="${manualAchievement ? n(row.achievementOverride) : ""}" placeholder="${phasePlaceholder}" title="${escapeAttr(phaseTitle)}" data-okr-field="achievementOverride" /><span class="okr-row-source">${manualAchievement ? "Manual" : automaticAchievementLabel}</span><div class="okr-progress-track"><span style="width:${achievement === null ? 0 : Math.min(100, achievement)}%"></span></div></div></td>
          ${okrWeightCell(row)}
          <td class="okr-number" title="min(Achievement ÷ Goal, 1) × Weight"><strong>${achievement === null ? "—" : fmt(result, 1) + "%"}</strong></td>
          <td class="okr-details"><textarea data-okr-field="details">${escapeHtml(row.details)}</textarea></td>
          <td class="okr-owner"><select data-okr-field="owner">${optionList(ASSIGNEES, normalizeAssignee(row.owner))}</select></td>
          <td class="okr-type"><select data-okr-field="projectType">${optionList(OKR_PROJECT_TYPES, row.projectType)}</select></td>
          <td class="okr-number"><input type="number" min="1" max="200" step="1" value="${n(row.goal) || 100}" data-okr-field="goal" /></td>
          ${OKR_PHASE_KEYS.map((key) => okrPhaseCell(row, key)).join("")}
          <td class="okr-type"><select data-okr-field="confidence">${optionList(OKR_CONFIDENCE, row.confidence || "Not set")}</select><span class="okr-confidence ${okrConfidenceClass(confidence)}">${escapeHtml(confidence)}</span></td>
          <td class="okr-notes"><textarea data-okr-field="feedback">${escapeHtml(row.feedback)}</textarea></td>
          <td class="okr-notes"><textarea data-okr-field="managerReview">${escapeHtml(row.managerReview)}</textarea></td>
          <td class="okr-link"><select data-okr-link>${okrProjectOptions(row.rocketlaneProjectId)}</select><span class="okr-row-source">${escapeHtml(source)}</span></td>
          <td class="okr-notes"><input type="url" value="${escapeAttr(row.evidence)}" placeholder="https://…" data-okr-field="evidence" /></td>
          <td class="okr-actions-cell"><button type="button" class="btn danger" data-okr-delete="${escapeAttr(row.id)}" aria-label="Remove key result">×</button></td>
        </tr>`;
      })
      .join("")}</tbody></table>
      <datalist id="okr-objectives">${OKR_OBJECTIVES.map((value) => `<option value="${escapeAttr(value)}"></option>`).join("")}</datalist>`;
  }

  function rocketlaneStatusProgress(status) {
    const value = status && n(status.value);
    const label = String((status && status.label) || status || "").toLowerCase();
    if (value >= 3 || label.includes("complete") || label.includes("done")) return 100;
    if (value === 2 || label.includes("progress") || label.includes("blocked")) return 50;
    return 0;
  }

  function okrBucketFromPhaseName(name) {
    const value = String(name || "").toLowerCase();
    if (value.includes("initiate") || value.includes("analysis") || value.includes("setup")) {
      return "projectManagement";
    }
    if (value.includes("mapping")) return "mapping";
    if (value.includes("design")) return "design";
    if (value.includes("package") || value.includes("development")) return "development";
    if (
      value.includes("adapt") ||
      value.includes("test") ||
      value.includes("commence") ||
      value.includes("go live") ||
      value.includes("launch") ||
      value.includes("transition") ||
      value.includes("hypercare") ||
      value.includes("closure")
    ) {
      return "proofOfDelivery";
    }
    return "projectManagement";
  }

  function computeRocketlaneOkrPhases(phaseRows, taskRows) {
    const tasksByPhase = {};
    const designScores = [];
    (taskRows || []).forEach((task) => {
      if (task.archived) return;
      const statusLabel = String(task.status && task.status.label || "").toLowerCase();
      if (statusLabel.includes("cancel") || statusLabel.includes("not applicable")) return;
      const phaseId = task.phase && String(task.phase.phaseId || "");
      if (!phaseId) return;
      if (!tasksByPhase[phaseId]) tasksByPhase[phaseId] = [];
      const score =
        Number.isFinite(Number(task.progress))
          ? Math.max(0, Math.min(100, Number(task.progress)))
          : rocketlaneStatusProgress(task.status);
      tasksByPhase[phaseId].push(score);
      if (/\b(design|architecture|business rules?|solution document|design document)\b/i.test(task.taskName || "")) {
        designScores.push(score);
      }
    });

    const bucketValues = {};
    OKR_PHASE_KEYS.forEach((key) => {
      bucketValues[key] = [];
    });
    (phaseRows || []).forEach((phase) => {
      if (phase.archived) return;
      const phaseId = String(phase.phaseId || "");
      const taskScores = tasksByPhase[phaseId] || [];
      const phaseStatus = rocketlaneStatusProgress(phase.status);
      const score =
        phaseStatus === 100
          ? 100
          : taskScores.length
            ? taskScores.reduce((sum, value) => sum + value, 0) / taskScores.length
            : phaseStatus;
      const weight = Math.max(1, taskScores.length);
      bucketValues[okrBucketFromPhaseName(phase.phaseName || phase.name)].push({ score, weight });
    });
    if (designScores.length) {
      bucketValues.design = designScores.map((score) => ({ score, weight: 1 }));
    }
    const result = {};
    OKR_PHASE_KEYS.forEach((key) => {
      const values = bucketValues[key];
      const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
      result[key] = totalWeight
        ? Math.round(values.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight)
        : 0;
    });
    return result;
  }

  async function fetchRocketlaneTasksForOkr(apiKey, projectId) {
    const rows = [];
    let path = `/api/1.0/tasks?project.eq=${encodeURIComponent(projectId)}&pageSize=100&includeAllFields=true`;
    let guard = 0;
    while (path && guard < 40) {
      guard += 1;
      const payload = await rocketlaneGetJson(apiKey, path);
      (Array.isArray(payload.data) ? payload.data : []).forEach((row) => rows.push(row));
      const next = payload.pagination && payload.pagination.hasMore && payload.pagination.nextPage;
      if (!next) break;
      path = String(next).replace(/^https?:\/\/api\.rocketlane\.com/i, "");
      if (!path.startsWith("/")) path = "/" + path.replace(/^\/+/, "");
    }
    return rows;
  }

  function fillQuarterSelect() {
    const qs = quartersForYear(state.year);
    if (!qs.includes(state.quarter)) state.quarter = qs[2] || qs[0];
    els.quarterFilter.innerHTML = optionList(qs, state.quarter);
    state.month = selectedMonth();
    const monthOptions = [`<option value="0"${state.month ? "" : " selected"}>All</option>`].concat(
      monthsInQuarter(state.quarter).map(
        (item) =>
          `<option value="${item.month}"${state.month === item.month ? " selected" : ""}>${escapeHtml(item.label)}</option>`
      )
    );
    els.monthFilter.innerHTML = monthOptions.join("");
    els.yearInput.value = state.year;
    els.reportQuarterLabel.textContent = periodName();
  }

  function render() {
    const focus = captureFocus();
    applyModeChrome();
    applyTabChrome();
    fillQuarterSelect();

    const computed = computeAll();
    const groups = groupByUser(computed);
    const teamActive = computed.filter((x) => x.p.status !== "Cancelled" && x.c.hasWorkInQuarter);
    const teamHoursWeight = teamActive.reduce((s, x) => s + x.c.quarterHours, 0);
    const teamHours = teamHoursWeight;
    const teamSP = teamActive.reduce((s, x) => s + x.c.quarterSP, 0);

    const filter = state.userFilter || "__all__";
    const visibleGroups =
      filter === "__all__" ? groups : groups.filter((g) => g.user === filter);

    const visibleActive = visibleGroups
      .flatMap((g) => g.rows)
      .filter((x) => x.p.status !== "Cancelled" && x.c.hasWorkInQuarter);

    els.statProjectsLabel.textContent = selectedMonth() ? "Active in month" : "Active in quarter";
    els.statSPLabel.textContent = selectedMonth() ? "Month SP" : "Quarter SP";
    els.statHoursLabel.textContent = selectedMonth() ? "Month hours" : "Quarter hours";
    els.statProjects.textContent = String(visibleActive.length);
    els.statSP.textContent = fmt(
      visibleActive.reduce((s, x) => s + x.c.quarterSP, 0),
      1
    );
    els.statHours.textContent = fmt(
      visibleActive.reduce((s, x) => s + x.c.quarterHours, 0),
      1
    );
    els.statActive.textContent = String(
      new Set(visibleActive.map((x) => x.assignee)).size
    );

    if (filter === "__all__") {
      els.statSP.textContent = fmt(teamSP, 1);
      els.statHours.textContent = fmt(teamHours, 1);
      els.statProjects.textContent = String(teamActive.length);
      els.statActive.textContent = String(new Set(teamActive.map((x) => x.assignee)).size);
    }

    renderDashboard(filter);

    const usersInData = groups.map((g) => g.user);
    els.userFilter.innerHTML =
      `<option value="__all__"${filter === "__all__" ? " selected" : ""}>All users</option>` +
      usersInData
        .map(
          (u) =>
            `<option value="${escapeAttr(u)}"${filter === u ? " selected" : ""}>${escapeHtml(u)}</option>`
        )
        .join("");

    els.userReport.innerHTML = groups
      .filter((g) => userTotals(g.rows).projects > 0)
      .map((g) => {
        const t = userTotals(g.rows);
        const teamShare = teamHoursWeight > 0 ? t.weight / teamHoursWeight : 0;
        return `<article class="user-card${filter === g.user ? " active" : ""}" data-user="${escapeAttr(g.user)}">
          <h3>${escapeHtml(g.user)}</h3>
          <div class="meta">
            <div>Projects<strong>${t.projects}</strong></div>
            <div>Q SP<strong>${fmt(t.sp, 1)}</strong></div>
            <div>Q Hours<strong>${fmt(t.hours, 1)}</strong></div>
            <div>Q Team %<strong>${(teamShare * 100).toFixed(1)}%</strong></div>
          </div>
        </article>`;
      })
      .join("");

    els.sections.innerHTML = visibleGroups
      .map((g) => {
        const t = userTotals(g.rows);
        const rowsHtml = g.rows
          .filter(
            ({ p, c }) =>
              p.status !== "Cancelled" &&
              (c.hasWorkInQuarter ||
                ((p.source === "manual" || p.portfolioShare) && phaseAssignedToQuarter(p, state.quarter)))
          )
          .map(({ p, c }) => renderRow(p, c, teamHoursWeight, t.weight))
          .join("");
        if (!rowsHtml) return "";
        return `<div class="user-section" data-user-section="${escapeAttr(g.user)}">
          <div class="user-section-head">
            <h3>${escapeHtml(g.user)} <span class="badge">${escapeHtml(periodName())}</span></h3>
            <div class="chips">
              <span>Active <strong>${t.projects}</strong></span>
              <span>Q SP <strong>${fmt(t.sp, 1)}</strong></span>
              <span>Q Hours <strong>${fmt(t.hours, 1)}</strong></span>
              <span>Q Team % <strong>${teamHoursWeight > 0 ? ((t.weight / teamHoursWeight) * 100).toFixed(1) : "0.0"}%</strong></span>
            </div>
          </div>
          <div class="table-wrap">
            <table>${tableHeader()}<tbody>${rowsHtml}</tbody></table>
          </div>
        </div>`;
      })
      .join("");

    if (!visibleGroups.length) {
      els.sections.innerHTML =
        '<p class="empty-state">No projects. Click <strong>Add project</strong>.</p>';
    }

    renderDetail(computed, teamHoursWeight);
    renderConfig();
    renderCompliance();
    renderOkr();
    save();
    restoreFocus(focus);
  }

  function renderDetail(computed, teamHoursWeight) {
    const row = computed.find((x) => x.p.id === state.selectedId) || computed[0];
    if (!row) {
      els.detailTitle.textContent = "Select a row for details.";
      els.quickFocusForm.innerHTML = "";
      els.phaseQuarterForm.className = "phase-quarter-form empty-state";
      els.phaseQuarterForm.textContent = "No project selected.";
      els.phaseDetail.className = "phase-grid empty-state";
      els.phaseDetail.textContent = "";
      return;
    }

    state.selectedId = row.p.id;
    const { p, c } = row;
    ensurePhaseQuarters(p, state.quarter);
    const teamPct =
      teamHoursWeight > 0 && p.status !== "Cancelled" ? c.quarterHours / teamHoursWeight : 0;

    els.detailTitle.textContent = `${p.name} · ${normalizeAssignee(p.assignee)} · ${periodName()}: ${fmt(c.quarterHours, 1)} h (${(teamPct * 100).toFixed(1)}% team)${isQuick() ? "" : ` · SP ${fmt(c.totalSP, 0)} / period SP ${fmt(c.quarterSP, 1)}`}`;

    // Quick: quarter focus preset. Other hours are entered per quarter instead.
    els.quickFocusForm.className =
      p.useActualByQuarter ||
      isDirectHoursType(p.type) ||
      (isQuarterHoursType(p.type) && !hasFlowEstimate(p))
        ? "quick-focus-form hidden"
        : "quick-focus-form";
    els.quickFocusForm.innerHTML = `<label>Quarter focus (vs ${escapeHtml(state.quarter)})
      <select data-focus="quarterFocus">${Object.keys(QUARTER_FOCUS)
        .map(
          (k) =>
            `<option value="${k}"${(p.quarterFocus || "full") === k ? " selected" : ""}>${escapeHtml(QUARTER_FOCUS[k])}</option>`
        )
        .join("")}</select>
    </label>
    <label>Anchor quarter for focus
      <select data-focus="anchorQ">${optionList(allQuarterOptions(state.year), state.quarter)}</select>
    </label>`;

    if (isQuarterHoursType(p.type) || (isDirectHoursType(p.type) && !p.useActualByQuarter)) {
      const yearQuarters = quartersForYear(state.year);
      const byMonth = ensureHoursByMonth(p);
      const tracked = isDirectHoursType(p.type);
      els.phaseQuarterForm.className = "phase-quarter-form month-board";
      els.phaseQuarterForm.innerHTML = yearQuarters
        .map((quarter) => {
          const months = monthsInQuarter(quarter);
          const selected = quarter === state.quarter ? " is-selected" : "";
          return `<section class="quarter-month-group${selected}">
            <header><span>${escapeHtml(quarter)}</span><strong>${fmt(quarterHoursOf(p, quarter), 1)} h</strong></header>
            ${months
              .map((item) =>
                monthHoursInput(
                  item,
                  byMonth,
                  tracked ? item.label + " hours from Rocketlane. Edit to override." : undefined
                )
              )
              .join("")}
          </section>`;
        })
        .join("");
      const enteredPeriod = enteredMonthHours(p, state.quarter, selectedMonth());
      const flowPeriod = hasFlowEstimate(p) ? c.quarterHours - enteredPeriod : 0;
      const flowCards = hasFlowEstimate(p)
        ? PHASE_KEYS.map(
            (k) =>
              `<div class="phase-card"><span class="label">${PHASE_LABELS[k]} flow</span><span class="value">${fmt(c.phases[k], 1)} h</span></div>`
          ).join("") +
          `<div class="phase-card"><span class="label">${escapeHtml(meetingSummary(c.meetingPlan))}</span><span class="value">${fmt(c.meetingsHours, 1)} h</span></div>`
        : "";
      els.phaseDetail.className = "phase-grid";
      els.phaseDetail.innerHTML = `
        ${flowCards}
        <div class="phase-card"><span class="label">Entered hours</span><span class="value">${fmt(enteredPeriod, 1)} h</span></div>
        ${hasFlowEstimate(p) ? `<div class="phase-card in-quarter"><span class="label">Flow in ${escapeHtml(periodName())}</span><span class="value">${fmt(flowPeriod, 1)} h</span></div>` : ""}
        <div class="phase-card total"><span class="label">${escapeHtml(periodName())} total</span><span class="value">${fmt(c.quarterHours, 1)} h</span></div>`;
      return;
    }

    if (isQuick()) {
      els.phaseQuarterForm.className = "phase-quarter-form hidden-mode";
      els.phaseQuarterForm.innerHTML = "";
      els.phaseDetail.className = "phase-grid";
      els.phaseDetail.innerHTML = `
        <div class="phase-card in-quarter"><span class="label">Q hours</span><span class="value">${fmt(c.quarterHours, 1)} h</span></div>
        <div class="phase-card"><span class="label">Lifecycle hours</span><span class="value">${fmt(c.estimatedHours, 1)} h</span></div>
        <div class="phase-card"><span class="label">${escapeHtml(meetingSummary(c.meetingPlan))}</span><span class="value">${fmt(c.meetingsHours, 1)} h</span></div>
        <div class="phase-card total"><span class="label">User / Team %</span><span class="value">${(teamPct * 100).toFixed(1)}% team</span></div>`;
      return;
    }

    if (p.useActualByQuarter) {
      els.phaseQuarterForm.className = "phase-quarter-form hidden-mode";
      els.phaseQuarterForm.innerHTML = "";
      els.phaseDetail.className = "phase-grid";
      els.phaseDetail.innerHTML = `
        <div class="phase-card in-quarter"><span class="label">${escapeHtml(state.quarter)} dated hours</span><span class="value">${fmt(c.quarterHours, 1)} h</span></div>
        <div class="phase-card"><span class="label">Imported total</span><span class="value">${fmt(c.estimatedHours, 1)} h</span></div>
        <div class="phase-card total"><span class="label">Special Team Tasks topic</span><span class="value">Leave excluded</span></div>`;
      return;
    }

    const qOpts = allQuarterOptions(state.year);
    els.phaseQuarterForm.className = "phase-quarter-form";
    els.phaseQuarterForm.innerHTML = PHASE_KEYS.map((k) => {
      const on = isPhaseActive(p, k);
      return `<label${on ? "" : ' class="phase-off"'}>
        <span class="phase-toggle"><input type="checkbox" data-phase-on="${k}"${on ? " checked" : ""} /> ${PHASE_LABELS[k]}</span>
        <select data-phase-q="${k}"${on ? "" : " disabled"}>${optionList(qOpts, p.phaseQuarters[k])}</select>
      </label>`;
    }).join("");

    els.phaseDetail.className = "phase-grid";
    const cards = PHASE_KEYS.map((k) => {
      const on = isPhaseActive(p, k);
      const inQ = p.phaseQuarters[k] === state.quarter;
      const hrs = c.phases[k];
      return `<div class="phase-card ${on ? (inQ ? "in-quarter" : "out-quarter") : "out-quarter phase-off"}">
        <span class="label">${PHASE_LABELS[k]} · ${on ? escapeHtml(p.phaseQuarters[k]) : "excluded"}</span>
        <span class="value">${on ? `${fmt(hrs, 1)} h` : "—"}</span>
      </div>`;
    });
    cards.push(
      `<div class="phase-card ${c.meetingsInQ > 0 ? "in-quarter" : "out-quarter"}">
        <span class="label">${escapeHtml(meetingSummary(c.meetingPlan))} · ${escapeHtml(periodName())}</span>
        <span class="value">${fmt(c.meetingsInQ, 1)} h</span>
      </div>`
    );
    cards.push(
      `<div class="phase-card total">
        <span class="label">${escapeHtml(periodName())} total (hours / SP)</span>
        <span class="value">${fmt(c.quarterHours, 1)} h · ${fmt(c.quarterSP, 1)} SP</span>
      </div>`
    );
    els.phaseDetail.innerHTML = cards.join("");
  }

  function renderConfig() {
    els.configForm.innerHTML = Object.keys(DEFAULT_RATES)
      .map((key) => {
        return `<label for="rate-${key}">${RATE_LABELS[key]}</label>
          <input id="rate-${key}" data-rate="${key}" type="number" step="0.01" min="0" value="${state.rates[key]}" />`;
      })
      .join("");
  }

  els.sections.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.preventDefault();
      const id = del.getAttribute("data-del");
      state.projects = state.projects.filter((p) => p.id !== id);
      if (state.selectedId === id) state.selectedId = null;
      render();
      return;
    }
    const tr = e.target.closest("tr[data-id]");
    if (tr && !e.target.closest("input,select,button")) {
      state.selectedId = tr.getAttribute("data-id");
      render();
    }
  });

  els.sections.addEventListener("change", onField);
  els.sections.addEventListener("input", onField);

  function onField(e) {
    const t = e.target;
    const monthKeyValue = t.getAttribute("data-mhours");
    const f = t.getAttribute("data-f");
    if (!f && !monthKeyValue) return;
    const tr = t.closest("tr[data-id]");
    if (!tr) return;
    const id = tr.getAttribute("data-id");
    const p = state.projects.find((x) => x.id === id);
    if (!p) return;

    if (monthKeyValue) setMonthHours(p, monthKeyValue, t.value);
    else if (f === "erpCutover") p.erpCutover = t.checked;
    else if (f === "monthHours") {
      const month = selectedMonth();
      if (month) setMonthHours(p, monthKey(state.year, month), t.value);
    } else if (f === "quarterHours") {
      ensureHoursByQuarter(p)[state.quarter] = n(t.value);
      monthsInQuarter(state.quarter).forEach((item) => {
        delete ensureHoursByMonth(p)[item.key];
      });
    } else if (f === "weeks") p.weeks = String(t.value).trim() === "" ? null : n(t.value);
    else if (["std", "cpx", "ins", "premiumHours", "okr"].includes(f)) {
      p[f] = n(t.value);
      if (f === "std" || f === "cpx" || f === "ins") {
        p.flowCountFromTasks = false;
        if (p.source !== "manual") clearMonthHoursForFlows(p);
      }
    }
    else if (f === "assignee") p.assignee = normalizeAssignee(t.value);
    else p[f] = t.value;
    if (f === "status" && p.status === "Complete") {
      ensureCompliance(p).phase = "Completed";
    }
    if (f === "type" && isQuarterHoursType(p.type)) {
      const byQ = ensureHoursByQuarter(p);
      const hasAny = Object.values(byQ).some((h) => n(h) > 0);
      if (!hasAny && n(p.premiumHours) > 0) byQ[state.quarter] = n(p.premiumHours);
    }

    if (p.source === "manual" && !p.complianceOnly && (f === "name" || f === "assignee")) {
      linkManualProjectToOkr(state, p);
    }

    state.selectedId = id;
    requestAnimationFrame(() => render());
  }

  function onQuarterHourInput(e) {
    const q = e.target.getAttribute("data-qhours");
    const monthKeyValue = e.target.getAttribute("data-mhours");
    if (!q && !monthKeyValue) return;
    const p = state.projects.find((x) => x.id === state.selectedId);
    if (!p) return;
    if (monthKeyValue) setMonthHours(p, monthKeyValue, e.target.value);
    else {
      ensureHoursByQuarter(p)[q] = n(e.target.value);
      monthsInQuarter(q).forEach((item) => {
        delete ensureHoursByMonth(p)[item.key];
      });
    }
    requestAnimationFrame(() => render());
  }

  els.phaseQuarterForm.addEventListener("input", onQuarterHourInput);
  els.phaseQuarterForm.addEventListener("change", (e) => {
    if (e.target.getAttribute("data-qhours") || e.target.getAttribute("data-mhours")) return;
    const p = state.projects.find((x) => x.id === state.selectedId);
    if (!p) return;
    const toggleKey = e.target.getAttribute("data-phase-on");
    if (toggleKey) {
      if (!p.phasesActive) {
        p.phasesActive = {};
        PHASE_KEYS.forEach((k) => {
          p.phasesActive[k] = true;
        });
      }
      p.phasesActive[toggleKey] = e.target.checked;
      if (PHASE_KEYS.every((k) => p.phasesActive[k])) p.phasesActive = null;
      requestAnimationFrame(() => render());
      return;
    }
    const key = e.target.getAttribute("data-phase-q");
    if (!key) return;
    ensurePhaseQuarters(p, state.quarter);
    p.phaseQuarters[key] = e.target.value;
    p.quarterFocus = "full"; // manual override
    requestAnimationFrame(() => render());
  });

  els.quickFocusForm.addEventListener("change", (e) => {
    const kind = e.target.getAttribute("data-focus");
    if (!kind) return;
    const p = state.projects.find((x) => x.id === state.selectedId);
    if (!p) return;
    if (kind === "quarterFocus") {
      const anchor =
        els.quickFocusForm.querySelector('[data-focus="anchorQ"]')?.value || state.quarter;
      applyQuarterFocus(p, e.target.value, anchor);
    } else if (kind === "anchorQ") {
      applyQuarterFocus(p, p.quarterFocus || "full", e.target.value);
    }
    requestAnimationFrame(() => render());
  });

  els.btnTabEstimator.addEventListener("click", () => {
    state.uiTab = "estimator";
    render();
  });
  els.btnTabCompliance.addEventListener("click", () => {
    state.uiTab = "compliance";
    render();
  });
  els.btnTabOkr.addEventListener("click", () => {
    state.uiTab = "okr";
    render();
  });

  function findOkrRowFromElement(element) {
    const rowElement = element && element.closest("[data-okr-id]");
    if (!rowElement) return null;
    return state.okr.rows.find((row) => row.id === rowElement.getAttribute("data-okr-id")) || null;
  }

  els.okrTable.addEventListener("input", (event) => {
    const row = findOkrRowFromElement(event.target);
    if (!row) return;
    const phaseKey = event.target.getAttribute("data-okr-phase");
    const field = event.target.getAttribute("data-okr-field");
    if (phaseKey && OKR_PHASE_KEYS.includes(phaseKey)) {
      row.phases[phaseKey] = Math.max(0, Math.min(100, n(event.target.value)));
      row.phaseOverrides[phaseKey] = true;
      row.syncSource = row.rocketlaneProjectId ? "Rocketlane + manual override" : "Manual";
    } else if (field) {
      if (field === "achievementOverride") {
        row.achievementOverride =
          event.target.value === "" ? null : Math.max(0, Math.min(200, n(event.target.value)));
      } else {
        row[field] = field === "goal" || field === "weight" ? n(event.target.value) : event.target.value;
        if (field === "keyResult") row.syncName = false;
      }
    }
    save();
  });

  els.okrTable.addEventListener("change", (event) => {
    const row = findOkrRowFromElement(event.target);
    if (!row) return;
    if (event.target.hasAttribute("data-okr-link")) {
      const projectId = event.target.value;
      row.rocketlaneProjectId = projectId;
      const project = state.projects.find(
        (item) => String(item.id) === projectId || String(item.id) === "rl-" + projectId
      );
      if (project) {
        if (!row.keyResult || row.keyResult === "New project") {
          row.keyResult = project.source === "manual" ? project.name : `Deliver ${project.name}`;
        }
        row.owner = normalizeAssignee(project.assignee);
        row.projectType = okrProjectType(project);
        if (!row.details) row.details = project.notes || "";
        if (String(project.id).startsWith("rl-")) {
          row.phases = okrProgressSnapshot(projectId);
          row.phaseOverrides = {};
          row.syncSource = "Rocketlane snapshot";
          const snapshot = (window.OKR_PROGRESS_2026 || {})[projectId];
          row.syncedAt = snapshot && snapshot.syncedAt ? snapshot.syncedAt : "";
        } else {
          row.syncSource = "Estimator project";
          row.syncedAt = "";
        }
      } else {
        row.syncSource = "Manual";
        row.syncedAt = "";
      }
    }
    render();
  });

  els.okrTable.addEventListener("click", (event) => {
    const id = event.target.getAttribute("data-okr-delete");
    if (!id) return;
    const row = state.okr.rows.find((item) => item.id === id);
    if (!row || !window.confirm(`Remove “${row.keyResult || "this key result"}”?`)) return;
    state.okr.rows = state.okr.rows.filter((item) => item.id !== id);
    render();
  });

  els.okrQuarterFilter.addEventListener("change", (event) => {
    state.okr.quarter = event.target.value;
    render();
  });

  els.okrUserFilter.addEventListener("change", (event) => {
    state.okr.userFilter = event.target.value;
    render();
  });

  els.btnOkrAdd.addEventListener("click", () => {
    state.okr.rows.push(
      okrRow({
        quarter: state.okr.quarter,
        owner: state.okr.userFilter === "__all__" ? "Unassigned" : state.okr.userFilter,
      })
    );
    render();
  });

  els.btnOkrAddProjects.addEventListener("click", () => {
    const linked = new Set(
      state.okr.rows
        .filter((row) => row.quarter === state.okr.quarter && row.rocketlaneProjectId)
        .map((row) => String(row.rocketlaneProjectId))
    );
    let added = 0;
    state.projects.forEach((project) => {
      if (project.status === "Cancelled" || project.complianceOnly) return;
      const manual = project.source === "manual";
      if (!manual && !String(project.id || "").startsWith("rl-")) return;
      const projectId = String(project.id).replace(/^rl-/, "");
      if (linked.has(projectId)) return;
      const result = calcForQuarter(project, state.rates, state.okr.quarter, null);
      const inQuarter = result.hasWorkInQuarter || (manual && phaseAssignedToQuarter(project, state.okr.quarter));
      if (!inQuarter) return;
      if (manual) {
        if (linkManualProjectToOkr(state, project, state.okr.quarter)) added += 1;
        linked.add(projectId);
        return;
      }
      state.okr.rows.push(
        okrRow({
          quarter: state.okr.quarter,
          objective: okrObjectiveForProject(project),
          keyResult: `Deliver ${project.name}`,
          details: project.notes || "",
          projectType: okrProjectType(project),
          owner: normalizeAssignee(project.assignee),
          rocketlaneProjectId: projectId,
          phases: okrProgressSnapshot(projectId),
          syncSource: "Rocketlane snapshot",
          syncedAt:
            (window.OKR_PROGRESS_2026 || {})[projectId] &&
            window.OKR_PROGRESS_2026[projectId].syncedAt || "",
        })
      );
      linked.add(projectId);
      added += 1;
    });
    els.okrSyncStatus.textContent = added
      ? `Added ${added} project${added === 1 ? "" : "s"}. Weight is allocated quarter hours divided by quarter capacity.`
      : "Every project active in this quarter is already on the OKR sheet.";
    render();
  });

  els.btnOkrSync.addEventListener("click", async () => {
    const apiKey = String(els.okrRlApiKey.value || "").trim();
    if (!apiKey) {
      els.okrSyncStatus.textContent = "Enter a Rocketlane API key to sync.";
      els.okrRlApiKey.focus();
      return;
    }
    const rows = okrRowsForQuarter().filter((row) => {
      const project = okrLinkedProject(row);
      return project && /^\d+$/.test(String(row.rocketlaneProjectId || "").split("~")[0]) && String(project.id || "").startsWith("rl-");
    });
    if (!rows.length) {
      els.okrSyncStatus.textContent = "Link at least one Rocketlane project first.";
      els.okrRlApiKey.value = "";
      return;
    }
    els.btnOkrSync.disabled = true;
    const rowsByProject = new Map();
    rows.forEach((row) => {
      const projectId = String(row.rocketlaneProjectId || "").split("~")[0];
      if (!rowsByProject.has(projectId)) rowsByProject.set(projectId, []);
      rowsByProject.get(projectId).push(row);
    });
    let synced = 0;
    let failed = 0;
    const failureMessages = [];
    for (const [projectId, group] of rowsByProject) {
      els.okrSyncStatus.textContent = `Syncing ${synced + failed + 1} of ${rowsByProject.size}: ${group[0].keyResult}`;
      try {
        const phases = await fetchRocketlanePhaseRows(apiKey, projectId);
        const tasks = await fetchRocketlaneTasksForOkr(apiKey, projectId);
        const syncedPhases = computeRocketlaneOkrPhases(phases, tasks);
        const taskCount = tasks.filter((task) => !task.archived).length;
        group.forEach((row) => {
          OKR_PHASE_KEYS.forEach((key) => {
            if (!row.phaseOverrides[key]) row.phases[key] = syncedPhases[key];
          });
          const overrideCount = OKR_PHASE_KEYS.filter((key) => row.phaseOverrides[key]).length;
          row.syncSource = `Rocketlane · ${taskCount} tasks${overrideCount ? ` · ${overrideCount} manual override${overrideCount === 1 ? "" : "s"}` : ""}`;
          row.syncedAt = new Date().toISOString();
        });
        synced += 1;
      } catch (error) {
        failed += 1;
        const message = String(error.message || error || "Unknown error");
        group.forEach((row) => {
          row.syncSource = `Sync failed: ${message}`;
        });
        if (!failureMessages.includes(message)) failureMessages.push(message);
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    els.okrRlApiKey.value = "";
    els.btnOkrSync.disabled = false;
    els.okrSyncStatus.textContent = `Synced ${synced} project${synced === 1 ? "" : "s"}${failed ? `; ${failed} failed: ${failureMessages.join("; ")}` : ""}.`;
    render();
  });

  els.btnOkrExport.addEventListener("click", () => {
    const headers = [
      "Quarter", "Objective", "Key Result", "Details", "Owner", "Project Type",
      "Goal %", "Achievement %", "Weight %", "Weighted Result %", "Project Management %",
      "Mapping %", "Design %", "Development %", "Proof of Delivery %", "Confidence",
      "Feedback", "Manager Review", "Rocketlane Project ID", "Evidence", "Synced At",
    ];
    const quote = (value) => `"${String(value == null ? "" : value).replace(/"/g, '""')}"`;
    const lines = [headers.map(quote).join(",")];
    okrRowsForQuarter().forEach((row) => {
      const achievement = okrAchievement(row);
      lines.push(
        [
          row.quarter, row.objective, row.keyResult, row.details, row.owner, row.projectType,
          n(row.goal), achievement === null ? "" : achievement.toFixed(1), okrEffectiveWeight(row).toFixed(1), okrWeightedResult(row).toFixed(1),
          ...OKR_PHASE_KEYS.map((key) => n(row.phases[key])), okrConfidenceFor(row), row.feedback,
          row.managerReview, row.rocketlaneProjectId, row.evidence, row.syncedAt,
        ].map(quote).join(",")
      );
    });
    const blob = new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `integration-okrs-${state.okr.quarter.replace(/\s+/g, "-").toLowerCase()}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 0);
  });

  function updateComplianceFilter(key, value) {
    if (!state.complianceFilters) {
      state.complianceFilters = { status: "Scored", owner: "All", phase: "All" };
    }
    state.complianceFilters[key] = value;
    render();
  }

  els.complianceStatusFilter.addEventListener("change", (e) => {
    updateComplianceFilter("status", e.target.value);
  });
  els.complianceOwnerFilter.addEventListener("change", (e) => {
    updateComplianceFilter("owner", e.target.value);
  });
  els.compliancePhaseFilter.addEventListener("change", (e) => {
    updateComplianceFilter("phase", e.target.value);
  });
  els.complianceSourceFilter.addEventListener("change", (e) => {
    updateComplianceFilter("source", e.target.value);
  });

  function deleteProject(id) {
    const project = state.projects.find((p) => p.id === id);
    if (!project) return;
    const label = project.name || "this project";
    if (!window.confirm(`Delete ${label} from the tracker?`)) return;
    state.projects = state.projects.filter((p) => p.id !== id);
    if (state.selectedId === id) state.selectedId = state.projects[0]?.id || null;
    if (state.selectedComplianceId === id) state.selectedComplianceId = null;
    render();
  }

  function addManualComplianceProject() {
    const project = blankProject(state.quarter);
    project.name = "New manual project";
    project.type = "Other";
    project.source = "manual";
    project.std = 0;
    project.cpx = 0;
    project.premiumHours = 0;
    ensureCompliance(project).inScope = true;
    state.projects.push(project);
    state.selectedComplianceId = project.id;
    state.selectedId = project.id;
    if (state.complianceFilters) state.complianceFilters.source = "Manual";
    render();
  }

  async function addRocketlaneProject(apiProject) {
    const rocketlaneId = String(apiProject.projectId || apiProject.id || "");
    if (!rocketlaneId) return;
    const id = `rl-${rocketlaneId}`;
    const existing = state.projects.find((p) => p.id === id);
    if (existing) {
      state.selectedComplianceId = existing.id;
      render();
      return;
    }
    const apiKey = (els.rlApiKey.value || "").trim() || localStorage.getItem(RL_KEY_STORAGE) || "";
    let detail = apiProject;
    let tasks = [];
    let allocationQuarters = [];
    let phaseRows = [];
    let trackedMonths = {};
    if (apiKey) {
      els.rlSearchStatus.textContent = `Loading ${apiProject.projectName || rocketlaneId} from Rocketlane…`;
      try {
        detail = (await fetchRocketlaneProject(apiKey, rocketlaneId)) || apiProject;
        tasks = await fetchRocketlaneTasks(apiKey, rocketlaneId);
        allocationQuarters = await fetchRocketlaneAllocationQuarters(apiKey, rocketlaneId);
        phaseRows = await fetchRocketlanePhaseRows(apiKey, rocketlaneId);
      } catch (error) {
        els.rlSearchStatus.textContent =
          (error && error.message) || "Rocketlane project detail failed; added with search fields only.";
      }
    }
    const owner = detail.owner || apiProject.owner || {};
    const assignee = mapAssigneeFromRl(
      [owner.firstName, owner.lastName].filter(Boolean).join(" ")
    );
    const customer =
      (detail.customer && (detail.customer.companyName || detail.customer.customerName)) ||
      (apiProject.customer && (apiProject.customer.companyName || apiProject.customer.customerName)) ||
      "";
    const template = rocketlaneTemplateName(detail) || rocketlaneTemplateName(apiProject);
    const type = inferTypeFromRl(detail.projectName || apiProject.projectName, template);
    const planStart = detail.startDate || apiProject.startDate || "";
    const planDue = detail.dueDate || apiProject.dueDate || "";
    const isLifecycle = type === "Generic" || type === "Custom";
    const phaseDueDates = phaseDueMapFromRows(phaseRows);
    const phaseQuarters = isLifecycle
      ? quartersFromPhaseDueDates(
          phaseDueDates,
          phaseQuartersAcross(allocationQuarters) ||
            phaseQuartersFromRocketlaneTasks(tasks, planStart, planDue, state.quarter)
        ) || phaseQuartersFromRocketlaneTasks(tasks, planStart, planDue, state.quarter)
      : defaultPhaseQuarters(dateToQuarter(planDue || planStart, state.quarter));
    const flowCount = isLifecycle ? countDevelopmentFlows(tasks) : 0;
    const budgeted = n(detail.budgetedHours);
    const project = proj(
      {
        id,
        name: detail.projectName || apiProject.projectName || apiProject.name || `Rocketlane ${rocketlaneId}`,
        assignee,
        type,
        status: mapRocketlaneStatus(
          (detail.status && detail.status.label) || (apiProject.status && apiProject.status.label)
        ),
        source: "rocketlane",
        rocketlaneId,
        planStart,
        planDue,
        phaseDueDates: phaseDueDates || undefined,
        phaseQuarters,
        quarterFocus: "full",
        std: isLifecycle ? flowCount : 0,
        cpx: 0,
        ins: 0,
        premiumHours: isDirectHoursType(type) ? budgeted : 0,
        hoursByMonth: trackedMonths,
        hoursByQuarter: {},
        notes: [template || "Rocketlane", customer].filter(Boolean).join(" · "),
        compliance: { inScope: true, owner: assignee === "Unassigned" ? "" : assignee },
      },
      phaseQuarters.package || state.quarter
    );
    if (isLifecycle && hasFlowEstimate(project)) clearMonthHoursForFlows(project);
    state.projects.push(project);
    state.selectedComplianceId = project.id;
    state.selectedId = project.id;
    if (state.complianceFilters) state.complianceFilters.source = "Rocketlane";
    const phaseNote = isLifecycle
      ? PHASE_KEYS.map((key) => `${PHASE_LABELS[key]} ${project.phaseQuarters[key]}`).join(" · ")
      : project.phaseQuarters.package;
    els.rlSearchStatus.textContent = isLifecycle
      ? `Added ${project.name}: ${flowCount} flows · ${phaseNote}`
      : `Added ${project.name}`;
    renderRocketlaneResults();
    render();
  }

  function renderRocketlaneResults() {
    if (!rocketlaneSearchResults.length) {
      els.rlSearchResults.innerHTML = "";
      return;
    }
    els.rlSearchResults.innerHTML = `<ul class="rocketlane-results">${rocketlaneSearchResults
      .map((project, index) => {
        const id = `rl-${project.projectId || project.id}`;
        const present = state.projects.some((p) => p.id === id);
        const customer =
          (project.customer && (project.customer.companyName || project.customer.customerName)) ||
          "";
        const status = (project.status && project.status.label) || "";
        return `<li>
          <div>
            <strong>${escapeHtml(project.projectName || project.name || id)}</strong>
            <span class="table-sub">${escapeHtml([status, customer].filter(Boolean).join(" · "))}</span>
          </div>
          ${
            present
              ? '<span class="control-tag">In tracker</span>'
              : `<button type="button" class="btn primary" data-rl-add="${index}">Add</button>`
          }
        </li>`;
      })
      .join("")}</ul>`;
  }

  async function searchRocketlane() {
    const key = els.rlApiKey.value.trim();
    if (!key) {
      els.rlSearchStatus.textContent = "Paste a Rocketlane API key to search.";
      return;
    }
    localStorage.setItem(RL_KEY_STORAGE, key);
    const query = els.rlSearch.value.trim();
    const params = new URLSearchParams({ pageSize: "50" });
    if (query) params.set("projectName.cn", query);
    else params.set("status.eq", "2");
    els.rlSearchStatus.textContent = "Searching Rocketlane…";
    els.rlSearchResults.innerHTML = "";
    try {
      const response = await fetch(`/rocketlane/api/1.0/projects?${params.toString()}`, {
        headers: { "api-key": key, accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload.error || payload.message || `Rocketlane returned ${response.status}`;
        throw new Error(typeof message === "string" ? message : `Rocketlane returned ${response.status}`);
      }
      rocketlaneSearchResults = Array.isArray(payload.data) ? payload.data : [];
      els.rlSearchStatus.textContent = rocketlaneSearchResults.length
        ? `${rocketlaneSearchResults.length} Rocketlane projects`
        : "No Rocketlane projects matched.";
      renderRocketlaneResults();
    } catch (error) {
      rocketlaneSearchResults = [];
      els.rlSearchStatus.textContent = error.message || "Rocketlane search failed.";
    }
  }

  document.getElementById("btnComplianceAddManual").addEventListener("click", () => {
    addManualComplianceProject();
  });
  document.getElementById("btnComplianceAddRocketlane").addEventListener("click", () => {
    els.rocketlanePicker.classList.toggle("hidden");
    if (!els.rocketlanePicker.classList.contains("hidden") && !els.rlApiKey.value) {
      els.rlApiKey.value = localStorage.getItem(RL_KEY_STORAGE) || "";
    }
  });
  document.getElementById("btnRlSearch").addEventListener("click", () => {
    searchRocketlane();
  });
  els.rlSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchRocketlane();
    }
  });
  els.rlSearchResults.addEventListener("click", (e) => {
    const button = e.target.closest("[data-rl-add]");
    if (!button) return;
    const project = rocketlaneSearchResults[Number(button.getAttribute("data-rl-add"))];
    if (project) {
      addRocketlaneProject(project).catch((error) => {
        els.rlSearchStatus.textContent =
          (error && error.message) || "Could not add the Rocketlane project.";
      });
    }
  });

  els.complianceTable.addEventListener("click", (e) => {
    const del = e.target.closest("[data-compliance-del]");
    if (del) {
      e.preventDefault();
      deleteProject(del.getAttribute("data-compliance-del"));
      return;
    }
    const tr = e.target.closest("tr[data-compliance-id]");
    if (!tr) return;
    state.selectedComplianceId = tr.getAttribute("data-compliance-id");
    render();
  });

  els.complianceProfile.addEventListener("change", (e) => {
    const field = e.target.getAttribute("data-compliance-profile");
    if (!field) return;
    const p = state.projects.find((project) => project.id === state.selectedComplianceId);
    if (!p) return;
    const compliance = ensureCompliance(p);
    compliance[field] = field === "inScope" ? e.target.checked : e.target.value;
    render();
  });

  els.complianceChecklist.addEventListener("change", (e) => {
    const controlId = e.target.getAttribute("data-compliance-control");
    const field = e.target.getAttribute("data-compliance-field");
    if (!controlId || !field) return;
    const p = state.projects.find((project) => project.id === state.selectedComplianceId);
    if (!p) return;
    const compliance = ensureCompliance(p);
    const record = compliance.controls[controlId];
    if (!record) return;
    record[field] = e.target.value;
    if (field === "status" && record.status === "Complete" && !record.completedDate) {
      record.completedDate = todayIso();
    }
    render();
  });

  document.getElementById("btnComplianceExport").addEventListener("click", () => {
    const headers = [
      "Project",
      "Estimator Status",
      "Type",
      "Assignee",
      "Compliance Scope",
      "Compliance Owner",
      "IMPACT Phase",
      "Compliance Status",
      "Score",
      "Complete Controls",
      "Applicable Controls",
      "Overdue Controls",
      "Critical Overdue",
      "Next Action",
    ];
    COMPLIANCE_CONTROLS.forEach((definition) => {
      headers.push(
        `${definition.label} Status`,
        `${definition.label} Due`,
        `${definition.label} Completed`,
        `${definition.label} Evidence`,
        `${definition.label} Notes`
      );
    });
    const csvRows = [headers];
    complianceRows().forEach(({ p, result }) => {
      const compliance = ensureCompliance(p);
      const row = [
        p.name,
        p.status,
        p.type,
        normalizeAssignee(p.assignee),
        compliance.inScope ? "Included" : "Excluded",
        compliance.owner,
        compliance.phase,
        result.status,
        result.score == null ? "" : `${result.score}%`,
        result.complete,
        result.applicable,
        result.overdue.length,
        result.criticalOverdue.length,
        result.nextAction,
      ];
      COMPLIANCE_CONTROLS.forEach((definition) => {
        const record = compliance.controls[definition.id];
        row.push(
          record.status,
          record.dueDate,
          record.completedDate,
          record.evidence,
          record.notes
        );
      });
      csvRows.push(row);
    });
    const csv = csvRows
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `project-compliance-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  els.btnModeQuick.addEventListener("click", () => {
    state.uiMode = "quick";
    render();
  });
  els.btnModeFull.addEventListener("click", () => {
    state.uiMode = "full";
    render();
  });

  els.userReport.addEventListener("click", (e) => {
    const card = e.target.closest("[data-user]");
    if (!card) return;
    const user = card.getAttribute("data-user");
    state.userFilter = state.userFilter === user ? "__all__" : user;
    render();
  });

  els.configForm.addEventListener("change", (e) => {
    const key = e.target.getAttribute("data-rate");
    if (!key) return;
    state.rates[key] = n(e.target.value);
    render();
  });

  els.yearInput.addEventListener("change", () => {
    state.year = n(els.yearInput.value) || 2026;
    const qs = quartersForYear(state.year);
    if (!qs.includes(state.quarter)) state.quarter = qs[2] || qs[0];
    render();
  });

  els.quarterFilter.addEventListener("change", () => {
    state.quarter = els.quarterFilter.value;
    state.month = selectedMonth();
    render();
  });

  els.monthFilter.addEventListener("change", () => {
    state.month = n(els.monthFilter.value) || 0;
    render();
  });

  els.userFilter.addEventListener("change", () => {
    state.userFilter = els.userFilter.value;
    render();
  });

  document.getElementById("btnAdd").addEventListener("click", () => {
    const p = blankProject(state.quarter);
    p.source = "manual";
    p.std = 0;
    p.cpx = 0;
    p.ins = 0;
    if (state.userFilter && state.userFilter !== "__all__") {
      p.assignee = state.userFilter;
    }
    state.projects.push(p);
    state.selectedId = p.id;
    linkManualProjectToOkr(state, p, state.quarter);
    render();
    requestAnimationFrame(() => {
      const input = els.sections.querySelector(
        `tr[data-id="${CSS.escape(p.id)}"] [data-f="name"]`
      );
      if (input) {
        input.focus();
        input.select();
      }
    });
  });

  const importInput = document.getElementById("importCsvInput");
  document.getElementById("btnImport").addEventListener("click", () => {
    importInput.value = "";
    importInput.click();
  });
  importInput.addEventListener("change", () => {
    if (!importInput.files?.length) return;
    importRocketlaneCsvFiles(importInput.files).catch((err) => {
      console.error(err);
      alert("Import failed: " + (err && err.message ? err.message : String(err)));
    });
  });

  document.getElementById("btnReset").addEventListener("click", () => {
    if (!confirm("Reset to the September–October Integration projects and default rates?")) return;
    const year = state.year || 2026;
    state = {
      year,
      quarter: quarterId(year, 3),
      month: 0,
      rates: { ...DEFAULT_RATES },
      ratesVersion: RATES_VERSION,
      projects: baselineProjects(year),
      portfolioSource: PORTFOLIO_SOURCE,
      onurTeamTasks2026: true,
      selectedId: null,
      userFilter: "__all__",
      uiMode: state.uiMode || "quick",
      uiTab: state.uiTab || "estimator",
      complianceFilters: { status: "Scored", owner: "All", phase: "All", source: "All" },
      complianceVersion: 1,
      selectedComplianceId: null,
      okr: { quarter: "Q4 2026", rows: sampleOkrRows() },
      okrVersion: 1,
      localTransferId: LOCAL_TRANSFER_ID,
    };
    applyPipelineCompliance(state);
    applyMcCompliance(state);
    applyRocketlanePortfolioAdditions(state);
    applyOnAirDirectAddition(state);
    applyCreated2026Projects(state);
    applyJohnPortfolio(state);
    applyTemplateClassification(state);
    applyLentifulFlowCorrection(state);
    applyDevelopmentSubtaskFlows(state);
    applyProjectPlanQuarters(state);
    applyPhaseTimelineSpread(state);
    applyAllocationPhaseQuarters(state);
    applyPhaseDueQuarters(state);
    applyClearFlowMonthHours(state);
    applyPremiumMonthHours(state);
    applyFullYearMonthHours(state);
    applyOkrOwnerProjects(state);
    applyOkrManualEstimatorProjects(state);
    render();
  });

  document.getElementById("btnExport").addEventListener("click", () => {
    const computed = computeAll();
    const groups = groupByUser(computed);
    const teamHoursWeight = computed
      .filter((x) => x.p.status !== "Cancelled" && x.c.hasWorkInQuarter)
      .reduce((s, x) => s + x.c.quarterHours, 0);

    const headers = [
      "Quarter",
      "Assignee",
      "Project",
      "Type",
      "Status",
      "Total SP",
      "Quarter SP",
      "Quarter Hours",
      "User Work %",
      "Team Work %",
      "Initiate Q",
      "Mapping Q",
      "Package Q",
      "Adapt Q",
      "Commence Q",
      "Transition Q",
      "Initiate Hrs (lifecycle)",
      "Mapping Hrs",
      "Package Hrs",
      "Adapt Hrs",
      "Commence Hrs",
      "Transition Hrs",
      "OKR Weight",
      "Notes",
    ];
    const lines = [headers.join(",")];

    for (const g of groups) {
      const ut = userTotals(g.rows);
      for (const { p, c } of g.rows) {
        ensurePhaseQuarters(p, state.quarter);
        const userPct =
          ut.weight > 0 && p.status !== "Cancelled" ? c.quarterHours / ut.weight : 0;
        const teamPct =
          teamHoursWeight > 0 && p.status !== "Cancelled" ? c.quarterHours / teamHoursWeight : 0;
        const row = [
          state.quarter,
          normalizeAssignee(p.assignee),
          p.name,
          p.type,
          p.status,
          c.totalSP,
          c.quarterSP,
          c.quarterHours,
          (userPct * 100).toFixed(2) + "%",
          (teamPct * 100).toFixed(2) + "%",
          p.phaseQuarters.initiate,
          p.phaseQuarters.mapping,
          p.phaseQuarters.package,
          p.phaseQuarters.adapt,
          p.phaseQuarters.commence,
          p.phaseQuarters.transition,
          c.phases.initiate,
          c.phases.mapping,
          c.phases.package,
          c.phases.adapt,
          c.phases.commence,
          c.phases.transition,
          (() => {
            const full = calcForQuarter(p, state.rates, state.quarter, null);
            const hours = p.status === "Cancelled" || !full.hasWorkInQuarter ? 0 : full.quarterHours;
            const weight = okrHoursWeight(hours, state.quarter);
            return weight == null ? "" : weight.toFixed(1) + "%";
          })(),
          p.notes,
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
        lines.push(row.join(","));
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `story-point-estimator-${state.quarter.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("btnPrint").addEventListener("click", () => {
    window.print();
  });

  render();
})();
