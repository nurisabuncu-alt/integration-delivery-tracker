// Scheduled Rocketlane refresh.
// Adds integration-template projects created on or after 2026-10-21.
// Refreshes OKR phase progress on rows already linked to a Rocketlane project.
// Does not change existing estimator or compliance fields, manual OKR rows, or month hours.
// Does not call the time-entries API.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = join(root, "local-snapshot.js");
const syncPath = join(root, "rocketlane-sync.js");
const indexPath = join(root, "index.html");
const createdSinceMs = Date.parse("2026-10-21T00:00:00Z");
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

function createdMs(project) {
  const value = Number(project && project.createdAt);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value < 1e12 ? value * 1000 : value;
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
  if (!people.size) people.add("Unassigned");
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
      compliance: { inScope: !share, owner: person === "Unassigned" ? "" : person },
    };
  });
}

const snapshot = readAssignment(snapshotPath, "LOCAL_SNAPSHOT");
const sync = readFileSync(syncPath, "utf8").includes("ROCKETLANE_SYNC")
  ? readAssignment(syncPath, "ROCKETLANE_SYNC")
  : { syncedAt: "", projects: [], okrPhases: {} };
if (!Array.isArray(snapshot.projects)) snapshot.projects = [];
if (!snapshot.okr) snapshot.okr = { rows: [] };
if (!Array.isArray(sync.projects)) sync.projects = [];
if (!sync.okrPhases) sync.okrPhases = {};

const known = new Set(
  snapshot.projects
    .map((project) => String(project.rocketlaneId || String(project.id || "").replace(/^rl-/, "").split("~")[0]))
    .filter((id) => /^\d+$/.test(id))
);
const fallbackQuarter = snapshot.quarter || "Q4 2026";
const syncedAt = new Date().toISOString();
let added = 0;
let flowsUpdated = 0;
let okrAdded = 0;
let phasesUpdated = 0;
const publishedOkrIds = new Set();

function upsertSyncProject(row) {
  const index = sync.projects.findIndex((item) => item && item.id === row.id);
  if (index >= 0) sync.projects[index] = row;
  else sync.projects.push(row);
}

function quarterForRow(phaseQuarters) {
  const values = Object.values(phaseQuarters || {}).filter(Boolean);
  if (values.includes(fallbackQuarter)) return fallbackQuarter;
  values.sort((left, right) => quarterSortKey(left) - quarterSortKey(right));
  return values[values.length - 1] || fallbackQuarter;
}

function ensurePortfolioOkr(row) {
  const linkId = row.id.replace(/^rl-/, "");
  publishedOkrIds.add(linkId);
  if (snapshot.okr.rows.some((okr) => String(okr.rocketlaneProjectId || "") === linkId)) return;
  snapshot.okr.rows.push({
    id: `okr-${row.id}`,
    quarter: quarterForRow(row.phaseQuarters),
    objective: row.type === "Other" || row.type === "Misc" ? "Operational Excellence" : "Activated ARR",
    keyResult: row.name,
    details: row.notes || "",
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
    phases: { projectManagement: 0, mapping: 0, design: 0, development: 0, proofOfDelivery: 0 },
    phaseOverrides: {},
    syncSource: "Rocketlane project",
    syncName: true,
  });
  okrAdded += 1;
}

const projects = await rocketlanePages("/api/1.0/projects?pageSize=100&includeAllFields=true");
console.log(`Scanned ${projects.length} Rocketlane projects.`);
for (const project of projects) {
  const id = String(project.projectId || "");
  if (!id || createdMs(project) < createdSinceMs) continue;
  const status = project.status && project.status.label;
  if (project.archived === true || String(project.archived) === "True" || status === "Cancelled") continue;
  const template = templateName(project);
  if (!isIntegrationTemplate(template)) continue;
  const detail = (await rocketlaneGet(`/api/1.0/projects/${encodeURIComponent(id)}?includeFields=budgetedHours,allocatedHours`)).data || project;
  const tasks = await rocketlanePages(`/api/1.0/tasks?project.eq=${encodeURIComponent(id)}&pageSize=100&includeAllFields=true`);
  const phaseRows = await rocketlanePages(`/api/1.0/phases?projectId=${encodeURIComponent(id)}&pageSize=100`);
  const allocations = await rocketlanePages(`/api/1.0/resource-allocations?startDate=2025-01-01&endDate=2026-12-31&pageSize=100&includeAllFields=true&projectId.eq=${encodeURIComponent(id)}`);
  const rows = buildPortfolioRows(detail, tasks, phaseRows, allocations, fallbackQuarter);
  for (const row of rows) {
    const existing = snapshot.projects.find((item) => item.id === row.id);
    if (!existing) {
      snapshot.projects.push(row);
      upsertSyncProject(row);
      ensurePortfolioOkr(row);
      added += 1;
      console.log(`Added ${row.id} ${row.assignee} flows=${row.std}`);
      continue;
    }
    if (row.updateFlowCount && existing.flowCountFromTasks !== false && Number(existing.std) !== Number(row.std)) {
      existing.std = row.std;
      existing.cpx = 0;
      existing.ins = 0;
      existing.flowCountFromTasks = true;
      upsertSyncProject(Object.assign({}, existing, { updateFlowCount: true, hoursByMonth: {}, hoursByQuarter: {} }));
      flowsUpdated += 1;
      console.log(`Flows ${row.id} ${row.assignee} ${row.std}`);
    }
    ensurePortfolioOkr(row);
  }
  known.add(id);
}

