"use client";

import React, { useMemo, useState } from "react";

/* ============================================================
   TYPES
   ============================================================ */

type Phase = "intro" | "modeSelect" | "setup" | "running" | "results" | "weekly" | "gameover";
type TabKey = "store" | "buy" | "recipe" | "staff" | "money";
type GameMode = "learning" | "survival" | "standard" | "safetyNet";

type DayEvent = {
  id: string;
  title: string;
  body: string;
};

type JournalLine = {
  account: string;
  debit: number;
  credit: number;
};

type JournalEntry = {
  id: string;
  day: number;
  memo: string;
  lines: JournalLine[];
};

type DayResult = {
  day: number;
  dow: number;

  demand: number;
  lunchDemand: number;
  dinnerDemand: number;

  sold: number;
  lunchSold: number;
  dinnerSold: number;
  lost: number;

  lunchLost: number;
  dinnerLost: number;

  bottleneck: string | null;
  lunchBottleneck: string | null;
  dinnerBottleneck: string | null;

  revenue: number;
  foodCostUsed: number;
  spoilageCost: number;
  laborCost: number;
  fixedCost: number;
  totalCost: number;
  profit: number;

  foodPct: number;
  laborPct: number;
  primePct: number;

  cashAfterPrime: number;
  cashAfterFixed: number;

  doughSpoiled: number;
  cheeseUsedOz: number;
  pepperoniUsedOz: number;

  startInv: {
    dough: number;
    cheeseOz: number;
    pepperoniOz: number;
    boxes: number;
  };
  endInv: {
    dough: number;
    cheeseOz: number;
    pepperoniOz: number;
    boxes: number;
  };

  recipeCheeseOz: number;
  actualCheeseOz: number;
  recipePepperoniOz: number;
  actualPepperoniOz: number;
  overCheeseImpact: number;
  overPepperoniImpact: number;

  lunchCapacity: number;
  dinnerCapacity: number;
  totalLaborHours: number;

  brandPenaltyApplied: number;
  skimpTriggeredToday: boolean;

  events: DayEvent[];
  coaching: string[];
};

type WeeklySummary = {
  weekNumber: number;
  days: DayResult[];
  totalRevenue: number;
  totalProfit: number;
  avgPrimePct: number;
  avgLaborPct: number;
  avgFoodPct: number;
  totalLostSales: number;
  totalWasteCost: number;
  maxOwnerDistribution: number;
  verdict: string;
};

type GameState = {
  mode: GameMode;
  loanBalance: number;
  loanDailyPayment: number;

  day: number;
  cash: number;
  ownership: number;
  totalDistributions: number;
  phase: Phase;
  activeTab: TabKey;

  brandPenalty: number;
  brandPenaltyDaysLeft: number;

  accountingView: "simple" | "advanced";

  inventory: {
    dough: number;
    cheeseOz: number;
    pepperoniOz: number;
    boxes: number;
  };

  purchases: {
    dough: number;
    cheeseLbs: number;
    pepperoniLbs: number;
    boxes: number;
  };

  decisions: {
    price: number;
    cheesePerPizza: number;
    pepperoniPerPizza: number;
    lunchStaff: number;
    dinnerStaff: number;
  };

  distributionRequest: number;

  lastResult: DayResult | null;
  weeklySummary: WeeklySummary | null;
  history: DayResult[];
  journal: JournalEntry[];
};

/* ============================================================
   CONSTANTS
   ============================================================ */

const TOTAL_DAYS = 30;
const STARTING_CASH = 1800;
const OZ_PER_LB = 16;

const LUNCH_BLOCK_HOURS = 5;
const DINNER_BLOCK_HOURS = 5;

const SKIMP_THRESHOLD_OZ = 0.5;
const SKIMP_PENALTY_START = 0.25;
const SKIMP_PENALTY_DAYS = 3;

type ModeConfig = {
  id: GameMode;
  label: string;
  tagline: string;
  startingCash: number;
  loanBalance: number;
  loanDailyPayment: number;
  lesson: string;
  color: string;
};

const MODES: Record<GameMode, ModeConfig> = {
  learning: {
    id: "learning",
    label: "Learning Mode",
    tagline: "One decision at a time. A gentle first run.",
    startingCash: 3000,
    loanBalance: 0,
    loanDailyPayment: 0,
    lesson: "Teaches the game's mechanics one lever at a time. Best first play.",
    color: "#3ba55d",
  },
  survival: {
    id: "survival",
    label: "Survival Mode",
    tagline: "Under-capitalized. One bad day from the edge.",
    startingCash: 800,
    loanBalance: 0,
    loanDailyPayment: 0,
    lesson: "Teaches under-capitalization and when to raise equity.",
    color: "#b63b3b",
  },
  standard: {
    id: "standard",
    label: "Standard Startup",
    tagline: "Balanced start. Find the price-to-quality sweet spot.",
    startingCash: 1800,
    loanBalance: 0,
    loanDailyPayment: 0,
    lesson: "Teaches pricing, portioning, and operating discipline.",
    color: "#e85a2a",
  },
  safetyNet: {
    id: "safetyNet",
    label: "Safety Net",
    tagline: "Plenty of cash up front — but you borrowed most of it.",
    startingCash: 1000,
    loanBalance: 4000,
    loanDailyPayment: 50,
    lesson: "Teaches ROI and the danger of wasteful spending when cash feels plentiful.",
    color: "#3f82ff",
  },
};

const COST = {
  dough: 1.25,
  cheesePerLb: 5.0,
  pepperoniPerLb: 7.0,
  box: 0.5,
  laborPerHour: 20.0,
  fixedPerDay: 375.0,
};

const BASE_DEMAND = 125;
const PIZZAS_PER_PERSON_PER_HOUR = 6;
const OVEN_MAX_PER_DAY = 300;

const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_MULT = [0.88, 0.93, 0.98, 1.04, 1.45, 1.62, 1.24];
const DAY_WEATHER = [
  "66° CLEAR",
  "71° CLEAR",
  "69° OVERCAST",
  "73° BREEZY",
  "78° SUNNY",
  "81° SUNNY",
  "70° COOL",
];
const DAY_VIBE = [
  'Slow start. Office orders and regulars for the 12" pepperoni pizza.',
  "Tuesday trickle. Stay lean and do not overbuy.",
  "Midweek lull. Easy to waste product if you get aggressive.",
  "Thursday warms up. Demand is building.",
  "Friday rush. Better be ready for dinner.",
  "Saturday volume. Dinner rush can bury you.",
  "Sunday family traffic. Softer than Saturday, but dinner still matters.",
];

/* ============================================================
   UTILITIES
   ============================================================ */

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function money(v: number, signed = false) {
  const x = n(v);
  const sign = signed && x > 0 ? "+" : "";
  return `${sign}$${Math.round(x).toLocaleString()}`;
}

function pct(v: number) {
  return `${n(v).toFixed(1)}%`;
}

type Unlocks = {
  staff: boolean;
  buy: boolean;
  price: boolean;
  recipe: boolean;
  equity: boolean;
  distributions: boolean;
  allEventsOn: boolean;
};

// Sensible defaults used when a given lever is still locked in Learning Mode.
// These are designed to be "average competent operator" settings so the player
// can't lose badly while they're being taught only part of the game.
const LEARNING_DEFAULTS = {
  price: 15,
  cheesePerPizza: 8,
  pepperoniPerPizza: 2.5,
  lunchStaff: 2,
  dinnerStaff: 4,
  dough: 110,
  cheeseLbs: 60,
  pepperoniLbs: 18,
  boxes: 130,
};

// Given a mode and day, return which decisions the player can actually make.
// All other modes return fully-unlocked. Learning Mode reveals one lever per day.
function getUnlocks(mode: GameMode, day: number): Unlocks {
  if (mode !== "learning") {
    return {
      staff: true,
      buy: true,
      price: true,
      recipe: true,
      equity: true,
      distributions: true,
      allEventsOn: true,
    };
  }

  return {
    staff: day >= 1,
    buy: day >= 2,
    price: day >= 3,
    recipe: day >= 4,
    equity: day >= 5,
    distributions: day >= 6,
    allEventsOn: day >= 3, // gentle: suppress random events for first 2 days
  };
}

// Short per-day coaching shown on the Store tab when in Learning Mode.
function getLearningCoach(day: number): { title: string; body: string } | null {
  if (day === 1)
    return {
      title: "Day 1 · Start with staffing",
      body:
        "Today you only set staff. Your inventory and recipe are handled for you. Lunch and dinner each need at least 2 people. More staff = more pizzas you can make per rush. Fewer = cheaper, but you'll miss sales.",
    };
  if (day === 2)
    return {
      title: "Day 2 · Now you're buying",
      body:
        "You now control purchasing. Dough spoils overnight. Cheese, pepperoni, and boxes carry over. Buy enough to meet demand — not so much that dough dies in the fridge.",
    };
  if (day === 3)
    return {
      title: "Day 3 · You set the price",
      body:
        "Price is unlocked. $15 is the neutral price. Drop it and demand goes up but margin shrinks. Raise it and fewer people come but each sale makes more.",
    };
  if (day === 4)
    return {
      title: "Day 4 · The recipe is yours",
      body:
        "You now choose cheese and pepperoni portions. More topping = more cost per pizza, but more customers. Skimp below 0.5 oz pepperoni and your brand takes a 3-day hit.",
    };
  if (day === 5)
    return {
      title: "Day 5 · Equity raises",
      body:
        "Check the Money tab. If you're running out of cash, you can sell 10/20/30% of the shop for a cash injection. But you give up permanent ownership — so only do it when you have to.",
    };
  if (day === 6)
    return {
      title: "Day 6 · Owner distributions",
      body:
        "At the end of every week, you can now pay yourself. Distributions are the whole point of owning a business. Too greedy and the shop runs out of cash; too timid and you worked for free.",
    };
  if (day === 7)
    return {
      title: "Day 7 · You have the full game",
      body:
        "Every lever is now unlocked. You've seen each mechanic one at a time — now it's yours to balance. Good luck.",
    };
  return null;
}

function inventoryValue(inv: GameState["inventory"]) {
  return (
    n(inv.dough) * COST.dough +
    (n(inv.cheeseOz) / OZ_PER_LB) * COST.cheesePerLb +
    (n(inv.pepperoniOz) / OZ_PER_LB) * COST.pepperoniPerLb +
    n(inv.boxes) * COST.box
  );
}

function getEquityRaiseCash(pctSold: number) {
  if (pctSold === 10) return 300;
  if (pctSold === 20) return 700;
  if (pctSold === 30) return 1200;
  return 0;
}

function getPepperoniDemandEffect(pepOz: number) {
  const p = n(pepOz);
  if (p <= 0.1) return 0.1;
  if (p <= 0.25) return 0.25;
  if (p <= 0.5) return 0.45;
  if (p <= 1.0) return 0.7;
  if (p <= 1.5) return 0.9;
  if (p <= 2.0) return 1.0;
  if (p <= 2.75) return 1.1;
  if (p <= 3.5) return 1.14;
  if (p <= 4.5) return 1.06;
  return 0.95;
}

function phaseDemandSplit(totalDemand: number, dow: number) {
  let dinnerWeight = 0.65;
  if (dow === 4) dinnerWeight = 0.72;
  if (dow === 5) dinnerWeight = 0.75;
  if (dow === 6) dinnerWeight = 0.68;

  const dinnerDemand = Math.round(n(totalDemand) * dinnerWeight);
  const lunchDemand = Math.max(0, n(totalDemand) - dinnerDemand);

  return { lunchDemand, dinnerDemand };
}

function inventoryCap(
  dough: number,
  cheeseOz: number,
  pepperoniOz: number,
  boxes: number,
  actualCheeseOz: number,
  actualPepperoniOz: number
) {
  const cheeseCap = actualCheeseOz > 0 ? Math.floor(n(cheeseOz) / actualCheeseOz) : 0;
  const pepperoniCap = actualPepperoniOz > 0 ? Math.floor(n(pepperoniOz) / actualPepperoniOz) : 0;

  const caps = [
    { name: "dough", value: Math.max(0, Math.floor(n(dough))) },
    { name: "cheese", value: Math.max(0, cheeseCap) },
    { name: "pepperoni", value: Math.max(0, pepperoniCap) },
    { name: "boxes", value: Math.max(0, Math.floor(n(boxes))) },
  ];

  const max = Math.min(...caps.map((c) => c.value));
  const sorted = [...caps].sort((a, b) => a.value - b.value);
  const bottleneck = sorted[0]?.name ?? null;

  return { max: Math.max(0, max), bottleneck };
}

function makeEntry(day: number, memo: string, lines: JournalLine[]): JournalEntry {
  return {
    id: `${day}-${memo}-${Math.random().toString(36).slice(2, 8)}`,
    day,
    memo,
    lines: lines.map((l) => ({
      account: l.account,
      debit: n(l.debit),
      credit: n(l.credit),
    })),
  };
}

/* ============================================================
   INITIAL STATE
   ============================================================ */

function initialState(mode: GameMode = "standard", startingPhase: Phase = "intro"): GameState {
  const cfg = MODES[mode];

  const init: GameState = {
    mode,
    loanBalance: cfg.loanBalance,
    loanDailyPayment: cfg.loanDailyPayment,

    day: 1,
    cash: cfg.startingCash,
    ownership: 1,
    totalDistributions: 0,
    phase: startingPhase,
    activeTab: "store",

    brandPenalty: 0,
    brandPenaltyDaysLeft: 0,

    accountingView: "simple",

    inventory: {
      dough: 0,
      cheeseOz: 0,
      pepperoniOz: 0,
      boxes: 0,
    },

    purchases: {
      dough: 110,
      cheeseLbs: 60,
      pepperoniLbs: 18,
      boxes: 130,
    },

    decisions: {
      price: 15,
      cheesePerPizza: 8,
      pepperoniPerPizza: 2.5,
      lunchStaff: 2,
      dinnerStaff: 4,
    },

    distributionRequest: 0,

    lastResult: null,
    weeklySummary: null,
    history: [],
    journal: [],
  };

  init.journal.push(
    makeEntry(0, "Life savings invested", [
      { account: "Cash", debit: cfg.startingCash, credit: 0 },
      { account: "Owner Equity", debit: 0, credit: cfg.startingCash },
    ])
  );

  if (cfg.loanBalance > 0) {
    init.journal.push(
      makeEntry(0, "Took business loan", [
        { account: "Cash", debit: cfg.loanBalance, credit: 0 },
        { account: "Loan Payable", debit: 0, credit: cfg.loanBalance },
      ])
    );
    init.cash += cfg.loanBalance;
  }

  return init;
}

