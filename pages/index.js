import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import OKRTree from '../components/OKRTree';
import Header from '../components/Header';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      const token = localStorage.getItem('accessToken');
      const userData = localStorage.getItem('user');
      
      if (token && userData) {
        // User is authenticated
        setIsAuthenticated(true);
        setUser(JSON.parse(userData));
      } else {
        // Not authenticated, redirect to Microsoft login page
        router.push('/test-auth');
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <Head>
        <title>OKR Tree</title>
        <meta name="description" content="OKR Tree Visualization and Management" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header 
        isAuthenticated={isAuthenticated} 
        user={user}
      />

      <main className="container mx-auto px-4 py-8">
        {isAuthenticated && <OKRTree />}
      </main>
    </div>
  );
}