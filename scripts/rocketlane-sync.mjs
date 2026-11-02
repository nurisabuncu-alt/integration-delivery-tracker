// Scheduled Rocketlane refresh.
// Includes an integration-template project when one of its phases falls in a 2026 quarter.
// Created date and project status are not filters. Archived, "do not use", and
// Logiwa IO-IMPACT Methodology templates are skipped. Month hours are not imported.
// Does not call the time-entries API.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = join(root, "local-snapshot.js");
const syncPath = join(root, "rocketlane-sync.js");
const indexPath = join(root, "index.html");
const phaseKeys = ["initiate", "mapping", "package", "adapt", "commence", "transition"];
const okrPhaseKeys = ["projectManagement", "mapping", "design", "development", "proofOfDelivery"];
const shellNames = {
  initiate: ["host system setup", "integration account setup", "integration - kick off", "kickoff call", "kick-off and project analysis meeting", "initiate"],
  mapping: ["design documents", "integration - high level design architecture", "review design document and test scenarios", "internal integration design review", "mapping"],
  package: ["development", "package"],
  adapt: ["functional tests", "integration process - functional tests", "end-to-end testing", "end-to-end test scenario final review", "adapt"],
  commence: ["go live", "go-live", "1st week of go live", "checkpoint for go-live", "commence"],
  transition: ["hypercare", "integration hypercare", "transition"],
};

const apiKey = String(process.env.ROCKETLANE_API_KEY || "").trim();
if (!apiKey) {
  console.error("Rocketlane API key secret is missing.");
  process.exit(1);
}

function readAssignment(file, name) {
  const text = readFileSync(file, "utf8");
  const marker = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (marker < 0 || end < marker) throw new Error(`${name} is missing its data object`);
  return JSON.parse(text.slice(marker, end + 1));
}

function writeAssignment(file, name, value) {
  const json = JSON.stringify(value);
  if (json.includes(apiKey)) throw new Error("Refusing to write the Rocketlane key into the site.");
  writeFileSync(file, `window.${name} = ${json};\n`, "utf8");
}

function quarterId(year, quarter) {
  return `Q${quarter} ${year}`;
}

function quarterFromDate(dateStr) {
  const match = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return quarterId(Number(match[1]), Math.floor((Number(match[2]) - 1) / 3) + 1);
}

function defaultPhaseQuarters(quarter) {
  return {
    initiate: quarter,
    mapping: quarter,
    package: quarter,
    adapt: quarter,
    commence: quarter,
    transition: quarter,
  };
}

function phaseQuartersFromPlan(start, due, fallback) {
  const startOk = /^\d{4}-\d{2}-\d{2}$/.test(start || "");
  const dueOk = /^\d{4}-\d{2}-\d{2}$/.test(due || "");
  if (!startOk && !dueOk) return defaultPhaseQuarters(fallback);
  if (!startOk || !dueOk || start === due) return defaultPhaseQuarters(quarterFromDate(due || start) || fallback);
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const dueMs = Date.parse(`${due}T00:00:00Z`);
  if (!(dueMs > startMs)) return defaultPhaseQuarters(quarterFromDate(due) || fallback);
  const result = {};
  phaseKeys.forEach((key, index) => {
    const ms = startMs + ((dueMs - startMs) * index) / (phaseKeys.length - 1);
    const date = new Date(ms);
    result[key] = quarterId(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) + 1);
  });
  return result;
}

function shellPhase(taskName) {
  const name = String(taskName || "").trim().toLowerCase();
  if (!name) return null;
  for (const key of phaseKeys) {
    if (shellNames[key].includes(name)) return key;
  }
  return null;
}

