interface CostLineItem {
  service: string;
  description: string;
  unitPrice: number;
  quantity: number;
  monthlyCost: number;
}

interface CostCategory {
  category: string;
  items: CostLineItem[];
  subtotal: number;
}

interface CostEstimate {
  userTier: string;
  monthlyUsers: number;
  multiplier: number;
  totalMonthlyCost: number;
  breakdown: CostCategory[];
  dataEgressTotal?: number;
}

interface CostReport {
  projectId: string;
  monthlyUsers: number;
  currentEstimate: CostEstimate;
  scalingProjections: CostEstimate[];
  recommendations: { title: string; description: string; potentialSavings: number; annualSavings: number; effort: string }[];
  generatedAt: string;
}

interface WorkerNodeData {
  id: string;
  nodeType: string;
  label: string;
  instances: number;
  region: string;
  maxRPS: number;
  computeTier: string;
  [key: string]: any;
}

interface WorkerEdgeData {
  source: string;
  target: string;
  trafficPercent: number;
  [key: string]: any;
}

interface WorkerInput {
  type: "calculate";
  projectId: string;
  nodes: WorkerNodeData[];
  edges: WorkerEdgeData[];
  monthlyUsers: number;
}

type NodeType = string;

const pricingRules: Record<string, { baseMonthly: number; perInstance: number; perUnitDesc: string; unitPrice: number }> = {
  LoadBalancer: { baseMonthly: 16.43, perInstance: 0, perUnitDesc: "", unitPrice: 0 },
  APIGateway: { baseMonthly: 3.50, perInstance: 0, perUnitDesc: "per 1M requests", unitPrice: 3.50 },
  WebServer: { baseMonthly: 0, perInstance: 30.37, perUnitDesc: "per instance (t3.medium)", unitPrice: 0 },
  AppServer: { baseMonthly: 0, perInstance: 30.37, perUnitDesc: "per instance (t3.medium)", unitPrice: 0 },
  Microservice: { baseMonthly: 0, perInstance: 30.37, perUnitDesc: "per instance (t3.medium)", unitPrice: 0 },
  PostgreSQLDB: { baseMonthly: 50.00, perInstance: 0, perUnitDesc: "per instance (db.t3.small)", unitPrice: 0 },
  MySQLDB: { baseMonthly: 50.00, perInstance: 0, perUnitDesc: "per instance (db.t3.small)", unitPrice: 0 },
  MongoDB: { baseMonthly: 60.00, perInstance: 0, perUnitDesc: "per instance (M10)", unitPrice: 0 },
  Redis: { baseMonthly: 15.00, perInstance: 0, perUnitDesc: "per instance (cache.t3.micro)", unitPrice: 0 },
  Elasticsearch: { baseMonthly: 45.00, perInstance: 0, perUnitDesc: "per instance (t3.small.es)", unitPrice: 0 },
  CDN: { baseMonthly: 0, perInstance: 0, perUnitDesc: "per GB transfer", unitPrice: 0.085 },
  DNS: { baseMonthly: 0.50, perInstance: 0, perUnitDesc: "per 1M queries", unitPrice: 0.40 },
  Firewall: { baseMonthly: 25.00, perInstance: 0, perUnitDesc: "", unitPrice: 0 },
  VPC: { baseMonthly: 0, perInstance: 0, perUnitDesc: "", unitPrice: 0 },
  Subnet: { baseMonthly: 0, perInstance: 0, perUnitDesc: "", unitPrice: 0 },
  MessageQueue: { baseMonthly: 0.40, perInstance: 0, perUnitDesc: "per 1M requests", unitPrice: 0.40 },
  EventBus: { baseMonthly: 1.00, perInstance: 0, perUnitDesc: "per 1M events", unitPrice: 1.00 },
  PubSub: { baseMonthly: 10.00, perInstance: 0, perUnitDesc: "", unitPrice: 0 },
  ContainerCluster: { baseMonthly: 73.00, perInstance: 0, perUnitDesc: "per cluster (EKS)", unitPrice: 0 },
  ServerlessFunction: { baseMonthly: 0, perInstance: 0, perUnitDesc: "per 1M invocations", unitPrice: 0.20 },
  BatchProcessor: { baseMonthly: 0, perInstance: 30.37, perUnitDesc: "per compute instance", unitPrice: 0 },
  WorkerService: { baseMonthly: 0, perInstance: 30.37, perUnitDesc: "per instance (t3.medium)", unitPrice: 0 },
};

