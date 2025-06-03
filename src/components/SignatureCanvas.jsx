import { useRef, useEffect, useState } from 'react';
import SignaturePad from 'react-signature-canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Toaster } from 'sonner';
import { toast } from 'sonner';

export default function SignatureCanvas({ readonly = false }) {
  const sigPadRef = useRef();
  const [websocket, setWebsocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [showFeedback, setShowFeedback] = useState(false);
  const [hasSignature, setHasSignature] = useState(false); // Track if signature exists
  const [feedbackTimeout, setFeedbackTimeout] = useState(null);
  const [sessionId, setSessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });

  // Check if this is readonly based on URL params
  const urlParams = new URLSearchParams(window.location.search);
  const urlReadonly = urlParams.get('readonly') === 'true';
  const displayType = urlParams.get('display') || 'unknown';
  const originalFileName = urlParams.get('filename');
  const isReadonly = urlReadonly !== null ? urlReadonly : readonly;

  const params = new URLSearchParams(window.location.search);
  const pdfBase64 = params.get('pdf');

  useEffect(() => {
    // Initialize WebSocket connection
    const initWebSocket = () => {
      try {
        // Use your WebSocket server URL - adjust port/host as needed
        const ws = new WebSocket(`ws://localhost:8080/signature-sync?session=${sessionId}`);

        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
          setWebsocket(ws);

          // Send initial connection message
          ws.send(
            JSON.stringify({
              type: 'join',
              sessionId: sessionId,
              isReadonly: isReadonly,
              displayType: displayType
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setConnectionStatus('disconnected');
          setWebsocket(null);

          // Attempt to reconnect after 3 seconds
          setTimeout(() => {
            if (connectionStatus !== 'connected') {
              initWebSocket();
            }
          }, 3000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('error');
        };
      } catch (err) {
        console.error('Failed to initialize WebSocket:', err);
        setConnectionStatus('error');

        // Fallback to polling or BroadcastChannel for same-device scenarios
        initFallbackSync();
      }
    };

    initWebSocket();

    return () => {
      if (websocket) {
        websocket.close();
      }
      // Clean up timeout on component unmount
      if (feedbackTimeout) {
        clearTimeout(feedbackTimeout);
      }
    };
  }, [sessionId, readonly]);

  // Fallback synchronization for same-device scenarios
  const initFallbackSync = () => {
    try {
      const channel = new BroadcastChannel(`signature-sync-${sessionId}`);

      channel.onmessage = (event) => {
        handleSyncMessage(event.data);
      };

      // Store channel reference for cleanup
      setWebsocket({
        send: (data) => channel.postMessage(JSON.parse(data)),
        close: () => channel.close(),
        isFallback: true
      });

      setConnectionStatus('connected-fallback');
    } catch (err) {
      console.error('Fallback sync failed:', err);
      setConnectionStatus('error');
    }
  };

  const handleWebSocketMessage = (data) => {
    handleSyncMessage(data);
  };

  const handleSyncMessage = (data) => {
    if (!sigPadRef.current) return;

    switch (data.type) {
      case 'signature-update':
        if (isReadonly && data.signatureData) {
          sigPadRef.current.fromDataURL(data.signatureData);
          setHasSignature(true); // Update signature state for readonly
        }
        break;

      case 'signature-clear':
        if (isReadonly) {
          sigPadRef.current.clear();
          setHasSignature(false); // Update signature state for readonly
        } else {
          // Also clear on editable screen if message came from readonly screen
          sigPadRef.current.clear();
          setHasSignature(false);
        }
        break;

      case 'show-feedback':
        // Only show feedback on editable screen
        if (!isReadonly) {
          setShowFeedback(true);
          // Set auto-close timeout for 30 seconds
          const timeout = setTimeout(() => {
            handleFeedback(0); // Auto-submit with rating 0
          }, 30000);
          setFeedbackTimeout(timeout);
        }
        break;

      case 'close-all':
        window.close();
        break;

      case 'session-status':
        console.log('Session status:', data);
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const sendMessage = (message) => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(
        JSON.stringify({
          ...message,
          sessionId: sessionId,
          timestamp: Date.now()
        })
      );
    } else if (websocket && websocket.isFallback) {
      websocket.send(
        JSON.stringify({
          ...message,
          sessionId: sessionId,
          timestamp: Date.now()
        })
      );
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  };

  const handleSignatureChange = () => {
    if (!isReadonly && sigPadRef.current) {
      // Check if there's actually content in the signature pad
      const isEmpty = sigPadRef.current.isEmpty();
      setHasSignature(!isEmpty);

      const signatureData = sigPadRef.current.toDataURL();
      sendMessage({
        type: 'signature-update',
        signatureData: signatureData
      });
    }
  };

  const clear = () => {
    // Allow clear from both screens
    if (!isReadonly) {
      // If this is the editable screen, clear locally and send message
      sigPadRef.current.clear();
      setHasSignature(false);
    }

    // Send clear message to sync across screens
    sendMessage({
      type: 'signature-clear'
    });
  };

  const save = async () => {
    // Allow save from both screens, but only editable screen does the actual saving
    if (!isReadonly) {
      // This is the editable screen - do the actual saving
      const signatureDataUrl = sigPadRef.current.toDataURL();
      const signatureBase64 = signatureDataUrl.split(',')[1];

      try {
        await fetch('http://localhost:5000/api/save-signed-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfBase64,
            signatureBase64,
            sessionId,
            originalFileName: originalFileName
          })
        });
        toast.success('Signature Saved! ✅');
        setTimeout(() => {
          setShowFeedback(true);
          // Set auto-close timeout for 30 seconds
          const timeout = setTimeout(() => {
            handleFeedback(0); // Auto-submit with rating 0
          }, 30000);
          setFeedbackTimeout(timeout);
        }, 1000);
      } catch (err) {
        console.error('Save error:', err);
        toast.error('Save Failed ❌');
      }
    } else {
      // This is readonly screen - send message to trigger feedback on editable screen
      sendMessage({
        type: 'show-feedback'
      });

      // Show success message on readonly screen too
      toast.success('Signature Saved! ✅');
    }
  };

  const handleFeedback = (rating) => {
    // Clear the timeout if user provides feedback before auto-close
    if (feedbackTimeout) {
      clearTimeout(feedbackTimeout);
      setFeedbackTimeout(null);
    }

    // Send feedback to backend
    fetch('http://localhost:5000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating,
        sessionId,
        billNo: sessionId, // Using sessionId as billNo, adjust as needed
        timestamp: new Date().toISOString(),
        isAutoSubmit: rating === 0
      })
    }).catch((err) => {
      console.error('Failed to submit feedback:', err);
    });

    setShowFeedback(false);

    // Close all windows in this session
    sendMessage({ type: 'close-all' });

    setTimeout(() => {
      window.close();
    }, 100);
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600';
      case 'connected-fallback':
        return 'text-yellow-600';
      case 'disconnected':
        return 'text-red-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connected-fallback':
        return 'Local Sync';
      case 'disconnected':
        return 'Reconnecting...';
      case 'error':
        return 'Connection Error';
      default:
        return 'Connecting...';
    }
  };

  const feedbackOptions = [
    {
      emoji: '😞',
      label: 'Poor',
      rating: 1,
      color: 'bg-red-50 border-red-200 hover:bg-red-100'
    },
    {
      emoji: '😐',
      label: 'Okay',
      rating: 2,
      color: 'bg-amber-50 border-amber-200 hover:bg-amber-100'
    },
    {
      emoji: '😊',
      label: 'Great',
      rating: 3,
      color: 'bg-green-50 border-green-200 hover:bg-green-100'
    }
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 flex items-center space-x-4">
        <h2 className="text-xl font-bold">
          {isReadonly
            ? `${displayType === 'cashier' ? 'Cashier View' : 'Signature View'} (Read-Only)`
            : `${displayType === 'customer' ? 'Customer Signature' : 'Sign Here'}`}
        </h2>
        <div className={`text-sm ${getConnectionStatusColor()}`}>● {getConnectionStatusText()}</div>
      </div>

      <SignaturePad
        ref={sigPadRef}
        canvasProps={{
          width: 300,
          height: 150,
          className: `border rounded ${isReadonly ? 'opacity-75 cursor-not-allowed bg-gray-50' : 'bg-white'}`
        }}
        onEnd={isReadonly ? undefined : handleSignatureChange} // Disable onEnd for readonly
        penColor={isReadonly ? 'transparent' : 'black'}
      />

      <div className="mt-4 space-x-4">
        <button
          onClick={clear}
          disabled={connectionStatus === 'error'}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
        <button
          onClick={save}
          disabled={connectionStatus === 'error' || !hasSignature}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Done
        </button>

        {isReadonly && (
          <div className="text-sm text-gray-600 text-center mt-2">
            {displayType === 'cashier'
              ? 'Cashier view - Customer is signing on the other screen'
              : 'This signature pad is read-only - synced in real-time'}
          </div>
        )}
      </div>

      {connectionStatus === 'error' && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          Connection failed. The signature sync may not work properly.
        </div>
      )}

      {/* Feedback Dialog - Only shown on editable screen */}
      <Dialog
        open={showFeedback}
        onOpenChange={(open) => {
          if (!open && feedbackTimeout) {
            // If user tries to close without selecting, don't allow it
            return;
          }
          setShowFeedback(open);
        }}
      >
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-semibold">How was your experience?</DialogTitle>
            <p className="text-center text-sm text-red-500 mt-2">
              This form will auto-submit in 30 seconds if no selection is made
            </p>
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

          <p className="text-sm text-gray-500 text-center">Click on a smiley to rate your experience</p>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}
