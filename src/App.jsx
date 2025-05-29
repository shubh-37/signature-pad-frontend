"use client"

import { useEffect, useState } from "react"
import { FileText, Edit3, Eye } from "lucide-react"
import PDFViewer from "./components/PDFViewer"
import SignatureCanvas from "./components/SignatureCanvas"

export default function App() {
  const [pdfData, setPdfData] = useState(null)
  const [mode, setMode] = useState("edit")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pdfBase64 = params.get("pdf")
    const urlMode = params.get("mode") || "edit"

    setMode(urlMode)

    if (pdfBase64) {
      try {
        const byteArray = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0))
        setPdfData(byteArray)
      } catch (error) {
        console.error("Error parsing PDF data:", error)
      }
    }

    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (!pdfData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No PDF Found</h2>
          <p className="text-gray-500">Please provide a valid PDF document to continue.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <FileText className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-800">Document Signature</h1>
        </div>

        {/* <div
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            mode === "edit" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
          }`}
        >
          {mode === "edit" ? (
            <>
              <Edit3 className="h-4 w-4" />
              <span>Editable Mode</span>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              <span>Read-Only View</span>
            </>
          )}
        </div> */}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Viewer Section */}
        <div className="w-1/2 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-800">Document Preview</h2>
            <p className="text-sm text-gray-500 mt-1">Review the document before signing</p>
          </div>
          <div className="flex-1 overflow-auto">
            <PDFViewer data={pdfData} />
          </div>
        </div>

        {/* Signature Section */}
        <div className="w-1/2 bg-gray-50 flex flex-col">
          <div className="px-6 py-4 bg-white border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-800">
              {mode === "edit" ? "Digital Signature" : "Signature Preview"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {mode === "edit" ? "Draw your signature in the canvas below" : "View the applied signature"}
            </p>
          </div>

          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-md">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <SignatureCanvas key={pdfData.length} pdfData={pdfData} readonly={mode === "readonly"} />

                {mode === "edit" && (
                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-500">Sign above to complete the document</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