const computeTierMultipliers: Record<string, number> = {
  on_demand: 1.0,
  reserved: 0.6,
  spot: 0.3,
};

const userTiers = [
  { label: "1k users (prototype)", users: 1_000, multiplier: 1 },
  { label: "10k users (launch)", users: 10_000, multiplier: 3 },
  { label: "100k users (growth)", users: 100_000, multiplier: 10 },
  { label: "1M users (scale)", users: 1_000_000, multiplier: 30 },
];

const categories = [
  "Compute", "Networking", "Data & Storage", "Data Transfer",
  "Request-Based", "Tiered Storage", "Messaging & Events", "Orchestration", "External",
];

const externalTypes = new Set(["ExternalClient", "ThirdPartyAPI", "MobileClient", "WebBrowser"]);
const serverlessTypes = new Set(["ServerlessFunction", "APIGateway", "MessageQueue", "EventBus"]);
const dbTypes = new Set(["PostgreSQLDB", "MySQLDB", "MongoDB", "Redis", "Elasticsearch"]);
const storageTypes = new Set(["PostgreSQLDB", "MySQLDB", "MongoDB", "Redis", "Elasticsearch", "CDN", "WebServer", "AppServer", "Microservice"]);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getInstances(node: WorkerNodeData): number {
  return node.instances || 1;
}

function getRegion(node: WorkerNodeData): string {
  return node.region || "us-east-1";
}

function getComputeTier(node: WorkerNodeData): string {
  return (node.computeTier && ["on_demand", "reserved", "spot"].includes(node.computeTier)) ? node.computeTier : "on_demand";
}

function categoryForType(nt: NodeType): string {
  const compute = new Set(["WebServer", "AppServer", "Microservice", "WorkerService", "BatchProcessor", "ServerlessFunction"]);
  const network = new Set(["LoadBalancer", "APIGateway", "CDN", "DNS", "Firewall", "VPC", "Subnet"]);
  const data = new Set(["PostgreSQLDB", "MySQLDB", "MongoDB", "Redis", "Elasticsearch"]);
  const msg = new Set(["MessageQueue", "EventBus", "PubSub"]);
  if (compute.has(nt)) return "Compute";
  if (network.has(nt)) return "Networking";
  if (data.has(nt)) return "Data & Storage";
  if (msg.has(nt)) return "Messaging & Events";
  if (nt === "ContainerCluster") return "Orchestration";
  if (externalTypes.has(nt)) return "External";
  return "Compute";
}

