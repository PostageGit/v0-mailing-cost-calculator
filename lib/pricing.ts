export type MailPiece = "Postcard" | "Letter" | ""
export type MailingClass = "1st Class" | "Standard" | "Non-Profit" | ""

export interface MailingInputs {
  mailPiece: MailPiece
  quantity: number
  mailingClass: MailingClass
  matchingNames: boolean
  splitMailingInto: number
  includePrinting: boolean
}

export interface CostBreakdown {
  addressing: number
  computerWork: number
  cass2nd: number
  inserting: number
  ndc: number
  postage: number
  stamping: number
  totalForEntireJob: number
  totalForEachMailing: number
  totalPerPiece: number
  isValid: boolean
  validationMessage: string
}

// Pricing constants from the spreadsheet reference table
const PRICING = {
  // Addressing (Row 3)
  addressing: {
    flatRate: 125,          // K3: 1 to 2500 per job
    midRate: 0.05,          // M3: 2500 to 5000 per piece
    highRate: 0.04,         // O3: 5000+ per piece
  },
  // Computer work (Row 4)
  computerWork: {
    flatRate: 125,          // K4: per job
  },
  // CASS 2nd (Row 5)
  cass2nd: {
    firstThousand: 0,       // K5: 1st 1000 per 1000
    additionalPer1000: 10,  // M5: 2nd 1000 & up per 1000
  },
  // Inserting (Row 6)
  inserting: {
    postcard: 0,            // K6: Postcard = 0
    envFlatRate: 125,       // M6: Env. 1 to 1700 per job
    envPer1000: 75,         // O6: Env. 1700+ per 1000
    envMatchPer1000: 200,   // Q6: Env. match per 1000
  },
  // NDC (Row 7)
  ndc: {
    firstClass: 0,          // K7: 1st Class per job
    notFirstClass: 100,     // M7: Not 1st Class per job
  },
  // Postage (Row 8)
  postage: {
    firstClassPostcard: 0.48,      // K8: 1st Class postcard per piece
    singlePiecePostcard: 0.61,     // K9 (row 9 in spreadsheet): Single piece postcard per piece
    firstClassEnv: 0.66,           // M8: 1st Class env per piece
    singlePieceEnv: 0.78,          // M9 (row 9 in spreadsheet): Single piece env per piece
    standard: 0.46,                // O8: Standard per piece
    nonProfit: 0.28,               // Q8: Non-Profit per piece
    // Stamping thresholds for single piece
    stampingPostcard: 0.48,        // K9 postcard stamp rate (reusing firstClassPostcard)
    stampingEnv: 0.66,             // M9 env stamp rate (reusing firstClassEnv)
    stampingRate: 0.15,            // K10: stamping per piece
  },
  // Stamping/Printing (Row 9)
  stamping: {
    perPiece: 0.15,
  },
}

