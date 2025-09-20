import { 
  LoginRequest, 
  LoginResponse, 
  SignupRequest, 
  SessionCreateRequest,
  SessionCreateResponse,
  FinishSessionRequest,
  SessionListResponse,
  PaginationQuery,
  ApiResponse 
} from './server/validation';

// Base API configuration
const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000';

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Helper to handle API responses
async function handleApiResponse<T>(response: Response): Promise<T> {
  let data;
  
  try {
    data = await response.json();
  } catch (error) {
    throw new ApiError('PARSE_ERROR', 'Failed to parse response', response.status);
  }

  if (!response.ok) {
    if (data && data.error) {
      throw new ApiError(data.error.code || 'API_ERROR', data.error.message, response.status);
    }
    throw new ApiError('HTTP_ERROR', `HTTP ${response.status}`, response.status);
  }

  if (data.success === false) {
    throw new ApiError(data.error.code || 'API_ERROR', data.error.message);
  }

  return data.success ? data.data : data;
}

// Helper to make API requests with automatic error handling
async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // Important for httpOnly cookies
  };

  // Add access token if available
  const accessToken = getStoredAccessToken();
  if (accessToken) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  try {
    const response = await fetch(url, config);
    return await handleApiResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      // Handle token refresh for 401 errors
      if (error.status === 401 && accessToken) {
        try {
          await refreshAccessToken();
          // Retry the request with new token
          const newToken = getStoredAccessToken();
          if (newToken) {
            config.headers = {
              ...config.headers,
              'Authorization': `Bearer ${newToken}`,
            };
            const retryResponse = await fetch(url, config);
            return await handleApiResponse<T>(retryResponse);
          }
        } catch (refreshError) {
          // Refresh failed, redirect to login
          clearAuthTokens();
          throw new ApiError('AUTH_REQUIRED', 'Authentication required');
        }
      }
      throw error;
    }
    
    throw new ApiError('NETWORK_ERROR', 'Network request failed');
  }
}

// Token management helpers
function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

function setStoredAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', token);
}

function clearAuthTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  // Refresh token is handled by httpOnly cookie, cleared by logout endpoint
}

// Refresh token function
async function refreshAccessToken(): Promise<string> {
  const response = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  const data = await response.json();
  
  if (!response.ok || !data.success) {
    throw new ApiError('REFRESH_FAILED', 'Token refresh failed');
  }

  const newToken = data.data.accessToken;
  setStoredAccessToken(newToken);
  return newToken;
}

// API Client class
export class ApiClient {
  // Auth endpoints
  static async signup(request: SignupRequest): Promise<{ message: string }> {
    return apiRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  static async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    
    // Store access token
    setStoredAccessToken(response.accessToken);
    return response;
  }

  static async logout(): Promise<{ message: string }> {
    try {
      const response = await apiRequest<{ message: string }>('/api/auth/logout', {
        method: 'POST',
      });
      clearAuthTokens();
      return response;
    } catch (error) {
      // Always clear tokens on logout, even if server request fails
      clearAuthTokens();
      throw error;
    }
  }

  static async refreshToken(): Promise<{ accessToken: string }> {
    const newToken = await refreshAccessToken();
    return { accessToken: newToken };
  }

  static async verifyEmail(token: string): Promise<{ message: string }> {
    return apiRequest(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    });
  }

  static async resendVerification(email: string): Promise<{ message: string }> {
    return apiRequest('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Session endpoints
  static async startSession(request: SessionCreateRequest): Promise<SessionCreateResponse> {
    return apiRequest('/api/sessions/start', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  static async finishSession(
    sessionId: string, 
    request: FinishSessionRequest
  ): Promise<{ message: string }> {
    return apiRequest(`/api/sessions/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  static async getSessionList(query: Partial<PaginationQuery> = {}): Promise<SessionListResponse> {
    const params = new URLSearchParams();
    
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.hideLowQuality) params.append('hideLowQuality', query.hideLowQuality.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/api/sessions?${queryString}` : '/api/sessions';
    
    return apiRequest(endpoint);
  }

  static async getSessionDetail(sessionId: string): Promise<any> {
    return apiRequest(`/api/sessions/${sessionId}`);
  }

  // Health endpoint
  static async getHealth(): Promise<{ status: string; timestamp: string }> {
    return apiRequest('/api/health');
  }
}

// Export individual functions for convenience
export const auth = {
  signup: ApiClient.signup,
  login: ApiClient.login,
  logout: ApiClient.logout,
  refreshToken: ApiClient.refreshToken,
  verifyEmail: ApiClient.verifyEmail,
  resendVerification: ApiClient.resendVerification,
};

export const sessions = {
  start: ApiClient.startSession,
  finish: ApiClient.finishSession,
  list: ApiClient.getSessionList,
  get: ApiClient.getSessionDetail,
};

export const health = {
  check: ApiClient.getHealth,
};

// Export types and errors
export { ApiError, type ApiResponse };

// Token management utilities
export const tokenUtils = {
  getAccessToken: getStoredAccessToken,
  setAccessToken: setStoredAccessToken,
  clearTokens: clearAuthTokens,
  refresh: refreshAccessToken,
};