function calculateNodeCost(nt: NodeType, label: string, node: WorkerNodeData, monthlyUsers: number, multiplier: number): { items: CostLineItem[]; total: number } {
  const rule = pricingRules[nt];
  if (!rule) return { items: [], total: 0 };

  const instances = getInstances(node);
  const scaledInstances = Math.max(1, Math.ceil(instances * multiplier));
  const tier = getComputeTier(node);
  const tierMult = computeTierMultipliers[tier] || 1.0;

  const items: CostLineItem[] = [];
  let total = 0;

  if (rule.baseMonthly > 0) {
    const desc = rule.perUnitDesc ? `${label} — base (${rule.perUnitDesc})` : `${label} — base cost`;
    items.push({ service: label, description: desc, unitPrice: rule.baseMonthly, quantity: 1, monthlyCost: round2(rule.baseMonthly) });
    total += rule.baseMonthly;
  }

  if (rule.perInstance > 0) {
    const adjustedPrice = rule.perInstance * tierMult;
    const cost = adjustedPrice * scaledInstances;
    const tierLabel = tier === "reserved" ? " [Reserved 40% off]" : tier === "spot" ? " [Spot 70% off]" : "";
    items.push({
      service: label,
      description: `${label} — ${scaledInstances} instance(s) (${rule.perUnitDesc})${tierLabel}`,
      unitPrice: round2(adjustedPrice),
      quantity: scaledInstances,
      monthlyCost: round2(cost),
    });
    total += cost;
  }

  if (serverlessTypes.has(nt) && rule.unitPrice > 0) {
    let estimatedUnits = (monthlyUsers / 1_000_000) * multiplier;
    if (estimatedUnits < 0.1) estimatedUnits = 0.1;
    const cost = rule.unitPrice * estimatedUnits;
    items.push({ service: label, description: `${label} — ${estimatedUnits.toFixed(1)} units (${rule.perUnitDesc})`, unitPrice: rule.unitPrice, quantity: Math.ceil(estimatedUnits), monthlyCost: round2(cost) });
    total += cost;
  }

  if (nt === "CDN" && rule.unitPrice > 0) {
    const gbTransfer = monthlyUsers * 0.15 * multiplier;
    const cost = rule.unitPrice * gbTransfer;
    items.push({ service: label, description: `${label} — ${Math.round(gbTransfer)} GB transfer`, unitPrice: rule.unitPrice, quantity: Math.ceil(gbTransfer), monthlyCost: round2(cost) });
    total += cost;
  }

  if (nt === "DNS" && rule.unitPrice > 0) {
    const queries = monthlyUsers * 10 * multiplier;
    const queryUnits = queries / 1_000_000;
    const cost = rule.unitPrice * queryUnits;
    items.push({ service: label, description: `${label} — ${queryUnits.toFixed(0)}M queries`, unitPrice: rule.unitPrice, quantity: Math.ceil(queryUnits), monthlyCost: round2(cost) });
    total += cost;
  }

  return { items, total };
}

function calculatePerRequestCost(nt: NodeType, estimatedRPS: number): { items: CostLineItem[]; total: number } {
  if (nt !== "ServerlessFunction" && !dbTypes.has(nt)) return { items: [], total: 0 };

  const totalMonthlyRequests = estimatedRPS * 86400 * 30;
  const millionRequests = totalMonthlyRequests / 1_000_000;

  const readUnits = millionRequests * 0.7;
  const writeUnits = millionRequests * 0.3;

  const writeCost = writeUnits * 1.25;
  const readCost = readUnits * 0.25;

  return {
    items: [
      { service: "Write Requests", description: `Write — ${writeUnits.toFixed(1)}M units × $1.25/M`, unitPrice: 1.25, quantity: Math.ceil(writeUnits), monthlyCost: round2(writeCost) },
      { service: "Read Requests", description: `Read — ${readUnits.toFixed(1)}M units × $0.25/M`, unitPrice: 0.25, quantity: Math.ceil(readUnits), monthlyCost: round2(readCost) },
    ],
    total: writeCost + readCost,
  };
}

function estimateStorageGB(nt: NodeType, instances: number): number {
  const map: Record<string, number> = {
    PostgreSQLDB: 100, MySQLDB: 100, MongoDB: 200, Redis: 20,
    Elasticsearch: 150, CDN: 500, WebServer: 50, AppServer: 50, Microservice: 50,
  };
  return (map[nt] || 0) * instances;
}

function calculateStorageCost(storageGB: number): { items: CostLineItem[]; total: number } {
  if (storageGB <= 0) return { items: [], total: 0 };

  const tier1Cap = 50 * 1024;
  const tier2Cap = 500 * 1024;

  const tier1 = Math.min(storageGB, tier1Cap);
  const tier2 = Math.max(0, Math.min(storageGB - tier1Cap, tier2Cap - tier1Cap));
  const tier3 = Math.max(0, storageGB - tier2Cap);

  const tier1Cost = tier1 * 0.023;
  const tier2Cost = tier2 * 0.022;
  const tier3Cost = tier3 * 0.021;

  const items: CostLineItem[] = [
    { service: "S3 Standard", description: `First 50TB — ${tier1} GB × $0.023`, unitPrice: 0.023, quantity: Math.ceil(tier1), monthlyCost: round2(tier1Cost) },
  ];
  if (tier2 > 0) items.push({ service: "S3 Standard", description: `Next 450TB — ${tier2} GB × $0.022`, unitPrice: 0.022, quantity: Math.ceil(tier2), monthlyCost: round2(tier2Cost) });
  if (tier3 > 0) items.push({ service: "S3 Standard", description: `Over 500TB — ${tier3} GB × $0.021`, unitPrice: 0.021, quantity: Math.ceil(tier3), monthlyCost: round2(tier3Cost) });

  return { items, total: tier1Cost + tier2Cost + tier3Cost };
}

