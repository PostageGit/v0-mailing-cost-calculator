import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "PDF Impose - Booklet, N-Up, Imposition",
  description: "Professional PDF imposition tool - booklets, n-up, step & repeat, page manipulation, and more",
}

export default function PDFImposeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
