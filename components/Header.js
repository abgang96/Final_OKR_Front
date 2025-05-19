import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import api from '../lib/api';

const Header = ({ isAuthenticated, user, hideWeeklyDiscussions, hideTeamDiscussions }) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [hasTeamMembers, setHasTeamMembers] = useState(false);
  // Check if the user has team members
  useEffect(() => {
    const checkTeamMembers = async () => {
      if (!isAuthenticated) return;
      
      try {
        const response = await api.get('/api/weekly-forms/my_team_members/');
        const teamMembers = response.data;
        setHasTeamMembers(Array.isArray(teamMembers) && teamMembers.length > 0);
      } catch (error) {
        console.error('Error checking team members:', error);
        setHasTeamMembers(false);
      }
    };
    
    checkTeamMembers();
  }, [isAuthenticated]);

  const handleLogout = () => {
    // Clear all authentication data
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Redirect to Microsoft login page
    router.push('/test-auth');
  };
  // Get the display name - prefer user_name, then username, then email
  const displayName = user?.user_name || user?.username || user?.email?.split('@')[0] || "User";
  // Get the initial for the avatar
  const userInitial = (user?.user_name?.[0] || user?.username?.[0] || user?.email?.[0] || "U").toUpperCase();
  
  return (
    <header className="bg-primary text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/">
            <img src="/tor2.png" alt="OKR Tree" className="h-8" />
          </Link>
            {isAuthenticated && (
            <nav className="ml-10 hidden md:block">
              <ul className="flex space-x-6">                <li>
                  <Link href="/" className={router.pathname === '/' ? 'text-[#F6490D]' : ''}>
                    DASHBOARD
                  </Link>
                </li>
                {!hideWeeklyDiscussions && (
                  <li>
                    <Link href="/weekly-discussions" className={router.pathname === '/weekly-discussions' ? 'text-[#F6490D]' : ''}>
                      WEEKLY DISCUSSION
                    </Link>
                  </li>
                )}
                {!hideTeamDiscussions && hasTeamMembers && (
                  <li>
                    <Link href="/team-discussions" className={router.pathname === '/team-discussions' ? 'text-[#F6490D]' : ''}>
                      TEAM DISCUSSION
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          )}
        </div>
        
        <div className="flex items-center">
          {isAuthenticated ? (
            <>              <div className="mr-4 text-sm hidden md:block">
                {/* <span>Welcome, {displayName}</span> */}
              </div>
              <div className="relative">
                <button 
                  onClick={() => setIsOpen(!isOpen)}
                  className="flex items-center space-x-2 p-2 rounded hover:bg-primary-dark focus:outline-none"
                >
                  {/* <span className="font-medium hidden md:block">{displayName}</span> */}
                  <div className="h-8 w-8 rounded-full bg-primary-foreground text-primary flex items-center justify-center">
                    {userInitial}
                  </div>
                </button>
                
                {isOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 text-gray-800">
                    <button 
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/test-auth" className="py-2 px-4 rounded bg-white text-primary font-medium">
              Login
            </Link>
          )}
        </div>
      </div>
        {/* Mobile menu */}
      {isAuthenticated && (
        <div className="md:hidden container mx-auto px-4 pb-3">
          <nav>
            <ul className="flex space-x-4">
              <li>
                <Link href="/" className={router.pathname === '/' ? 'text-[#F6490D]' : ''}>
                  DASHBOARD
                </Link>
              </li>
              <li>
                <Link href="/weekly-discussions" className={router.pathname === '/weekly-discussions' ? 'text-[#F6490D]' : ''}>
                  WEEKLY DISCUSSION
                </Link>
              </li>
              <li>
                <Link href="/team-discussions" className={router.pathname === '/team-discussions' ? 'text-[#F6490D]' : ''}>
                  TEAM DISCUSSION
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;