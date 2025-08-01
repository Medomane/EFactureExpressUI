import { API_BASE_URL } from '../../../config/api';

export const INVOICE_ENDPOINTS = {
  LIST: `${API_BASE_URL}/invoices`,
  CREATE: `${API_BASE_URL}/invoices`,
  UPDATE: (id: number) => `${API_BASE_URL}/invoices/${id}`,
  DELETE: (id: number) => `${API_BASE_URL}/invoices/${id}`,
  PDF: (id: number) => `${API_BASE_URL}/invoices/${id}/pdf-url`,
  JSON: (id: number) => `${API_BASE_URL}/invoices/${id}/json-url`,
  IMPORT: `${API_BASE_URL}/invoices/import-csv`,
  SUBMIT: (id: number) => `${API_BASE_URL}/invoices/${id}/dgi-submit`,
  DGI_STATUS: (id: number) => `${API_BASE_URL}/invoices/${id}/dgi-status`,
};