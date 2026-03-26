"use client"

import { useState, useRef, useCallback } from "react"
import { PDFDocument } from "pdf-lib"
import JSZip from "jszip"
import { Upload, FileText, Download, Trash2, Filter, CheckSquare, Plus, X } from "lucide-react"
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
type DimensionFilter = "all" | "letter" | "tabloid" | "legal" | "a4" | "square" | "landscape" | "portrait"

export default function PDFBatchPage() {
  const [files, setFiles] = useState<PDFFile[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [sortCol, setSortCol] = useState<SortColumn>("name")
  const [sortAsc, setSortAsc] = useState(true)
  const [dimFilter, setDimFilter] = useState<DimensionFilter>("all")
  const [minPages, setMinPages] = useState<string>("")
  const [maxPages, setMaxPages] = useState<string>("")
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processMsg, setProcessMsg] = useState("")
  const [processProgress, setProcessProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uidRef = useRef(0)

  // Format bytes
  const formatBytes = (b: number) => 
    b > 1048576 ? (b / 1048576).toFixed(2) + " MB" : (b / 1024).toFixed(1) + " KB"

  // Format dimensions
  const formatDim = (e: PDFFile) => 
    e.pageW ? `${(e.pageW / 72).toFixed(2)}" × ${(e.pageH! / 72).toFixed(2)}"` : "—"

  // New filename with page count prefix
  const newName = (e: PDFFile) => 
    typeof e.pages === "number" ? `${e.pages} ${e.name}` : e.name

  // Add files
  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith(".pdf"))
    if (!arr.length) return

    const batch: PDFFile[] = arr.map(file => {
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

    setFiles(prev => [...prev, ...batch])
    setSelected(prev => {
      const newSet = new Set(prev)
      batch.forEach(e => newSet.add(e.id))
      return newSet
    })

    // Load all PDFs in parallel
    await Promise.all(batch.map(async (entry) => {
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

  // Filter files
  const filteredFiles = useCallback(() => {
    const pmin = parseInt(minPages) || 0
    const pmax = parseInt(maxPages) || Infinity

    return files.filter(e => {
      if (e.pages !== null && typeof e.pages === "number") {
        if (pmin && e.pages < pmin) return false
        if (pmax < Infinity && e.pages > pmax) return false
      }
      if (dimFilter === "all" || !e.pageW) return true
      
      const w = e.pageW / 72, h = e.pageH! / 72, t = 0.15
      switch (dimFilter) {
        case "letter": return Math.abs(w - 8.5) < t && Math.abs(h - 11) < t
        case "tabloid": return Math.abs(w - 11) < t && Math.abs(h - 17) < t
        case "legal": return Math.abs(w - 8.5) < t && Math.abs(h - 14) < t
        case "a4": return Math.abs(w - 8.27) < t && Math.abs(h - 11.69) < t
        case "square": return Math.abs(w - h) < 0.2
        case "landscape": return w > h + 0.1
        case "portrait": return h > w + 0.1
        default: return true
      }
    })
  }, [files, dimFilter, minPages, maxPages])

  // Sort files
  const sortedFiles = useCallback(() => {
    const list = filteredFiles()
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
  }, [filteredFiles, sortCol, sortAsc])

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
    setSelected(new Set(files.map(e => e.id)))
  }

  // Select filtered
  const selectFiltered = () => {
    setSelected(new Set(filteredFiles().map(e => e.id)))
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

  // Download ZIP
  const downloadZip = async () => {
    const sel = files.filter(e => selected.has(e.id) && e.status === "ready")
    if (!sel.length) return

    setIsProcessing(true)
    setProcessMsg("Preparing files...")
    setProcessProgress(0)

    try {
      // Sort by pages ascending
      const sorted = [...sel].sort((a, b) => (a.pages || 0) - (b.pages || 0))
      
      const zip = new JSZip()
      
      for (let i = 0; i < sorted.length; i++) {
        const e = sorted[i]
        setProcessMsg(`Adding ${e.name}...`)
        setProcessProgress(Math.round((i / sorted.length) * 100))
        
        const ab = await e.file.arrayBuffer()
        const renamed = newName(e)
        zip.file(renamed, ab)
      }

      setProcessMsg("Creating ZIP...")
      setProcessProgress(95)

      const blob = await zip.generateAsync({ type: "blob" })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `PDFs_${new Date().toISOString().slice(0, 10)}.zip`
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
  const totalBytes = files.reduce((a, e) => a + e.bytes, 0)
  const visibleFiles = sortedFiles()
  const selectedCount = files.filter(e => selected.has(e.id)).length
  const readySelected = files.filter(e => selected.has(e.id) && e.status === "ready").length

  return (
    <div 
      className="min-h-screen bg-muted/30"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Nav */}
      <nav className="sticky top-0 z-50 h-14 bg-background/80 backdrop-blur-xl border-b flex items-center px-6 gap-3">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <FileText className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-semibold text-sm">PDF Batch</div>
          <div className="text-xs text-muted-foreground">Page counter & renamer</div>
        </div>
        <div className="ml-auto">
          {files.length > 0 ? (
            <div className="text-sm px-3 py-1 rounded-full bg-card border">
              <span className="font-bold text-blue-500">{files.length}</span>
              <span className="text-muted-foreground"> file{files.length === 1 ? "" : "s"} · {formatBytes(totalBytes)}</span>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Drop PDFs to start</div>
          )}
        </div>
      </nav>

      {/* Hero drop zone - shown when no files */}
      {files.length === 0 && (
        <div className="max-w-3xl mx-auto px-6 pt-10">
          <div 
            className={cn(
              "bg-card rounded-2xl shadow-lg p-12 text-center cursor-pointer transition-all border-2 border-dashed",
              isDragging ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 scale-[1.01]" : "border-transparent hover:shadow-xl hover:-translate-y-0.5"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-20 h-20 mx-auto mb-5 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50 rounded-3xl flex items-center justify-center">
              <Upload className="h-10 w-10 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Drop your PDFs here</h1>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Drop as many PDFs as you want. The tool reads each file, counts the pages, and automatically downloads a ZIP with files renamed <strong className="text-foreground">12 original.pdf</strong> · <strong className="text-foreground">48 another.pdf</strong> — sorted smallest to largest.
            </p>
            <button className="inline-flex items-center gap-2 bg-blue-500 text-white px-7 py-3 rounded-full font-semibold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/30 hover:-translate-y-0.5">
              <Upload className="h-4 w-4" />
              Choose PDFs
            </button>
          </div>
        </div>
      )}

      {/* Content - shown when files exist */}
      {files.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 py-6">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-card rounded-xl shadow-sm p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Files</div>
              <div className="text-2xl font-bold font-mono text-blue-500">{files.length}</div>
            </div>
            <div className="bg-card rounded-xl shadow-sm p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Showing</div>
              <div className="text-2xl font-bold font-mono">{visibleFiles.length}</div>
            </div>
            <div className="bg-card rounded-xl shadow-sm p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Selected</div>
              <div className="text-2xl font-bold font-mono text-orange-500">{selectedCount}</div>
            </div>
            <div className="bg-card rounded-xl shadow-sm p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Total Size</div>
              <div className="text-lg font-bold font-mono pt-1">{formatBytes(totalBytes)}</div>
            </div>
          </div>

          {/* Filter + Actions bar */}
          <div className="bg-card rounded-xl shadow-sm p-4 flex items-center gap-3 flex-wrap mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Filter</span>
            <select 
              value={dimFilter} 
              onChange={(e) => setDimFilter(e.target.value as DimensionFilter)}
              className="bg-muted border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">Any page size</option>
              <option value="letter">Letter 8.5×11"</option>
              <option value="tabloid">Tabloid 11×17"</option>
              <option value="legal">Legal 8.5×14"</option>
              <option value="a4">A4</option>
              <option value="square">Square</option>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Pages</span>
              <input 
                type="number" 
                value={minPages}
                onChange={(e) => setMinPages(e.target.value)}
                placeholder="min"
                className="w-16 bg-muted border rounded-lg px-2 py-1.5 text-sm"
              />
              <span className="text-muted-foreground">–</span>
              <input 
                type="number" 
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                placeholder="max"
                className="w-16 bg-muted border rounded-lg px-2 py-1.5 text-sm"
              />
            </div>

            <div className="w-px h-6 bg-border mx-2" />

            <div className="ml-auto flex items-center gap-2">
              <button onClick={selectAll} className="px-3 py-1.5 rounded-full text-sm font-medium bg-muted border hover:border-blue-500 hover:text-blue-500 transition-colors">
                Select all
              </button>
              <button onClick={selectFiltered} className="px-3 py-1.5 rounded-full text-sm font-medium bg-muted border hover:border-blue-500 hover:text-blue-500 transition-colors">
                Select filtered
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 rounded-full text-sm font-medium bg-muted border hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add more
              </button>
              <button onClick={clearAll} className="px-3 py-1.5 rounded-full text-sm font-medium bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors">
                Clear
              </button>
              <button 
                onClick={downloadZip}
                disabled={readySelected === 0}
                className="px-4 py-1.5 rounded-full text-sm font-semibold bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-600 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <Download className="h-3.5 w-3.5" />
                Download ZIP {readySelected > 0 && `(${readySelected})`}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="w-10 px-4 py-3">
                    <input 
                      type="checkbox" 
                      checked={selectedCount === files.length && files.length > 0}
                      onChange={() => selectedCount === files.length ? setSelected(new Set()) : selectAll()}
                      className="w-4 h-4 rounded"
                    />
                  </th>
                  <th 
                    onClick={() => handleSort("name")}
                    className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground"
                  >
                    Filename {sortCol === "name" && (sortAsc ? "↑" : "↓")}
                  </th>
                  <th 
                    onClick={() => handleSort("bytes")}
                    className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground"
                  >
                    Size {sortCol === "bytes" && (sortAsc ? "↑" : "↓")}
                  </th>
                  <th 
                    onClick={() => handleSort("pages")}
                    className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground"
                  >
                    Pages {sortCol === "pages" && (sortAsc ? "↑" : "↓")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Dimensions
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {visibleFiles.map((e) => (
                  <tr 
                    key={e.id}
                    onClick={() => toggleSelect(e.id)}
                    className={cn(
                      "border-b last:border-b-0 cursor-pointer transition-colors",
                      selected.has(e.id) ? "bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30" : "hover:bg-muted/50"
                    )}
                  >
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        checked={selected.has(e.id)}
                        onChange={() => toggleSelect(e.id)}
                        onClick={(ev) => ev.stopPropagation()}
                        className="w-4 h-4 rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm truncate max-w-[280px]">{e.name}</div>
                      {e.status === "ready" && (
                        <div className="text-xs text-green-600 font-mono mt-0.5 truncate max-w-[280px]">
                          → {newName(e)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{formatBytes(e.bytes)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {e.status === "loading" ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-mono bg-muted border border-dashed text-muted-foreground">
                          ...
                        </span>
                      ) : e.pages !== null ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold font-mono bg-muted border">
                          {e.pages}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {formatDim(e)}
                    </td>
                    <td className="px-4 py-3">
                      {e.status === "ready" && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Ready
                        </span>
                      )}
                      {e.status === "loading" && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                          Loading
                        </span>
                      )}
                      {e.status === "error" && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                          Error
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={(ev) => { ev.stopPropagation(); removeFile(e.id); }}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleFiles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-20 text-center">
                      <div className="text-4xl mb-3">📭</div>
                      <div className="font-bold">No files match filter</div>
                      <div className="text-sm text-muted-foreground">Try adjusting your filters</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hidden file input */}
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
          <div className="bg-card rounded-2xl shadow-2xl p-10 text-center min-w-[340px]">
            <div className="w-11 h-11 mx-auto mb-4 border-3 border-muted border-t-blue-500 rounded-full animate-spin" />
            <div className="font-bold text-lg mb-2">Processing...</div>
            <div className="text-sm text-muted-foreground mb-4">{processMsg}</div>
            <div className="h-1 bg-muted rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${processProgress}%` }}
              />
            </div>
            <div className="text-xs font-mono text-muted-foreground">{processProgress}%</div>
          </div>
        </div>
      )}
    </div>
  )
}
