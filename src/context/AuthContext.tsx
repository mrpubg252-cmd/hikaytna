import React, { createContext, useContext } from 'react';

interface AuthContextType {
  user: any | null;
  profile: any | null;
  loading: boolean;
  checkReferral: (referrerId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthContext.Provider value={{ 
      user: null, 
      profile: null, 
      loading: false, 
      checkReferral: async () => {},
      signOut: async () => {}
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
