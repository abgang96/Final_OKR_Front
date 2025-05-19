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
  // Check API connectivity (new method)
  checkBackendConnection: async () => {
    try {
      // Simple endpoint that should always be available
      const response = await apiClient.get('/api/');
      console.log('Backend connection successful');
      return true;
    } catch (error) {
      console.error('Backend connection failed:', error.message);
      return false;
    }
  },
  
  // Auth (Note: Your actual backend may have different auth endpoints)
  login: async (credentials) => {
    try {
      // This endpoint might need to be updated based on your actual backend auth endpoints
      const response = await apiCallWithRetry(() => apiClient.post('/api/token/', credentials));
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },
  
  // Teams authentication endpoints
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

  // Departments
  getDepartments: async () => {
    try {
      console.log('Fetching departments from:', `${API_BASE_URL}/api/departments/`);
      const response = await apiCallWithRetry(() => apiClient.get('/api/departments/'));
      console.log('Departments fetched successfully:', response.data);
      // Return empty array if the data is null or undefined
      return response.data || [];
    } catch (error) {
      console.error('Error fetching departments:', error);
      // Return empty array on error to prevent UI breaking
      return [];
    }
  },
  
  // Business Units
  getBusinessUnits: async () => {
    try {
      const response = await apiClient.get('/api/business-units/');
      return response.data;
    } catch (error) {
      console.error('Error fetching business units:', error);
      throw error;
    }
  },
  
  getBusinessUnit: async (businessUnitId) => {
    try {
      const response = await apiClient.get(`/api/business-units/${businessUnitId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching business unit ${businessUnitId}:`, error);
      throw error;
    }
  },
  
  createBusinessUnit: async (businessUnitData) => {
    try {
      const response = await apiClient.post('/api/business-units/', businessUnitData);
      return response.data;
    } catch (error) {
      console.error('Error creating business unit:', error);
      throw error;
    }
  },
  
  updateBusinessUnit: async (businessUnitId, businessUnitData) => {
    try {
      const response = await apiClient.put(`/api/business-units/${businessUnitId}/`, businessUnitData);
      return response.data;
    } catch (error) {
      console.error(`Error updating business unit ${businessUnitId}:`, error);
      throw error;
    }
  },
  
  deleteBusinessUnit: async (businessUnitId) => {
    try {
      const response = await apiClient.delete(`/api/business-units/${businessUnitId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting business unit ${businessUnitId}:`, error);
      throw error;
    }
  },
  
  // OKR Business Units
  getOKRBusinessUnits: async (okrId) => {
    try {
      const response = await apiClient.get(`/api/okrs/${okrId}/business_units/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching business units for OKR ${okrId}:`, error);
      throw error;
    }
  },
  
  assignBusinessUnitsToOKR: async (okrId, businessUnitIds) => {
    try {
      const response = await apiClient.post(`/api/okrs/${okrId}/assign_business_units/`, businessUnitIds);
      return response.data;
    } catch (error) {
      console.error(`Error assigning business units to OKR ${okrId}:`, error);
      throw error;
    }
  },
  
  // Users
  getUsers: async (searchQuery = '', limit = 100) => {
    try {
      const endpoint = '/api/users/';
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append('search', searchQuery);
      if (limit) queryParams.append('limit', limit);
      
      const queryString = queryParams.toString();
      const url = `${endpoint}${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiCallWithRetry(() => apiClient.get(url), 3, 2000);
      console.log('Users fetched successfully:', response.data);
      return response.data?.results || response.data || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  },
  
  getUser: async (userId) => {
    try {
      const response = await apiClient.get(`/api/users/${userId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      throw error;
    }
  },
  
  // OKRs
  getOKRs: async () => {
    try {
      const response = await apiClient.get('/api/okrs/');
      return response.data;
    } catch (error) {
      console.error('Error fetching OKRs:', error);
      throw error;
    }
  },
  
  getOKR: async (okrId) => {
    try {
      const response = await apiClient.get(`/api/okrs/${okrId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching OKR ${okrId}:`, error);
      throw error;
    }
  },
  
  createOKR: async (okrData) => {
    try {
      // Transform the data format to match what the backend expects
      const transformedData = {
        ...okrData,
        // Map title to name if title exists
        name: okrData.title,
        // For user mappings - convert assigned_users to the format backend expects
        assigned_user_ids: okrData.assigned_user_ids || [],
        // Set primary user
        primary_user_id: okrData.primary_user_id || null,
        // Use business_unit_ids if it exists
        business_unit_ids: okrData.business_unit_ids || []
      };
      
      // Remove title field as we've transformed it to name
      if (transformedData.title) {
        delete transformedData.title;
      }
      
      // Log the transformed data being sent
      console.log('Data being sent to create OKR API:', {
        endpoint: '/api/okrs/',
        original: okrData,
        transformed: transformedData
      });
      
      // Handle the multi-user assignment and business units in the backend
      const response = await apiClient.post('/api/okrs/', transformedData);
      return response.data;
    } catch (error) {
      console.error('Error creating OKR:', error);
      throw error;
    }
  },
  
  updateOKR: async (okrId, okrData) => {
    try {
      // Transform the data format to match what the backend expects
      const transformedData = {
        ...okrData,
        // For user mappings - convert assigned_users to the format backend expects
        assigned_user_ids: okrData.assigned_users ? 
          okrData.assigned_users.map(user => user.user_id) : 
          [],
        // Set primary user
        primary_user_id: okrData.assigned_users ? 
          okrData.assigned_users.find(user => user.is_primary)?.user_id : 
          null,
        // Use business_unit_ids if it exists, otherwise use business_units
        business_unit_ids: okrData.business_unit_ids || okrData.business_units || []
      };
      
      // Remove fields the backend doesn't expect
      if (transformedData.assigned_users) {
        delete transformedData.assigned_users;
      }
      
      if (transformedData.business_units && transformedData.business_unit_ids) {
        delete transformedData.business_units;
      }
      
      // Log the transformed data being sent
      console.log('Data being sent to update OKR API:', {
        endpoint: `/api/okrs/${okrId}/`,
        original: okrData,
        transformed: transformedData
      });
      
      // Send the request
      const response = await apiClient.put(`/api/okrs/${okrId}/`, transformedData);
      return response.data;
    } catch (error) {
      console.error(`Error updating OKR ${okrId}:`, error);
      throw error;
    }
  },
  
  deleteOKR: async (okrId) => {
    try {
      const response = await apiClient.delete(`/api/okrs/${okrId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting OKR ${okrId}:`, error);
      throw error;
    }
  },
  
  // Child OKRs - Get OKRs with a specific parent_okr
  getChildOKRs: async (parentOkrId) => {
    try {
      const response = await apiClient.get(`/api/okrs/?parent_okr=${parentOkrId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching child OKRs for parent ${parentOkrId}:`, error);
      throw error;
    }
  },
  
  // Get assigned users for an OKR
  getOKRAssignedUsers: async (okrId) => {
    try {
      const response = await apiClient.get(`/api/okrs/${okrId}/assigned_users/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching assigned users for OKR ${okrId}:`, error);
      throw error;
    }
  },
  
  // Add a user to an OKR 
  addUserToOKR: async (okrId, userData) => {
    try {
      const response = await apiClient.post(`/api/okrs/${okrId}/assign_user/`, userData);
      return response.data;
    } catch (error) {
      console.error(`Error adding user to OKR ${okrId}:`, error);
      throw error;
    }
  },
  
  // Remove a user from an OKR
  removeUserFromOKR: async (okrId, userId) => {
    try {
      const response = await apiClient.delete(`/api/okrs/${okrId}/remove_user/${userId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error removing user from OKR ${okrId}:`, error);
      throw error;
    }
  },
  
  // Set a user as primary for an OKR
  setPrimaryUserForOKR: async (okrId, userId) => {
    try {
      const response = await apiClient.post(`/api/okrs/${okrId}/set_primary_user/`, { user_id: userId });
      return response.data;
    } catch (error) {
      console.error(`Error setting primary user for OKR ${okrId}:`, error);
      throw error;
    }
  },
  
  // Tasks
  getTasks: async () => {
    try {
      const response = await apiClient.get('/api/tasks/');
      return response.data;
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  },
  
  getTask: async (taskId) => {
    try {
      const response = await apiClient.get(`/api/tasks/${taskId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching task ${taskId}:`, error);
      throw error;
    }
  },
  
  createTask: async (taskData) => {
    try {
      const response = await apiClient.post('/api/tasks/', taskData);
      return response.data;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },
  
  updateTask: async (taskId, taskData) => {
    try {
      const response = await apiClient.put(`/api/tasks/${taskId}/`, taskData);
      return response.data;
    } catch (error) {
      console.error(`Error updating task ${taskId}:`, error);
      throw error;
    }
  },
  
  deleteTask: async (taskId) => {
    try {
      const response = await apiClient.delete(`/api/tasks/${taskId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting task ${taskId}:`, error);
      throw error;
    }
  },
  
  // OKR Tasks - Get tasks for a specific OKR
  getOKRTasks: async (okrId) => {
    try {
      const response = await apiClient.get(`/api/tasks/?linked_to_okr=${okrId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching tasks for OKR ${okrId}:`, error);
      throw error;
    }
  },
  
  // User-specific OKRs - now supports both assigned_to (legacy) and okr_user_mappings
  getUserOKRs: async (userId) => {
    try {
      const response = await apiClient.get(`/api/okrs/user/${userId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching OKRs for user ${userId}:`, error);
      throw error;
    }
  },
  
  // User-specific tasks
  getUserTasks: async (userId) => {
    try {
      const response = await apiClient.get(`/api/tasks/?assigned_to=${userId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching tasks for user ${userId}:`, error);
      throw error;
    }
  },

  // TaskChallenges
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
  
  // Get challenges for a specific task
  getTaskChallengesByTask: async (taskId) => {
    try {
      const response = await apiClient.get(`/api/task-challenges/by_task/?task_id=${taskId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching challenges for task ${taskId}:`, error);
      throw error;
    }
  },
};

export default api;