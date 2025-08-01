import { API_BASE_URL } from '../../../config/api';

export const QUOTE_ENDPOINTS = {
  LIST: `${API_BASE_URL}/quotes`,
  CREATE: `${API_BASE_URL}/quotes`,
  UPDATE: (id: number) => `${API_BASE_URL}/quotes/${id}`,
  DELETE: (id: number) => `${API_BASE_URL}/quotes/${id}`,
  PDF: (id: number) => `${API_BASE_URL}/quotes/${id}/pdf`,
  DOWNLOAD_PDF: (id: number) => `${API_BASE_URL}/quotes/${id}/pdf`,
  IMPORT_CSV: `${API_BASE_URL}/quotes/import-csv`,
  SUBMIT: (id: number) => `${API_BASE_URL}/quotes/${id}/submit`,
  UPDATE_STATUS: (id: number) => `${API_BASE_URL}/quotes/${id}/status`,
  CONVERT_TO_INVOICE: (id: number) => `${API_BASE_URL}/quotes/${id}/convert-to-invoice`,
  BULK_DELETE: `${API_BASE_URL}/quotes/bulk-delete`,
  BULK_SUBMIT: `${API_BASE_URL}/quotes/bulk-submit`,
};