/* ============================================================
   SIMULATION (unchanged math)
   ============================================================ */

function simulateDay(state: GameState): DayResult {
  const { day, inventory } = state;
  const dow = (day - 1) % 7;

  // In Learning Mode, if a lever isn't unlocked yet, the player-visible value
  // is ignored and we substitute a sensible "average operator" default so the
  // game still plays reasonably.
  const simUnlocks = getUnlocks(state.mode, day);
  const decisions = {
    price: simUnlocks.price ? n(state.decisions.price) : LEARNING_DEFAULTS.price,
    cheesePerPizza: simUnlocks.recipe
      ? n(state.decisions.cheesePerPizza)
      : LEARNING_DEFAULTS.cheesePerPizza,
    pepperoniPerPizza: simUnlocks.recipe
      ? n(state.decisions.pepperoniPerPizza)
      : LEARNING_DEFAULTS.pepperoniPerPizza,
    lunchStaff: simUnlocks.staff ? n(state.decisions.lunchStaff) : LEARNING_DEFAULTS.lunchStaff,
    dinnerStaff: simUnlocks.staff ? n(state.decisions.dinnerStaff) : LEARNING_DEFAULTS.dinnerStaff,
  };
  const purchases = {
    dough: simUnlocks.buy ? n(state.purchases.dough) : LEARNING_DEFAULTS.dough,
    cheeseLbs: simUnlocks.buy ? n(state.purchases.cheeseLbs) : LEARNING_DEFAULTS.cheeseLbs,
    pepperoniLbs: simUnlocks.buy
      ? n(state.purchases.pepperoniLbs)
      : LEARNING_DEFAULTS.pepperoniLbs,
    boxes: simUnlocks.buy ? n(state.purchases.boxes) : LEARNING_DEFAULTS.boxes,
  };

  const startInv = {
    dough: n(inventory.dough) + n(purchases.dough),
    cheeseOz: n(inventory.cheeseOz) + n(purchases.cheeseLbs) * OZ_PER_LB,
    pepperoniOz: n(inventory.pepperoniOz) + n(purchases.pepperoniLbs) * OZ_PER_LB,
    boxes: n(inventory.boxes) + n(purchases.boxes),
  };

  const events: DayEvent[] = [];

  let demandMult = 1;
  let lunchDemandFlat = 0;
  let dinnerDemandFlat = 0;
  let lunchLaborMult = 1;
  let dinnerLaborMult = 1;
  let actualCheeseOz = n(decisions.cheesePerPizza);
  let actualPepperoniOz = n(decisions.pepperoniPerPizza);
  let fixedCostExtra = 0;
  let priceAdjustment = 0;

  // In Learning Mode's first days, suppress random events so new players
  // don't get blindsided before they understand the mechanics.
  const roll = simUnlocks.allEventsOn ? Math.random() : 0.99; // 0.99 falls outside every event branch → "Normal Day"

  if (roll < 0.1) {
    actualCheeseOz = n(decisions.cheesePerPizza) * 1.25;
    events.push({
      id: "new_hire_cheese",
      title: "New Hire Over-Cheesed",
      body: 'A new line cook poured about 25% extra cheese on the 12" pizzas.',
    });
  } else if (roll < 0.18) {
    dinnerDemandFlat += 18;
    events.push({
      id: "local_event",
      title: "Local Event Boost",
      body: 'A nearby event pushed extra dinner demand into the 12" pepperoni pizza.',
    });
  } else if (roll < 0.26) {
    dinnerLaborMult -= 0.22;
    events.push({
      id: "dinner_calloff",
      title: "Dinner Call-Off",
      body: "A team member called off before dinner. Your dinner capacity dropped.",
    });
  } else if (roll < 0.34) {
    lunchLaborMult -= 0.2;
    events.push({
      id: "lunch_calloff",
      title: "Lunch Call-Off",
      body: "A lunch call-off slowed your midday production.",
    });
  } else if (roll < 0.42) {
    demandMult -= 0.15;
    events.push({
      id: "slow_day",
      title: "Slow Day",
      body: "Traffic came in softer than expected.",
    });
  } else if (roll < 0.5) {
    fixedCostExtra += 80;
    events.push({
      id: "minor_break",
      title: "Minor Equipment Issue",
      body: "You had to spend extra cash today on a small repair.",
    });
  } else if (roll < 0.58) {
    priceAdjustment = -1;
    events.push({
      id: "competitor_promo",
      title: "Competitor Promo",
      body: "A nearby competitor ran a special and made pricing tougher.",
    });
  } else if (roll < 0.66) {
    dinnerDemandFlat += 10;
    events.push({
      id: "late_group_order",
      title: "Late Group Order",
      body: 'A surprise group order pushed dinner demand up for the 12" pizzas.',
    });
  } else if (roll < 0.74) {
    actualPepperoniOz = Math.min(6, n(decisions.pepperoniPerPizza) * 1.2);
    events.push({
      id: "heavy_hand_pepp",
      title: "Pepperoni Hand Was Heavy",
      body: "Your topping line used more pepperoni than planned.",
    });
  } else if (roll < 0.81) {
    fixedCostExtra += 50;
    lunchDemandFlat -= 6;
    events.push({
      id: "rainy_lunch",
      title: "Rainy Lunch, Better Dinner",
      body: "Lunch slowed down, but the evening stayed decent.",
    });
  } else if (roll < 0.88) {
    dinnerDemandFlat += 14;
    events.push({
      id: "social_media_pop",
      title: "Social Media Pop",
      body: 'A local mention online drove more people to try the 12" pepperoni pizza.',
    });
  }

  if (events.length === 0) {
    events.push({
      id: "normal_day",
      title: "Normal Day",
      body: "No major disruption hit the store today.",
    });
  }

  const effectivePrice = Math.max(10, n(decisions.price) + priceAdjustment);

  const priceEffect = Math.pow(15 / effectivePrice, 1.4);
  const cheeseQualityEffect = 1 + (n(decisions.cheesePerPizza) - 8) * 0.05;
  const pepperoniEffect = getPepperoniDemandEffect(n(decisions.pepperoniPerPizza));
  const dayEffect = DAY_MULT[dow];
  const randomNoise = 0.92 + Math.random() * 0.16;

  // Brand equity penalty from past skimping. Applied as a demand multiplier.
  const brandPenaltyMult = 1 - Math.max(0, Math.min(0.6, n(state.brandPenalty)));

  const rawDemand =
    BASE_DEMAND *
    dayEffect *
    priceEffect *
    cheeseQualityEffect *
    pepperoniEffect *
    demandMult *
    brandPenaltyMult *
    randomNoise;

  const totalDemand = Math.max(0, Math.round(rawDemand));
  const split = phaseDemandSplit(totalDemand, dow);

  // Detect skimping TODAY (pepperoni too low). Triggers a penalty that hits tomorrow.
  const skimpTriggeredToday = n(decisions.pepperoniPerPizza) < SKIMP_THRESHOLD_OZ;

  if (n(state.brandPenalty) > 0.01) {
    events.push({
      id: "brand_penalty",
      title: "Customer Satisfaction Penalty",
      body: `Word got around about past skimpy pizzas. Demand is down about ${Math.round(
        (1 - brandPenaltyMult) * 100
      )}% today. ${n(state.brandPenaltyDaysLeft)} day(s) left.`,
    });
  }

  if (skimpTriggeredToday) {
    events.push({
      id: "skimp_today",
      title: "You Skimped Today",
      body: `You used only ${n(decisions.pepperoniPerPizza).toFixed(
        2
      )} oz of pepperoni. Customers noticed. Expect lower demand for the next ${SKIMP_PENALTY_DAYS} days.`,
    });
  }

  const lunchDemand = Math.max(0, n(split.lunchDemand) + lunchDemandFlat);
  const dinnerDemand = Math.max(0, n(split.dinnerDemand) + dinnerDemandFlat);
  const demand = lunchDemand + dinnerDemand;

  const lunchCapacityFromLabor = Math.floor(
    n(decisions.lunchStaff) * LUNCH_BLOCK_HOURS * PIZZAS_PER_PERSON_PER_HOUR * lunchLaborMult
  );

  const dinnerCapacityFromLabor = Math.floor(
    n(decisions.dinnerStaff) * DINNER_BLOCK_HOURS * PIZZAS_PER_PERSON_PER_HOUR * dinnerLaborMult
  );

  let remDough = startInv.dough;
  let remCheeseOz = startInv.cheeseOz;
  let remPepperoniOz = startInv.pepperoniOz;
  let remBoxes = startInv.boxes;

  const lunchInvCap = inventoryCap(
    remDough,
    remCheeseOz,
    remPepperoniOz,
    remBoxes,
    actualCheeseOz,
    actualPepperoniOz
  );

  const lunchMax = Math.min(lunchCapacityFromLabor, lunchInvCap.max, OVEN_MAX_PER_DAY);
  const lunchSold = Math.max(0, Math.min(lunchDemand, lunchMax));
  const lunchLost = Math.max(0, lunchDemand - lunchSold);

  remDough -= lunchSold;
  remCheeseOz -= lunchSold * actualCheeseOz;
  remPepperoniOz -= lunchSold * actualPepperoniOz;
  remBoxes -= lunchSold;

  const dinnerInvCap = inventoryCap(
    remDough,
    remCheeseOz,
    remPepperoniOz,
    remBoxes,
    actualCheeseOz,
    actualPepperoniOz
  );

  const dinnerMax = Math.min(
    dinnerCapacityFromLabor,
    dinnerInvCap.max,
    OVEN_MAX_PER_DAY - lunchSold
  );
  const dinnerSold = Math.max(0, Math.min(dinnerDemand, dinnerMax));
  const dinnerLost = Math.max(0, dinnerDemand - dinnerSold);

  remDough -= dinnerSold;
  remCheeseOz -= dinnerSold * actualCheeseOz;
  remPepperoniOz -= dinnerSold * actualPepperoniOz;
  remBoxes -= dinnerSold;

  const sold = lunchSold + dinnerSold;
  const lost = lunchLost + dinnerLost;

  let bottleneck: string | null = null;
  if (dinnerLost > 0)
    bottleneck =
      dinnerCapacityFromLabor < dinnerInvCap.max ? "dinner labor" : dinnerInvCap.bottleneck;
  else if (lunchLost > 0)
    bottleneck = lunchCapacityFromLabor < lunchInvCap.max ? "lunch labor" : lunchInvCap.bottleneck;

  const lunchBottleneck =
    lunchLost > 0
      ? lunchCapacityFromLabor < lunchInvCap.max
        ? "lunch labor"
        : lunchInvCap.bottleneck
      : null;

  const dinnerBottleneck =
    dinnerLost > 0
      ? dinnerCapacityFromLabor < dinnerInvCap.max
        ? "dinner labor"
        : dinnerInvCap.bottleneck
      : null;

  const doughUsed = sold;
  const cheeseUsedOz = sold * actualCheeseOz;
  const pepperoniUsedOz = sold * actualPepperoniOz;
  const boxUsed = sold;

  const doughSpoiled = Math.max(0, startInv.dough - doughUsed);

  const endInv = {
    dough: 0,
    cheeseOz: Math.max(0, startInv.cheeseOz - cheeseUsedOz),
    pepperoniOz: Math.max(0, startInv.pepperoniOz - pepperoniUsedOz),
    boxes: Math.max(0, startInv.boxes - boxUsed),
  };

  const revenue = sold * effectivePrice;

  const doughFoodCost = sold * COST.dough;
  const cheeseFoodCost = (cheeseUsedOz / OZ_PER_LB) * COST.cheesePerLb;
  const pepperoniFoodCost = (pepperoniUsedOz / OZ_PER_LB) * COST.pepperoniPerLb;
  const boxFoodCost = sold * COST.box;

  const foodCostUsed = doughFoodCost + cheeseFoodCost + pepperoniFoodCost + boxFoodCost;
  const spoilageCost = doughSpoiled * COST.dough;

  const totalLaborHours =
    n(decisions.lunchStaff) * LUNCH_BLOCK_HOURS + n(decisions.dinnerStaff) * DINNER_BLOCK_HOURS;

  const laborCost = totalLaborHours * COST.laborPerHour;
  const fixedCost = COST.fixedPerDay + fixedCostExtra + n(state.loanDailyPayment);
  const totalCost = foodCostUsed + spoilageCost + laborCost + fixedCost;
  const profit = revenue - totalCost;

  const foodPct = revenue > 0 ? ((foodCostUsed + spoilageCost) / revenue) * 100 : 0;
  const laborPct = revenue > 0 ? (laborCost / revenue) * 100 : 0;
  const primePct = revenue > 0 ? ((foodCostUsed + spoilageCost + laborCost) / revenue) * 100 : 0;

  const cashAfterPrime = revenue - (foodCostUsed + spoilageCost + laborCost);
  const cashAfterFixed = cashAfterPrime - fixedCost;

  const idealCheeseCost = (sold * n(decisions.cheesePerPizza) * COST.cheesePerLb) / OZ_PER_LB;
  const actualCheeseCost = (cheeseUsedOz * COST.cheesePerLb) / OZ_PER_LB;
  const overCheeseImpact = actualCheeseCost - idealCheeseCost;

  const idealPepCost = (sold * n(decisions.pepperoniPerPizza) * COST.pepperoniPerLb) / OZ_PER_LB;
  const actualPepCost = (pepperoniUsedOz * COST.pepperoniPerLb) / OZ_PER_LB;
  const overPepperoniImpact = actualPepCost - idealPepCost;

  const coaching: string[] = [];

  if (dinnerLost > 15)
    coaching.push(`You lost ${dinnerLost} pizzas during dinner because dinner staffing was too weak.`);
  if (lunchLost > 10)
    coaching.push(`You missed ${lunchLost} lunch pizzas. Lunch staffing or inventory was too tight.`);
  if (doughSpoiled > 20) coaching.push(`You spoiled ${doughSpoiled} dough balls. You overbought inventory.`);
  if (overCheeseImpact > 10) coaching.push(`Extra cheese quietly cost you ${money(overCheeseImpact)} today.`);
  if (n(decisions.pepperoniPerPizza) <= 0.5)
    coaching.push(
      `You skimped on pepperoni today. You saved a few cents per pizza, but your brand just took damage. Demand will be depressed for ${SKIMP_PENALTY_DAYS} days.`
    );
  if (n(state.brandPenalty) > 0.01)
    coaching.push(
      `Brand penalty still active: demand was about ${Math.round(
        (1 - brandPenaltyMult) * 100
      )}% lower today from past skimping.`
    );
  if (primePct > 70) coaching.push(`Prime cost was ${pct(primePct)}. That is the danger zone.`);
  if (primePct > 75) coaching.push(`At this prime cost, fixed costs will bury you.`);
  if (cashAfterFixed < 0)
    coaching.push(`After paying fixed costs, the store was cash negative by ${money(Math.abs(cashAfterFixed))}.`);
  if (profit < 0) coaching.push(`You lost money today. Something in pricing, staffing, or prep was off.`);
  else if (profit > 300) coaching.push(`Strong day. This is what a good operating day looks like.`);
  if (primePct < 55 && sold > 0) coaching.push(`Prime cost was controlled. That is how owners get paid.`);

  return {
    day,
    dow,
    demand,
    lunchDemand,
    dinnerDemand,
    sold,
    lunchSold,
    dinnerSold,
    lost,
    lunchLost,
    dinnerLost,
    bottleneck,
    lunchBottleneck,
    dinnerBottleneck,
    revenue,
    foodCostUsed,
    spoilageCost,
    laborCost,
    fixedCost,
    totalCost,
    profit,
    foodPct,
    laborPct,
    primePct,
    cashAfterPrime,
    cashAfterFixed,
    doughSpoiled,
    cheeseUsedOz,
    pepperoniUsedOz,
    startInv,
    endInv,
    recipeCheeseOz: n(decisions.cheesePerPizza),
    actualCheeseOz,
    recipePepperoniOz: n(decisions.pepperoniPerPizza),
    actualPepperoniOz,
    overCheeseImpact,
    overPepperoniImpact,
    lunchCapacity: lunchCapacityFromLabor,
    dinnerCapacity: dinnerCapacityFromLabor,
    totalLaborHours,
    brandPenaltyApplied: n(state.brandPenalty),
    skimpTriggeredToday,
    events,
    coaching,
  };
}

