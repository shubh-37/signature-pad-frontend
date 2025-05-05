import { useEffect, useState } from 'react';
import PDFViewer from './components/PDFViewer';
import SignatureCanvas from './components/SignatureCanvas';

export default function SignPage() {
  const [pdfData, setPdfData] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pdfBase64 = params.get('pdf');
    if (pdfBase64) {
      const byteArray = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
      setPdfData(byteArray);
    }
  }, []);

  if (!pdfData) return <div className="p-4">Loading PDF...</div>;
  console.log(pdfData)
  return (
    <div className="flex h-screen">
      <div className="w-1/2 border-r">
        <PDFViewer data={pdfData} />
      </div>
      <div className="w-1/2 flex flex-col justify-center items-center">
      {pdfData && <SignatureCanvas key={pdfData.length} pdfData={pdfData} />}
      </div>
    </div>
  );
}