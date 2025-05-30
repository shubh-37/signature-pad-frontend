import { useRef, useEffect, useState } from 'react';
import SignaturePad from 'react-signature-canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Toaster } from 'sonner';
import { toast } from 'sonner';

export default function SignatureCanvas({ readonly = false }) {
  const sigPadRef = useRef();
  const [broadcastChannel, setBroadcastChannel] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
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

    try {
      const response = await fetch('http://localhost:5000/api/save-signed-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, signatureBase64 }),
      });
      
      const data = await response.json();
      
      // Show success toast
      toast.success("Signature Saved! ✅");
      
      // Show feedback popup after a short delay to let user see the toast
      setTimeout(() => {
        setShowFeedback(true);
      }, 1000);
      
    } catch (err) {
      console.error(err);
      
      // Show error toast
      toast.error("Save Failed ❌");
    }
  };

  const handleFeedback = (rating) => {
    // Optional: Send feedback to backend
    // fetch('http://localhost:5000/api/feedback', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ rating, timestamp: new Date().toISOString() }),
    // });

    // Close feedback popup
    setShowFeedback(false);
    
    // Close all windows
    const channel = new BroadcastChannel('signature-sync');
    channel.postMessage({ type: 'closeAll' });
    
    // Close current window as well
    setTimeout(() => {
      window.close();
    }, 100);
  };

  const feedbackOptions = [
    {
      emoji: '😞',
      label: 'Poor',
      rating: 1,
      color: 'hover:bg-red-50 hover:border-red-200'
    },
    {
      emoji: '😐',
      label: 'Okay', 
      rating: 2,
      color: 'hover:bg-yellow-50 hover:border-yellow-200'
    },
    {
      emoji: '😊',
      label: 'Great',
      rating: 3,
      color: 'hover:bg-green-50 hover:border-green-200'
    }
  ];

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
        onEnd={handleSignatureChange}
        penColor={readonly ? 'transparent' : 'black'}
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

      {/* Feedback Dialog */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-semibold">
              How was your experience?
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex justify-center space-x-6 py-6">
            {feedbackOptions.map((option) => (
              <Button
                key={option.rating}
                size="lg"
                variant="outline"
                onClick={() => handleFeedback(option.rating)}
                className={`flex flex-col items-center space-y-2 h-20 w-20 bg-white p-2 transition-all duration-200 ${option.color}`}
              >
                <span className="text-2xl">{option.emoji}</span>
                <span className="text-xs font-medium">{option.label}</span>
              </Button>
            ))}
          </div>
          
          <p className="text-sm text-gray-500 text-center">
            Click on a smiley to rate your experience
          </p>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}