function calculateEdgeEgress(srcRegion: string, tgtRegion: string, tgtNodeType: string, trafficPercent: number, sourceMaxRPS: number, srcNodeType: string): { item: CostLineItem | null; cost: number } {
  if (trafficPercent <= 0 || sourceMaxRPS <= 0) return { item: null, cost: 0 };

  const respSizes: Record<string, number> = {
    AppServer: 50, Microservice: 50, WebServer: 50,
    CDN: 500, PostgreSQLDB: 10, MySQLDB: 10, MongoDB: 10, Redis: 10, Elasticsearch: 10,
  };
  const respSizeKB = respSizes[srcNodeType] || 10;

  const estimatedRPS = sourceMaxRPS * (trafficPercent / 100);
  const gbPerMonth = (estimatedRPS * respSizeKB * 86400 * 30) / (1024 * 1024);

  let costPerGB: number;
  let transferType: string;

  if (externalTypes.has(tgtNodeType)) {
    costPerGB = 0.09;
    transferType = "Internet egress";
  } else if (srcRegion !== tgtRegion) {
    costPerGB = 0.02;
    transferType = "Inter-region";
  } else {
    return { item: null, cost: 0 };
  }

  const monthlyCost = gbPerMonth * costPerGB;
  const desc = transferType === "Internet egress"
    ? `${transferType} — ${gbPerMonth.toFixed(1)} GB/mo to internet`
    : `${transferType} — ${gbPerMonth.toFixed(1)} GB/mo (${srcRegion})`;

  return {
    item: { service: transferType, description: desc, unitPrice: costPerGB, quantity: Math.ceil(gbPerMonth), monthlyCost: round2(monthlyCost) },
    cost: monthlyCost,
  };
}