export function calculateCosts(inputs: MailingInputs): CostBreakdown {
  const { mailPiece, quantity, mailingClass, matchingNames, splitMailingInto, includePrinting } = inputs
  const qty = quantity

  // Validation
  if (!mailPiece || !quantity || !mailingClass) {
    const messages: string[] = []
    if (!mailPiece) messages.push("Mail Piece")
    if (!quantity) messages.push("Quantity")
    if (!mailingClass) messages.push("Mailing Class")
    return {
      addressing: 0,
      computerWork: 0,
      cass2nd: 0,
      inserting: 0,
      ndc: 0,
      postage: 0,
      stamping: 0,
      totalForEntireJob: 0,
      totalForEachMailing: 0,
      totalPerPiece: 0,
      isValid: false,
      validationMessage: `Please select: ${messages.join(", ")}`,
    }
  }

  // G3 - Addressing
  // =IF(J2<2500, K3, IF(J2<5000, M3*J2, O3*J2))
  let addressing: number
  if (qty < 2500) {
    addressing = PRICING.addressing.flatRate
  } else if (qty < 5000) {
    addressing = PRICING.addressing.midRate * qty
  } else {
    addressing = PRICING.addressing.highRate * qty
  }

  // G4 - Computer work
  // =K4
  const computerWork = PRICING.computerWork.flatRate

  // G5 - CASS 2nd
  // =IF(J2<1000, K5, ((J2/1000)-1)*M5)
  let cass2nd: number
  if (qty < 1000) {
    cass2nd = PRICING.cass2nd.firstThousand
  } else {
    cass2nd = ((qty / 1000) - 1) * PRICING.cass2nd.additionalPer1000
  }

  // G6 - Inserting
  // =if(C2="Postcard", K6, IF(C5=TRUE, (J2/1000)*Q6, IF(J2<1700, M6, (J2/1000)*O6)))
  let inserting: number
  if (mailPiece === "Postcard") {
    inserting = PRICING.inserting.postcard
  } else if (matchingNames) {
    inserting = (qty / 1000) * PRICING.inserting.envMatchPer1000
  } else if (qty < 1700) {
    inserting = PRICING.inserting.envFlatRate
  } else {
    inserting = (qty / 1000) * PRICING.inserting.envPer1000
  }

  // G7 - NDC
  // =IF(C4="1st Class", K7, M7)
  const ndc = mailingClass === "1st Class" ? PRICING.ndc.firstClass : PRICING.ndc.notFirstClass

  // G8 - Postage
  // Complex formula with thresholds for single-piece vs bulk
  let postage: number
  const isSmallFirstClass = qty < 500 && mailingClass === "1st Class"
  const isSmallOther = qty < 200 && mailingClass !== "1st Class"

  if (isSmallFirstClass || isSmallOther) {
    // Single piece rates: (K9+K10)*J2 for postcard, (M9+K10)*J2 for letter
    if (mailPiece === "Postcard") {
      postage = (PRICING.postage.singlePiecePostcard + PRICING.postage.stampingRate) * qty
    } else {
      postage = (PRICING.postage.singlePieceEnv + PRICING.postage.stampingRate) * qty
    }
  } else {
    if (mailingClass === "1st Class") {
      if (mailPiece === "Postcard") {
        postage = qty * PRICING.postage.firstClassPostcard
      } else {
        postage = qty * PRICING.postage.firstClassEnv
      }
    } else if (mailingClass === "Standard") {
      postage = qty * PRICING.postage.standard
    } else {
      // Non-Profit
      postage = qty * PRICING.postage.nonProfit
    }
  }

  // G9 - Stamping/Printing
  const stamping = includePrinting ? PRICING.stamping.perPiece * qty : 0

  // G13 - Total for entire job
  // =SUM(G3:G8)+IF(E9=TRUE,G9,0)
  const totalForEntireJob = addressing + computerWork + cass2nd + inserting + ndc + postage + stamping

  // G12 - Total for each mailing
  // =if(Value(C7)<1, G12, G12*C7) -- when splitMailingInto > 0, multiply
  // Based on spreadsheet logic: if split is < 1, use total; otherwise multiply total by split count
  // Actually: G12 = G13 when no split, G12 = G13 * splitCount when split is used
  // Looking at the formulas more carefully:
  // G12 references itself which means it's dependent on G13
  // G12 = if(Value(C7)<1, G12, G12*C7) - this looks circular but G12 starts with G13 value
  // In the screenshot: Total for entire job = $10,651.40, Total for each mailing = $10,651.40
  // So when splitMailingInto is 0 or 1, totalForEachMailing = totalForEntireJob
  const totalForEachMailing = splitMailingInto > 1 ? totalForEntireJob * splitMailingInto : totalForEntireJob

  // G14 - Total per piece
  // =Roundup(G12/J2, 2)
  const totalPerPiece = Math.ceil((totalForEachMailing / qty) * 100) / 100

  return {
    addressing,
    computerWork,
    cass2nd,
    inserting,
    ndc,
    postage,
    stamping,
    totalForEntireJob,
    totalForEachMailing,
    totalPerPiece,
    isValid: true,
    validationMessage: "",
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
