"use client"

import useSWR from "swr"
import { useEffect, useRef } from "react"
import { applyOverrides, getActiveConfig, type PricingConfig, type FinishingOption, type ScoreFoldConfig, type EnvelopeSettings, type AddressingConfig, type TabbingConfig, type PaperWeightConfig, type EnvelopeWeightConfig } from "./pricing-config"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/**
 * Loads pricing overrides from app_settings and applies them to the shared
 * pricing config module. Returns the active config and a loading flag.
 *
 * Call this once at a high level (e.g. the main page component).
 * The pricing modules (printing-pricing, booklet-pricing) read from
 * getActiveConfig() which is updated by this hook.
 */
export function usePricingConfig(): { config: PricingConfig; isLoading: boolean } {
  const { data, isLoading } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const appliedRef = useRef(false)

  useEffect(() => {
    if (!data) return
    applyOverrides({
      pricing_click_costs: data.pricing_click_costs as Record<string, { regular: number; machine: number }> | undefined,
      pricing_paper_prices: data.pricing_paper_prices as Record<string, Record<string, number>> | undefined,
      pricing_booklet_paper_prices: data.pricing_booklet_paper_prices as Record<string, Record<string, number>> | undefined,
      pricing_markups: data.pricing_markups as Record<string, Record<number, number>> | undefined,
      pricing_finishings: data.pricing_finishings as FinishingOption[] | undefined,
      pricing_score_fold: data.pricing_score_fold as ScoreFoldConfig | undefined,
      envelope_settings: data.envelope_settings as EnvelopeSettings | undefined,
      addressing_config: data.addressing_config as AddressingConfig | undefined,
      tabbing_config: data.tabbing_config as TabbingConfig | undefined,
      paper_weight_config: data.paper_weight_config as PaperWeightConfig | undefined,
      envelope_weight_config: data.envelope_weight_config as EnvelopeWeightConfig | undefined,
    })
    appliedRef.current = true
  }, [data])

  return { config: getActiveConfig(), isLoading: isLoading && !appliedRef.current }
}