function generateRecommendations(nodes: WorkerNodeData[], projections: CostEstimate[]): { title: string; description: string; potentialSavings: number; annualSavings: number; effort: string }[] {
  const recs: { title: string; description: string; potentialSavings: number; annualSavings: number; effort: string }[] = [];

  let onDemandCount = 0;
  let spotCandidateCount = 0;
  for (const n of nodes) {
    const tier = getComputeTier(n);
    if (tier === "on_demand") onDemandCount++;
    if (tier === "on_demand" && !dbTypes.has(n.nodeType) && n.nodeType !== "LoadBalancer") spotCandidateCount++;
  }

  if (spotCandidateCount > 0) {
    const savings = spotCandidateCount * 30.37 * 0.7;
    recs.push({
      title: "Use Spot Instances",
      description: `${spotCandidateCount} workload(s) can use spot instances, reducing compute cost by up to 70%.`,
      potentialSavings: round2(savings),
      annualSavings: round2(savings * 12),
      effort: "medium",
    });
  }

  if (onDemandCount > 2) {
    const savings = onDemandCount * 30.37 * 0.4;
    recs.push({
      title: "Reserved Instance Discount",
      description: `Commit to ${onDemandCount} instance(s) for 1-3 years and save ~40% vs on-demand pricing.`,
      potentialSavings: round2(savings),
      annualSavings: round2(savings * 12),
      effort: "low",
    });
  }

  if (projections.length >= 4 && projections[3].totalMonthlyCost > projections[0].totalMonthlyCost * 5) {
    recs.push({
      title: "Plan Capacity Early",
      description: "Cost grows 5x+ from 1k to 1M users. Reserve instances early to lock in lower rates.",
      potentialSavings: round2(projections[3].totalMonthlyCost * 0.15),
      annualSavings: round2(projections[3].totalMonthlyCost * 0.15 * 12),
      effort: "low",
    });
  }

  return recs;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  if (e.data.type !== "calculate") return;

  const { projectId, nodes, edges, monthlyUsers } = e.data;

  const nodeLookup = new Map(nodes.map((n) => [n.id, n]));
  const billable = nodes.filter((n) => !externalTypes.has(n.nodeType) && pricingRules[n.nodeType]);

  if (billable.length === 0) {
    self.postMessage({ type: "error", error: "No billable resources found" });
    return;
  }

  const projections: CostEstimate[] = [];

  for (const tier of userTiers) {
    const categoryMap = new Map<string, CostLineItem[]>();
    const catTotals = new Map<string, number>();
    let totalCost = 0;
    let totalEgress = 0;

    for (const node of billable) {
      const result = calculateNodeCost(node.nodeType, node.label, node, tier.users, tier.multiplier);
      const catName = categoryForType(node.nodeType);
      if (!categoryMap.has(catName)) categoryMap.set(catName, []);
      categoryMap.get(catName)!.push(...result.items);
      catTotals.set(catName, (catTotals.get(catName) || 0) + result.total);
      totalCost += result.total;

      const scaledRPS = (node.maxRPS || 1000) * tier.multiplier;
      const reqResult = calculatePerRequestCost(node.nodeType, scaledRPS);
      if (reqResult.total > 0) {
        if (!categoryMap.has("Request-Based")) categoryMap.set("Request-Based", []);
        categoryMap.get("Request-Based")!.push(...reqResult.items);
        catTotals.set("Request-Based", (catTotals.get("Request-Based") || 0) + reqResult.total);
        totalCost += reqResult.total;
      }

      const instances = getInstances(node);
      const storageGB = estimateStorageGB(node.nodeType, instances);
      if (storageGB > 0) {
        const storageResult = calculateStorageCost(storageGB);
        if (!categoryMap.has("Tiered Storage")) categoryMap.set("Tiered Storage", []);
        categoryMap.get("Tiered Storage")!.push(...storageResult.items);
        catTotals.set("Tiered Storage", (catTotals.get("Tiered Storage") || 0) + storageResult.total);
        totalCost += storageResult.total;
      }
    }

    const egressItems: CostLineItem[] = [];
    for (const edge of edges) {
      const srcNode = nodeLookup.get(edge.source);
      const tgtNode = nodeLookup.get(edge.target);
      if (!srcNode || !tgtNode) continue;

      const srcRegion = getRegion(srcNode);
      const tgtRegion = getRegion(tgtNode);
      const trafficPercent = edge.trafficPercent || 100;
      const srcMaxRPS = (srcNode.maxRPS || 1000) * tier.multiplier;

      const egress = calculateEdgeEgress(srcRegion, tgtRegion, tgtNode.nodeType, trafficPercent, srcMaxRPS, srcNode.nodeType);
      if (egress.item && egress.cost > 0) {
        egressItems.push(egress.item);
        totalEgress += egress.cost;
      }
    }

    if (egressItems.length > 0) {
      categoryMap.set("Data Transfer", egressItems);
      catTotals.set("Data Transfer", totalEgress);
      totalCost += totalEgress;
    }

    const breakdown: CostCategory[] = [];
    for (const catName of categories) {
      const items = categoryMap.get(catName);
      if (!items || items.length === 0) continue;
      breakdown.push({ category: catName, items, subtotal: round2(catTotals.get(catName) || 0) });
    }

    projections.push({
      userTier: tier.label,
      monthlyUsers: tier.users,
      multiplier: tier.multiplier,
      totalMonthlyCost: round2(totalCost),
      breakdown,
      dataEgressTotal: round2(totalEgress),
    });
  }

  const report: CostReport = {
    projectId,
    monthlyUsers,
    currentEstimate: projections[0],
    scalingProjections: projections,
    recommendations: generateRecommendations(billable, projections),
    generatedAt: new Date().toISOString(),
  };

  self.postMessage({ type: "result", report });
};
