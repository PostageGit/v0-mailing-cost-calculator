"use client"

import { useState, useRef, useCallback } from "react"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import JSZip from "jszip"
import { 
  Upload, FileText, Download, Trash2, Loader2, 
  Layers, FileStack, Check, AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PDFFile {
  id: number
  file: File
  name: string
  bytes: number
  pages: number | null
  pageW: number | null
  pageH: number | null
  status: "loading" | "ready" | "error"
  error: string | null
}

type SortColumn = "name" | "bytes" | "pages"

export function PDFBatchTool() {
  const [files, setFiles] = useState<PDFFile[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [sortCol, setSortCol] = useState<SortColumn>("pages")
  const [sortAsc, setSortAsc] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [useWeightDividers, setUseWeightDividers] = useState(true) // USPS per-oz dividers
  const [processMsg, setProcessMsg] = useState("")
  const [processProgress, setProcessProgress] = useState(0)
  const [globalSets, setGlobalSets] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uidRef = useRef(0)

  // Format bytes
  const formatBytes = (b: number) => 
    b > 1048576 ? (b / 1048576).toFixed(2) + " MB" : (b / 1024).toFixed(1) + " KB"

  // Add files
  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith(".pdf"))
    if (!arr.length) return

    const newFiles: PDFFile[] = arr.map(file => {
      const id = ++uidRef.current
      return {
        id,
        file,
        name: file.name,
        bytes: file.size,
        pages: null,
        pageW: null,
        pageH: null,
        status: "loading" as const,
        error: null
      }
    })

    setFiles(prev => [...prev, ...newFiles])
    setSelected(prev => {
      const newSet = new Set(prev)
      newFiles.forEach(e => newSet.add(e.id))
      return newSet
    })

    // Load all PDFs in parallel
    await Promise.all(newFiles.map(async (entry) => {
      try {
        const ab = await entry.file.arrayBuffer()
        const doc = await PDFDocument.load(new Uint8Array(ab), { ignoreEncryption: true })
        const pages = doc.getPages()
        
        setFiles(prev => prev.map(e => 
          e.id === entry.id ? {
            ...e,
            pages: pages.length,
            pageW: pages.length > 0 ? pages[0].getWidth() : null,
            pageH: pages.length > 0 ? pages[0].getHeight() : null,
            status: "ready" as const
          } : e
        ))
      } catch (ex) {
        setFiles(prev => prev.map(e => 
          e.id === entry.id ? {
            ...e,
            status: "error" as const,
            error: (ex as Error).message
          } : e
        ))
      }
    }))
  }, [])

  // Sort files
  const sortFiles = (list: PDFFile[]) => {
    return [...list].sort((a, b) => {
      let va: string | number = a[sortCol] ?? ""
      let vb: string | number = b[sortCol] ?? ""
      
      if (sortCol === "bytes" || sortCol === "pages") {
        va = Number(va) || 0
        vb = Number(vb) || 0
      } else {
        va = String(va).toLowerCase()
        vb = String(vb).toLowerCase()
      }
      
      if (va === vb) return 0
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })
  }

  // Handle sort click
  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc)
    } else {
      setSortCol(col)
      setSortAsc(true)
    }
  }

  // Toggle selection
  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Select all
  const selectAll = () => {
    setSelected(new Set(files.map(f => f.id)))
  }

  // Deselect all
  const deselectAll = () => {
    setSelected(new Set())
  }

  // Remove file
  const removeFile = (id: number) => {
    setFiles(prev => prev.filter(e => e.id !== id))
    setSelected(prev => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  // Clear all
  const clearAll = () => {
    setFiles([])
    setSelected(new Set())
  }

  // Group files by page count
  const getPageGroups = () => {
    const readyFiles = files.filter(f => f.status === "ready" && selected.has(f.id))
    const groups = new Map<number, PDFFile[]>()
    
    for (const file of readyFiles) {
      const pages = file.pages || 0
      if (!groups.has(pages)) {
        groups.set(pages, [])
      }
      groups.get(pages)!.push(file)
    }
    
    // Sort groups by page count (ascending)
    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([pageCount, files]) => ({ pageCount, files }))
  }

  // ========== WEIGHT DIVIDER PAGE - Only for 20+ pages ==========
  // 20-31 pages = 2 OZ, 32-37 pages = 3 OZ, 38+ pages = 4 OZ
  const getWeightInfo = (pageCount: number): { oz: number; label: string; color: { r: number; g: number; b: number } } | null => {
    if (pageCount >= 38) return { oz: 4, label: "4 OZ", color: { r: 0.6, g: 0.1, b: 0.1 } }  // Dark red
    if (pageCount >= 32) return { oz: 3, label: "3 OZ", color: { r: 0.7, g: 0.3, b: 0 } }   // Orange
    if (pageCount >= 20) return { oz: 2, label: "2 OZ", color: { r: 0.1, g: 0.4, b: 0.7 } } // Blue
    return null // Under 20 pages = standard 1oz, no divider needed
  }

  const generateWeightDivider = async (pageCount: number, fileCount: number, weightInfo: { oz: number; label: string; color: { r: number; g: number; b: number } }) => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([612, 792]) // Letter size
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
    
    const { width, height } = page.getSize()
    const centerX = width / 2
    const { r, g, b } = weightInfo.color

    // ========== FULL PAGE COLORED HEADER ==========
    page.drawRectangle({
      x: 0,
      y: height - 180,
      width: width,
      height: 180,
      color: rgb(r, g, b)
    })

    page.drawText("WEIGHT DIVIDER", {
      x: centerX - 120,
      y: height - 50,
      size: 32,
      font: fontBold,
      color: rgb(1, 1, 1)
    })

    page.drawText("PLACE ON TOP OF STACK", {
      x: centerX - 110,
      y: height - 90,
      size: 16,
      font: fontRegular,
      color: rgb(1, 1, 1, 0.85)
    })

    page.drawText(`${fileCount} set${fileCount > 1 ? 's' : ''} @ ${pageCount} pages each`, {
      x: centerX - 100,
      y: height - 130,
      size: 14,
      font: fontRegular,
      color: rgb(1, 1, 1, 0.7)
    })

    // ========== HUGE WEIGHT LABEL ==========
    page.drawRectangle({
      x: 40,
      y: height - 550,
      width: width - 80,
      height: 340,
      borderColor: rgb(r, g, b),
      borderWidth: 12,
      color: rgb(1, 1, 1)
    })

    // The big weight text
    const ozText = weightInfo.label
    page.drawText(ozText, {
      x: centerX - 140,
      y: height - 420,
      size: 180,
      font: fontBold,
      color: rgb(r, g, b)
    })

    // Page range subtitle
    let rangeText = ""
    if (weightInfo.oz === 2) rangeText = "(20-31 pages)"
    else if (weightInfo.oz === 3) rangeText = "(32-37 pages)"
    else if (weightInfo.oz === 4) rangeText = "(38+ pages)"

    page.drawText(rangeText, {
      x: centerX - 60,
      y: height - 520,
      size: 20,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4)
    })

    // ========== INFO BOX ==========
    page.drawRectangle({
      x: 40,
      y: 80,
      width: width - 80,
      height: 120,
      color: rgb(0.96, 0.96, 0.98),
      borderColor: rgb(0.85, 0.85, 0.88),
      borderWidth: 1
    })

    page.drawText(`This lot: ${pageCount} pages x ${fileCount} sets`, {
      x: 60,
      y: 165,
      size: 16,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2)
    })

    page.drawText(`Weight class: ${weightInfo.oz} ounce postage required`, {
      x: 60,
      y: 135,
      size: 14,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4)
    })

    page.drawText(`Generated: ${new Date().toLocaleString()}`, {
      x: 60,
      y: 100,
      size: 10,
      font: fontRegular,
      color: rgb(0.6, 0.6, 0.6)
    })

    // ========== BOTTOM STRIPE ==========
    page.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: 40,
      color: rgb(r, g, b)
    })

    return await doc.save()
  }

  // ========== FULL REPORT - Multi-page, lists ALL files ==========
  const generateFullReport = async (groups: { pageCount: number; files: PDFFile[] }[]) => {
    const doc = await PDFDocument.create()
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
    
    const pageWidth = 612
    const pageHeight = 792
    const margin = 50
    const lineHeight = 16
    
    // First page - summary
    let currentPage = doc.addPage([pageWidth, pageHeight])
    let y = pageHeight - 80

    // Title
    currentPage.drawRectangle({
      x: 0,
      y: pageHeight - 100,
      width: pageWidth,
      height: 100,
      color: rgb(0.12, 0.18, 0.38)
    })

    currentPage.drawText("PDF BATCH REPORT", {
      x: margin,
      y: pageHeight - 55,
      size: 32,
      font: fontBold,
      color: rgb(1, 1, 1)
    })

    currentPage.drawText(`Generated: ${new Date().toLocaleString()}`, {
      x: margin,
      y: pageHeight - 85,
      size: 12,
      font: fontRegular,
      color: rgb(0.8, 0.85, 0.95)
    })

    y = pageHeight - 140

    // Summary stats
    const totalFiles = groups.reduce((sum, g) => sum + g.files.length, 0)
    const totalPages = groups.reduce((sum, g) => sum + (g.pageCount * g.files.length), 0)

    currentPage.drawText("SUMMARY", {
      x: margin,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2)
    })

    y -= 35

    // Stats boxes
    const boxWidth = (pageWidth - margin * 2 - 20) / 3
    const boxHeight = 70

    // Total Files
    currentPage.drawRectangle({
      x: margin,
      y: y - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: rgb(0.95, 0.97, 1),
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 2
    })
    currentPage.drawText(`${totalFiles}`, { x: margin + 20, y: y - 35, size: 32, font: fontBold, color: rgb(0.2, 0.4, 0.8) })
    currentPage.drawText("FILES", { x: margin + 20, y: y - 55, size: 12, font: fontRegular, color: rgb(0.5, 0.5, 0.5) })

    // Total Pages
    currentPage.drawRectangle({
      x: margin + boxWidth + 10,
      y: y - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: rgb(0.95, 1, 0.97),
      borderColor: rgb(0.2, 0.6, 0.3),
      borderWidth: 2
    })
    currentPage.drawText(`${totalPages}`, { x: margin + boxWidth + 30, y: y - 35, size: 32, font: fontBold, color: rgb(0.2, 0.6, 0.3) })
    currentPage.drawText("TOTAL PAGES", { x: margin + boxWidth + 30, y: y - 55, size: 12, font: fontRegular, color: rgb(0.5, 0.5, 0.5) })

    // Groups
    currentPage.drawRectangle({
      x: margin + (boxWidth + 10) * 2,
      y: y - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: rgb(1, 0.97, 0.95),
      borderColor: rgb(0.9, 0.3, 0.1),
      borderWidth: 2
    })
    currentPage.drawText(`${groups.length}`, { x: margin + (boxWidth + 10) * 2 + 20, y: y - 35, size: 32, font: fontBold, color: rgb(0.9, 0.3, 0.1) })
    currentPage.drawText("GROUPS", { x: margin + (boxWidth + 10) * 2 + 20, y: y - 55, size: 12, font: fontRegular, color: rgb(0.5, 0.5, 0.5) })

    y -= boxHeight + 40

    // Groups overview
    currentPage.drawText("PAGE COUNT GROUPS:", {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3)
    })

    y -= 25

    for (const group of groups) {
      if (y < 100) {
        currentPage = doc.addPage([pageWidth, pageHeight])
        y = pageHeight - 80
      }

      currentPage.drawRectangle({
        x: margin,
        y: y - 5,
        width: pageWidth - margin * 2,
        height: 25,
        color: rgb(0.96, 0.96, 0.98)
      })

      currentPage.drawText(`${group.pageCount} PAGES`, {
        x: margin + 15,
        y,
        size: 12,
        font: fontBold,
        color: rgb(0.2, 0.4, 0.7)
      })

      currentPage.drawText(`${group.files.length} file${group.files.length > 1 ? 's' : ''}`, {
        x: margin + 150,
        y,
        size: 11,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4)
      })

      currentPage.drawText(`= ${group.pageCount * group.files.length} total pages`, {
        x: margin + 280,
        y,
        size: 11,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5)
      })

      y -= 30
    }

    y -= 20

    // Detailed file list for each group
    currentPage.drawText("DETAILED FILE LIST:", {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3)
    })

    y -= 30

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi]

      if (y < 150) {
        currentPage = doc.addPage([pageWidth, pageHeight])
        y = pageHeight - 80
      }

      // Group header
      currentPage.drawRectangle({
        x: margin,
        y: y - 5,
        width: pageWidth - margin * 2,
        height: 30,
        color: rgb(0.15, 0.25, 0.45)
      })

      currentPage.drawText(`${group.pageCount}-PAGE FILES (${group.files.length} sets)`, {
        x: margin + 15,
        y: y + 2,
        size: 14,
        font: fontBold,
        color: rgb(1, 1, 1)
      })

      y -= 40

      // File list
      for (let fi = 0; fi < group.files.length; fi++) {
        const file = group.files[fi]

        if (y < 60) {
          currentPage = doc.addPage([pageWidth, pageHeight])
          y = pageHeight - 80

          // Continuation header
          currentPage.drawRectangle({
            x: margin,
            y: y - 5,
            width: pageWidth - margin * 2,
            height: 25,
            color: rgb(0.9, 0.9, 0.92)
          })
          currentPage.drawText(`${group.pageCount}-PAGE FILES (continued)`, {
            x: margin + 15,
            y,
            size: 11,
            font: fontBold,
            color: rgb(0.3, 0.3, 0.3)
          })
          y -= 35
        }

        // Alternating background
        if (fi % 2 === 0) {
          currentPage.drawRectangle({
            x: margin,
            y: y - 3,
            width: pageWidth - margin * 2,
            height: lineHeight,
            color: rgb(0.97, 0.97, 0.98)
          })
        }

        // Row number
        currentPage.drawText(`${fi + 1}.`, {
          x: margin + 10,
          y,
          size: 9,
          font: fontRegular,
          color: rgb(0.5, 0.5, 0.5)
        })

        // Filename (renamed format)
        const baseName = file.name.replace(/\.pdf$/i, "")
        const renamedName = `${group.pageCount} ${baseName}.pdf`
        const maxLen = 75
        const displayName = renamedName.length > maxLen ? renamedName.substring(0, maxLen - 3) + "..." : renamedName

        currentPage.drawText(displayName, {
          x: margin + 40,
          y,
          size: 9,
          font: fontRegular,
          color: rgb(0.15, 0.15, 0.15)
        })

        y -= lineHeight
      }

      y -= 15
    }

    // Footer on last page
    currentPage.drawText("--- END OF REPORT ---", {
      x: centerX(pageWidth) - 60,
      y: 40,
      size: 10,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5)
    })

    return await doc.save()

    function centerX(w: number) { return w / 2 }
  }

  // Download ZIP - organized by page count
  // ONLY adds weight dividers for lots with 20+ pages (2oz, 3oz, 4oz)
  const downloadZip = async () => {
    const groups = getPageGroups()
    
    if (groups.length === 0) {
      alert("No files selected. Select files to download.")
      return
    }

    setIsProcessing(true)
    setProcessMsg("Organizing by page count...")
    setProcessProgress(0)

    try {
      const zip = new JSZip()
      // Count dividers needed (only for 20+ page groups when toggle is on)
      const dividersNeeded = useWeightDividers ? groups.filter(g => getWeightInfo(g.pageCount) !== null).length : 0
      const totalSteps = dividersNeeded + groups.reduce((sum, g) => sum + g.files.length, 0) + 1
      let currentStep = 0

      // First add the full report at root
      setProcessMsg("Creating full report...")
      const fullReport = await generateFullReport(groups)
      zip.file("00_FULL_REPORT.pdf", fullReport)
      currentStep++
      setProcessProgress(Math.round((currentStep / totalSteps) * 100))

      // Process each page-count group
      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi]
        const pageCount = group.pageCount
        const paddedCount = String(pageCount).padStart(3, '0')
        
        // Check if this group needs a weight divider (20+ pages) AND toggle is on
        const weightInfo = getWeightInfo(pageCount)
        
        if (useWeightDividers && weightInfo) {
          // Create WEIGHT DIVIDER - only for 20+ page lots when enabled
          setProcessMsg(`Creating ${weightInfo.label} divider for ${pageCount}-page lot...`)
          const dividerPdf = await generateWeightDivider(pageCount, group.files.length, weightInfo)
          // "!" sorts first, include weight in filename for clarity
          zip.file(`${paddedCount} !${weightInfo.label} DIVIDER.pdf`, dividerPdf)
          currentStep++
          setProcessProgress(Math.round((currentStep / totalSteps) * 100))
        }
        // No divider for lots under 20 pages (standard 1oz) or when toggle is off

        // Add all files for this page count
        for (let fi = 0; fi < group.files.length; fi++) {
          const file = group.files[fi]
          setProcessMsg(`Adding ${file.name}...`)
          
          const ab = await file.file.arrayBuffer()
          // Rename: "014 originalname.pdf" - starts with letter so sorts after divider
          const baseName = file.name.replace(/\.pdf$/i, "")
          const newName = `${paddedCount} ${baseName}.pdf`
          zip.file(newName, ab)
          
          currentStep++
          setProcessProgress(Math.round((currentStep / totalSteps) * 100))
        }
      }

      setProcessMsg("Creating ZIP...")
      setProcessProgress(95)

      const blob = await zip.generateAsync({ type: "blob" })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `PDF_Organized_${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)

      setProcessProgress(100)
    } catch (ex) {
      console.error("Download error:", ex)
    } finally {
      setIsProcessing(false)
    }
  }

  // Drag handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files)
    }
  }

  // Stats
  const totalFiles = files.length
  const totalPages = files.reduce((sum, f) => sum + (f.pages || 0), 0)
  const selectedCount = selected.size
  const pageGroups = getPageGroups()

  const sortedFiles = sortFiles(files)

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                <FileStack className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">PDF Batch Organizer</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Groups by page count - adds weight dividers for 20+ page lots (2oz/3oz/4oz)
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6">
              <div className="text-center px-4 py-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                <div className="text-2xl font-bold text-blue-600">{totalFiles}</div>
                <div className="text-xs text-muted-foreground">Files</div>
              </div>
              <div className="text-center px-4 py-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                <div className="text-2xl font-bold text-emerald-600">{totalPages}</div>
                <div className="text-xs text-muted-foreground">Pages</div>
              </div>
              <div className="text-center px-4 py-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                <div className="text-2xl font-bold text-orange-600">{pageGroups.length}</div>
                <div className="text-xs text-muted-foreground">Groups</div>
              </div>
              <div className="text-center px-4 py-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                <div className="text-2xl font-bold text-purple-600">{selectedCount}</div>
                <div className="text-xs text-muted-foreground">Selected</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - File list */}
        <div className="flex-1 flex flex-col border-r">
          {/* Drop zone / file input */}
          <div
            className={cn(
              "m-4 p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer",
              isDragging 
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" 
                : "border-muted-foreground/25 hover:border-blue-400 hover:bg-muted/30"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <div className="flex flex-col items-center gap-2 text-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <span className="font-medium text-blue-600">Click to upload</span>
                <span className="text-muted-foreground"> or drag and drop PDFs</span>
              </div>
            </div>
          </div>

          {/* Action bar */}
          {files.length > 0 && (
            <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={selectAll}
                className="px-3 py-1.5 text-sm rounded-lg border hover:bg-muted transition-colors"
              >
                <Check className="h-3.5 w-3.5 inline mr-1" />
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="px-3 py-1.5 text-sm rounded-lg border hover:bg-muted transition-colors"
              >
                Deselect All
              </button>
              <button
                onClick={clearAll}
                className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 inline mr-1" />
                Clear All
              </button>
            </div>
          )}

          {/* File list */}
          <div className="flex-1 overflow-auto px-4 pb-4">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Layers className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">No files yet</p>
                <p className="text-sm">Drop PDF files to get started</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                {/* Table header */}
                <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
                  <div className="w-6"></div>
                  <button 
                    onClick={() => handleSort("name")}
                    className="flex-1 text-left hover:text-foreground"
                  >
                    Name {sortCol === "name" && (sortAsc ? "↑" : "↓")}
                  </button>
                  <button 
                    onClick={() => handleSort("bytes")}
                    className="w-20 text-right hover:text-foreground"
                  >
                    Size {sortCol === "bytes" && (sortAsc ? "↑" : "↓")}
                  </button>
                  <button 
                    onClick={() => handleSort("pages")}
                    className="w-20 text-right hover:text-foreground"
                  >
                    Pages {sortCol === "pages" && (sortAsc ? "↑" : "↓")}
                  </button>
                  <div className="w-8"></div>
                </div>

                {/* File rows */}
                {sortedFiles.map(file => (
                  <div
                    key={file.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 border-b last:border-b-0 transition-colors",
                      selected.has(file.id) 
                        ? "bg-blue-50 dark:bg-blue-950/30" 
                        : "hover:bg-muted/30"
                    )}
                  >
                    <input 
                      type="checkbox" 
                      checked={selected.has(file.id)}
                      onChange={() => toggleSelect(file.id)}
                      className="w-4 h-4 rounded border-2"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{file.name}</div>
                    </div>
                    
                    <div className="w-20 text-right text-sm text-muted-foreground">
                      {formatBytes(file.bytes)}
                    </div>
                    
                    <div className="w-20 text-right">
                      {file.status === "loading" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground inline" />
                      ) : file.status === "error" ? (
                        <AlertCircle className="h-4 w-4 text-red-500 inline" />
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-sm">
                          {file.pages}
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => removeFile(file.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel - Groups preview & download */}
        <div className="w-96 flex flex-col bg-muted/20">
          <div className="p-4 border-b">
            <h2 className="font-bold text-lg">Page Count Groups</h2>
            <p className="text-sm text-muted-foreground">Files organized by page count</p>
          </div>

          {/* Groups preview */}
          <div className="flex-1 overflow-auto p-4">
            {pageGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select files to see groups</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pageGroups.map((group, i) => (
                  <div 
                    key={group.pageCount}
                    className="rounded-xl border bg-card overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                      <div className="text-3xl font-bold">{group.pageCount}</div>
                      <div>
                        <div className="font-medium">pages</div>
                        <div className="text-sm opacity-80">{group.files.length} set{group.files.length > 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="p-3 text-sm text-muted-foreground max-h-32 overflow-auto">
                      {group.files.map((f, j) => (
                        <div key={f.id} className="truncate py-0.5">
                          {j + 1}. {group.pageCount} {f.name.replace(/\.pdf$/i, '')}.pdf
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Download button */}
          <div className="p-4 border-t bg-card">
            {isProcessing ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="text-sm">{processMsg}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${processProgress}%` }}
                  />
                </div>
              </div>
) : (
  <div className="space-y-3">
    {/* USPS Weight Dividers Toggle */}
    <button
      onClick={() => setUseWeightDividers(!useWeightDividers)}
      className={cn(
        "w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-between border-2",
        useWeightDividers
          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-400 text-amber-700 dark:text-amber-300"
          : "bg-muted/50 border-muted-foreground/20 text-muted-foreground"
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-5 h-5 rounded flex items-center justify-center text-xs font-bold",
          useWeightDividers ? "bg-amber-500 text-white" : "bg-muted-foreground/30"
        )}>
          {useWeightDividers ? "✓" : ""}
        </div>
        <span>USPS Per-Ounce Dividers</span>
      </div>
      <span className="text-xs opacity-70">
        {useWeightDividers ? "2oz / 3oz / 4oz" : "OFF"}
      </span>
    </button>
    
    {/* Download Button */}
    <button
      onClick={downloadZip}
      disabled={pageGroups.length === 0}
      className={cn(
        "w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2",
        pageGroups.length > 0
          ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-lg"
          : "bg-muted text-muted-foreground cursor-not-allowed"
      )}
    >
      <Download className="h-5 w-5" />
      Download ZIP
    </button>
  </div>
  )}
  
  <p className="text-xs text-muted-foreground text-center mt-3">
  {useWeightDividers 
    ? "Weight dividers added for 20+ page lots (2oz/3oz/4oz)"
    : "Files grouped by page count, no dividers"
  }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
