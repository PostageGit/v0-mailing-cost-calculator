import "@/app/globals.css"

export const metadata = {
  title: "Calculator Tools",
  description: "Printing and mailing calculators",
}

// This layout is COMPLETELY SEPARATE from the main app
// No header, no sidebar, no navigation - just the calculators
export default function CalculatorToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  )
}
