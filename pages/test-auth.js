import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MicrosoftAuthButton from '../components/auth/MicrosoftAuthButton';

const LoginPage = () => {
  const [authError, setAuthError] = useState(null);
  const router = useRouter();
  
  // Check if user is already authenticated
  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      // Already authenticated, redirect to dashboard
      router.push('/');
    }
  }, [router]);
  
  // Handle successful login
  const handleLoginComplete = (userData) => {
    setAuthError(null);
    // Redirect will be handled by the MicrosoftAuthButton component
  };
  
  // Handle login error
  const handleLoginError = (error) => {
    setAuthError(error.message || 'Authentication failed');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
      <Head>
        <title>Sign In - OKR Tree</title>
        <meta name="description" content="Sign in to OKR Tree" />
      </Head>
      
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary">OKR Tree</h1>
            <p className="text-gray-600 mt-2">Sign in to manage and visualize your OKRs</p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-6 text-center">Sign In</h2>
            
            {authError && (
              <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                {authError}
              </div>
            )}
            
            <div className="mb-8">
              <MicrosoftAuthButton
                onLoginComplete={handleLoginComplete}
                onError={handleLoginError}
                redirectToHome={true}
              />
            </div>
            
            <div className="text-center text-sm text-gray-500">
              <p>Sign in with your organization's Microsoft account</p>
            </div>
          </div>
          
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>© {new Date().getFullYear()} OKR Tree. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;