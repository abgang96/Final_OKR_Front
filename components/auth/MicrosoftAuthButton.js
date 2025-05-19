import React, { useState } from 'react';
import api from '../../lib/api';
import axios from 'axios';
import { useRouter } from 'next/router';

// Constants for Microsoft OAuth
const TENANT_ID = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || '0f31460e-8f97-4bf6-9b20-fe837087ad59';
const MICROSOFT_AUTH_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`;
const REDIRECT_URI = typeof window !== 'undefined' ? 
  `${window.location.origin}/auth/microsoft-callback` : 
  'http://localhost:3000/auth/microsoft-callback';

// API URL for backend calls
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Update these with your actual app registration values
const CLIENT_ID = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '4f34222d-3d22-4855-9d70-6aa95971c511';

/**
 * Button component that initiates Microsoft OAuth sign-in flow
 */
const MicrosoftAuthButton = ({ onLoginStart, onLoginComplete, onError, redirectToHome = false }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const router = useRouter();

  const handleLogin = () => {
    try {
      setIsLoggingIn(true);
      if (onLoginStart) onLoginStart();
      
      // Build Microsoft OAuth URL with necessary parameters
      const authParams = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: 'openid profile email User.Read',
        response_mode: 'fragment',
        prompt: 'select_account',
      });
      
      const authUrl = `${MICROSOFT_AUTH_URL}?${authParams.toString()}`;
      
      // Log the authentication configuration for debugging
      const debugData = {
        clientId: CLIENT_ID,
        tenantId: TENANT_ID,
        redirectUri: REDIRECT_URI,
        authUrl: authUrl
      };
      
      console.log('Microsoft Auth Config:', debugData);
      setDebugInfo(debugData);
      
      // Create a popup window for Microsoft login
      const width = 600;
      const height = 600;
      const left = window.innerWidth / 2 - width / 2;
      const top = window.innerHeight / 2 - height / 2;
      
      const authWindow = window.open(
        authUrl,
        'microsoft-auth-popup',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      if (!authWindow) {
        throw new Error('Popup window was blocked. Please allow popups for this site.');
      }
      
      // Set up event listener to handle the callback
      const handleMessage = async (event) => {
        // Check origin to ensure it's from our app
        if (event.origin !== window.location.origin) {
          console.log('Ignoring message from different origin:', event.origin);
          return;
        }
        
        console.log('Received postMessage event:', event.data);
        
        // Check if the message contains authentication data
        if (event.data && event.data.type === 'microsoft-auth-callback' && event.data.code) {
          window.removeEventListener('message', handleMessage);
          
          try {
            console.log('Received auth code, exchanging for token...');
            
            // Create a direct axios instance for this call since we don't have a specific API method
            const response = await axios.post(`${API_BASE_URL}/api/auth/microsoft/callback`, {
              code: event.data.code,
              redirect_uri: REDIRECT_URI
            });
            
            console.log('Token exchange successful');
            const { user, tokens } = response.data;
            
            // Store authentication data
            localStorage.setItem('accessToken', tokens.access);
            localStorage.setItem('refreshToken', tokens.refresh);
            localStorage.setItem('user', JSON.stringify(user));
            
            // Callback for successful login
            if (onLoginComplete) onLoginComplete(user);
            
            // Redirect to home page if the redirectToHome prop is true
            if (redirectToHome) {
              console.log('Redirecting to homepage after successful login');
              window.location.href = '/';
            }
          } catch (error) {
            console.error('Error exchanging code for token:', error);
            if (onError) onError(error);
          } finally {
            setIsLoggingIn(false);
            setDebugInfo(null);
          }
        } else if (event.data && event.data.type === 'microsoft-auth-error') {
          console.error('Auth error from popup:', event.data.error, event.data.description);
          if (onError) onError(new Error(`${event.data.error}: ${event.data.description}`));
          setIsLoggingIn(false);
        }
      };
      
      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('Error initiating Microsoft login:', error);
      setIsLoggingIn(false);
      if (onError) onError(error);
    }
  };
  
  return (
    <div>
      <button
        className="w-full flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        onClick={handleLogin}
        disabled={isLoggingIn}
      >
        <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
        {isLoggingIn ? 'Signing in...' : 'Sign in with Microsoft'}
      </button>
      
      {/* Debug info display - only visible during login */}
      {debugInfo && (
        <div className="mt-4 p-2 border border-gray-300 rounded text-xs bg-gray-50">
          <p className="font-semibold">Auth Debug Info:</p>
          <p><strong>Client ID:</strong> {debugInfo.clientId}</p>
          <p><strong>Tenant ID:</strong> {debugInfo.tenantId}</p>
          <p><strong>Redirect URI:</strong> {debugInfo.redirectUri}</p>
          <p className="mt-2 text-xs">Make sure this redirect URI is registered in your Azure app registration.</p>
        </div>
      )}
    </div>
  );
};

export default MicrosoftAuthButton;