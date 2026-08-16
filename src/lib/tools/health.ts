/**
 * Deterministic health & nutrition calculators (spec §35, §74).
 *
 * The language model must NEVER perform these calculations itself. It calls
 * these pure, tested functions; the functions compute; the model only explains
 * the result. Every function validates its inputs and returns typed output.
 *
 * These are general wellness formulas (Mifflin-St Jeor, WHO BMI bands, DRI
 * protein) — not individualized medical advice.
 */

export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal = "fat_loss" | "maintenance" | "muscle_gain";

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new RangeError(msg);
}

const round = (n: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// ── Unit conversions ────────────────────────────────────────────────────────
export const lbToKg = (lb: number) => round(lb * 0.45359237, 2);
export const kgToLb = (kg: number) => round(kg / 0.45359237, 2);
export const inToCm = (inch: number) => round(inch * 2.54, 1);
export const cmToIn = (cm: number) => round(cm / 2.54, 1);
export const ftInToCm = (ft: number, inch = 0) => round((ft * 12 + inch) * 2.54, 1);

// ── BMI ─────────────────────────────────────────────────────────────────────
export interface BmiResult {
  bmi: number;
  category: "underweight" | "healthy" | "overweight" | "obese";
  note: string;
}

/** WHO adult BMI bands. BMI is a screening tool, not a body-composition measure. */
export function bmi(weightKg: number, heightCm: number): BmiResult {
  assert(weightKg > 0 && weightKg < 500, "weightKg out of range");
  assert(heightCm > 50 && heightCm < 275, "heightCm out of range");
  const m = heightCm / 100;
  const value = round(weightKg / (m * m), 1);
  const category =
    value < 18.5 ? "underweight" : value < 25 ? "healthy" : value < 30 ? "overweight" : "obese";
  return {
    bmi: value,
    category,
    note: "WHO adult BMI band. BMI does not distinguish muscle from fat or fit every body type.",
  };
}

// ── BMR / TDEE ──────────────────────────────────────────────────────────────
/** Basal metabolic rate — Mifflin-St Jeor equation (kcal/day). */
export function bmr(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  assert(weightKg > 0 && weightKg < 500, "weightKg out of range");
  assert(heightCm > 50 && heightCm < 275, "heightCm out of range");
  assert(ageYears > 0 && ageYears < 120, "ageYears out of range");
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return round(base + (sex === "male" ? 5 : -161));
}

/** Total daily energy expenditure (kcal/day). */
export function tdee(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  ageYears: number,
  activity: ActivityLevel,
): number {
  return round(bmr(sex, weightKg, heightCm, ageYears) * ACTIVITY_FACTOR[activity]);
}

// ── Calorie & macro targets ─────────────────────────────────────────────────
export interface CalorieTarget {
  tdee: number;
  targetKcal: number;
  goal: Goal;
  note: string;
}

/** Goal-adjusted calorie target with a safe lower floor. */
export function calorieTarget(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  ageYears: number,
  activity: ActivityLevel,
  goal: Goal,
): CalorieTarget {
  const maintenance = tdee(sex, weightKg, heightCm, ageYears, activity);
  let target =
    goal === "fat_loss" ? maintenance - 500 : goal === "muscle_gain" ? maintenance + 300 : maintenance;
  // Safe floor to avoid recommending an unsafely low intake.
  const floor = sex === "male" ? 1500 : 1200;
  const floored = Math.max(target, floor);
  return {
    tdee: maintenance,
    targetKcal: round(floored),
    goal,
    note:
      floored > target
        ? `Capped at a safe minimum of ${floor} kcal/day rather than a steeper deficit.`
        : "General estimate; individual needs vary — confirm with a professional.",
  };
}

export interface ProteinTarget {
  gramsPerKg: [number, number];
  gramsPerDay: [number, number];
  note: string;
}

/** DRI-informed protein range (g/day). Higher end for muscle gain / active. */
export function proteinTarget(weightKg: number, goal: Goal): ProteinTarget {
  assert(weightKg > 0 && weightKg < 500, "weightKg out of range");
  const range: [number, number] =
    goal === "muscle_gain" ? [1.6, 2.2] : goal === "fat_loss" ? [1.6, 2.0] : [1.2, 1.6];
  return {
    gramsPerKg: range,
    gramsPerDay: [round(weightKg * range[0]), round(weightKg * range[1])],
    note: "RDA is ~0.8 g/kg; active people and those building or preserving muscle need more.",
  };
}

export interface MacroSplit {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/** Split a calorie target into macros given a fixed protein amount. */
export function macroSplit(targetKcal: number, proteinG: number, fatPct = 0.28): MacroSplit {
  assert(targetKcal > 0, "targetKcal must be positive");
  assert(proteinG >= 0, "proteinG must be >= 0");
  const fatG = round((targetKcal * fatPct) / 9);
  const remaining = targetKcal - proteinG * 4 - fatG * 9;
  return { proteinG: round(proteinG), fatG, carbsG: round(Math.max(remaining, 0) / 4) };
}
