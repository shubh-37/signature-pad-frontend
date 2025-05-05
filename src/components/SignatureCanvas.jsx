
import { useRef } from 'react';
import SignaturePad from 'react-signature-canvas';

import { useEffect, useState } from 'react';

export default function SignatureCanvas() {
  const [pdfData, setPdfData] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pdfBase64 = params.get('pdf');
    if (pdfBase64) {
      const byteArray = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
      setPdfData(byteArray);
    }
  }, []);
  const sigPadRef = useRef();

  const clear = () => sigPadRef.current.clear();

  const save = async () => {
    const signatureDataUrl = sigPadRef.current.toDataURL();
    function encodePdfBase64(pdfUint8) {
  const blob = new Blob([pdfUint8], { type: 'application/pdf' });
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

const pdfBase64 = await encodePdfBase64(pdfData);
    const signatureBase64 = signatureDataUrl.split(',')[1];

    await fetch('http://localhost:5000/api/save-signed-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64, signatureBase64 }),
    })
      .then(res => res.json())
      .then(data => alert('Signed PDF saved at: ' + data.path))
      .catch(err => console.error(err));

      if (window.closePuppeteer) {
        window.closePuppeteer();
      } else {
        console.warn("closePuppeteer is not available.");
      }
  };

  return (
    <div className="flex flex-col items-center">
      <SignaturePad
        ref={sigPadRef}
        canvasProps={{ width: 400, height: 200, className: 'border' }}
      />
      <div className="mt-4 space-x-4">
        <button onClick={clear}>Clear</button>
        <button onClick={save}>Done</button>
      </div>
    </div>
  );
}
