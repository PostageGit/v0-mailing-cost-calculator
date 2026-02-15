export type ApplyPer = "cut_item" | "parent_sheet"

export type CalculatorTarget = "flat" | "saddle" | "perfect_binding"

export const CALCULATOR_TARGET_LABELS: Record<CalculatorTarget, string> = {
  flat: "Flat Printing",
  saddle: "Saddle Stitch",
  perfect_binding: "Perfect Binding",
}

export interface FinishingCalculator {
  id: string
  name: string
  apply_per: ApplyPer
  material_cost: number
  labor_cost: number
  setup_minutes: number
  setup_buffer_minutes: number
  speed_per_hour: number
  running_buffer_minutes: number
  markup: number
  enabled_calculators: CalculatorTarget[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FinishingGlobalRates {
  id: string
  setup_labor_rate: number
  running_labor_rate: number
  broker_discount: number
}

/**
 * Calculate the total cost of a finishing operation.
 *
 * Material = material_cost x quantity
 * Labor    = labor_cost x quantity
 * Setup    = ((setup_minutes + setup_buffer) / 60) x setup_labor_rate
 * Running  = ((quantity / speed_per_hour) + running_buffer_hrs) x running_labor_rate
 * Subtotal = Material + Labor + Setup + Running
 * Total    = Subtotal x markup
 * Broker   = Total x (1 - broker_discount)
 */
export function calculateFinishingTotal(
  fc: FinishingCalculator,
  rates: FinishingGlobalRates,
  quantity: number,
  isBroker: boolean,
): { material: number; labor: number; setup: number; running: number; subtotal: number; total: number } {
  const material = fc.material_cost * quantity
  const labor = fc.labor_cost * quantity

  const setupHrs = (fc.setup_minutes + fc.setup_buffer_minutes) / 60
  const setup = setupHrs * rates.setup_labor_rate

  const runningHrs =
    fc.speed_per_hour > 0
      ? quantity / fc.speed_per_hour + fc.running_buffer_minutes / 60
      : fc.running_buffer_minutes / 60
  const running = runningHrs * rates.running_labor_rate

  const subtotal = material + labor + setup + running
  const markedUp = subtotal * fc.markup
  const total = isBroker ? markedUp * (1 - rates.broker_discount) : markedUp

  return { material, labor, setup, running, subtotal, total }
}