function phaseQuartersFromTasks(tasks, start, due, fallback) {
  const base = phaseQuartersFromPlan(start, due, fallback);
  const datesByPhase = {};
  (tasks || []).forEach((task) => {
    const phase = shellPhase(task.taskName || task.name);
    const date = String(task.dueDate || task.startDate || "").slice(0, 10);
    if (!phase || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (!datesByPhase[phase]) datesByPhase[phase] = [];
    datesByPhase[phase].push(date);
  });
  phaseKeys.forEach((key) => {
    const dates = datesByPhase[key];
    if (!dates || !dates.length) return;
    dates.sort();
    base[key] = quarterFromDate(dates[dates.length - 1]) || base[key];
  });
  return base;
}

function impactKeysFromPhaseName(name) {
  const value = String(name || "").trim().toLowerCase();
  if (value.startsWith("initiate") || value.startsWith("analysis")) return ["initiate"];
  if (value.startsWith("design") || value.startsWith("mapping")) return ["mapping"];
  if (value.startsWith("package")) return ["package"];
  if (value.startsWith("development")) return ["package", "adapt"];
  if (value.startsWith("adapt") || value.startsWith("end to end") || value.startsWith("end-to-end")) return ["adapt"];
  if (value.startsWith("commence") || value.startsWith("go live") || value.startsWith("go-live") || value === "launch") return ["commence"];
  if (value.startsWith("transition") || value.startsWith("hypercare") || value.startsWith("hyper care") || value.startsWith("closure")) return ["transition"];
  return [];
}

function phaseDueMap(rows) {
  const dues = {};
  (rows || []).forEach((row) => {
    const due = String(row.dueDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return;
    impactKeysFromPhaseName(row.phaseName || row.name).forEach((key) => {
      if (!dues[key] || due > dues[key]) dues[key] = due;
    });
  });
  const latest = phaseKeys.map((key) => dues[key]).filter(Boolean).sort().pop();
  if (latest && !dues.commence) dues.commence = latest;
  if (latest && !dues.transition) dues.transition = dues.commence;
  return Object.keys(dues).length ? dues : null;
}

function quartersFromPhaseDues(dues, fallback) {
  const result = Object.assign({}, fallback || {});
  if (!dues) return Object.keys(result).length ? result : null;
  phaseKeys.forEach((key) => {
    const quarter = quarterFromDate(dues[key]);
    if (quarter) result[key] = quarter;
  });
  return result;
}

function quarterSortKey(value) {
  const match = String(value).match(/^Q([1-4])\s+(\d{4})$/);
  if (!match) return 0;
  return Number(match[2]) * 4 + Number(match[1]);
}

function phaseQuartersAcross(quarters) {
  const list = (quarters || []).slice().sort((left, right) => quarterSortKey(left) - quarterSortKey(right));
  if (!list.length) return null;
  const result = {};
  const last = list.length - 1;
  phaseKeys.forEach((key, index) => {
    result[key] = list[Math.round((index * last) / (phaseKeys.length - 1))];
  });
  return result;
}

function templateName(project) {
  const sources = project && project.sources;
  if (!Array.isArray(sources)) return "";
  for (const source of sources) {
    if (source && source.templateName) return String(source.templateName);
  }
  return "";
}

function isIntegrationTemplate(name) {
  const value = String(name || "");
  if (/do not use/i.test(value)) return false;
  if (value.includes("(Integration)")) return true;
  if (/\(Onboarding\/Integration\)/i.test(value)) return true;
  if (/Integration Project Template|Integration Template/i.test(value)) return true;
  return false;
}

function isImpactMethodology(project, template) {
  const source = `${template || ""} ${templateName(project)} ${project && (project.projectName || project.name) || ""}`;
  return /impact methodology|logiwa io-impact/i.test(source);
}

function mapAssignee(userName) {
  const value = String(userName || "").toLowerCase();
  if (value.includes("onur")) return "Onur";
  if (value.includes("cihan")) return "Cihan";
  if (value.includes("uygar")) return "Uygar";
  if (value.includes("parlier") || value === "john") return "John";
  return "Unassigned";
}

function mapStatus(label) {
  const value = String(label || "").toLowerCase();
  if (value === "completed") return "Complete";
  if (value === "cancelled") return "Cancelled";
  if (value === "on hold") return "OnHold";
  return "InProgress";
}

function inferType(projectName, template) {
  const project = String(projectName || "").toLowerCase();
  const source = String(template || "").toLowerCase();
  if (project.includes("premium api") || project.includes("premium support") || source.includes("premium")) return "Premium API Support";
  if (source.includes("generic") || project.includes("generic")) return "Generic";
  if (source.includes("custom") || project.includes("custom")) return "Custom";
  if (project.includes("misc") || project.includes("newsletter") || project.includes("improvement list")) return "Misc";
  return "Custom";
}

function developmentFlowKey(taskName) {
  const raw = String(taskName || "").trim();
  if (!raw.endsWith(" - Development") || raw === "Development") return null;
  let stem = raw.slice(0, -" - Development".length).trim();
  if (!stem) return null;
  const edi = stem.match(/^(\d{3})\b/);
  if (edi) return `EDI ${edi[1]}`;
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

function countFlows(tasks) {
  const keys = new Set();
  (tasks || []).forEach((task) => {
    const key = developmentFlowKey(task.taskName || task.name);
    if (key) keys.add(key);
  });
  return keys.size;
}

function statusProgress(status) {
  const value = status && status.value != null && status.value !== "" ? Number(status.value) : 0;
  const label = String((status && status.label) || "").toLowerCase();
  if (value >= 3 || label.includes("complete") || label.includes("done")) return 100;
  if (value === 2 || label.includes("progress") || label.includes("blocked")) return 50;
  return 0;
}

function okrBucket(name) {
  const value = String(name || "").toLowerCase();
  if (value.includes("initiate") || value.includes("analysis") || value.includes("setup")) return "projectManagement";
  if (value.includes("mapping")) return "mapping";
  if (value.includes("design")) return "design";
  if (value.includes("package") || value.includes("development")) return "development";
  if (value.includes("adapt") || value.includes("test") || value.includes("commence") || value.includes("go live") || value.includes("launch") || value.includes("transition") || value.includes("hypercare") || value.includes("closure")) {
    return "proofOfDelivery";
  }
  return "projectManagement";
}

function computeOkrPhases(phaseRows, taskRows) {
  const tasksByPhase = {};
  const designScores = [];
  let taskCount = 0;
  (taskRows || []).forEach((task) => {
    if (task.archived) return;
    taskCount += 1;
    const statusLabel = String((task.status && task.status.label) || "").toLowerCase();
    if (statusLabel.includes("cancel") || statusLabel.includes("not applicable")) return;
    const phaseId = task.phase && String(task.phase.phaseId || "");
    if (!phaseId) return;
    if (!tasksByPhase[phaseId]) tasksByPhase[phaseId] = [];
    const score = task.progress != null && task.progress !== "" && Number.isFinite(Number(task.progress))
      ? Math.max(0, Math.min(100, Number(task.progress)))
      : statusProgress(task.status);
    tasksByPhase[phaseId].push(score);
    if (/\b(design|architecture|business rules?|solution document|design document)\b/i.test(task.taskName || "")) {
      designScores.push(score);
    }
  });
  const buckets = {};
  okrPhaseKeys.forEach((key) => {
    buckets[key] = [];
  });
  (phaseRows || []).forEach((phase) => {
    if (phase.archived) return;
    const scores = tasksByPhase[String(phase.phaseId || "")] || [];
    const phaseStatus = statusProgress(phase.status);
    const score = phaseStatus === 100 ? 100 : scores.length ? scores.reduce((sum, item) => sum + item, 0) / scores.length : phaseStatus;
    buckets[okrBucket(phase.phaseName || phase.name)].push({ score, weight: Math.max(1, scores.length) });
  });
  if (designScores.length) buckets.design = designScores.map((score) => ({ score, weight: 1 }));
  const phases = {};
  okrPhaseKeys.forEach((key) => {
    const values = buckets[key];
    const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
    phases[key] = totalWeight ? Math.round(values.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight) : 0;
  });
  return { phases, taskCount };
}

async function rocketlaneGet(path) {
  if (/time-entries/i.test(path)) throw new Error("Time entries are not part of this refresh.");
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(`https://api.rocketlane.com${path}`, {
      headers: { "api-key": apiKey, accept: "application/json" },
    });
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Rocketlane rejected the API key (${response.status}).`);
    }
    if (response.ok) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return text ? JSON.parse(text) : {};
    }
    lastError = new Error(`Rocketlane returned ${response.status} for ${path.split("?")[0]}`);
    if (![429, 502, 503].includes(response.status) || attempt === 5) throw lastError;
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
  }
  throw lastError;
}

async function rocketlanePages(path) {
  const rows = [];
  let next = path;
  let guard = 0;
  while (next && guard < 40) {
    guard += 1;
    const payload = await rocketlaneGet(next);
    (Array.isArray(payload.data) ? payload.data : []).forEach((row) => rows.push(row));
    const page = payload.pagination;
    if (!(page && page.hasMore && page.nextPage)) break;
    next = String(page.nextPage).replace(/^https?:\/\/api\.rocketlane\.com/i, "");
    if (!next.startsWith("/")) next = `/${next.replace(/^\/+/, "")}`;
  }
  return rows;
}

function allocationQuarters(rows) {
  const quarters = new Set();
  (rows || []).forEach((row) => {
    const start = String(row.startDate || "").slice(0, 10);
    const end = String(row.endDate || start).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return;
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const last = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
    while (cursor <= last) {
      quarters.add(quarterId(cursor.getUTCFullYear(), Math.floor(cursor.getUTCMonth() / 3) + 1));
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
  });
  return [...quarters];
}

function personName(person) {
  if (!person || typeof person !== "object") return "";
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
}

function rosterPerson(person) {
  const mapped = mapAssignee(personName(person));
  return mapped === "Unassigned" ? "" : mapped;
}

function taskMembers(task) {
  const members = task && task.assignees && task.assignees.members;
  if (!members) return [];
  return Array.isArray(members) ? members : [members];
}

function flowsForPerson(tasks, person, owner) {
  const keys = new Set();
  (tasks || []).forEach((task) => {
    const key = developmentFlowKey(task.taskName || task.name);
    if (!key) return;
    const people = taskMembers(task).map(rosterPerson).filter(Boolean);
    if (people.includes(person) || (people.length === 0 && person === owner)) keys.add(key);
  });
  return keys.size;
}

function personPhaseKeys(person, tasks, allocations, phaseNames) {
  const keys = new Set();
  (tasks || []).forEach((task) => {
    const included = taskMembers(task).some((member) => rosterPerson(member) === person);
    if (!included) return;
    const phaseId = task.phase && String(task.phase.phaseId || "");
    impactKeysFromPhaseName(phaseNames[phaseId] || "").forEach((key) => keys.add(key));
  });
  (allocations || []).forEach((row) => {
    if (rosterPerson(row.member) !== person) return;
    const phaseId = String(row.workId || "");
    impactKeysFromPhaseName(phaseNames[phaseId] || "").forEach((key) => keys.add(key));
  });
  return [...keys];
}

function phasesActiveFor(keys) {
  if (!keys.length) return null;
  const active = {};
  phaseKeys.forEach((key) => {
    active[key] = keys.includes(key);
  });
  return active;
}

function buildPortfolioRows(detail, tasks, phaseRows, allocations, fallbackQuarter) {
  const ownerName = [detail.owner && detail.owner.firstName, detail.owner && detail.owner.lastName].filter(Boolean).join(" ");
  const owner = mapAssignee(ownerName);
  const people = new Set();
  if (owner !== "Unassigned") people.add(owner);
  (tasks || []).forEach((task) => {
    taskMembers(task).forEach((member) => {
      const person = rosterPerson(member);
      if (person) people.add(person);
    });
  });
  (allocations || []).forEach((row) => {
    const person = rosterPerson(row.member);
    if (person) people.add(person);
  });
  if (!people.size) return [];
  const primary = people.has(owner) ? owner : [...people][0];
  const customer = (detail.customer && (detail.customer.companyName || detail.customer.customerName)) || "";
  const template = templateName(detail);
  const type = inferType(detail.projectName, template);
  const planStart = detail.startDate || "";
  const planDue = detail.dueDate || "";
  const lifecycle = type === "Generic" || type === "Custom";
  const dues = phaseDueMap(phaseRows);
  const fromTasks = phaseQuartersFromTasks(tasks, planStart, planDue, fallbackQuarter);
  const phaseQuarters = lifecycle
    ? quartersFromPhaseDues(dues, phaseQuartersAcross(allocationQuarters(allocations)) || fromTasks) || fromTasks
    : defaultPhaseQuarters(quarterFromDate(planDue || planStart) || fallbackQuarter);
  const phaseNames = {};
  (phaseRows || []).forEach((phase) => {
    phaseNames[String(phase.phaseId || "")] = phase.phaseName || phase.name || "";
  });
  const rocketlaneId = String(detail.projectId || detail.id);
  const directHours = type === "Premium API Support" || type === "Misc";
  return [...people].map((person) => {
    const share = person !== primary;
    const includedPhases = personPhaseKeys(person, tasks, allocations, phaseNames);
    return {
      id: share ? `rl-${rocketlaneId}~${person}` : `rl-${rocketlaneId}`,
      name: detail.projectName || `Rocketlane ${rocketlaneId}`,
      assignee: person,
      type,
      status: mapStatus(detail.status && detail.status.label),
      category: "Other",
      effort: "New Development",
      std: lifecycle ? flowsForPerson(tasks, person, owner) : 0,
      cpx: 0,
      ins: 0,
      dependency: "Stable",
      mapping: "Simple",
      connection: "Other",
      erpCutover: false,
      premiumHours: !share && directHours ? Number(detail.budgetedHours) || 0 : 0,
      weeks: null,
      okr: 0,
      notes: [template || "Rocketlane", customer, share ? `Shared portfolio · ${person}` : ""].filter(Boolean).join(" · "),
      quarterFocus: "full",
      phaseQuarters,
      phasesActive: share ? phasesActiveFor(includedPhases) : null,
      source: "rocketlane",
      rocketlaneId,
      portfolioShare: share,
      flowCountFromTasks: true,
      updateFlowCount: true,
      planStart,
      planDue,
      phaseDueDates: dues || undefined,
      hoursByMonth: {},
      hoursByQuarter: {},
      compliance: {
        inScope: person === owner && owner !== "Unassigned",
        owner: person === "Unassigned" ? "" : person,
        phase: "Initiate",
        controls: {},
      },
    };
  });
}

function blankOkrPhases() {
  return { projectManagement: 0, mapping: 0, design: 0, development: 0, proofOfDelivery: 0 };
}

function rangeOverlaps2026(start, due) {
  const from = String(start || "").slice(0, 10);
  const to = String(due || "").slice(0, 10);
  const startOk = /^\d{4}-\d{2}-\d{2}$/.test(from);
  const dueOk = /^\d{4}-\d{2}-\d{2}$/.test(to);
  if (!startOk && !dueOk) return null;
  const left = startOk ? from : to;
  const right = dueOk ? to : from;
  return left <= "2026-12-31" && right >= "2026-01-01";
}

function quartersFor(phaseQuarters, phasesActive) {
  const found = [];
  phaseKeys.forEach((key) => {
    if (phasesActive && phasesActive[key] !== true) return;
    const quarter = phaseQuarters && phaseQuarters[key];
    if (!quarter || !String(quarter).endsWith("2026") || found.includes(quarter)) return;
    found.push(quarter);
  });
  found.sort((left, right) => quarterSortKey(left) - quarterSortKey(right));
  return found;
}

function keysForQuarter(phaseQuarters, phasesActive, quarter) {
  return phaseKeys.filter((key) => {
    if (phasesActive && phasesActive[key] !== true) return false;
    return phaseQuarters && phaseQuarters[key] === quarter;
  });
}

function progressForQuarter(phaseRows, tasks, keys) {
  const allowed = new Set(keys);
  const phaseIds = new Set();
  (phaseRows || []).forEach((phase) => {
    const names = impactKeysFromPhaseName(phase.phaseName || phase.name);
    if (names.some((key) => allowed.has(key))) phaseIds.add(String(phase.phaseId || ""));
  });
  const relevantPhases = (phaseRows || []).filter((phase) => phaseIds.has(String(phase.phaseId || "")));
  const relevantTasks = (tasks || []).filter((task) => phaseIds.has(String((task.phase && task.phase.phaseId) || "")));
  if (!relevantPhases.length) return { phases: blankOkrPhases(), taskCount: 0 };
  return computeOkrPhases(relevantPhases, relevantTasks);
}

const snapshot = readAssignment(snapshotPath, "LOCAL_SNAPSHOT");
const sync = readFileSync(syncPath, "utf8").includes("ROCKETLANE_SYNC")
  ? readAssignment(syncPath, "ROCKETLANE_SYNC")
  : { syncedAt: "", projects: [], okrPhases: {} };
if (!Array.isArray(snapshot.projects)) snapshot.projects = [];
if (!snapshot.okr) snapshot.okr = { rows: [] };
if (!Array.isArray(sync.projects)) sync.projects = [];
if (!sync.okrPhases) sync.okrPhases = {};

const fallbackQuarter = snapshot.quarter || "Q4 2026";
const syncedAt = new Date().toISOString();
const rebuild = !snapshot.timelinePortfolio2026;
let added = 0;
let removed = 0;
let flowsUpdated = 0;
let okrAdded = 0;
let phasesUpdated = 0;
const accepted = new Set();

if (rebuild) {
  const previousProjects = snapshot.projects.length;
  const previousRows = (snapshot.okr && snapshot.okr.rows && snapshot.okr.rows.length) || 0;
  snapshot.projects = [];
  snapshot.okr = { quarter: snapshot.okr && snapshot.okr.quarter ? snapshot.okr.quarter : "Q4 2026", userFilter: "__all__", rows: [] };
  sync.projects = [];
  sync.okrRows = [];
  sync.okrPhases = {};
  console.log(`Replacing the current portfolio (${previousProjects} projects, ${previousRows} OKR rows).`);
}

function upsertSyncProject(row) {
  const index = sync.projects.findIndex((item) => item && item.id === row.id);
  if (index >= 0) sync.projects[index] = row;
  else sync.projects.push(row);
}

function upsertPortfolioRow(row) {
  const existing = snapshot.projects.find((item) => item.id === row.id);
  if (!existing) {
    snapshot.projects.push(row);
    added += 1;
    const quarters = quartersFor(row.phaseQuarters, row.phasesActive).join(", ");
    console.log(`Added ${row.id} ${row.assignee} flows=${row.std} ${quarters}`);
    return;
  }
  if (row.updateFlowCount && existing.flowCountFromTasks !== false && Number(existing.std) !== Number(row.std)) {
    existing.std = row.std;
    existing.cpx = 0;
    existing.ins = 0;
    existing.flowCountFromTasks = true;
    flowsUpdated += 1;
  }
  existing.phaseQuarters = row.phaseQuarters;
  existing.phasesActive = row.phasesActive;
  existing.phaseDueDates = row.phaseDueDates;
  existing.planStart = row.planStart;
  existing.planDue = row.planDue;
  existing.status = row.status;
  existing.portfolioShare = row.portfolioShare;
}

function syncQuarterOkrs(row, phaseRows, tasks) {
  const quarters = quartersFor(row.phaseQuarters, row.phasesActive);
  const linkId = row.id.replace(/^rl-/, "");
  const keep = new Set(quarters);
  snapshot.okr.rows = snapshot.okr.rows.filter((okr) => {
    if (String(okr.rocketlaneProjectId || "") !== linkId) return true;
    return keep.has(okr.quarter);
  });
  quarters.forEach((quarter) => {
    const computed = progressForQuarter(phaseRows, tasks, keysForQuarter(row.phaseQuarters, row.phasesActive, quarter));
    sync.okrPhases[`${linkId}|${quarter}`] = {
      phases: computed.phases,
      taskCount: computed.taskCount,
      quarter,
      syncedAt,
    };
    const existing = snapshot.okr.rows.find(
      (okr) => String(okr.rocketlaneProjectId || "") === linkId && okr.quarter === quarter
    );
    if (!existing) {
      snapshot.okr.rows.push({
        id: `okr-${row.id}-${quarter.replace(/\s+/g, "")}`,
        quarter,
        objective: row.type === "Other" || row.type === "Misc" ? "Operational Excellence" : "Activated ARR",
        keyResult: row.name,
        details: "",
        goal: 100,
        achievementOverride: null,
        weight: 0,
        feedback: "",
        managerReview: "",
        projectType: row.type === "Premium API Support" ? "API Support" : row.type === "Other" || row.type === "Misc" ? "Misc" : "Integration",
        owner: row.assignee,
        confidence: "Not set",
        rocketlaneProjectId: linkId,
        evidence: "",
        phases: computed.phases,
        phaseOverrides: {},
        syncSource: `Rocketlane · ${computed.taskCount} tasks`,
        syncedAt,
        syncName: true,
      });
      okrAdded += 1;
      return;
    }
    if (!existing.phases) existing.phases = blankOkrPhases();
    if (!existing.phaseOverrides) existing.phaseOverrides = {};
    let changed = false;
    okrPhaseKeys.forEach((key) => {
      if (existing.phaseOverrides[key]) return;
      if (Number(existing.phases[key]) !== Number(computed.phases[key])) {
        existing.phases[key] = computed.phases[key];
        changed = true;
      }
    });
    if (!changed) return;
    const overrideCount = okrPhaseKeys.filter((key) => existing.phaseOverrides[key]).length;
    existing.syncSource = `Rocketlane · ${computed.taskCount} tasks${overrideCount ? ` · ${overrideCount} manual override${overrideCount === 1 ? "" : "s"}` : ""}`;
    existing.syncedAt = syncedAt;
    phasesUpdated += 1;
  });
}

const projects = await rocketlanePages("/api/1.0/projects?pageSize=100&includeAllFields=true");
console.log(`Scanned ${projects.length} Rocketlane projects.`);
let skippedArchived = 0;
let skippedImpact = 0;
let skippedTemplate = 0;
let skippedTimeline = 0;
let skippedPeople = 0;
for (const project of projects) {
  const id = String(project.projectId || "");
  if (!id) continue;
  if (project.archived === true || String(project.archived) === "True") {
    skippedArchived += 1;
    continue;
  }
  let detail = project;
  let template = templateName(project);
  if (!template) {
    detail = (await rocketlaneGet(`/api/1.0/projects/${encodeURIComponent(id)}?includeFields=budgetedHours,allocatedHours`)).data || project;
    template = templateName(detail);
  }
  if (isImpactMethodology(detail, template)) {
    skippedImpact += 1;
    continue;
  }
  if (!isIntegrationTemplate(template)) {
    skippedTemplate += 1;
    continue;
  }
  const phaseRows = await rocketlanePages(`/api/1.0/phases?projectId=${encodeURIComponent(id)}&pageSize=100`);
  const dues = phaseDueMap(phaseRows);
  const dueQuarters = dues ? phaseKeys.map((key) => quarterFromDate(dues[key])).filter(Boolean) : [];
  const duesIn2026 = dueQuarters.some((quarter) => quarter.endsWith("2026"));
  let tasks = null;
  let allocations = null;
  if (dueQuarters.length && !duesIn2026) {
    skippedTimeline += 1;
    continue;
  }
  if (!dueQuarters.length) {
    const overlap = rangeOverlaps2026(detail.startDate || project.startDate, detail.dueDate || project.dueDate);
    tasks = await rocketlanePages(`/api/1.0/tasks?project.eq=${encodeURIComponent(id)}&pageSize=100&includeAllFields=true`);
    allocations = await rocketlanePages(`/api/1.0/resource-allocations?startDate=2026-01-01&endDate=2026-12-31&pageSize=100&includeAllFields=true&projectId.eq=${encodeURIComponent(id)}`);
    const taskIn2026 = tasks.some((task) => {
      const quarter = quarterFromDate(task.dueDate || task.startDate);
      return quarter && quarter.endsWith("2026");
    });
    const allocationIn2026 = allocationQuarters(allocations).some((quarter) => quarter.endsWith("2026"));
    if (!taskIn2026 && !allocationIn2026 && overlap !== true) {
      skippedTimeline += 1;
      continue;
    }
  }
  if (detail === project) {
    detail = (await rocketlaneGet(`/api/1.0/projects/${encodeURIComponent(id)}?includeFields=budgetedHours,allocatedHours`)).data || project;
  }
  if (!tasks) tasks = await rocketlanePages(`/api/1.0/tasks?project.eq=${encodeURIComponent(id)}&pageSize=100&includeAllFields=true`);
  if (!allocations) {
    allocations = await rocketlanePages(`/api/1.0/resource-allocations?startDate=2026-01-01&endDate=2026-12-31&pageSize=100&includeAllFields=true&projectId.eq=${encodeURIComponent(id)}`);
  }
  const rows = buildPortfolioRows(detail, tasks, phaseRows, allocations, fallbackQuarter).filter((row) =>
    quartersFor(row.phaseQuarters, row.phasesActive).length
  );
  if (!rows.length) {
    skippedPeople += 1;
    continue;
  }
  accepted.add(id);
  rows.forEach((row) => {
    upsertPortfolioRow(row);
    upsertSyncProject(row);
    syncQuarterOkrs(row, phaseRows, tasks);
  });
}

if (!rebuild) {
  const before = snapshot.projects.length;
  snapshot.projects = snapshot.projects.filter((project) => {
    if (!project) return false;
    if (project.source === "manual") return true;
    if (!String(project.id || "").startsWith("rl-")) return true;
    const rocketlaneId = String(project.rocketlaneId || String(project.id).replace(/^rl-/, "").split("~")[0]);
    return accepted.has(rocketlaneId);
  });
  removed = before - snapshot.projects.length;
  const liveLinks = new Set(snapshot.projects.filter((project) => String(project.id || "").startsWith("rl-")).map((project) => String(project.id).replace(/^rl-/, "")));
  snapshot.okr.rows = snapshot.okr.rows.filter((row) => {
    const linkId = String(row.rocketlaneProjectId || "");
    if (!linkId) return true;
    return liveLinks.has(linkId);
  });
}

Object.assign(snapshot, {
  portfolioReplaceId: "2026-11-02-timeline",
  timelinePortfolio2026: true,
  portfolioSource: snapshot.portfolioSource || "integration-templates-sep-oct-2026",
  templateFlows2026: true,
  lentifulFlowCorrection: true,
  developmentSubtasks2026: true,
  projectPlanQuarters2026: true,
  phaseTimelineSpread2026: true,
  allocationPhaseQuarters2026: true,
  phaseDueQuarters2026: true,
  flowMonthHoursCleared2026: true,
  premiumMonthHours2026: true,
  fullYearMonthHours2026: true,
  okrManualEstimator2026: true,
  okrOwnerProjects2026: true,
  okrRocketlaneRefreshOct26: true,
  okrCihanFromEstimator2026: true,
  apparelMagicQuarters2026: true,
  rocketlanePortfolioOct19: true,
  onAirDirectPortfolio2026: true,
  createdProjects2026: true,
  johnPortfolio2026: true,
  pipelineCompliance2026: true,
  mcCompliance2026: true,
  onurTeamTasks2026: true,
});
if (!snapshot.portfolioSource) snapshot.portfolioSource = "integration-templates-sep-oct-2026";
snapshot.portfolioSource = "integration-templates-sep-oct-2026";

sync.projects = snapshot.projects.filter((project) => String(project.id || "").startsWith("rl-"));
sync.okrRows = [];
const okrSeen = new Set();
snapshot.okr.rows.forEach((row) => {
  const linkId = String(row.rocketlaneProjectId || "");
  const key = `${linkId}|${row.quarter}`;
  if (!linkId || okrSeen.has(key)) return;
  okrSeen.add(key);
  sync.okrRows.push(row);
});

console.log(
  `Skipped ${skippedArchived} archived, ${skippedImpact} IMPACT methodology, ${skippedTemplate} other templates, ${skippedTimeline} outside 2026, ${skippedPeople} with no roster person.`
);
if (!rebuild && !added && !removed && !flowsUpdated && !okrAdded && !phasesUpdated) {
  console.log("No Rocketlane changes.");
  process.exit(0);
}

sync.syncedAt = syncedAt;
writeAssignment(snapshotPath, "LOCAL_SNAPSHOT", snapshot);
writeAssignment(syncPath, "ROCKETLANE_SYNC", sync);
const stamp = syncedAt.replace(/[-:]/g, "").slice(0, 15);
let html = readFileSync(indexPath, "utf8");
html = html.replace(/rocketlane-sync\.js\?v=[^"]+/, `rocketlane-sync.js?v=${stamp}`);
html = html.replace(/local-snapshot\.js\?v=[^"]+/, `local-snapshot.js?v=${stamp}`);
writeFileSync(indexPath, html, "utf8");
console.log(
  `Portfolio ${snapshot.projects.length} projects, ${snapshot.okr.rows.length} OKR rows. Added ${added}, removed ${removed}, flows ${flowsUpdated}, new OKR rows ${okrAdded}, phase updates ${phasesUpdated}.`
);