const linked = [];
(snapshot.okr.rows || []).forEach((row) => {
  const projectId = String(row.rocketlaneProjectId || "").split("~")[0];
  if (!/^\d+$/.test(projectId) || linked.includes(projectId)) return;
  const project = snapshot.projects.find((item) => String(item.rocketlaneId || "") === projectId || String(item.id) === `rl-${projectId}`);
  if (project && String(project.id).startsWith("rl-")) linked.push(projectId);
});

for (const projectId of linked) {
  const phaseRows = await rocketlanePages(`/api/1.0/phases?projectId=${encodeURIComponent(projectId)}&pageSize=100`);
  const tasks = await rocketlanePages(`/api/1.0/tasks?project.eq=${encodeURIComponent(projectId)}&pageSize=100&includeAllFields=true`);
  const computed = computeOkrPhases(phaseRows, tasks);
  const previous = sync.okrPhases[projectId];
  const same = previous && okrPhaseKeys.every((key) => Number(previous.phases && previous.phases[key]) === computed.phases[key]);
  sync.okrPhases[projectId] = { phases: computed.phases, taskCount: computed.taskCount, syncedAt };
  (snapshot.okr.rows || []).forEach((row) => {
    const rowProjectId = String(row.rocketlaneProjectId || "");
    if (rowProjectId !== projectId && !rowProjectId.startsWith(`${projectId}~`)) return;
    if (!row.phases) row.phases = {};
    if (!row.phaseOverrides) row.phaseOverrides = {};
    let changed = false;
    okrPhaseKeys.forEach((key) => {
      if (row.phaseOverrides[key]) return;
      if (Number(row.phases[key]) !== computed.phases[key]) {
        row.phases[key] = computed.phases[key];
        changed = true;
      }
    });
    if (!changed) return;
    const overrideCount = okrPhaseKeys.filter((key) => row.phaseOverrides[key]).length;
    row.syncSource = `Rocketlane · ${computed.taskCount} tasks${overrideCount ? ` · ${overrideCount} manual override${overrideCount === 1 ? "" : "s"}` : ""}`;
    row.syncedAt = syncedAt;
    phasesUpdated += 1;
  });
  if (!same) console.log(`OKR ${projectId} ${okrPhaseKeys.map((key) => computed.phases[key]).join("/")}`);
}

const previousOkrLinks = new Set((sync.okrRows || []).map((row) => String(row.rocketlaneProjectId || "")));
sync.okrRows = (snapshot.okr.rows || []).filter((row) => publishedOkrIds.has(String(row.rocketlaneProjectId || "")));
const okrPublishMissing = [...publishedOkrIds].some((linkId) => !previousOkrLinks.has(linkId));

if (!added && !flowsUpdated && !okrAdded && !phasesUpdated && !okrPublishMissing) {
  const baselineMissing = linked.some((projectId) => !sync.okrPhases[projectId]);
  if (!baselineMissing) {
    console.log("No Rocketlane changes.");
    process.exit(0);
  }
}

sync.syncedAt = syncedAt;
if (added || flowsUpdated || okrAdded || phasesUpdated) writeAssignment(snapshotPath, "LOCAL_SNAPSHOT", snapshot);
writeAssignment(syncPath, "ROCKETLANE_SYNC", sync);
const stamp = syncedAt.replace(/[-:]/g, "").slice(0, 15);
let html = readFileSync(indexPath, "utf8");
html = html.replace(/rocketlane-sync\.js\?v=[^"]+/, `rocketlane-sync.js?v=${stamp}`);
if (added || flowsUpdated || okrAdded || phasesUpdated) html = html.replace(/local-snapshot\.js\?v=[^"]+/, `local-snapshot.js?v=${stamp}`);
writeFileSync(indexPath, html, "utf8");
console.log(`Added ${added} portfolio row${added === 1 ? "" : "s"}. Updated ${flowsUpdated} flow count${flowsUpdated === 1 ? "" : "s"}, ${okrAdded} new OKR row${okrAdded === 1 ? "" : "s"}, and ${phasesUpdated} OKR phase row${phasesUpdated === 1 ? "" : "s"}.`);
