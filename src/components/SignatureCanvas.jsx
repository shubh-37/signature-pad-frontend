import { useRef, useEffect, useState } from 'react';
import SignaturePad from 'react-signature-canvas';

export default function SignatureCanvas({ readonly = false }) {
  const sigPadRef = useRef();
  const [broadcastChannel, setBroadcastChannel] = useState(null);
  const params = new URLSearchParams(window.location.search);
  const pdfBase64 = params.get('pdf');

  useEffect(() => {
    // Create BroadcastChannel for cross-window communication
    const channel = new BroadcastChannel('signature-sync');
    setBroadcastChannel(channel);

    // Listen for signature updates from other windows
    channel.onmessage = (event) => {
      if (event.data.type === 'signature-update' && sigPadRef.current) {
        // Only update if this is the readonly window
        if (readonly) {
          sigPadRef.current.fromDataURL(event.data.signatureData);
        }
      }
      
      if (event.data.type === 'signature-clear' && sigPadRef.current) {
        if (readonly) {
          sigPadRef.current.clear();
        }
      }
      if (event.data.type === 'closeAll') {
        window.close();
      }
    };

    return () => {
      channel.close();
    };
  }, [readonly]);

  // Broadcast signature changes (only from editable window)
  const handleSignatureChange = () => {
    if (!readonly && broadcastChannel && sigPadRef.current) {
      const signatureData = sigPadRef.current.toDataURL();
      broadcastChannel.postMessage({
        type: 'signature-update',
        signatureData: signatureData
      });
    }
  };

  const clear = () => {
    if (readonly) return;
    
    sigPadRef.current.clear();
    
    // Broadcast clear action
    if (broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'signature-clear'
      });
    }
  };

  const save = async () => {
    if (readonly) return;
    
    const signatureDataUrl = sigPadRef.current.toDataURL();
    const signatureBase64 = signatureDataUrl.split(',')[1];

    await fetch('http://localhost:5000/api/save-signed-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64, signatureBase64 }),
    })
      .then(res => res.json())
      .then(data => alert('Signed PDF saved at: ' + data.path))
      .catch(err => console.error(err));

      // if (window.closePuppeteer) {
      //   window.closePuppeteer();
      // } else {
      //   console.warn("closePuppeteer is not available.");
      // }

      const channel = new BroadcastChannel('signature-sync');
channel.postMessage({ type: 'closeAll' });
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold mb-4">
        {readonly ? 'Signature View (Read-Only)' : 'Sign Here'}
      </h2>
      
      <SignaturePad
        ref={sigPadRef}
        canvasProps={{ 
          width: 300, 
          height: 150, 
          className: `border ${readonly ? 'opacity-75 cursor-not-allowed' : ''}` 
        }}
        onEnd={handleSignatureChange} // Broadcast when signature stroke ends
        penColor={readonly ? 'transparent' : 'black'} // Make pen transparent for readonly
      />
      
      <div className="mt-4 space-x-4">
        {!readonly && (
          <>
            <button 
              onClick={clear}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear
            </button>
            <button 
              onClick={save}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Done
            </button>
          </>
        )}
        
        {readonly && (
          <div className="text-sm text-gray-600">
            This signature pad is read-only
          </div>
        )}
      </div>
    </div>
  );
}