function getWeeklySummary(
  history: DayResult[],
  cash: number,
  ownership: number
): WeeklySummary | null {
  if (history.length === 0) return null;
  const latestDay = history[history.length - 1].day;
  if (latestDay % 7 !== 0) return null;

  const weekStart = latestDay - 6;
  const weekDays = history.filter((d) => d.day >= weekStart && d.day <= latestDay);

  const totalRevenue = weekDays.reduce((s, d) => s + n(d.revenue), 0);
  const totalProfit = weekDays.reduce((s, d) => s + n(d.profit), 0);
  const avgPrimePct = weekDays.length
    ? weekDays.reduce((s, d) => s + n(d.primePct), 0) / weekDays.length
    : 0;
  const avgLaborPct = weekDays.length
    ? weekDays.reduce((s, d) => s + n(d.laborPct), 0) / weekDays.length
    : 0;
  const avgFoodPct = weekDays.length
    ? weekDays.reduce((s, d) => s + n(d.foodPct), 0) / weekDays.length
    : 0;

  const totalLostSales = weekDays.reduce((s, d) => s + n(d.lost) * 15, 0);
  const totalWasteCost = weekDays.reduce((s, d) => s + n(d.spoilageCost), 0);

  const maxOwnerDistribution = Math.max(
    0,
    Math.min(n(cash) - 500, Math.max(0, totalProfit) * 0.9 * n(ownership) + 250)
  );

  let verdict = "Average week.";
  if (avgPrimePct > 70) verdict = "Too much waste or labor. Busy does not equal healthy.";
  else if (avgPrimePct > 62) verdict = "Close, but still leaking margin.";
  else if (avgPrimePct >= 55 && avgPrimePct <= 60) verdict = "Strong operator week. This is the zone.";
  else if (avgPrimePct < 55) verdict = "Very efficient week. Make sure you are not under-serving demand.";

  return {
    weekNumber: Math.ceil(latestDay / 7),
    days: weekDays,
    totalRevenue,
    totalProfit,
    avgPrimePct,
    avgLaborPct,
    avgFoodPct,
    totalLostSales,
    totalWasteCost,
    maxOwnerDistribution,
    verdict,
  };
}

function buildBalanceSheet(state: GameState) {
  const cash = n(state.cash);
  const invValue = inventoryValue(state.inventory);

  const assets = {
    cash,
    inventory: invValue,
    total: cash + invValue,
  };

  const liabilities = { total: 0 };
  const equity = { ownerEquityPlug: assets.total - liabilities.total };

  return { assets, liabilities, equity };
}

function buildIncomeStatement(history: DayResult[]) {
  const revenue = history.reduce((s, d) => s + n(d.revenue), 0);
  const foodUsed = history.reduce((s, d) => s + n(d.foodCostUsed), 0);
  const spoilage = history.reduce((s, d) => s + n(d.spoilageCost), 0);
  const labor = history.reduce((s, d) => s + n(d.laborCost), 0);
  const fixed = history.reduce((s, d) => s + n(d.fixedCost), 0);
  const netIncome = revenue - foodUsed - spoilage - labor - fixed;

  return { revenue, foodUsed, spoilage, labor, fixed, netIncome };
}

