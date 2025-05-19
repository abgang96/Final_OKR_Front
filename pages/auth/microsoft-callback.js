import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function MicrosoftAuthCallback() {
  const router = useRouter();
  const [error, setError] = useState(null);

  useEffect(() => {
    // Parse the URL hash (fragment) for auth data
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      // Extract the code from the URL
      const code = params.get('code');
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      
      if (code) {
        console.log('Auth callback received code, sending to opener window');
        // Send message back to the opener window
        if (window.opener) {
          window.opener.postMessage({
            type: 'microsoft-auth-callback',
            code: code
          }, window.location.origin);
          // Wait a moment to ensure the message is sent before closing
          setTimeout(() => window.close(), 500);
        } else {
          // If not a popup, redirect to the login page with the code
          router.push(`/test-auth?code=${code}`);
        }
      } else if (error) {
        console.error('Authentication error:', error, errorDescription);
        setError(`${error}: ${errorDescription}`);
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'microsoft-auth-error',
            error: error,
            description: errorDescription
          }, window.location.origin);
          // Wait a moment to ensure the message is sent before closing
          setTimeout(() => window.close(), 2000);
        } else {
          router.push(`/test-auth?error=${error}`);
        }
      }
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-6 max-w-md">
        {error ? (
          <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-4">
            <p className="text-red-700"><strong>Authentication Error:</strong></p>
            <p className="text-red-700">{error}</p>
            <p className="text-sm mt-2">This window will close automatically.</p>
          </div>
        ) : (
          <>
            <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full text-blue-600" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Completing authentication...</p>
            <p className="text-sm text-gray-500 mt-1">Please wait, you will be redirected automatically.</p>
          </>
        )}
      </div>
    </div>
  );
}