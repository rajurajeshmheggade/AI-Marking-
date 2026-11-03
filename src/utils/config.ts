// src/utils/config.ts
export const getApiBaseUrl = () => {
    if (import.meta.env.DEV) {
      return import.meta.env.VITE_LOCAL_PROXY || 'http://localhost:5000/api'; // Local proxy
    }
    return import.meta.env.VITE_AI_EXCELSOFT_BASE || 'https://ai.excelsoftcorp.com';
  };