function buildTAccounts(state: GameState) {
  const totals: Record<string, { debit: number; credit: number }> = {};

  for (const entry of state.journal) {
    for (const line of entry.lines) {
      if (!totals[line.account]) totals[line.account] = { debit: 0, credit: 0 };
      totals[line.account].debit += n(line.debit);
      totals[line.account].credit += n(line.credit);
    }
  }

  return totals;
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function Page() {
  const [state, setState] = useState<GameState>(initialState());

  const unlocks = getUnlocks(state.mode, state.day);
  const learningCoach = state.mode === "learning" ? getLearningCoach(state.day) : null;

  // When a lever is locked, we fall back to LEARNING_DEFAULTS both visually
  // and for cost calculations — so the player sees the right order total and
  // the simulation uses the same value we charged them for.
  const p = {
    dough: unlocks.buy ? n(state.purchases.dough) : LEARNING_DEFAULTS.dough,
    cheeseLbs: unlocks.buy ? n(state.purchases.cheeseLbs) : LEARNING_DEFAULTS.cheeseLbs,
    pepperoniLbs: unlocks.buy
      ? n(state.purchases.pepperoniLbs)
      : LEARNING_DEFAULTS.pepperoniLbs,
    boxes: unlocks.buy ? n(state.purchases.boxes) : LEARNING_DEFAULTS.boxes,
  };
  const d = {
    price: unlocks.price ? n(state.decisions.price) : LEARNING_DEFAULTS.price,
    cheesePerPizza: unlocks.recipe
      ? n(state.decisions.cheesePerPizza)
      : LEARNING_DEFAULTS.cheesePerPizza,
    pepperoniPerPizza: unlocks.recipe
      ? n(state.decisions.pepperoniPerPizza)
      : LEARNING_DEFAULTS.pepperoniPerPizza,
    lunchStaff: unlocks.staff ? n(state.decisions.lunchStaff) : LEARNING_DEFAULTS.lunchStaff,
    dinnerStaff: unlocks.staff ? n(state.decisions.dinnerStaff) : LEARNING_DEFAULTS.dinnerStaff,
  };
  const dow = (state.day - 1) % 7;

  const purchaseCost =
    n(p.dough) * COST.dough +
    n(p.cheeseLbs) * COST.cheesePerLb +
    n(p.pepperoniLbs) * COST.pepperoniPerLb +
    n(p.boxes) * COST.box;

  const totalLaborHours =
    n(d.lunchStaff) * LUNCH_BLOCK_HOURS + n(d.dinnerStaff) * DINNER_BLOCK_HOURS;

  const laborPreview = totalLaborHours * COST.laborPerHour;
  const canAfford = purchaseCost <= n(state.cash);

  const projectedDemandMid =
    BASE_DEMAND *
    DAY_MULT[dow] *
    Math.pow(15 / Math.max(10, n(d.price)), 1.4) *
    (1 + (n(d.cheesePerPizza) - 8) * 0.05) *
    getPepperoniDemandEffect(n(d.pepperoniPerPizza));

  const projectedRange = {
    lo: Math.round(projectedDemandMid * 0.92),
    hi: Math.round(projectedDemandMid * 1.08),
  };

  const projectedSplit = phaseDemandSplit(projectedRange.hi, dow);

  const avgPrime =
    state.history.length > 0
      ? state.history.reduce((sum, h) => sum + n(h.primePct), 0) / state.history.length
      : 0;

  const totalProfit = state.history.reduce((sum, h) => sum + n(h.profit), 0);

  const balanceSheet = useMemo(() => buildBalanceSheet(state), [state]);
  const incomeStatement = useMemo(() => buildIncomeStatement(state.history), [state.history]);
  const tAccounts = useMemo(() => buildTAccounts(state), [state]);

  function setTab(tab: TabKey) {
    setState((s) => ({ ...s, activeTab: tab }));
  }

  function setPurchase<K extends keyof GameState["purchases"]>(key: K, value: number) {
    setState((s) => ({
      ...s,
      purchases: { ...s.purchases, [key]: Math.max(0, n(value)) },
    }));
  }

  function setDecision<K extends keyof GameState["decisions"]>(key: K, value: number) {
    setState((s) => ({
      ...s,
      decisions: { ...s.decisions, [key]: n(value) },
    }));
  }

  function startGame() {
    setState((s) => ({ ...s, phase: "modeSelect" }));
  }

  function selectMode(mode: GameMode) {
    setState(initialState(mode, "setup"));
  }

  function goBankrupt() {
    setState(initialState(state.mode, "modeSelect"));
  }

  function setAccountingView(v: "simple" | "advanced") {
    setState((s) => ({ ...s, accountingView: v }));
  }

  function applyInstantEquitySale(pctSold: number) {
    if (pctSold === 0) return;
    const cashIn = getEquityRaiseCash(pctSold);

    setState((s) => ({
      ...s,
      cash: n(s.cash) + cashIn,
      ownership: clamp(n(s.ownership) - pctSold / 100, 0.05, 1),
      journal: [
        ...s.journal,
        makeEntry(s.day, `Sold ${pctSold}% equity`, [
          { account: "Cash", debit: cashIn, credit: 0 },
          { account: "Owner Equity", debit: 0, credit: cashIn },
        ]),
      ],
    }));
  }

  function openStore() {
    if (purchaseCost > n(state.cash)) return;

    setState((s) => ({
      ...s,
      phase: "running",
      journal: [
        ...s.journal,
        makeEntry(s.day, "Bought inventory", [
          { account: "Inventory", debit: purchaseCost, credit: 0 },
          { account: "Cash", debit: 0, credit: purchaseCost },
        ]),
      ],
      cash: n(s.cash) - purchaseCost,
    }));

    const sim = simulateDay({
      ...state,
      cash: n(state.cash) - purchaseCost,
    });

    window.setTimeout(() => {
      setState((s) => ({
        ...s,
        lastResult: sim,
        phase: "results",
      }));
    }, 5000);
  }

  function continueAfterDay() {
    setState((s) => {
      if (!s.lastResult) return s;

      const nextCash =
        n(s.cash) + n(s.lastResult.revenue) - n(s.lastResult.laborCost) - n(s.lastResult.fixedCost);

      const finalized = s.lastResult;
      const newHistory = [...s.history, finalized];
      const nextDay = s.day + 1;
      const weeklySummary = getWeeklySummary(newHistory, nextCash, s.ownership);
      const nextPhase = nextDay > TOTAL_DAYS ? "gameover" : weeklySummary ? "weekly" : "setup";

      // ---- Brand equity evolution ----
      // 1) Decay any existing penalty by stepping days-left down.
      // 2) If player skimped today, STACK a fresh penalty (doesn't reset days left, takes the max).
      let nextBrandPenalty = n(s.brandPenalty);
      let nextBrandDaysLeft = Math.max(0, n(s.brandPenaltyDaysLeft) - 1);

      if (nextBrandDaysLeft <= 0) {
        nextBrandPenalty = 0;
      } else {
        // fade slightly as days go on
        nextBrandPenalty = nextBrandPenalty * 0.85;
      }

      if (finalized.skimpTriggeredToday) {
        nextBrandPenalty = Math.max(nextBrandPenalty, SKIMP_PENALTY_START);
        nextBrandDaysLeft = SKIMP_PENALTY_DAYS;
      }

      // ---- Loan payment: bundled into fixedCost, but record separately in journal ----
      const loanPayment = n(s.loanDailyPayment);
      const loanApplied = Math.min(n(s.loanBalance), loanPayment);
      const nextLoanBalance = Math.max(0, n(s.loanBalance) - loanApplied);

      const newJournal = [...s.journal];

      newJournal.push(
        makeEntry(s.day, "Recorded sales", [
          { account: "Cash", debit: finalized.revenue, credit: 0 },
          { account: "Sales Revenue", debit: 0, credit: finalized.revenue },
        ])
      );

      newJournal.push(
        makeEntry(s.day, "Recorded food and spoilage", [
          {
            account: "COGS + Waste",
            debit: finalized.foodCostUsed + finalized.spoilageCost,
            credit: 0,
          },
          {
            account: "Inventory",
            debit: 0,
            credit: finalized.foodCostUsed + finalized.spoilageCost,
          },
        ])
      );

      newJournal.push(
        makeEntry(s.day, "Paid labor", [
          { account: "Labor Expense", debit: finalized.laborCost, credit: 0 },
          { account: "Cash", debit: 0, credit: finalized.laborCost },
        ])
      );

      // Fixed cost journal entry, split between rent/utilities and loan if applicable
      const nonLoanFixed = Math.max(0, finalized.fixedCost - loanApplied);
      if (nonLoanFixed > 0) {
        newJournal.push(
          makeEntry(s.day, "Paid fixed costs", [
            { account: "Fixed Expense", debit: nonLoanFixed, credit: 0 },
            { account: "Cash", debit: 0, credit: nonLoanFixed },
          ])
        );
      }

      if (loanApplied > 0) {
        newJournal.push(
          makeEntry(s.day, "Loan payment", [
            { account: "Loan Payable", debit: loanApplied, credit: 0 },
            { account: "Cash", debit: 0, credit: loanApplied },
          ])
        );
      }

      return {
        ...s,
        day: nextDay,
        cash: nextCash,
        loanBalance: nextLoanBalance,
        brandPenalty: nextBrandPenalty,
        brandPenaltyDaysLeft: nextBrandDaysLeft,
        inventory: {
          dough: n(finalized.endInv.dough),
          cheeseOz: n(finalized.endInv.cheeseOz),
          pepperoniOz: n(finalized.endInv.pepperoniOz),
          boxes: n(finalized.endInv.boxes),
        },
        purchases: {
          dough: Math.max(40, Math.round(n(finalized.sold) * 0.95)),
          cheeseLbs: Math.max(
            10,
            Math.round((n(finalized.sold) * n(d.cheesePerPizza)) / OZ_PER_LB)
          ),
          pepperoniLbs: Math.max(
            4,
            Math.round((n(finalized.sold) * n(d.pepperoniPerPizza)) / OZ_PER_LB)
          ),
          boxes: Math.max(40, n(finalized.sold)),
        },
        lastResult: null,
        history: newHistory,
        weeklySummary,
        distributionRequest: 0,
        phase: nextPhase,
        activeTab: "store",
        journal: newJournal,
      };
    });
  }

  function processWeeklyDistribution() {
    setState((s) => {
      if (!s.weeklySummary) return s;

      const maxAllowed = Math.floor(n(s.weeklySummary.maxOwnerDistribution));
      const requested = clamp(n(s.distributionRequest), 0, maxAllowed);

      return {
        ...s,
        cash: n(s.cash) - requested,
        totalDistributions: n(s.totalDistributions) + requested,
        distributionRequest: 0,
        weeklySummary: null,
        phase: s.day > TOTAL_DAYS ? "gameover" : "setup",
        journal: [
          ...s.journal,
          makeEntry(s.day, "Owner distribution", [
            { account: "Distributions", debit: requested, credit: 0 },
            { account: "Cash", debit: 0, credit: requested },
          ]),
        ],
      };
    });
  }

  function resetGame() {
    setState(initialState("standard", "modeSelect"));
  }

  const gameScoreText = useMemo(() => {
    if (n(state.totalDistributions) >= 5000) return "Strong run. You got paid and kept the store alive.";
    if (n(state.totalDistributions) >= 2500) return "Solid run. You made money, but too much stayed trapped.";
    return "You stayed busy, but did not pull enough cash out.";
  }, [state.totalDistributions]);

  /* ---------- OVERLAY: INTRO ---------- */
  if (state.phase === "intro") {
    return (
      <Shell>
        <Styles />
        <div className="overlayWrap">
          <div className="overlayCard">
            <div className="badgeRow">
              <div className="slice">🍕</div>
              <div className="overlayEyebrow">BRENZ · 12" PEPPERONI</div>
            </div>
            <h1 className="overlayTitle">Welcome to Brenz Pizza Game</h1>
            <p className="overlayBody">
              Congratulations. You invested your life&apos;s savings and built this location.
            </p>
            <p className="overlayBody">
              You are selling one product only: a <b>12&quot; pepperoni pizza</b>. The store is open
              11am–9pm. You have 30 days to build a real business.
            </p>
            <p className="overlayBody">
              First, pick how you want to start.
            </p>
            <button className="bigBtn green" onClick={startGame}>
              CHOOSE YOUR MODE →
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------- OVERLAY: MODE SELECT ---------- */
  if (state.phase === "modeSelect") {
    return (
      <Shell>
        <Styles />
        <div className="overlayWrap overlayScroll">
          <div className="overlayCard wide">
            <div className="overlayEyebrow">PICK YOUR STARTING POSITION</div>
            <h1 className="overlayTitle">Three ways to start</h1>
            <p className="overlayBody">
              Each mode teaches a different lesson. Your choice changes starting cash, loan
              obligations, and what kind of mistake will hurt you the most.
            </p>

            <div className="modeList">
              {(["learning", "survival", "standard", "safetyNet"] as GameMode[]).map((m) => {
                const cfg = MODES[m];
                const isRecommended = m === "learning";
                return (
                  <button
                    key={m}
                    className={`modeCard ${isRecommended ? "modeCardRecommended" : ""}`}
                    style={{ borderColor: cfg.color }}
                    onClick={() => selectMode(m)}
                  >
                    {isRecommended && (
                      <div className="modeRecBadge">RECOMMENDED FOR FIRST PLAY</div>
                    )}
                    <div className="modeCardTop">
                      <div className="modeCardName" style={{ color: cfg.color }}>
                        {cfg.label}
                      </div>
                      <div className="modeCardCash">{money(cfg.startingCash)}</div>
                    </div>
                    <div className="modeCardTag">{cfg.tagline}</div>

                    <div className="modeCardStats">
                      <div className="modeStat">
                        <div className="modeStatLabel">Starting cash</div>
                        <div className="modeStatVal">{money(cfg.startingCash)}</div>
                      </div>
                      <div className="modeStat">
                        <div className="modeStatLabel">Loan balance</div>
                        <div className="modeStatVal">
                          {cfg.loanBalance > 0 ? money(cfg.loanBalance) : "—"}
                        </div>
                      </div>
                      <div className="modeStat">
                        <div className="modeStatLabel">Daily loan pmt</div>
                        <div className="modeStatVal">
                          {cfg.loanDailyPayment > 0 ? money(cfg.loanDailyPayment) : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="modeLesson">{cfg.lesson}</div>
                    <div className="modePick" style={{ background: cfg.color }}>
                      PICK THIS MODE →
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------- OVERLAY: GAME OVER ---------- */
  if (state.phase === "gameover") {
    return (
      <Shell>
        <Styles />
        <div className="overlayWrap">
          <div className="overlayCard">
            <div className="overlayEyebrow" style={{ color: "#f2b443" }}>
              FINAL REPORT · 30 DAYS
            </div>
            <h1 className="overlayTitle">Game Complete</h1>
            <p className="overlayBody">{gameScoreText}</p>

            <div className="statGrid">
              <StatCell big={money(state.totalDistributions)} label="Total distributions" />
              <StatCell big={pct(avgPrime)} label="Avg prime cost" />
              <StatCell big={money(totalProfit, true)} label="Net profit" />
              <StatCell big={`${Math.round(n(state.ownership) * 100)}%`} label="Ownership left" />
              <StatCell big={money(state.cash)} label="Ending cash" />
              <StatCell
                big={`${state.history.reduce((s, h) => s + n(h.lost), 0)}`}
                label="Tickets lost"
              />
            </div>

            <button className="bigBtn red" onClick={resetGame}>
              PLAY AGAIN
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------- OVERLAY: DAY RESULTS ---------- */
  if (state.phase === "results" && state.lastResult) {
    const r = state.lastResult;
    return (
      <Shell>
        <Styles />
        <TopStatusBar state={state} />
        <div className="overlayWrap overlayScroll">
          <div className="overlayCard wide">
            <div className="resultHero">
              <div className="overlayEyebrow">DAY {r.day} · {DAY_NAMES[r.dow]} · RESULTS</div>
              <h1 className={`resultProfit ${n(r.profit) >= 0 ? "good" : "bad"}`}>
                {money(n(r.profit), true)}
              </h1>
              <div className="resultSub">
                {n(r.sold)} pizzas sold · {pct(n(r.primePct))} prime cost
              </div>
            </div>

            <div className="metricGrid">
              <MetricBox label="Demand" value={`${n(r.demand)}`} />
              <MetricBox label="Sold" value={`${n(r.sold)}`} />
              <MetricBox label="Lost" value={`${n(r.lost)}`} tone={n(r.lost) > 20 ? "bad" : undefined} />
              <MetricBox label="Revenue" value={money(n(r.revenue))} />
              <MetricBox label="Food %" value={pct(n(r.foodPct))} />
              <MetricBox label="Labor %" value={pct(n(r.laborPct))} />
              <MetricBox
                label="Prime %"
                value={pct(n(r.primePct))}
                tone={n(r.primePct) > 70 ? "bad" : n(r.primePct) < 60 ? "good" : undefined}
              />
              <MetricBox
                label="Profit"
                value={money(n(r.profit), true)}
                tone={n(r.profit) >= 0 ? "good" : "bad"}
              />
            </div>

            <SectionLabel>CASH LESSON</SectionLabel>
            <div className="sheet">
              <Row label="Cash after prime" value={money(n(r.cashAfterPrime), true)} />
              <Row label="Fixed costs" value={money(n(r.fixedCost))} />
              <Row label="Cash after fixed" value={money(n(r.cashAfterFixed), true)} />
              <Row label="Prime %" value={pct(n(r.primePct))} />
            </div>

            <SectionLabel>LUNCH vs DINNER</SectionLabel>
            <div className="sheet">
              <Row label="Lunch demand / sold" value={`${n(r.lunchDemand)} / ${n(r.lunchSold)}`} />
              <Row label="Dinner demand / sold" value={`${n(r.dinnerDemand)} / ${n(r.dinnerSold)}`} />
              <Row label="Lunch bottleneck" value={r.lunchBottleneck ?? "none"} />
              <Row label="Dinner bottleneck" value={r.dinnerBottleneck ?? "none"} />
              <Row label="Overall bottleneck" value={r.bottleneck ?? "none"} />
            </div>

            {r.events.map((ev) => (
              <div className="event" key={ev.id}>
                <div className="eventTitle">{ev.title}</div>
                <div className="eventBody">{ev.body}</div>
              </div>
            ))}

            {(r.coaching ?? []).length > 0 && (
              <>
                <SectionLabel>WHAT HAPPENED TODAY</SectionLabel>
                <div className="sheet">
                  {r.coaching.map((c, i) => (
                    <div key={i} className="coachRow">
                      <span className="bullet">●</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <SectionLabel>WHERE EVERY DOLLAR WENT</SectionLabel>
            <div className="viewToggle">
              <button
                className={`viewToggleBtn ${state.accountingView === "simple" ? "active" : ""}`}
                onClick={() => setAccountingView("simple")}
              >
                Simple
              </button>
              <button
                className={`viewToggleBtn ${state.accountingView === "advanced" ? "active" : ""}`}
                onClick={() => setAccountingView("advanced")}
              >
                Detailed
              </button>
            </div>

            {state.accountingView === "simple" ? (
              <CommonSensePL
                revenue={n(r.revenue)}
                food={n(r.foodCostUsed) + n(r.spoilageCost)}
                labor={n(r.laborCost)}
                fixed={n(r.fixedCost)}
                profit={n(r.profit)}
              />
            ) : (
              <div className="sheet">
                <Row label="Food used" value={money(n(r.foodCostUsed))} />
                <Row label="Spoilage" value={money(n(r.spoilageCost))} />
                <Row label="Labor" value={money(n(r.laborCost))} />
                <Row label="Fixedc" value={money(n(r.fixedCost))} />
                <Row label="Net profit" value={money(n(r.profit), true)} bold tone={n(r.profit) >= 0 ? "good" : "bad"} />
              </div>
            )}

            <SectionLabel>INVENTORY</SectionLabel>
            <div className="sheet">
              <Row label="Dough spoiled" value={`${n(r.doughSpoiled)}`} />
              <Row label="Boxes left" value={`${n(r.endInv.boxes)}`} />
              <Row
                label="Pepperoni left"
                value={`${(n(r.endInv.pepperoniOz) / OZ_PER_LB).toFixed(1)} lbs`}
              />
              <Row
                label="Cheese left"
                value={`${(n(r.endInv.cheeseOz) / OZ_PER_LB).toFixed(1)} lbs`}
              />
            </div>

            <button className="bigBtn blue stickyCta" onClick={continueAfterDay}>
              CONTINUE →
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------- OVERLAY: WEEKLY ---------- */
  if (state.phase === "weekly" && state.weeklySummary) {
    const w = state.weeklySummary;
    return (
      <Shell>
        <Styles />
        <TopStatusBar state={state} />
        <div className="overlayWrap overlayScroll">
          <div className="overlayCard wide">
            <div className="resultHero">
              <div className="overlayEyebrow">WEEK {n(w.weekNumber)} · OWNER REVIEW</div>
              <h1 className={`resultProfit ${n(w.totalProfit) >= 0 ? "good" : "bad"}`}>
                {money(n(w.totalProfit), true)}
              </h1>
              <div className="resultSub">{w.verdict}</div>
            </div>

            <div className="metricGrid">
              <MetricBox label="Week Revenue" value={money(n(w.totalRevenue))} />
              <MetricBox
                label="Week Profit"
                value={money(n(w.totalProfit), true)}
                tone={n(w.totalProfit) >= 0 ? "good" : "bad"}
              />
              <MetricBox label="Avg Prime %" value={pct(n(w.avgPrimePct))} />
              <MetricBox label="Ownership" value={`${Math.round(n(state.ownership) * 100)}%`} />
            </div>

            <SectionLabel>SCORECARD</SectionLabel>
            <div className="sheet">
              <Row label="Revenue" value={money(n(w.totalRevenue))} />
              <Row label="Profit" value={money(n(w.totalProfit), true)} />
              <Row label="Avg food %" value={pct(n(w.avgFoodPct))} />
              <Row label="Avg labor %" value={pct(n(w.avgLaborPct))} />
            </div>

            <SectionLabel>LEAKS</SectionLabel>
            <div className="sheet">
              <Row label="Lost sales" value={money(n(w.totalLostSales))} />
              <Row label="Waste cost" value={money(n(w.totalWasteCost))} />
              <Row label="Prime cost" value={pct(n(w.avgPrimePct))} />
            </div>

            <SectionLabel>TAKE OWNER DISTRIBUTION</SectionLabel>
            <div className="sheet">
              <Row label="Max available" value={money(n(w.maxOwnerDistribution))} />
              <div className="rowLineSimple">
                <div className="ctrlName">Amount to take</div>
                <input
                  className="moneyInput"
                  type="number"
                  value={n(state.distributionRequest)}
                  min={0}
                  max={Math.floor(n(w.maxOwnerDistribution))}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      distributionRequest: e.target.value === "" ? 0 : n(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="quickRow">
                <button
                  className="quickBtn"
                  onClick={() =>
                    setState((s) => ({ ...s, distributionRequest: 0 }))
                  }
                >
                  $0
                </button>
                <button
                  className="quickBtn"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      distributionRequest: Math.floor(n(w.maxOwnerDistribution) * 0.5),
                    }))
                  }
                >
                  50%
                </button>
                <button
                  className="quickBtn"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      distributionRequest: Math.floor(n(w.maxOwnerDistribution)),
                    }))
                  }
                >
                  MAX
                </button>
              </div>
            </div>

            <button className="bigBtn gold stickyCta" onClick={processWeeklyDistribution}>
              TAKE DISTRIBUTION →
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------- OVERLAY: RUNNING ---------- */
  if (state.phase === "running") {
    return (
      <Shell>
        <Styles />
        <TopStatusBar state={state} />
        <div className="runningWrap">
          <AnimatedStoreScene day={state.day} dow={dow} running={true} />
          <div className="runningStatus">
            <div className="pulseDot" />
            <div>
              <div className="runningTitle">STORE ACTIVE</div>
              <div className="runningSub">
                Customers are moving through lunch and dinner. Day is playing out...
              </div>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------- MAIN LAYOUT: SETUP (tabs) ---------- */

  return (
    <Shell>
      <Styles />
      <TopStatusBar state={state} />

      <div className="contentScroll">
        {state.activeTab === "store" && (
          <StoreTab
            state={state}
            projectedRange={projectedRange}
            projectedSplit={projectedSplit}
            purchaseCost={purchaseCost}
            canAfford={canAfford}
            openStore={openStore}
            dow={dow}
            unlocks={unlocks}
            learningCoach={learningCoach}
          />
        )}

        {state.activeTab === "buy" && (
          <BuyTab
            state={state}
            p={p}
            purchaseCost={purchaseCost}
            setPurchase={setPurchase}
            canAfford={canAfford}
            openStore={openStore}
            unlocks={unlocks}
          />
        )}

        {state.activeTab === "recipe" && (
          <RecipeTab d={d} setDecision={setDecision} unlocks={unlocks} />
        )}

        {state.activeTab === "staff" && (
          <StaffTab
            d={d}
            setDecision={setDecision}
            totalLaborHours={totalLaborHours}
            laborPreview={laborPreview}
            unlocks={unlocks}
          />
        )}

        {state.activeTab === "money" && (
          <MoneyTab
            state={state}
            balanceSheet={balanceSheet}
            incomeStatement={incomeStatement}
            tAccounts={tAccounts}
            applyInstantEquitySale={applyInstantEquitySale}
            setAccountingView={setAccountingView}
            goBankrupt={goBankrupt}
            unlocks={unlocks}
          />
        )}
      </div>

      <BottomTabBar active={state.activeTab} setTab={setTab} />
    </Shell>
  );
}

/* ============================================================
   SHELL + TOP BAR
   ============================================================ */

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="wrap">{children}</div>;
}

function TopStatusBar({ state }: { state: GameState }) {
  const dow = (state.day - 1) % 7;
  const brandActive = n(state.brandPenalty) > 0.01 && n(state.brandPenaltyDaysLeft) > 0;
  const modeCfg = MODES[state.mode];

  return (
    <header className="topbar">
      <div className="topLeft">
        <div className="topDay">DAY {Math.min(state.day, TOTAL_DAYS)}</div>
        <div className="topDow">
          {DAY_NAMES[dow]} · {DAY_WEATHER[dow]}
        </div>
        <div className="topModeBadge" style={{ color: modeCfg.color }}>
          {modeCfg.label.toUpperCase()}
        </div>
      </div>
      <div className="topRight">
        {brandActive && (
          <div className="brandPill" title={`Customer satisfaction penalty: ${n(state.brandPenaltyDaysLeft)} day(s) left`}>
            ⚠ BRAND −{Math.round(n(state.brandPenalty) * 100)}%
          </div>
        )}
        <div className="topStat">
          <div className="topStatVal">{money(state.cash)}</div>
          <div className="topStatLabel">CASH</div>
        </div>
        <div className="topStat">
          <div className="topStatVal">{Math.round(n(state.ownership) * 100)}%</div>
          <div className="topStatLabel">OWN</div>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   BOTTOM TAB BAR
   ============================================================ */

function BottomTabBar({
  active,
  setTab,
}: {
  active: TabKey;
  setTab: (t: TabKey) => void;
}) {
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "store", label: "Store", icon: <IconStore /> },
    { key: "buy", label: "Buy", icon: <IconBuy /> },
    { key: "recipe", label: "Recipe", icon: <IconRecipe /> },
    { key: "staff", label: "Staff", icon: <IconStaff /> },
    { key: "money", label: "Money", icon: <IconMoney /> },
  ];

  return (
    <nav className="tabBar">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`tabItem ${active === t.key ? "tabActive" : ""}`}
          onClick={() => setTab(t.key)}
        >
          <div className="tabIcon">{t.icon}</div>
          <div className="tabLabel">{t.label}</div>
        </button>
      ))}
    </nav>
  );
}

/* ============================================================
   TABS
   ============================================================ */

function StoreTab({
  state,
  projectedRange,
  projectedSplit,
  purchaseCost,
  canAfford,
  openStore,
  dow,
  unlocks,
  learningCoach,
}: {
  state: GameState;
  projectedRange: { lo: number; hi: number };
  projectedSplit: { lunchDemand: number; dinnerDemand: number };
  purchaseCost: number;
  canAfford: boolean;
  openStore: () => void;
  dow: number;
  unlocks: Unlocks;
  learningCoach: { title: string; body: string } | null;
}) {
  return (
    <>
      <AnimatedStoreScene day={state.day} dow={dow} running={false} />

      {learningCoach && (
        <div className="coachCard">
          <div className="coachBadge">LEARNING · DAY {state.day}</div>
          <div className="coachTitle">{learningCoach.title}</div>
          <div className="coachBody">{learningCoach.body}</div>
          <UnlockMap unlocks={unlocks} />
        </div>
      )}

      <div className="sectionCard">
        <div className="sectionLabel">TONIGHT&apos;S FORECAST</div>
        <div className="sheet">
          <Row label="Total demand" value={`${projectedRange.lo}–${projectedRange.hi}`} />
          <Row label="Lunch demand" value={`~${projectedSplit.lunchDemand}`} />
          <Row label="Dinner demand" value={`~${projectedSplit.dinnerDemand}`} />
          <Row label="Weather" value={DAY_WEATHER[dow]} />
          <Row
            label="Cash after buy"
            value={money(n(state.cash) - purchaseCost)}
            tone={canAfford ? undefined : "bad"}
          />
        </div>
      </div>

      <div className="sectionCard">
        <div className="sectionLabel">CURRENT INVENTORY</div>
        <div className="sheet">
          <Row label="Dough" value={`${n(state.inventory.dough)}`} />
          <Row label="Cheese" value={`${(n(state.inventory.cheeseOz) / OZ_PER_LB).toFixed(1)} lbs`} />
          <Row
            label="Pepperoni"
            value={`${(n(state.inventory.pepperoniOz) / OZ_PER_LB).toFixed(1)} lbs`}
          />
          <Row label="Boxes" value={`${n(state.inventory.boxes)}`} />
        </div>
      </div>

      <div className="sectionCard hint">
        <div className="hintText">
          If prime cost gets above <b>70%</b>, fixed costs will usually start to bury you.
        </div>
      </div>

      <button
        className={`bigBtn green sticky ${canAfford ? "" : "disabled"}`}
        onClick={openStore}
        disabled={!canAfford}
      >
        {canAfford ? "OPEN THE STORE →" : "NOT ENOUGH CASH"}
      </button>
    </>
  );
}

// Visual tracker: which levers are unlocked today vs. locked with the day they open.
function UnlockMap({ unlocks }: { unlocks: Unlocks }) {
  const items: { key: keyof Unlocks; label: string; unlockDay: number }[] = [
    { key: "staff", label: "Staff", unlockDay: 1 },
    { key: "buy", label: "Buy", unlockDay: 2 },
    { key: "price", label: "Price", unlockDay: 3 },
    { key: "recipe", label: "Recipe", unlockDay: 4 },
    { key: "equity", label: "Equity", unlockDay: 5 },
    { key: "distributions", label: "Payout", unlockDay: 6 },
  ];

  return (
    <div className="unlockMap">
      {items.map((it) => {
        const open = unlocks[it.key];
        return (
          <div key={it.key} className={`unlockPill ${open ? "unlockOpen" : "unlockLocked"}`}>
            <span className="unlockDot">{open ? "●" : "🔒"}</span>
            <span className="unlockPillLabel">{it.label}</span>
            {!open && <span className="unlockWhen">D{it.unlockDay}</span>}
          </div>
        );
      })}
    </div>
  );
}

function BuyTab({
  state,
  p,
  purchaseCost,
  setPurchase,
  canAfford,
  openStore,
  unlocks,
}: {
  state: GameState;
  p: GameState["purchases"];
  purchaseCost: number;
  setPurchase: <K extends keyof GameState["purchases"]>(key: K, value: number) => void;
  canAfford: boolean;
  openStore: () => void;
  unlocks: Unlocks;
}) {
  if (!unlocks.buy) {
    return (
      <>
        <LockedPanel
          title="Purchasing locked until Day 2"
          body="Today your ingredients are being ordered for you at a sensible amount. Tomorrow you'll decide how much to buy — buy too little and you miss sales, too much and dough spoils overnight."
        />
        <div className="sectionCard">
          <div className="sectionLabel">AUTO-ORDER TODAY</div>
          <div className="sheet">
            <Row label="Dough balls" value={`${LEARNING_DEFAULTS.dough}`} />
            <Row label="Cheese" value={`${LEARNING_DEFAULTS.cheeseLbs} lbs`} />
            <Row label="Pepperoni" value={`${LEARNING_DEFAULTS.pepperoniLbs} lbs`} />
            <Row label="Boxes" value={`${LEARNING_DEFAULTS.boxes}`} />
            <Row label="Order total" value={money(purchaseCost)} bold />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="sectionCard">
        <div className="sectionLabel sectionLabelRow">
          <span>PURCHASING</span>
          <span className="sectionLabelTail">{money(purchaseCost)}</span>
        </div>

        <ControlRow
          name="Dough balls"
          sub={`${money(COST.dough)} each · dough dies daily`}
          value={n(p.dough)}
          setValue={(v) => setPurchase("dough", v)}
          min={0}
          max={220}
          step={5}
        />
        <ControlRow
          name="Cheese (lbs)"
          sub={`${money(COST.cheesePerLb)} / lb`}
          value={n(p.cheeseLbs)}
          setValue={(v) => setPurchase("cheeseLbs", v)}
          min={0}
          max={120}
          step={1}
        />
        <ControlRow
          name="Pepperoni (lbs)"
          sub={`${money(COST.pepperoniPerLb)} / lb`}
          value={n(p.pepperoniLbs)}
          setValue={(v) => setPurchase("pepperoniLbs", v)}
          min={0}
          max={60}
          step={1}
        />
        <ControlRow
          name="Boxes"
          sub={`${money(COST.box)} each`}
          value={n(p.boxes)}
          setValue={(v) => setPurchase("boxes", v)}
          min={0}
          max={240}
          step={5}
        />
      </div>

      <div className="sectionCard">
        <div className="sectionLabel">CURRENT INVENTORY (CARRY-OVER)</div>
        <div className="sheet">
          <Row label="Dough" value={`${n(state.inventory.dough)}`} />
          <Row label="Cheese" value={`${(n(state.inventory.cheeseOz) / OZ_PER_LB).toFixed(1)} lbs`} />
          <Row
            label="Pepperoni"
            value={`${(n(state.inventory.pepperoniOz) / OZ_PER_LB).toFixed(1)} lbs`}
          />
          <Row label="Boxes" value={`${n(state.inventory.boxes)}`} />
        </div>
        <div className="hintText" style={{ marginTop: 10 }}>
          Dough spoils overnight. Cheese, pepperoni, and boxes carry over.
        </div>
      </div>

      <div className="sectionCard totalsCard">
        <div className="totalsRow">
          <span>Order total</span>
          <span>{money(purchaseCost)}</span>
        </div>
        <div className="totalsRow">
          <span>Cash after buy</span>
          <span className={canAfford ? "" : "bad"}>{money(n(state.cash) - purchaseCost)}</span>
        </div>
      </div>

      <button
        className={`bigBtn green sticky ${canAfford ? "" : "disabled"}`}
        onClick={openStore}
        disabled={!canAfford}
      >
        {canAfford ? "OPEN THE STORE →" : "NOT ENOUGH CASH"}
      </button>
    </>
  );
}

function RecipeTab({
  d,
  setDecision,
  unlocks,
}: {
  d: GameState["decisions"];
  setDecision: <K extends keyof GameState["decisions"]>(key: K, value: number) => void;
  unlocks: Unlocks;
}) {
  // If both locked, show one clear panel.
  if (!unlocks.price && !unlocks.recipe) {
    return (
      <>
        <LockedPanel
          title="Recipe & price locked"
          body="Price unlocks Day 3. Recipe portions (cheese & pepperoni) unlock Day 4. Until then, we use standard settings: $15 price, 8 oz cheese, 2.5 oz pepperoni."
        />
        <div className="sectionCard">
          <div className="sectionLabel">AUTO-SETTINGS TODAY</div>
          <div className="sheet">
            <Row label="Price" value={`$${LEARNING_DEFAULTS.price}`} />
            <Row label="Cheese per pizza" value={`${LEARNING_DEFAULTS.cheesePerPizza.toFixed(1)} oz`} />
            <Row
              label="Pepperoni per pizza"
              value={`${LEARNING_DEFAULTS.pepperoniPerPizza.toFixed(2)} oz`}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {unlocks.price && (
        <div className="sectionCard">
          <div className="sectionLabel">PRICE</div>
          <ControlRow
            name="Price per pizza"
            sub="Lower price drives traffic. Higher protects margin."
            value={n(d.price)}
            setValue={(v) => setDecision("price", v)}
            min={10}
            max={25}
            step={1}
            format={(v) => `$${v}`}
          />
        </div>
      )}

      {unlocks.recipe ? (
        <div className="sectionCard">
          <div className="sectionLabel">RECIPE</div>
          <ControlRow
            name='Cheese per 12" pizza'
            sub="Higher cheese helps appeal but hurts cost"
            value={n(d.cheesePerPizza)}
            setValue={(v) => setDecision("cheesePerPizza", v)}
            min={6}
            max={12}
            step={0.5}
            format={(v) => `${v.toFixed(1)} oz`}
          />
          <ControlRow
            name='Pepperoni per 12" pizza'
            sub="Too little pepperoni will crush demand"
            value={n(d.pepperoniPerPizza)}
            setValue={(v) => setDecision("pepperoniPerPizza", v)}
            min={0.05}
            max={6}
            step={0.05}
            format={(v) => `${v.toFixed(2)} oz`}
          />

          {n(d.pepperoniPerPizza) < SKIMP_THRESHOLD_OZ && (
            <div className="warning">
              ⚠ You are about to <b>skimp</b>. Using less than {SKIMP_THRESHOLD_OZ} oz of pepperoni
              saves pennies today but triggers a <b>brand equity penalty</b>: demand drops for{" "}
              {SKIMP_PENALTY_DAYS} days. Customers remember.
            </div>
          )}
        </div>
      ) : (
        <LockedPanel
          title="Recipe portions locked until Day 4"
          body="Right now we use 8 oz of cheese and 2.5 oz of pepperoni — a solid baseline. On Day 4 you'll decide how much to use. More topping = more demand but also more cost per pizza."
        />
      )}
    </>
  );
}

function StaffTab({
  d,
  setDecision,
  totalLaborHours,
  laborPreview,
  unlocks: _unlocks,
}: {
  d: GameState["decisions"];
  setDecision: <K extends keyof GameState["decisions"]>(key: K, value: number) => void;
  totalLaborHours: number;
  laborPreview: number;
  unlocks: Unlocks;
}) {
  const lunchCap = n(d.lunchStaff) * LUNCH_BLOCK_HOURS * PIZZAS_PER_PERSON_PER_HOUR;
  const dinnerCap = n(d.dinnerStaff) * DINNER_BLOCK_HOURS * PIZZAS_PER_PERSON_PER_HOUR;

  return (
    <>
      <div className="sectionCard">
        <div className="sectionLabel sectionLabelRow">
          <span>LABOR · 11AM–9PM</span>
          <span className="sectionLabelTail">{money(laborPreview)}</span>
        </div>

        <ControlRow
          name="Lunch staff (11am–4pm)"
          sub="Minimum 2 people"
          value={n(d.lunchStaff)}
          setValue={(v) => setDecision("lunchStaff", v)}
          min={2}
          max={8}
          step={1}
          format={(v) => `${v} people`}
        />
        <ControlRow
          name="Dinner staff (4pm–9pm)"
          sub="Minimum 2 people · dinner rush matters most"
          value={n(d.dinnerStaff)}
          setValue={(v) => setDecision("dinnerStaff", v)}
          min={2}
          max={10}
          step={1}
          format={(v) => `${v} people`}
        />
      </div>

      <div className="sectionCard">
        <div className="sectionLabel">CAPACITY PREVIEW</div>
        <div className="sheet">
          <Row label="Total labor hours" value={`${totalLaborHours}`} />
          <Row label="Lunch capacity" value={`${lunchCap} pizzas`} />
          <Row label="Dinner capacity" value={`${dinnerCap} pizzas`} />
          <Row label="Labor cost" value={money(laborPreview)} />
        </div>
      </div>

      <div className="sectionCard hint">
        <div className="hintText">
          Each person makes <b>{PIZZAS_PER_PERSON_PER_HOUR}</b> pizzas/hour. Dinner is where most days are won or lost.
        </div>
      </div>
    </>
  );
}

function MoneyTab({
  state,
  balanceSheet,
  incomeStatement,
  tAccounts,
  applyInstantEquitySale,
  setAccountingView,
  goBankrupt,
}: {
  state: GameState;
  balanceSheet: ReturnType<typeof buildBalanceSheet>;
  incomeStatement: ReturnType<typeof buildIncomeStatement>;
  tAccounts: Record<string, { debit: number; credit: number }>;
  applyInstantEquitySale: (pct: number) => void;
  setAccountingView: (v: "simple" | "advanced") => void;
  goBankrupt: () => void;
  unlocks: Unlocks;
}) {
  const simple = state.accountingView === "simple";

  return (
    <>
      <div className="sectionCard">
        <div className="sectionLabel">ACCOUNTING VIEW</div>
        <div className="viewToggle">
          <button
            className={`viewToggleBtn ${simple ? "active" : ""}`}
            onClick={() => setAccountingView("simple")}
          >
            Simple
          </button>
          <button
            className={`viewToggleBtn ${!simple ? "active" : ""}`}
            onClick={() => setAccountingView("advanced")}
          >
            Detailed
          </button>
        </div>
        <div className="hintText" style={{ marginTop: 10 }}>
          {simple
            ? "Simple view: a plain-English breakdown of where every dollar goes."
            : "Detailed view: full balance sheet, income statement, and T-accounts."}
        </div>
      </div>

      {/* Where every dollar goes (always useful) */}
      {incomeStatement.revenue > 0 && (
        <div className="sectionCard">
          <div className="sectionLabel">WHERE EVERY DOLLAR WENT (RUN TO DATE)</div>
          <CommonSensePL
            revenue={incomeStatement.revenue}
            food={incomeStatement.foodUsed + incomeStatement.spoilage}
            labor={incomeStatement.labor}
            fixed={incomeStatement.fixed}
            profit={incomeStatement.netIncome}
          />
        </div>
      )}

      {unlocks.equity ? (
        <div className="sectionCard">
          <div className="sectionLabel">EQUITY RAISE</div>
          <div className="hintText" style={{ marginBottom: 12 }}>
            Sell part of the shop for instant cash. This lowers ownership immediately.
          </div>

        <div className="equityGrid">
          <button className="equityBtn blue" onClick={() => applyInstantEquitySale(10)}>
            <div className="equityPct">Sell 10%</div>
            <div className="equityCash">+{money(300)}</div>
          </button>
          <button className="equityBtn gold" onClick={() => applyInstantEquitySale(20)}>
            <div className="equityPct">Sell 20%</div>
            <div className="equityCash">+{money(700)}</div>
          </button>
          <button className="equityBtn orange" onClick={() => applyInstantEquitySale(30)}>
            <div className="equityPct">Sell 30%</div>
            <div className="equityCash">+{money(1200)}</div>
          </button>
        </div>

        <div className="sheet" style={{ marginTop: 12 }}>
          <Row
            label="Ownership remaining"
            value={`${Math.round(n(state.ownership) * 100)}%`}
          />
          <Row label="Total distributions taken" value={money(state.totalDistributions)} />
        </div>
      </div>
      ) : (
        <LockedPanel
          title="Equity raises unlock Day 5"
          body="If you ever run out of cash, you'll be able to sell 10/20/30% of the shop for an instant cash injection. But giving up ownership is permanent — it's a tool for emergencies, not a first move."
        />
      )}

      {/* Loan card only if player has a loan */}
      {(n(state.loanBalance) > 0 || n(state.loanDailyPayment) > 0) && (
        <div className="sectionCard">
          <div className="sectionLabel">LOAN</div>
          <div className="sheet">
            <Row label="Current loan balance" value={money(state.loanBalance)} />
            <Row label="Daily payment" value={money(state.loanDailyPayment)} />
            <Row
              label="Days until paid off"
              value={
                n(state.loanDailyPayment) > 0 && n(state.loanBalance) > 0
                  ? `${Math.ceil(n(state.loanBalance) / n(state.loanDailyPayment))} days`
                  : "—"
              }
            />
          </div>
          <div className="hintText" style={{ marginTop: 10 }}>
            Loan payment hits your daily fixed cost automatically. It eats margin every single day
            you&apos;re open, so don&apos;t waste cash that could be paying it down faster.
          </div>
        </div>
      )}

      {!simple && (
        <>
          <div className="sectionCard">
            <div className="sectionLabel">BALANCE SHEET</div>
            <div className="sheet">
              <Row label="Cash" value={money(balanceSheet.assets.cash)} />
              <Row label="Inventory" value={money(balanceSheet.assets.inventory)} />
              <Row label="Total Assets" value={money(balanceSheet.assets.total)} bold />
              <Row label="Loan Payable" value={money(state.loanBalance)} />
              <Row label="Liabilities" value={money(balanceSheet.liabilities.total)} />
              <Row label="Owner Equity" value={money(balanceSheet.equity.ownerEquityPlug)} bold />
            </div>
          </div>

          <div className="sectionCard">
            <div className="sectionLabel">INCOME STATEMENT (RUN TO DATE)</div>
            <div className="sheet">
              <Row label="Sales Revenue" value={money(incomeStatement.revenue)} />
              <Row label="Food Used" value={money(incomeStatement.foodUsed)} />
              <Row label="Spoilage" value={money(incomeStatement.spoilage)} />
              <Row label="Labor" value={money(incomeStatement.labor)} />
              <Row label="Fixed Expense" value={money(incomeStatement.fixed)} />
              <Row
                label="Net Income"
                value={money(incomeStatement.netIncome, true)}
                bold
                tone={incomeStatement.netIncome >= 0 ? "good" : "bad"}
              />
            </div>
          </div>

          <div className="sectionCard">
            <div className="sectionLabel">T-ACCOUNTS</div>
            {Object.keys(tAccounts).length === 0 ? (
              <div className="hintText">No accounting activity yet.</div>
            ) : (
              <div className="tTable">
                <div className="tHead">
                  <div>Account</div>
                  <div className="tNum">Debit</div>
                  <div className="tNum">Credit</div>
                </div>
                {Object.entries(tAccounts).map(([account, totals]) => (
                  <div className="tRow" key={account}>
                    <div>{account}</div>
                    <div className="tNum">{money(totals.debit)}</div>
                    <div className="tNum">{money(totals.credit)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <button className="bigBtn red" onClick={goBankrupt}>
        GO BANKRUPT / RESTART
      </button>
    </>
  );
}

/* ============================================================
   SCENE
   ============================================================ */

function AnimatedStoreScene({
  day,
  dow,
  running,
}: {
  day: number;
  dow: number;
  running: boolean;
}) {
  return (
    <div className="sceneCard">
      <div className="sceneTop">
        <div className="chip chipStrong">
          DAY {day} · {DAY_NAMES[dow]}
        </div>
        <div className="chip">{DAY_WEATHER[dow]}</div>
        <div className={`chip ${running ? "chipActive" : ""}`}>
          {running ? "ACTIVE" : "READY"}
        </div>
      </div>

      <div className="sceneAnimWrap">
        <img src="/storefront.jpeg" alt="Brenz storefront" className="sceneImg" />

        {running && (
          <div className="walkPlane">
            <Silhouette className="walker w1" />
            <Silhouette className="walker w2" />
            <Silhouette className="walker w3" />
            <Silhouette className="walker w4" />
            <Silhouette className="walker w5" />
          </div>
        )}

        {running && <div className="activeBadge">OPEN · LUNCH / DINNER FLOW</div>}
      </div>

      <div className="sceneBottom">
        <div className="vibe">{DAY_VIBE[dow]}</div>
        <div className="meta">
          {running
            ? "Customers are moving through the day..."
            : "Open 11am–9pm. Dinner rush can break a weak labor plan."}
        </div>
      </div>
    </div>
  );
}

function Silhouette({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 46 110" fill="rgba(14,10,8,0.88)" aria-hidden="true">
      <circle cx="23" cy="11" r="9" />
      <rect x="15" y="21" width="16" height="34" rx="7" />
      <rect x="10" y="25" width="5" height="26" rx="2" />
      <rect x="31" y="25" width="5" height="26" rx="2" />
      <rect x="16" y="55" width="6" height="35" rx="2" />
      <rect x="24" y="55" width="6" height="35" rx="2" />
      <rect x="14" y="88" width="10" height="6" rx="1" />
      <rect x="22" y="88" width="10" height="6" rx="1" />
    </svg>
  );
}

/* ============================================================
   SMALL PIECES
   ============================================================ */

function ControlRow({
  name,
  sub,
  value,
  setValue,
  min,
  max,
  step,
  format,
}: {
  name: string;
  sub: string;
  value: number;
  setValue: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="rowLine">
      <div className="rowLineLeft">
        <div className="ctrlName">{name}</div>
        <div className="ctrlSub">{sub}</div>
      </div>
      <div className="stepper">
        <button
          className="stepBtn"
          onClick={() => setValue(clamp(n(value) - step, min, max))}
          aria-label="decrease"
        >
          −
        </button>
        <div className="stepVal">{format ? format(n(value)) : n(value)}</div>
        <button
          className="stepBtn"
          onClick={() => setValue(clamp(n(value) + step, min, max))}
          aria-label="increase"
        >
          +
        </button>
      </div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="metricBox">
      <div className={`mv ${tone ?? ""}`}>{value}</div>
      <div className="ml">{label}</div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "good" | "bad";
}) {
  return (
    <div className={`row ${bold ? "rowBold" : ""}`}>
      <span>{label}</span>
      <span className={tone ?? ""}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="sectionLabel sectionLabelStandalone">{children}</div>;
}

function StatCell({ big, label }: { big: string; label: string }) {
  return (
    <div className="statCell">
      <div className="statBig">{big}</div>
      <div className="statLabel">{label}</div>
    </div>
  );
}

// Shown in place of controls when a lever is locked in Learning Mode.
// Explains what the feature is and when it unlocks, so the player knows
// what to expect without just seeing an empty tab.
function LockedPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="lockedPanel">
      <div className="lockedIcon">🔒</div>
      <div className="lockedTitle">{title}</div>
      <div className="lockedBody">{body}</div>
    </div>
  );
}

/* CommonSensePL — breaks $1 of revenue into its component cents so non-accountants
   can see exactly where the money goes. Teaches the "prime cost + fixed cost + profit"
   mental model without any debit/credit machinery. */
function CommonSensePL({
  revenue,
  food,
  labor,
  fixed,
  profit,
}: {
  revenue: number;
  food: number;
  labor: number;
  fixed: number;
  profit: number;
}) {
  if (revenue <= 0) {
    return (
      <div className="sheet">
        <div className="hintText">No revenue yet. Open the store to see this breakdown.</div>
      </div>
    );
  }

  const foodCents = food / revenue;
  const laborCents = labor / revenue;
  const fixedCents = fixed / revenue;

  // Profit cents can be negative — we calculate it as the residual so the four
  // values always sum to 1.00.
  const profitCents = 1 - foodCents - laborCents - fixedCents;
  const profitPositive = profitCents >= 0;

  const toCents = (c: number) => `$${c.toFixed(2)}`;

  // Clamp visual widths to [0, 1]. If profit is negative we show it as a
  // red "hole" segment so the bar still feels honest.
  const barFood = Math.max(0, Math.min(1, foodCents)) * 100;
  const barLabor = Math.max(0, Math.min(1, laborCents)) * 100;
  const barFixed = Math.max(0, Math.min(1, fixedCents)) * 100;
  const barProfit = Math.max(0, Math.min(1, profitCents)) * 100;
  const barLoss = profitPositive ? 0 : Math.min(100, Math.abs(profitCents) * 100);

  return (
    <div className="simpleBlock">
      <div className="simpleIntro">For every <b>$1.00</b> you took in:</div>

      <div className="simpleBar" role="img" aria-label="Dollar breakdown">
        <div className="simpleBarSeg food" style={{ width: `${barFood}%` }} />
        <div className="simpleBarSeg labor" style={{ width: `${barLabor}%` }} />
        <div className="simpleBarSeg fixed" style={{ width: `${barFixed}%` }} />
        {profitPositive ? (
          <div className="simpleBarSeg profit" style={{ width: `${barProfit}%` }} />
        ) : (
          <div className="simpleBarSeg loss" style={{ width: `${barLoss}%` }} />
        )}
      </div>

      <div className="simpleLegend">
        <SimpleRow
          swatch="food"
          cents={toCents(foodCents)}
          label="went to the food"
          sub="Ingredients, cheese, pepperoni, boxes, spoilage"
        />
        <SimpleRow
          swatch="labor"
          cents={toCents(laborCents)}
          label="went to your staff"
          sub="Lunch and dinner crew wages"
        />
        <SimpleRow
          swatch="fixedc"
          cents={toCents(fixedCents)}
          label="went to rent &amp; utilities"
          sub="Fixed costs you pay even on a slow day"
        />
        <SimpleRow
          swatch={profitPositive ? "profit" : "loss"}
          cents={toCents(profitCents)}
          label={profitPositive ? "is your actual profit" : "is how much you LOST on the dollar"}
          sub={
            profitPositive
              ? "Whatever is left after paying everyone else"
              : "Revenue did not cover your costs today"
          }
          tone={profitPositive ? "good" : "bad"}
        />
      </div>

      <div className="simpleFooter">
        Revenue {money(revenue)} · Profit{" "}
        <span className={profitPositive ? "good" : "bad"}>{money(profit, true)}</span>
      </div>
    </div>
  );
}

function SimpleRow({
  swatch,
  cents,
  label,
  sub,
  tone,
}: {
  swatch: "food" | "labor" | "fixedc" | "profit" | "loss";
  cents: string;
  label: string;
  sub: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="simpleRow">
      <div className={`simpleSwatch ${swatch}`} />
      <div className="simpleRowBody">
        <div className="simpleRowTop">
          <span className={`simpleCents ${tone ?? ""}`}>{cents}</span>
          <span className="simpleLabel">{label}</span>
        </div>
        <div className="simpleSub">{sub}</div>
      </div>
    </div>
  );
}

/* ============================================================
   ICONS
   ============================================================ */

function IconStore() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10l1.5-5h15L21 10" />
      <path d="M4 10v10h16V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function IconBuy() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6h15l-1.5 9H7.5z" />
      <path d="M6 6L4 3H2" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
    </svg>
  );
}

function IconRecipe() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="9" r="1" fill="currentColor" />
      <circle cx="10" cy="15" r="1" fill="currentColor" />
      <circle cx="15" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

function IconStaff() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 20c0-2.5 2-5 4.5-5" />
    </svg>
  );
}

function IconMoney() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9v6M18 9v6" />
    </svg>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

function Styles() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }

      .wrap {
        min-height: 100vh;
        background:
          radial-gradient(circle at 20% -10%, rgba(232,90,42,0.12), transparent 40%),
          radial-gradient(circle at 100% 110%, rgba(242,180,67,0.06), transparent 40%),
          linear-gradient(180deg, #16110c 0%, #1d1711 100%);
        font-family: 'Inter', system-ui, sans-serif;
        color: #f3e7c9;
        padding-bottom: env(safe-area-inset-bottom);
      }

      /* =========== TOP BAR =========== */
      .topbar {
        position: sticky;
        top: 0;
        z-index: 30;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: rgba(22, 17, 12, 0.92);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-bottom: 1px solid #3b2d1f;
        padding-top: calc(12px + env(safe-area-inset-top));
      }
      .topLeft { display: flex; flex-direction: column; }
      .topDay {
        font-size: 18px;
        font-weight: 900;
        letter-spacing: .05em;
        color: #f2b443;
      }
      .topDow {
        font-size: 11px;
        letter-spacing: .08em;
        color: #c8b48c;
        margin-top: 2px;
      }
      .topRight { display: flex; gap: 16px; }
      .topStat { text-align: right; }
      .topStatVal { font-size: 16px; font-weight: 900; }
      .topStatLabel {
        font-size: 10px;
        letter-spacing: .1em;
        color: #8f7d5d;
        margin-top: 2px;
      }

      /* =========== CONTENT SCROLL =========== */
      .contentScroll {
        padding: 16px;
        padding-bottom: 100px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        max-width: 640px;
        margin: 0 auto;
      }

      /* =========== BOTTOM TAB BAR =========== */
      .tabBar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 40;
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        background: rgba(22, 17, 12, 0.96);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-top: 1px solid #3b2d1f;
        padding-bottom: env(safe-area-inset-bottom);
      }
      .tabItem {
        background: transparent;
        border: 0;
        color: #8f7d5d;
        padding: 10px 4px 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        transition: color .15s ease, transform .15s ease;
        font-family: inherit;
      }
      .tabIcon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
      }
      .tabLabel {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .04em;
      }
      .tabActive {
        color: #e85a2a;
      }
      .tabActive .tabIcon {
        transform: translateY(-1px);
        filter: drop-shadow(0 2px 6px rgba(232,90,42,0.35));
      }

      /* =========== SECTION CARDS =========== */
      .sectionCard {
        background: #221a12;
        border: 1px solid #3b2d1f;
        border-radius: 18px;
        padding: 16px;
      }
      .sectionLabel {
        font-size: 12px;
        letter-spacing: .12em;
        font-weight: 900;
        color: #f2b443;
        margin-bottom: 12px;
      }
      .sectionLabelRow {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .sectionLabelTail {
        color: #f2b443;
      }
      .sectionLabelStandalone {
        margin-top: 18px;
        margin-bottom: 10px;
      }
      .hint {
        background: rgba(242, 180, 67, 0.08);
        border-color: rgba(242, 180, 67, 0.3);
      }
      .hintText {
        color: #c8b48c;
        font-size: 13px;
        line-height: 1.5;
      }
      .warning {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(182, 59, 59, 0.18);
        border: 1px solid rgba(255, 157, 132, 0.4);
        color: #ffb8a4;
        font-size: 13px;
        font-weight: 600;
      }

      .sheet {
        display: flex;
        flex-direction: column;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 0;
        border-top: 1px solid #2d2217;
        font-size: 14px;
      }
      .row:first-child { border-top: 0; padding-top: 4px; }
      .rowBold {
        font-weight: 900;
        font-size: 15px;
      }
      .good { color: #9edf83; }
      .bad { color: #ff9d84; }

      /* =========== CONTROL ROW =========== */
      .rowLine {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 14px 0;
        border-top: 1px solid #2d2217;
      }
      .rowLine:first-child { border-top: 0; padding-top: 4px; }
      .rowLineSimple {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 12px 0;
        border-top: 1px solid #2d2217;
      }
      .rowLineLeft { min-width: 0; }
      .ctrlName { font-weight: 700; font-size: 14px; }
      .ctrlSub { margin-top: 4px; color: #8f7d5d; font-size: 12px; line-height: 1.4; }

      .stepper {
        display: grid;
        grid-template-columns: 44px 90px 44px;
        gap: 8px;
        align-items: center;
      }
      .stepBtn {
        height: 44px;
        border: 0;
        border-radius: 12px;
        background: #3b2d1f;
        color: #f3e7c9;
        font-size: 22px;
        font-weight: 900;
        cursor: pointer;
        transition: background .12s ease, transform .08s ease;
      }
      .stepBtn:hover { background: #4a3827; }
      .stepBtn:active { transform: scale(0.94); }
      .stepVal {
        text-align: center;
        padding: 12px 6px;
        border-radius: 12px;
        background: #16110c;
        border: 1px solid #3b2d1f;
        font-weight: 800;
        font-size: 14px;
      }

      /* =========== BUTTONS =========== */
      .bigBtn {
        width: 100%;
        border: 0;
        border-radius: 16px;
        padding: 18px;
        color: white;
        font-size: 16px;
        font-weight: 900;
        letter-spacing: .03em;
        cursor: pointer;
        font-family: inherit;
        box-shadow: 0 10px 24px rgba(0,0,0,0.35);
        transition: transform .1s ease, box-shadow .15s ease, filter .15s ease;
      }
      .bigBtn:active { transform: translateY(1px); }
      .bigBtn:hover:not(.disabled) { filter: brightness(1.05); }
      .sticky { margin-top: 4px; }
      .stickyCta { margin-top: 18px; }

      .orange { background: linear-gradient(180deg, #f0663a, #e85a2a); }
      .blue { background: linear-gradient(180deg, #4f8fff, #3f82ff); }
      .gold { background: linear-gradient(180deg, #e4ad2c, #d49d25); }
      .gray { background: #5a5248; }
      .green { background: linear-gradient(180deg, #46bd6a, #3ba55d); }
      .red { background: linear-gradient(180deg, #c84646, #b63b3b); }
      .disabled {
        background: #3b322a;
        color: #7d7060;
        cursor: not-allowed;
        box-shadow: none;
      }

      .quickRow {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 10px;
      }
      .quickBtn {
        padding: 10px;
        border-radius: 10px;
        background: #2a2016;
        border: 1px solid #3b2d1f;
        color: #f3e7c9;
        font-weight: 800;
        font-size: 13px;
        cursor: pointer;
        font-family: inherit;
      }
      .quickBtn:hover { background: #342618; }

      .moneyInput {
        width: 140px;
        padding: 12px;
        border-radius: 12px;
        border: 1px solid #3b2d1f;
        background: #16110c;
        color: #f3e7c9;
        font-size: 16px;
        font-weight: 800;
        font-family: inherit;
        text-align: right;
      }

      /* =========== SCENE =========== */
      .sceneCard {
        background: #221a12;
        border: 1px solid #3b2d1f;
        border-radius: 20px;
        overflow: hidden;
      }
      .sceneTop {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding: 12px 14px;
        background: #1b140e;
        border-bottom: 1px solid #3b2d1f;
      }
      .chip {
        border-radius: 999px;
        background: #2a2016;
        border: 1px solid #3b2d1f;
        padding: 6px 12px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .05em;
        color: #c8b48c;
      }
      .chipStrong {
        background: #3b2d1f;
        color: #f3e7c9;
      }
      .chipActive {
        background: rgba(232, 90, 42, 0.9);
        border-color: transparent;
        color: white;
      }
      .sceneAnimWrap {
        position: relative;
        overflow: hidden;
        aspect-ratio: 16/9;
        background: #16110c;
      }
      .sceneImg {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .walkPlane {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
      }
      .walker {
        position: absolute;
        bottom: 2%;
        width: 32px;
        height: 74px;
        opacity: 0;
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.35));
      }
      .w1 { animation: walk-right 5s linear 0s 1; }
      .w2 { animation: walk-left 4.8s linear 0.4s 1; bottom: 0%; transform: scale(1.05); }
      .w3 { animation: walk-right 4.6s linear 1s 1; bottom: 3%; transform: scale(0.9); }
      .w4 { animation: walk-left 4.2s linear 1.5s 1; bottom: 1%; transform: scale(1.1); }
      .w5 { animation: walk-right 3.8s linear 2s 1; bottom: 4%; transform: scale(0.82); }
      @keyframes walk-right {
        0%   { left: -8%; opacity: 0; transform: translateY(0) scale(1); }
        8%   { opacity: 0.95; }
        50%  { transform: translateY(-2px) scale(1); }
        92%  { opacity: 0.95; }
        100% { left: 104%; opacity: 0; transform: translateY(0) scale(1); }
      }
      @keyframes walk-left {
        0%   { left: 104%; opacity: 0; transform: translateY(0) scaleX(-1); }
        8%   { opacity: 0.95; }
        50%  { transform: translateY(-2px) scaleX(-1); }
        92%  { opacity: 0.95; }
        100% { left: -8%; opacity: 0; transform: translateY(0) scaleX(-1); }
      }
      .activeBadge {
        position: absolute;
        right: 12px;
        top: 12px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(232, 90, 42, 0.95);
        color: white;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .1em;
        box-shadow: 0 6px 16px rgba(0,0,0,0.25);
      }
      .sceneBottom { padding: 14px; }
      .vibe { font-size: 16px; font-weight: 800; line-height: 1.35; }
      .meta { margin-top: 6px; color: #c8b48c; font-size: 13px; line-height: 1.45; }

      /* =========== METRIC GRID =========== */
      .metricGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin: 14px 0 6px;
      }
      .metricBox {
        padding: 12px;
        border-radius: 14px;
        background: #1b140e;
        border: 1px solid #3b2d1f;
      }
      .mv { font-size: 22px; font-weight: 900; line-height: 1.1; }
      .ml {
        margin-top: 4px;
        color: #c8b48c;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .08em;
      }

      /* =========== EVENTS =========== */
      .event {
        margin-top: 12px;
        padding: 14px;
        border-radius: 14px;
        background: #2a2016;
        border: 1px solid #3b2d1f;
      }
      .eventTitle {
        color: #f2b443;
        font-weight: 900;
        letter-spacing: .06em;
        font-size: 13px;
      }
      .eventBody { margin-top: 6px; line-height: 1.5; font-size: 14px; }

      .coachRow {
        display: grid;
        grid-template-columns: 16px 1fr;
        gap: 10px;
        align-items: flex-start;
        padding: 8px 0;
        border-top: 1px solid #2d2217;
        font-size: 14px;
        line-height: 1.45;
      }
      .coachRow:first-child { border-top: 0; padding-top: 2px; }
      .bullet { color: #e85a2a; line-height: 1.4; }

      /* =========== OVERLAYS =========== */
      .overlayWrap {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px 16px;
      }
      .overlayScroll {
        align-items: flex-start;
        padding-top: 24px;
        padding-bottom: 40px;
      }
      .overlayCard {
        width: 100%;
        max-width: 520px;
        background: linear-gradient(180deg, #221a12, #1d1711);
        border: 1px solid #3b2d1f;
        border-radius: 22px;
        padding: 24px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
      }
      .overlayCard.wide { max-width: 640px; }

      .badgeRow {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .slice {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(180deg, #f0663a, #e85a2a);
        border-radius: 14px;
        font-size: 22px;
        box-shadow: 0 6px 14px rgba(232, 90, 42, 0.4);
      }
      .overlayEyebrow {
        color: #c8b48c;
        font-size: 11px;
        letter-spacing: .18em;
        font-weight: 800;
      }
      .overlayTitle {
        margin: 12px 0 12px;
        font-size: 30px;
        line-height: 1.1;
        font-weight: 900;
        color: #f3e7c9;
        letter-spacing: -0.01em;
      }
      .overlayBody {
        color: #d8c8a2;
        font-size: 15px;
        line-height: 1.55;
        margin: 10px 0;
      }

      .resultHero {
        text-align: center;
        padding: 8px 0 16px;
        border-bottom: 1px solid #2d2217;
        margin-bottom: 6px;
      }
      .resultProfit {
        font-size: 48px;
        font-weight: 900;
        line-height: 1;
        margin: 10px 0 6px;
        letter-spacing: -0.02em;
      }
      .resultSub {
        color: #c8b48c;
        font-size: 14px;
      }

      .statGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin: 16px 0;
      }
      .statCell {
        padding: 14px;
        border-radius: 14px;
        background: #1b140e;
        border: 1px solid #3b2d1f;
      }
      .statBig {
        font-size: 22px;
        font-weight: 900;
        letter-spacing: -0.01em;
      }
      .statLabel {
        color: #c8b48c;
        font-size: 11px;
        letter-spacing: .08em;
        margin-top: 4px;
        text-transform: uppercase;
      }

      /* =========== RUNNING =========== */
      .runningWrap {
        padding: 16px;
        padding-bottom: 100px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        max-width: 640px;
        margin: 0 auto;
      }
      .runningStatus {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px;
        background: #221a12;
        border: 1px solid #3b2d1f;
        border-radius: 18px;
      }
      .pulseDot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #e85a2a;
        box-shadow: 0 0 0 0 rgba(232, 90, 42, 0.7);
        animation: pulse 1.6s infinite;
      }
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(232, 90, 42, 0.7); }
        80% { box-shadow: 0 0 0 14px rgba(232, 90, 42, 0); }
        100% { box-shadow: 0 0 0 0 rgba(232, 90, 42, 0); }
      }
      .runningTitle {
        font-weight: 900;
        letter-spacing: .06em;
        font-size: 14px;
      }
      .runningSub {
        color: #c8b48c;
        font-size: 13px;
        margin-top: 4px;
        line-height: 1.45;
      }

      /* =========== EQUITY =========== */
      .equityGrid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .equityBtn {
        border: 0;
        border-radius: 14px;
        padding: 14px 8px;
        color: white;
        font-weight: 900;
        cursor: pointer;
        font-family: inherit;
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: center;
        box-shadow: 0 8px 18px rgba(0,0,0,0.3);
      }
      .equityPct { font-size: 14px; letter-spacing: .04em; }
      .equityCash { font-size: 13px; opacity: .92; }

      .totalsCard {
        background: #1b140e;
      }
      .totalsRow {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 15px;
        font-weight: 800;
      }

      /* =========== T-TABLE =========== */
      .tTable {
        display: flex;
        flex-direction: column;
        margin-top: 4px;
      }
      .tHead, .tRow {
        display: grid;
        grid-template-columns: 1.4fr 1fr 1fr;
        gap: 6px;
        padding: 10px 0;
        border-top: 1px solid #2d2217;
        font-size: 13px;
      }
      .tHead {
        border-top: 0;
        font-size: 11px;
        letter-spacing: .1em;
        color: #f2b443;
        font-weight: 900;
      }
      .tNum { text-align: right; }

      /* =========== MODE SELECT =========== */
      .modeList {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 18px;
      }
      .modeCard {
        background: #1b140e;
        border: 2px solid #3b2d1f;
        border-radius: 18px;
        padding: 16px;
        text-align: left;
        cursor: pointer;
        color: #f3e7c9;
        font-family: inherit;
        transition: transform .12s ease, box-shadow .2s ease;
        box-shadow: 0 6px 18px rgba(0,0,0,0.3);
      }
      .modeCard:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 28px rgba(0,0,0,0.45);
      }
      .modeCard:active { transform: translateY(0); }
      .modeCardTop {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
      }
      .modeCardName {
        font-size: 18px;
        font-weight: 900;
        letter-spacing: .02em;
      }
      .modeCardCash {
        font-size: 22px;
        font-weight: 900;
        color: #f3e7c9;
      }
      .modeCardTag {
        margin-top: 8px;
        color: #c8b48c;
        font-size: 14px;
        line-height: 1.4;
      }
      .modeCardStats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 14px;
      }
      .modeStat {
        padding: 10px;
        background: #221a12;
        border: 1px solid #3b2d1f;
        border-radius: 10px;
      }
      .modeStatLabel {
        font-size: 10px;
        letter-spacing: .08em;
        color: #8f7d5d;
        text-transform: uppercase;
      }
      .modeStatVal {
        margin-top: 4px;
        font-size: 14px;
        font-weight: 800;
      }
      .modeLesson {
        margin-top: 12px;
        padding: 10px 12px;
        background: #221a12;
        border-left: 3px solid #f2b443;
        border-radius: 4px;
        font-size: 13px;
        color: #d8c8a2;
        line-height: 1.45;
      }
      .modePick {
        margin-top: 14px;
        text-align: center;
        padding: 12px;
        border-radius: 12px;
        color: white;
        font-weight: 900;
        font-size: 13px;
        letter-spacing: .06em;
      }

      /* =========== TOP BAR EXTRAS =========== */
      .topModeBadge {
        margin-top: 4px;
        font-size: 10px;
        letter-spacing: .1em;
        font-weight: 900;
      }
      .brandPill {
        display: flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255, 157, 132, 0.18);
        border: 1px solid rgba(255, 157, 132, 0.4);
        color: #ffb8a4;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .04em;
      }
      .topRight {
        align-items: center;
      }

      /* =========== VIEW TOGGLE =========== */
      .viewToggle {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
        padding: 4px;
        background: #16110c;
        border: 1px solid #3b2d1f;
        border-radius: 12px;
        margin-bottom: 12px;
      }
      .viewToggleBtn {
        border: 0;
        background: transparent;
        color: #c8b48c;
        font-family: inherit;
        font-weight: 800;
        font-size: 13px;
        padding: 10px;
        border-radius: 9px;
        cursor: pointer;
        letter-spacing: .03em;
        transition: background .12s ease, color .12s ease;
      }
      .viewToggleBtn.active {
        background: #e85a2a;
        color: white;
        box-shadow: 0 4px 10px rgba(232, 90, 42, 0.3);
      }

      /* =========== COMMON SENSE P&L =========== */
      .simpleBlock {
        padding: 4px 0 6px;
      }
      .simpleIntro {
        font-size: 15px;
        color: #d8c8a2;
        margin-bottom: 12px;
      }
      .simpleIntro b {
        color: #f3e7c9;
        font-weight: 900;
      }
      .simpleBar {
        display: flex;
        height: 28px;
        width: 100%;
        border-radius: 10px;
        overflow: hidden;
        background: #16110c;
        border: 1px solid #3b2d1f;
        margin-bottom: 14px;
      }
      .simpleBarSeg {
        height: 100%;
        transition: width .4s ease;
      }
      .simpleBarSeg.food { background: linear-gradient(180deg, #e4ad2c, #d49d25); }
      .simpleBarSeg.labor { background: linear-gradient(180deg, #4f8fff, #3f82ff); }
      .simpleBarSeg.fixed { background: linear-gradient(180deg, #a88b6b, #866a4c); }
      .simpleBarSeg.profit { background: linear-gradient(180deg, #46bd6a, #3ba55d); }
      .simpleBarSeg.loss {
        background: repeating-linear-gradient(
          45deg,
          #b63b3b 0,
          #b63b3b 8px,
          #7a2525 8px,
          #7a2525 16px
        );
      }

      .simpleLegend {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .simpleRow {
        display: grid;
        grid-template-columns: 14px minmax(0, 1fr);
        gap: 12px;
        padding: 10px 0;
        border-top: 1px solid #2d2217;
        align-items: flex-start;
      }
      .simpleRow:first-child { border-top: 0; padding-top: 4px; }
      .simpleSwatch {
        width: 14px;
        height: 14px;
        border-radius: 4px;
        margin-top: 6px;
        flex-shrink: 0;
      }
      .simpleSwatch.food { background: #d49d25; }
      .simpleSwatch.labor { background: #3f82ff; }
      .simpleSwatch.fixed { background: #a88b6b; }
      .simpleSwatch.profit { background: #3ba55d; }
      .simpleSwatch.loss { background: #b63b3b; }

      .simpleRowBody {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .simpleRowTop {
        display: flex;
        align-items: baseline;
        gap: 10px;
        flex-wrap: wrap;
        min-width: 0;
      }
      .simpleCents {
        font-size: 20px;
        font-weight: 900;
        font-variant-numeric: tabular-nums;
        color: #f3e7c9;
        letter-spacing: -0.01em;
        flex-shrink: 0;
      }
      .simpleCents.good { color: #9edf83; }
      .simpleCents.bad { color: #ff9d84; }
      .simpleLabel {
        font-size: 14px;
        color: #f3e7c9;
        font-weight: 600;
        flex: 1 1 auto;
        min-width: 0;
        word-break: normal;
        overflow-wrap: break-word;
      }
      .simpleSub {
        font-size: 12px;
        color: #8f7d5d;
        line-height: 1.4;
        word-break: normal;
        overflow-wrap: break-word;
      }
      .simpleFooter {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #2d2217;
        font-size: 13px;
        color: #c8b48c;
        font-weight: 700;
      }

      /* =========== LEARNING MODE: COACH CARD =========== */
      .coachCard {
        background: linear-gradient(180deg, rgba(59, 165, 93, 0.14), rgba(59, 165, 93, 0.06));
        border: 1px solid rgba(59, 165, 93, 0.5);
        border-radius: 18px;
        padding: 16px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
      }
      .coachBadge {
        display: inline-block;
        font-size: 10px;
        letter-spacing: .14em;
        font-weight: 900;
        color: #9edf83;
        padding: 4px 8px;
        background: rgba(59, 165, 93, 0.18);
        border-radius: 999px;
        margin-bottom: 10px;
      }
      .coachTitle {
        font-size: 18px;
        font-weight: 900;
        color: #f3e7c9;
        line-height: 1.2;
        letter-spacing: -0.01em;
      }
      .coachBody {
        margin-top: 8px;
        color: #d8c8a2;
        font-size: 14px;
        line-height: 1.55;
      }

      /* =========== LEARNING MODE: UNLOCK MAP =========== */
      .unlockMap {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid rgba(59, 165, 93, 0.25);
      }
      .unlockPill {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .03em;
        border: 1px solid #3b2d1f;
      }
      .unlockOpen {
        background: rgba(59, 165, 93, 0.2);
        border-color: rgba(59, 165, 93, 0.45);
        color: #c0e9af;
      }
      .unlockLocked {
        background: #16110c;
        color: #8f7d5d;
      }
      .unlockDot {
        font-size: 10px;
        line-height: 1;
      }
      .unlockPillLabel {
        font-weight: 800;
      }
      .unlockWhen {
        font-size: 10px;
        color: #c8b48c;
        opacity: 0.75;
        letter-spacing: .05em;
      }

      /* =========== LEARNING MODE: LOCKED PANEL =========== */
      .lockedPanel {
        background: #1b140e;
        border: 1px dashed #3b2d1f;
        border-radius: 18px;
        padding: 24px 18px;
        text-align: center;
      }
      .lockedIcon {
        font-size: 28px;
        margin-bottom: 8px;
        opacity: 0.8;
      }
      .lockedTitle {
        font-size: 16px;
        font-weight: 900;
        color: #f2b443;
        letter-spacing: .02em;
      }
      .lockedBody {
        margin-top: 10px;
        color: #c8b48c;
        font-size: 13px;
        line-height: 1.55;
        max-width: 420px;
        margin-left: auto;
        margin-right: auto;
      }

      /* =========== MODE CARD RECOMMENDED BADGE =========== */
      .modeCardRecommended {
        position: relative;
        box-shadow: 0 8px 24px rgba(59, 165, 93, 0.25);
      }
      .modeRecBadge {
        display: inline-block;
        font-size: 10px;
        letter-spacing: .14em;
        font-weight: 900;
        color: #fff;
        padding: 4px 10px;
        background: #3ba55d;
        border-radius: 999px;
        margin-bottom: 10px;
      }

      /* =========== RESPONSIVE =========== */
      @media (min-width: 720px) {
        .contentScroll, .runningWrap { padding: 24px; padding-bottom: 100px; }
        .metricGrid { grid-template-columns: repeat(4, 1fr); }
        .statGrid { grid-template-columns: repeat(3, 1fr); }
        .sceneAnimWrap { aspect-ratio: 21/9; }
        .resultProfit { font-size: 56px; }
      }
    `}</style>
  );
}