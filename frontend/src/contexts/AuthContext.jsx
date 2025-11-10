import { createContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check for stored user data and validate token
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (token && storedUser) {
        try {
          // Verify token is still valid by fetching current user
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        } catch {
          // Token is invalid, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      const { user: userData } = await authService.login(credentials);
      
      // Ensure user data is properly stored and set
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      return userData;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      const { user: newUser } = await authService.register(userData);
      
      // Ensure user data is properly stored and set
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
      
      return newUser;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setError(null);
    }
  };

  const updateUser = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      const updatedUser = await authService.updateProfile(userData);
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (passwordData) => {
    try {
      setLoading(true);
      setError(null);
      await authService.changePassword(passwordData);
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email) => {
    try {
      setError(null);
      await authService.forgotPassword(email);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const resetPassword = async (token, newPassword) => {
    try {
      setError(null);
      await authService.resetPassword(token, newPassword);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const verifyEmail = async (token) => {
    try {
      setError(null);
      await authService.verifyEmail(token);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const resendVerification = async () => {
    try {
      setError(null);
      await authService.resendVerification();
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const socialLogin = async (provider, token) => {
    try {
      setLoading(true);
      setError(null);
      const { user: userData } = await authService.socialLogin(provider, token);
      setUser(userData);
      return userData;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateUser,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
    socialLogin,
    clearError,
    isAuthenticated: !!user,
    isBuyer: user?.role === 'buyer',
    isTenant: user?.role === 'tenant',
    isOwner: user?.role === 'owner',
    isAgent: user?.role === 'agent',
    isBroker: user?.role === 'broker',
    isBuilder: user?.role === 'builder',
    isDeveloper: user?.role === 'developer',
    isAdmin: user?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
