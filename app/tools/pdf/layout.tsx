import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "PDF Batch - Page Counter & Renamer",
  description: "Drop PDFs, count pages, rename with page count prefix, download as ZIP",
}

export default function PDFToolLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Isolated layout - no header, no sidebar, just content
  return <>{children}</>
}
