"use client"

export default function PDFImposePage() {
  return (
    <div className="w-full h-screen">
      <iframe 
        src="/qi-impose-pro.html" 
        className="w-full h-full border-0"
        title="QI Impose Pro"
        sandbox="allow-scripts allow-same-origin allow-downloads"
      />
    </div>
  )
}
