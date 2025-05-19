import axios from 'axios';

// Define API base URL - Add production URL when deploying
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Add request interceptor to attach auth token
apiClient.interceptors.request.use(
  (config) => {
    // Skip authentication for local development if needed
    if (typeof window !== 'undefined') {
      // First try to get Teams SSO token from our auth service
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      } else {
        // Fall back to legacy token if exists
        const legacyToken = localStorage.getItem('auth_token');
        if (legacyToken) {
          config.headers['Authorization'] = `Bearer ${legacyToken}`;
        }
      }
    }
    console.log(`Making request to: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for auth error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle authentication errors (401)
    const originalRequest = error.config;
    
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await apiClient.post('/api/token/refresh/', {
            refresh: refreshToken
          });
          
          const newToken = response.data.access;
          localStorage.setItem('accessToken', newToken);
          
          // Update the authorization header
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Token refresh failed, user needs to login again
        console.log('Token refresh failed, redirecting to login');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        
        // Redirect to login or handle based on your app's flow
        if (typeof window !== 'undefined') {
          // Check if we're in Teams context
          const isTeams = window.parent !== window.self;
          
          if (isTeams) {
            // In Teams context - initiate Teams auth again
            // This will be handled by the Teams auth service
            console.log('In Teams context, will re-authenticate');
          } else {
            // In browser context - redirect to login page
            window.location.href = '/login';
          }
        }
      }
    }
    
    // Original error handling
    if (error.response) {
      console.error('API Error Response:', {
        data: error.response.data,
        status: error.response.status,
        headers: error.response.headers,
        url: error.config?.url,
      });
    } else if (error.request) {
      console.error('API No Response:', {
        request: error.request,
        message: 'No response received from server. Is the backend running?',
        url: error.config?.url,
        baseURL: error.config?.baseURL,
      });
      console.log('Backend connectivity issue. Make sure Django server is running at:', API_BASE_URL);
    } else {
      console.error('API Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Helper function for retry logic
const apiCallWithRetry = async (apiCall, retryCount = 3, initialDelayMs = 1000) => {
  let lastError;
  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      // Only retry network or timeout errors
      if (!error.code || (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED')) {
        throw error;
      }
      
      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
};

// Define API endpoints
const api = {
  // Check API connectivity
  checkBackendConnection: async () => {
    try {
      const response = await apiClient.get('/api/');
      console.log('Backend connection successful');
      return true;
    } catch (error) {
      console.error('Backend connection failed:', error.message);
      return false;
    }
  },

  // Auth endpoints
  login: async (credentials) => {
    try {
      const response = await apiCallWithRetry(() => apiClient.post('/api/token/', credentials));
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  teamsAuth: async (token) => {
    try {
      const response = await apiClient.post('/api/auth/teams/', { token });
      return response.data;
    } catch (error) {
      console.error('Teams authentication error:', error);
      throw error;
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await apiClient.get('/api/auth/me/');
      return response.data;
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw error;
    }
  },

  refreshToken: async (refreshToken) => {
    try {
      const response = await apiClient.post('/api/token/refresh/', { refresh: refreshToken });
      return response.data;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  },

  // Task Challenges
  getTaskChallenges: async () => {
    try {
      const response = await apiClient.get('/api/task-challenges/');
      return response.data;
    } catch (error) {
      console.error('Error fetching task challenges:', error);
      throw error;
    }
  },

  getTaskChallenge: async (challengeId) => {
    try {
      const response = await apiClient.get(`/api/task-challenges/${challengeId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching task challenge ${challengeId}:`, error);
      throw error;
    }
  },

  createTaskChallenge: async (challengeData) => {
    try {
      const response = await apiClient.post('/api/task-challenges/', challengeData);
      return response.data;
    } catch (error) {
      console.error('Error creating task challenge:', error);
      throw error;
    }
  },

  updateTaskChallenge: async (challengeId, challengeData) => {
    try {
      const response = await apiClient.put(`/api/task-challenges/${challengeId}/`, challengeData);
      return response.data;
    } catch (error) {
      console.error(`Error updating task challenge ${challengeId}:`, error);
      throw error;
    }
  },

  deleteTaskChallenge: async (challengeId) => {
    try {
      const response = await apiClient.delete(`/api/task-challenges/${challengeId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting task challenge ${challengeId}:`, error);
      throw error;
    }
  },

  getTaskChallengesByTask: async (taskId) => {
    try {
      const response = await apiClient.get(`/api/task-challenges/by_task/?task_id=${taskId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching challenges for task ${taskId}:`, error);
      throw error;
    }
  }
};

export default api;