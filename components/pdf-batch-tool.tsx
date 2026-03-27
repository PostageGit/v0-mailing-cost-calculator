"use client"

import { useState, useRef, useCallback } from "react"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import JSZip from "jszip"
import { 
  Upload, FileText, Download, Trash2, Plus, X, Loader2, 
  FolderPlus, Layers, FileStack, ChevronDown, ChevronRight,
  GripVertical, Check, AlertCircle, Copy, Printer
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
  batchId: number | null
}

interface Batch {
  id: number
  name: string
  sets: number
  collapsed: boolean
}

type SortColumn = "name" | "bytes" | "pages"

export function PDFBatchTool() {
  const [files, setFiles] = useState<PDFFile[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [unbatchedCollapsed, setUnbatchedCollapsed] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [sortCol, setSortCol] = useState<SortColumn>("pages")
  const [sortAsc, setSortAsc] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processMsg, setProcessMsg] = useState("")
  const [processProgress, setProcessProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uidRef = useRef(0)
  const batchUidRef = useRef(0)

  // Format bytes
  const formatBytes = (b: number) => 
    b > 1048576 ? (b / 1048576).toFixed(2) + " MB" : (b / 1024).toFixed(1) + " KB"

  // Format dimensions
  const formatDim = (e: PDFFile) => 
    e.pageW ? `${(e.pageW / 72).toFixed(1)}" x ${(e.pageH! / 72).toFixed(1)}"` : "-"

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
        error: null,
        batchId: null
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

  // Create new batch from selected files
  const createBatch = () => {
    const batchNum = batches.length + 1
    const newBatch: Batch = {
      id: ++batchUidRef.current,
      name: `Batch ${batchNum}`,
      sets: 1,
      collapsed: false
    }
    setBatches(prev => [...prev, newBatch])
    
    // Move selected files to this batch
    setFiles(prev => prev.map(f => 
      selected.has(f.id) ? { ...f, batchId: newBatch.id } : f
    ))
    setSelected(new Set())
  }

  // Update batch
  const updateBatch = (id: number, updates: Partial<Batch>) => {
    setBatches(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  // Delete batch (moves files back to unbatched)
  const deleteBatch = (id: number) => {
    setFiles(prev => prev.map(f => f.batchId === id ? { ...f, batchId: null } : f))
    setBatches(prev => prev.filter(b => b.id !== id))
  }

  // Move file to batch
  const moveFileToBatch = (fileId: number, batchId: number | null) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, batchId } : f))
  }

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

  // Get files for a batch
  const getFilesForBatch = (batchId: number | null) => {
    return sortFiles(files.filter(f => f.batchId === batchId))
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
    setBatches([])
    setSelected(new Set())
  }

  // ========== SEPARATOR PAGE - Simple, bold, stays on TOP of batch ==========
  const generateSeparatorPage = async (batch: Batch, batchFiles: PDFFile[], batchNumber: number, totalBatches: number) => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([612, 792]) // Letter size
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
    
    const { width, height } = page.getSize()
    const centerX = width / 2
    const totalPages = batchFiles.reduce((sum, f) => sum + (f.pages || 0), 0)
    
    // ========== HUGE BATCH NUMBER - TOP ==========
    page.drawRectangle({
      x: 0,
      y: height - 250,
      width: width,
      height: 250,
      color: rgb(0.12, 0.2, 0.4)
    })
    
    // BATCH label
    page.drawText("BATCH", {
      x: centerX - 80,
      y: height - 80,
      size: 48,
      font: fontBold,
      color: rgb(1, 1, 1)
    })
    
    // Huge batch number
    const batchNumText = `${batchNumber}`
    page.drawText(batchNumText, {
      x: centerX - (batchNumText.length > 1 ? 90 : 55),
      y: height - 200,
      size: 180,
      font: fontBold,
      color: rgb(1, 1, 1)
    })
    
    page.drawText(`of ${totalBatches}`, {
      x: centerX - 30,
      y: height - 235,
      size: 24,
      font: fontRegular,
      color: rgb(0.7, 0.8, 0.9)
    })
    
    // ========== BATCH INFO - MIDDLE ==========
    page.drawText(batch.name.toUpperCase(), {
      x: centerX - (batch.name.length * 10),
      y: height - 320,
      size: 36,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2)
    })
    
    // Stats line
    const statsText = `${batchFiles.length} FILES  |  ${totalPages} TOTAL PAGES`
    page.drawText(statsText, {
      x: centerX - (statsText.length * 5),
      y: height - 370,
      size: 20,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4)
    })
    
    // ========== HUGE SET COUNT - BOTTOM ==========
    page.drawRectangle({
      x: 50,
      y: 180,
      width: width - 100,
      height: 280,
      borderColor: rgb(0.9, 0.3, 0.1),
      borderWidth: 6,
      color: rgb(1, 0.97, 0.95)
    })
    
    // SET COUNT - massive
    const setsText = `${batch.sets}`
    page.drawText(setsText, {
      x: centerX - (setsText.length > 1 ? 100 : 60),
      y: 300,
      size: 200,
      font: fontBold,
      color: rgb(0.9, 0.2, 0.1)
    })
    
    page.drawText(batch.sets === 1 ? "SET" : "SETS", {
      x: centerX - 45,
      y: 210,
      size: 48,
      font: fontBold,
      color: rgb(0.5, 0.5, 0.5)
    })
    
    // ========== FOOTER ==========
    page.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: 50,
      color: rgb(0.95, 0.95, 0.95)
    })
    
    page.drawText("SEPARATOR - KEEP ON TOP OF BATCH", {
      x: centerX - 130,
      y: 20,
      size: 14,
      font: fontBold,
      color: rgb(0.5, 0.5, 0.5)
    })
    
    return await doc.save()
  }

  // ========== COVER REPORT - Multi-page, FULL file list, no truncation ==========
  const generateCoverReport = async (batch: Batch, batchFiles: PDFFile[], batchNumber: number, totalBatches: number) => {
    const doc = await PDFDocument.create()
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
    
    const totalPages = batchFiles.reduce((sum, f) => sum + (f.pages || 0), 0)
    const totalSheets = totalPages * batch.sets
    const sortedFiles = [...batchFiles].sort((a, b) => (a.pages || 0) - (b.pages || 0))
    
    const pageWidth = 612
    const pageHeight = 792
    const margin = 50
    const lineHeight = 18
    const headerHeight = 200
    const footerHeight = 50
    
    // Calculate how many files fit per page
    const usableHeight = pageHeight - headerHeight - footerHeight
    const filesPerPage = Math.floor(usableHeight / lineHeight)
    const totalReportPages = Math.ceil(sortedFiles.length / filesPerPage)
    
    for (let pageNum = 0; pageNum < totalReportPages; pageNum++) {
      const page = doc.addPage([pageWidth, pageHeight])
      const startIdx = pageNum * filesPerPage
      const endIdx = Math.min(startIdx + filesPerPage, sortedFiles.length)
      
      // ========== HEADER (only on first page has full header) ==========
      if (pageNum === 0) {
        // Header bar
        page.drawRectangle({
          x: 0,
          y: pageHeight - 80,
          width: pageWidth,
          height: 80,
          color: rgb(0.15, 0.25, 0.45)
        })
        
        page.drawText(`BATCH ${batchNumber} OF ${totalBatches} - COMPLETE FILE LIST`, {
          x: margin,
          y: pageHeight - 50,
          size: 22,
          font: fontBold,
          color: rgb(1, 1, 1)
        })
        
        // Batch name
        page.drawText(batch.name.toUpperCase(), {
          x: margin,
          y: pageHeight - 115,
          size: 28,
          font: fontBold,
          color: rgb(0.2, 0.2, 0.2)
        })
        
        // Summary stats
        const summaryText = `This batch has ${batchFiles.length} files and ${totalPages} total pages`
        page.drawText(summaryText, {
          x: margin,
          y: pageHeight - 150,
          size: 16,
          font: fontRegular,
          color: rgb(0.3, 0.3, 0.3)
        })
        
        // Sets and total sheets
        page.drawText(`${batch.sets} SET${batch.sets > 1 ? "S" : ""} = ${totalSheets} TOTAL SHEETS TO PRINT`, {
          x: margin,
          y: pageHeight - 175,
          size: 14,
          font: fontBold,
          color: rgb(0.9, 0.3, 0.1)
        })
      } else {
        // Continuation header
        page.drawRectangle({
          x: 0,
          y: pageHeight - 50,
          width: pageWidth,
          height: 50,
          color: rgb(0.95, 0.95, 0.95)
        })
        
        page.drawText(`BATCH ${batchNumber} - ${batch.name} (continued)`, {
          x: margin,
          y: pageHeight - 32,
          size: 14,
          font: fontBold,
          color: rgb(0.3, 0.3, 0.3)
        })
      }
      
      // ========== FILE LIST ==========
      const listStartY = pageNum === 0 ? pageHeight - headerHeight : pageHeight - 70
      let y = listStartY
      
      // Column headers (on every page)
      page.drawRectangle({
        x: margin,
        y: y - 5,
        width: pageWidth - (margin * 2),
        height: 22,
        color: rgb(0.9, 0.9, 0.9)
      })
      
      page.drawText("#", { x: margin + 10, y: y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText("PAGES", { x: margin + 40, y: y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText("FILE NAME", { x: margin + 100, y: y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      
      y -= lineHeight + 5
      
      // File rows
      for (let i = startIdx; i < endIdx; i++) {
        const f = sortedFiles[i]
        const rowNum = i + 1
        
        // Alternating row background
        if (i % 2 === 0) {
          page.drawRectangle({
            x: margin,
            y: y - 4,
            width: pageWidth - (margin * 2),
            height: lineHeight,
            color: rgb(0.97, 0.97, 0.98)
          })
        }
        
        // Row number
        page.drawText(`${rowNum}`, { 
          x: margin + 10, 
          y, 
          size: 9, 
          font: fontRegular, 
          color: rgb(0.5, 0.5, 0.5) 
        })
        
        // Page count (bold)
        page.drawText(`${f.pages}`, { 
          x: margin + 45, 
          y, 
          size: 10, 
          font: fontBold, 
          color: rgb(0.2, 0.4, 0.7) 
        })
        
        // File name - full name, truncate only if extremely long
        const baseName = f.name.replace(/\.pdf$/i, "")
        const maxLen = 70
        const displayName = baseName.length > maxLen ? baseName.substring(0, maxLen - 3) + "..." : baseName
        page.drawText(displayName, { 
          x: margin + 100, 
          y, 
          size: 9, 
          font: fontRegular, 
          color: rgb(0.15, 0.15, 0.15) 
        })
        
        y -= lineHeight
      }
      
      // ========== FOOTER ==========
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: footerHeight,
        color: rgb(0.95, 0.95, 0.95)
      })
      
      page.drawText(`Page ${pageNum + 1} of ${totalReportPages}`, {
        x: margin,
        y: 20,
        size: 10,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5)
      })
      
      page.drawText(`Generated: ${new Date().toLocaleString()}`, {
        x: pageWidth - margin - 150,
        y: 20,
        size: 9,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5)
      })
    }
    
    return await doc.save()
  }

  // Download ZIP with cover pages
  const downloadZip = async () => {
    if (batches.length === 0) {
      alert("Create at least one batch before downloading")
      return
    }

    setIsProcessing(true)
    setProcessMsg("Preparing batches...")
    setProcessProgress(0)

    try {
      const zip = new JSZip()
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        const batchFiles = getFilesForBatch(batch.id).filter(f => f.status === "ready")
        
        if (batchFiles.length === 0) continue
        
        const batchFolder = zip.folder(`Batch_${batchIndex + 1}_${batch.name.replace(/[^a-zA-Z0-9]/g, "_")}`)
        if (!batchFolder) continue
        
        setProcessMsg(`Creating separator for ${batch.name}...`)
        setProcessProgress(Math.round(((batchIndex * 3) / (batches.length * 3)) * 100))
        
        // 1. SEPARATOR PAGE - stays on TOP (named with "!" to sort first)
        const separatorPdf = await generateSeparatorPage(batch, batchFiles, batchIndex + 1, batches.length)
        batchFolder.file("!_SEPARATOR.pdf", separatorPdf)
        
        setProcessMsg(`Creating report for ${batch.name}...`)
        setProcessProgress(Math.round(((batchIndex * 3 + 1) / (batches.length * 3)) * 100))
        
        // 2. COVER REPORT - full file list (named with "!!" to sort second)
        const reportPdf = await generateCoverReport(batch, batchFiles, batchIndex + 1, batches.length)
        batchFolder.file("!!_BATCH_REPORT.pdf", reportPdf)
        
        // Sort files by pages ascending
        const sortedFiles = [...batchFiles].sort((a, b) => (a.pages || 0) - (b.pages || 0))
        
        // Add files with page count prefix - format: "14 filename.pdf"
        for (let i = 0; i < sortedFiles.length; i++) {
          const f = sortedFiles[i]
          setProcessMsg(`Adding ${f.name}...`)
          setProcessProgress(Math.round((((batchIndex * 3) + 2 + (i / sortedFiles.length)) / (batches.length * 3)) * 100))
          
          const ab = await f.file.arrayBuffer()
          // Remove .pdf extension from original name, add page count prefix
          const baseName = f.name.replace(/\.pdf$/i, "")
          const newName = `${f.pages} ${baseName}.pdf`
          batchFolder.file(newName, ab)
        }
      }

      setProcessMsg("Creating ZIP...")
      setProcessProgress(95)

      const blob = await zip.generateAsync({ type: "blob" })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `PDF_Batches_${new Date().toISOString().slice(0, 10)}.zip`
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
  const unbatchedFiles = files.filter(f => f.batchId === null)
  const selectedCount = selected.size

  // File row component
  const FileRow = ({ file, showBatchActions = false }: { file: PDFFile; showBatchActions?: boolean }) => (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b last:border-b-0 transition-colors",
        selected.has(file.id) 
          ? "bg-blue-50 dark:bg-blue-950/30" 
          : "hover:bg-muted/50"
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
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span>{formatBytes(file.bytes)}</span>
          <span>{formatDim(file)}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {file.status === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : file.status === "error" ? (
          <span className="text-red-500 text-xs">Error</span>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <FileText className="h-3.5 w-3.5" />
            <span className="font-bold text-sm">{file.pages}</span>
            <span className="text-xs opacity-80">pg</span>
          </div>
        )}
        
        {showBatchActions && batches.length > 0 && file.batchId === null && (
          <select
            value=""
            onChange={(e) => moveFileToBatch(file.id, parseInt(e.target.value))}
            className="text-xs px-2 py-1 rounded border bg-background"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="">Move to batch...</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        
        <button 
          onClick={() => removeFile(file.id)}
          className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div 
      className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && addFiles(e.target.files)}
      />

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card rounded-2xl shadow-2xl border p-8 text-center max-w-sm">
            <Loader2 className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-spin" />
            <div className="font-semibold text-lg mb-2">{processMsg}</div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300" 
                style={{ width: `${processProgress}%` }} 
              />
            </div>
            <div className="text-sm text-muted-foreground mt-2">{processProgress}%</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 p-6 bg-white dark:bg-slate-900 border-b">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <FileStack className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">PDF Batch Organizer</h1>
            <p className="text-muted-foreground">Organize PDFs into batches with cover sheets, sorted by page count</p>
          </div>
          
          {files.length > 0 && (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{totalFiles}</div>
                <div className="text-xs text-muted-foreground font-medium">Files</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-600">{totalPages}</div>
                <div className="text-xs text-muted-foreground font-medium">Total Pages</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{batches.length}</div>
                <div className="text-xs text-muted-foreground font-medium">Batches</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {files.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div 
            className={cn(
              "max-w-lg w-full rounded-3xl p-12 text-center cursor-pointer transition-all border-2 border-dashed",
              isDragging 
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 scale-105" 
                : "border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-white dark:hover:bg-slate-800"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 rounded-3xl flex items-center justify-center">
              <Upload className="h-12 w-12 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Drop PDFs to get started</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Organize your PDFs into batches. Each batch gets a cover sheet showing batch number, set count, and file list. Files are renamed with page count and sorted smallest to largest.
            </p>
            <button className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all">
              <Upload className="h-5 w-5" />
              Select PDF Files
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      {files.length > 0 && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel - Unbatched files */}
          <div className="w-1/2 flex flex-col border-r bg-white dark:bg-slate-900">
            {/* Toolbar */}
            <div className="shrink-0 p-4 border-b bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border hover:border-blue-500 hover:text-blue-500 transition-colors font-medium text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Files
                </button>
                
                {selectedCount > 0 && (
                  <button 
                    onClick={createBatch}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold text-sm hover:shadow-lg transition-all"
                  >
                    <FolderPlus className="h-4 w-4" />
                    Create Batch ({selectedCount})
                  </button>
                )}
                
                <div className="ml-auto flex items-center gap-2">
                  <button 
                    onClick={() => setSelected(new Set(unbatchedFiles.map(f => f.id)))}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border hover:border-blue-500 hover:text-blue-500 transition-colors"
                  >
                    Select All
                  </button>
                  <button 
                    onClick={clearAll}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
            
            {/* Unbatched section */}
            <div className="flex-1 overflow-auto">
              <div className="p-4">
                <button
                  onClick={() => setUnbatchedCollapsed(!unbatchedCollapsed)}
                  className="flex items-center gap-2 w-full text-left font-semibold text-sm text-muted-foreground mb-2"
                >
                  {unbatchedCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Unbatched Files ({unbatchedFiles.length})
                </button>
                
                {!unbatchedCollapsed && (
                  <div className="rounded-xl border bg-card overflow-hidden">
                    {unbatchedFiles.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">All files have been organized into batches</p>
                      </div>
                    ) : (
                      sortFiles(unbatchedFiles).map(file => (
                        <FileRow key={file.id} file={file} showBatchActions />
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Right panel - Batches */}
          <div className="w-1/2 flex flex-col bg-slate-50 dark:bg-slate-800/30">
            {/* Batch header */}
            <div className="shrink-0 p-4 border-b bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-lg">Batches</h2>
                  <p className="text-sm text-muted-foreground">Each batch gets a cover sheet in the ZIP</p>
                </div>
                
                {batches.length > 0 && (
                  <button 
                    onClick={downloadZip}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold hover:shadow-lg transition-all"
                  >
                    <Download className="h-5 w-5" />
                    Download ZIP
                  </button>
                )}
              </div>
            </div>
            
            {/* Batches list */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {batches.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                      <FolderPlus className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">No batches yet</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">
                      Select files on the left and click &quot;Create Batch&quot; to organize them
                    </p>
                  </div>
                </div>
              ) : (
                batches.map((batch, index) => {
                  const batchFiles = getFilesForBatch(batch.id)
                  const batchPages = batchFiles.reduce((sum, f) => sum + (f.pages || 0), 0)
                  
                  return (
                    <div key={batch.id} className="rounded-2xl border-2 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                      {/* Batch header */}
                      <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xl">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={batch.name}
                              onChange={(e) => updateBatch(batch.id, { name: e.target.value })}
                              className="bg-transparent border-b border-white/30 focus:border-white outline-none text-lg font-semibold w-full"
                            />
                            <div className="flex items-center gap-4 text-sm text-white/80 mt-1">
                              <span>{batchFiles.length} files</span>
                              <span>{batchPages} pages per set</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <label className="text-xs text-white/70 block">Sets</label>
                              <input
                                type="number"
                                min="1"
                                value={batch.sets}
                                onChange={(e) => updateBatch(batch.id, { sets: Math.max(1, parseInt(e.target.value) || 1) })}
                                className="w-20 bg-white/20 rounded-lg px-3 py-1.5 text-center font-bold text-xl focus:bg-white/30 outline-none"
                              />
                            </div>
                            <button
                              onClick={() => updateBatch(batch.id, { collapsed: !batch.collapsed })}
                              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                            >
                              {batch.collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </button>
                            <button
                              onClick={() => deleteBatch(batch.id)}
                              className="p-2 rounded-lg hover:bg-red-500/50 transition-colors"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Batch stats */}
                        <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-6 text-sm">
                          <div>
                            <span className="text-white/70">Total sheets:</span>
                            <span className="font-bold ml-2">{batchPages * batch.sets}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Batch files */}
                      {!batch.collapsed && (
                        <div className="max-h-64 overflow-auto">
                          {batchFiles.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">
                              <p className="text-sm">Drag files here or select and add to this batch</p>
                            </div>
                          ) : (
                            batchFiles.map(file => (
                              <div
                                key={file.id}
                                className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/50"
                              >
                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="flex-1 text-sm truncate">{file.name}</span>
                                <span className="text-sm font-semibold text-blue-600">{file.pages} pg</span>
                                <button
                                  onClick={() => moveFileToBatch(file.id, null)}
                                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
