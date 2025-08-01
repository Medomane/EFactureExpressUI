import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { Company } from "./types/common";
import { Invoice, NewInvoice } from "./domains/invoices/types/invoice.types";
import Dashboard from "./domains/dashboard/components/Dashboard";
import InvoiceList from "./domains/invoices/components/InvoiceList";
import ImportCSV from "./domains/invoices/components/ImportCSV";
import InvoiceForm from "./domains/invoices/components/InvoiceForm";
import QuoteManagement from "./domains/quotes/components/QuoteManagement";
import LoginPage from "./domains/auth/components/LoginPage";
import RegisterPage from "./domains/auth/components/RegisterPage";
import Users from "./domains/users/components/Users";
import { API_BASE_URL, getAuthHeaders, getSecureJsonHeaders, getSecureHeaders, getJsonHeaders } from "./config/api";
import { AUTH_ENDPOINTS } from "./domains/auth/api/auth.endpoints";
import { INVOICE_ENDPOINTS } from "./domains/invoices/api/invoice.endpoints";
import { APP_CONFIG } from "./config/app";
import { Toaster, toast } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorPage from './components/ErrorPage';
import { useTranslation } from 'react-i18next';
import ProtectedRoute from './components/ProtectedRoute';
import { decodeJWT } from "./utils/jwt";
import { tokenManager } from "./utils/tokenManager";
import CompanyProfile from "./components/CompanyProfile";
import CustomerCRUD from "./domains/customers/components/CustomerCRUD";

function App() {
  const { t, i18n } = useTranslation();
  // ─── AUTH STATE ───────────────────────────────────────────────────────────
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = tokenManager.getToken();
    if (storedToken) {
      const decoded = decodeJWT(storedToken);
      if (!decoded || (decoded.exp && decoded.exp * 1000 < Date.now())) {
        tokenManager.clearAuthData();
        return null;
      }
      return storedToken;
    }
    return null;
  });

  const [company, setCompany] = useState<Company | null>(() => {
    const storedCompany = tokenManager.getCompanyData();
    return storedCompany;
  });

  // ─── LISTING STATE ─────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceListData, setInvoiceListData] = useState<any>(null);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  // ─── LANGUAGE STATE ───────────────────────────────────────────────────────
  const [language] = useState(() => {
    const savedLanguage = localStorage.getItem('language');
    return savedLanguage || 'fr';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    i18n.changeLanguage(language);
  }, [language, i18n]);

  // Handle token refresh events
  useEffect(() => {
    const handleTokenRefresh = (event: CustomEvent) => {
      const newToken = event.detail?.token;
      if (newToken) {
        setToken(newToken);
        toast.success(t('auth.tokenRefreshed'));
      }
    };

    const handleTokenRefreshFailed = () => {
      setToken(null);
      setCompany(null);
      toast.error(t('auth.tokenRefreshFailed'));
    };

    window.addEventListener('tokenRefreshed', handleTokenRefresh as EventListener);
    window.addEventListener('tokenRefreshFailed', handleTokenRefreshFailed);

    return () => {
      window.removeEventListener('tokenRefreshed', handleTokenRefresh as EventListener);
      window.removeEventListener('tokenRefreshFailed', handleTokenRefreshFailed);
    };
  }, [t]);

  // ─── ACCOUNT DROPDOWN ──────────────────────────────────────────────────────
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const decoded = useMemo(() => token ? decodeJWT(token) : null, [token]);
  const userEmail = useMemo(() => decoded?.email || '', [decoded]);
  const userRole = useMemo(() => decoded?.role || tokenManager.getUserRole(), [decoded]);

  // ─── OPTIMISTIC UPDATES ───────────────────────────────────────────────────
  const optimisticallyUpdateInvoice = useCallback((updatedInvoice: Invoice) => {
    try {
      setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));
    } catch (error) {
      // Error updating invoice optimistically
    }
  }, []);

  const optimisticallyRemoveInvoice = useCallback((id: number) => {
    try {
      setInvoices(prev => prev.filter(inv => inv.id !== id));
    } catch (error) {
      // Error removing invoice optimistically
    }
  }, []);

  const optimisticallyAddInvoice = useCallback((newInvoice: Invoice) => {
    try {
      setInvoices(prev => [newInvoice, ...prev]);
    } catch (error) {
      // Error adding invoice optimistically
    }
  }, []);

  const optimisticallyUpdateInvoiceStatus = useCallback((id: number, newStatus: number, dgiSubmissionId?: string, dgiRejectionReason?: string) => {
    try {
      // Update the invoices state
      setInvoices(prev => prev.map(inv => 
        inv.id === id 
          ? { 
              ...inv, 
              status: newStatus, 
              dgiSubmissionId: dgiSubmissionId || inv.dgiSubmissionId,
              dgiRejectionReason: dgiRejectionReason || inv.dgiRejectionReason
            }
          : inv
      ));
      
      // Also update the invoiceListData state
      setInvoiceListData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          invoices: prev.invoices.map((inv: any) => 
            inv.id === id 
              ? { 
                  ...inv, 
                  status: newStatus, 
                  dgiSubmissionId: dgiSubmissionId || inv.dgiSubmissionId,
                  dgiRejectionReason: dgiRejectionReason || inv.dgiRejectionReason
                }
              : inv
          )
        };
      });
    } catch (error) {
      // Error updating invoice status optimistically
    }
  }, []);

  // Silent update functions that preserve sorting/filtering
  const silentlyUpdateInvoiceInList = useCallback((updatedInvoice: any) => {
    setInvoiceListData((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        invoices: prev.invoices.map((inv: any) => 
          inv.id === updatedInvoice.id ? updatedInvoice : inv
        )
      };
    });
  }, []);

  const silentlyAddInvoiceToList = useCallback((newInvoice: any) => {
    setInvoiceListData((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        invoices: [newInvoice, ...prev.invoices],
        pagination: {
          ...prev.pagination,
          totalItems: prev.pagination.totalItems + 1,
          totalPages: Math.ceil((prev.pagination.totalItems + 1) / prev.pagination.pageSize)
        }
      };
    });
  }, []);

  /*const silentlyRemoveInvoiceFromList = useCallback((id: number) => {
    setInvoiceListData((prev: any) => {
      if (!prev) return prev;
      const updatedInvoices = prev.invoices.filter((inv: any) => inv.id !== id);
      return {
        ...prev,
        invoices: updatedInvoices,
        pagination: {
          ...prev.pagination,
          totalItems: prev.pagination.totalItems - 1,
          totalPages: Math.ceil((prev.pagination.totalItems - 1) / prev.pagination.pageSize)
        }
      };
    });
  }, []);*/

  // ─── FETCH DASHBOARD STATS ─────────────────────────────────────────────────
  const fetchDashboardStats = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
        headers: getAuthHeaders(token),
      });
      
      if (response.status === 401) {
        tokenManager.clearAuthData();
        setToken(null);
        return;
      }
      
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      const data = await response.json();
      setDashboardStats(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.anErrorOccurred'));
    } finally {
      setDashboardLoading(false);
    }
  }, [token, t]);

  // ─── FETCH LIST ────────────────────────────────────────────────────────────
  const fetchInvoices = useCallback(async (filters?: any, sort?: any, pagination?: any) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters
      if (filters) {
        if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
        if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
        if (filters.customerName) queryParams.append('customerName', filters.customerName);
        if (filters.status !== 'all') queryParams.append('status', filters.status);
        if (filters.amountFrom) queryParams.append('amountFrom', filters.amountFrom);
        if (filters.amountTo) queryParams.append('amountTo', filters.amountTo);
      }
      
      // Add sorting
      if (sort) {
        queryParams.append('sortField', sort.sortField);
        queryParams.append('sortDirection', sort.sortDirection);
      }
      
      // Add pagination
      if (pagination) {
        queryParams.append('page', pagination.page.toString());
        queryParams.append('pageSize', pagination.pageSize.toString());
      }
      
      const url = `${INVOICE_ENDPOINTS.LIST}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url, {
        headers: getAuthHeaders(token),
      });
      
      if (response.status === 401) {
        tokenManager.clearAuthData();
        setToken(null);
        return;
      }
      
      if (!response.ok) throw new Error("Failed to fetch invoices");
      const data = await response.json();
      setInvoiceListData(data);
      
      // Keep the old invoices state for backward compatibility
      setInvoices(data.invoices || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.anErrorOccurred'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (token) {
      fetchInvoices();
      fetchDashboardStats();
    }
  }, [token, fetchInvoices, fetchDashboardStats]);

  // ─── HANDLERS ─────────────────────────────────────────────────────────────
  const handleLogin = useCallback(async (email: string, password: string) => {
          const response = await fetch(AUTH_ENDPOINTS.LOGIN, {
      method: "POST",
      headers: getJsonHeaders(), // Using regular headers for login (no CSRF required)
      body: JSON.stringify({ email: email.trim(), password: password.trim() }),
    });

    if (!response.ok) {
      throw new Error(t('errors.invalidCredentials'));
    }

    const data = await response.json();
    
    if (!data.token) {
      throw new Error(t('errors.invalidResponse'));
    }

    // Extract user info from JWT token
    const decoded = decodeJWT(data.token);
    if (!decoded) {
      throw new Error(t('errors.invalidResponse'));
    }
    if (!decoded.role) {
      throw new Error(t('errors.invalidRole'));
    }
    if (!decoded.userId) {
      throw new Error(t('errors.invalidUserId'));
    }

    // Store token and refresh token if available
    tokenManager.setToken(data.token, data.refreshToken);
    tokenManager.setUserData(decoded.role, decoded.userId, data.company);
    if (data.company) {
      setCompany(data.company);
    }
    setToken(data.token);    
  }, [t]);

  const handleLogout = useCallback(async () => {
    try {
      // Call backend logout endpoint to clear CSRF cookie
      await fetch(AUTH_ENDPOINTS.LOGOUT, {
        method: 'POST',
        headers: getSecureHeaders(token),
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Clear frontend auth data
      tokenManager.clearAuthData();
      setToken(null);
      setCompany(null);
    }
  }, [token]);

  const handleCreateInvoice = useCallback(async (newInvoice: NewInvoice, customerName?: string) => {
    try {
      // Optimistically add a temporary invoice
      const tempInvoice: Invoice = {
        id: Date.now(), // Temporary ID
        invoiceNumber: newInvoice.invoiceNumber,
        date: newInvoice.date,
        customer: { id: newInvoice.customerId, name: customerName || 'Unknown Customer' }, // Use actual customer name
        subTotal: newInvoice.subTotal,
        vat: newInvoice.vat,
        total: newInvoice.total,
        status: newInvoice.status,
        lines: newInvoice.lines.map(line => ({
          id: Date.now() + Math.random(), // Temporary ID
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: line.quantity * line.unitPrice,
          invoiceId: Date.now(), // Temporary invoice ID
          taxRate: line.taxRate
        })),
        createdAt: new Date().toISOString(),
        createdBy: {
          createdById: '',
          name: userEmail.split('@')[0] || 'User', // Use email prefix as name
          email: userEmail
        }
      };
      
      optimisticallyAddInvoice(tempInvoice);

      const response = await fetch(INVOICE_ENDPOINTS.CREATE, {
        method: "POST",
        headers: getSecureJsonHeaders(token),
        body: JSON.stringify(newInvoice),
      });

      if (response.status === 401) {
        tokenManager.clearAuthData();
        setToken(null);
        // Revert optimistic update
        optimisticallyRemoveInvoice(tempInvoice.id);
        return;
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        // Revert optimistic update
        optimisticallyRemoveInvoice(tempInvoice.id);
        throw errorData;
      }
      
      // Check if response has content before trying to parse
      const responseText = await response.text();
      
      if (responseText.trim()) {
        try {
          const createdInvoice = JSON.parse(responseText);
          // Replace temporary invoice with real one
          optimisticallyRemoveInvoice(tempInvoice.id);
          optimisticallyAddInvoice(createdInvoice);
          // Silently add to the list data to preserve sorting/filtering
          silentlyAddInvoiceToList(createdInvoice);
        } catch (parseError) {
          // If response is not valid JSON, just remove the temporary invoice
          optimisticallyRemoveInvoice(tempInvoice.id);
        }
      } else {
        // If response is empty, just remove the temporary invoice
        optimisticallyRemoveInvoice(tempInvoice.id);
      }
      
      toast.success(t('success.invoiceCreated'));
    } catch (err: any) {
      // Revert any optimistic updates that might have been applied
      if (err.tempInvoiceId) {
        optimisticallyRemoveInvoice(err.tempInvoiceId);
      }
      throw err;
    }
  }, [token, userEmail, t, optimisticallyAddInvoice, optimisticallyRemoveInvoice, silentlyAddInvoiceToList]);

  const handleUpdateInvoice = useCallback(async (invoice: NewInvoice, customerName?: string) => {
    if (!invoice.id) {
      toast.error(t('errors.failedToUpdateInvoice'));
      return;
    }

    try {
      // Store original invoice for rollback
      const originalInvoice = invoices.find(inv => inv.id === invoice.id);
      if (!originalInvoice) throw new Error('Invoice not found');

      // Optimistically update the invoice
      const updatedInvoice: Invoice = {
        ...originalInvoice,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        customer: { 
          id: invoice.customerId, 
          name: customerName || originalInvoice.customer.name 
        },
        subTotal: invoice.subTotal,
        vat: invoice.vat,
        total: invoice.total,
        status: invoice.status,
        lines: invoice.lines.map(line => ({
          id: Date.now() + Math.random(), // Temporary ID for new lines
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: line.quantity * line.unitPrice,
          invoiceId: invoice.id!, // Use the invoice ID
          taxRate: line.taxRate
        }))
      };
      
      optimisticallyUpdateInvoice(updatedInvoice);

      const response = await fetch(INVOICE_ENDPOINTS.UPDATE(invoice.id), {
        method: "PUT",
        headers: getSecureJsonHeaders(token),
        body: JSON.stringify(invoice),
      });

      if (response.status === 401) {
        tokenManager.clearAuthData();
        setToken(null);
        // Revert optimistic update
        optimisticallyUpdateInvoice(originalInvoice);
        return;
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        // Revert optimistic update
        optimisticallyUpdateInvoice(originalInvoice);
        throw errorData;
      }
      
      // Check if response has content before trying to parse
      const responseText = await response.text();
      if (responseText.trim()) {
        try {
          const serverUpdatedInvoice = JSON.parse(responseText);
          // Update with server response to ensure consistency
          optimisticallyUpdateInvoice(serverUpdatedInvoice);
          // Silently update the list data to preserve sorting/filtering
          silentlyUpdateInvoiceInList(serverUpdatedInvoice);
        } catch (parseError) {
          // If response is not valid JSON, keep the optimistic update
          // Still update the list data with our optimistic update
          silentlyUpdateInvoiceInList(updatedInvoice);
        }
      } else {
        // If response is empty, keep the optimistic update
        // Still update the list data with our optimistic update
        silentlyUpdateInvoiceInList(updatedInvoice);
      }
      
      toast.success(t('success.invoiceUpdated'));
    } catch (err: any) {
      throw err;
    }
  }, [token, invoices, t, optimisticallyUpdateInvoice, silentlyUpdateInvoiceInList]);

  const handleDeleteInvoice = useCallback(async (id: number) => {
    const toastId = toast.loading(t('common.deletingInvoice'));
    
    // Store original data for rollback
    const originalData = invoiceListData;
    const originalInvoice = invoices.find(inv => inv.id === id);
    if (!originalInvoice) {
      toast.error(t('errors.invoiceNotFound'), { id: toastId });
      return;
    }

    // Check if this deletion will make the page incomplete
    const willPageBeIncomplete = invoiceListData && 
      invoiceListData.invoices.length === invoiceListData.pagination.pageSize && 
      invoiceListData.pagination.page < invoiceListData.pagination.totalPages;

    try {
      // Optimistically remove the invoice from both states
      optimisticallyRemoveInvoice(id);
      
      // Optimistically update the server-side data
      if (invoiceListData) {
        setInvoiceListData((prev: any) => {
          if (!prev) return prev;
          const updatedInvoices = prev.invoices.filter((inv: any) => inv.id !== id);
          
          return {
            ...prev,
            invoices: updatedInvoices,
            pagination: {
              ...prev.pagination,
              totalItems: prev.pagination.totalItems - 1,
              totalPages: Math.ceil((prev.pagination.totalItems - 1) / prev.pagination.pageSize)
            }
          };
        });
      }

      const response = await fetch(INVOICE_ENDPOINTS.DELETE(id), {
        method: "DELETE",
        headers: getSecureHeaders(token),
      });

      if (response.status === 401) {
        tokenManager.clearAuthData();
        setToken(null);
        // Revert optimistic updates
        optimisticallyAddInvoice(originalInvoice);
        setInvoiceListData(originalData);
        toast.error(t('errors.sessionExpired'), { id: toastId });
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: t('errors.failedToDeleteInvoice') }));
        // Revert optimistic updates
        optimisticallyAddInvoice(originalInvoice);
        setInvoiceListData(originalData);
        throw new Error(errorData.message || t('errors.failedToDeleteInvoice'));
      }
      
      // If the page will be incomplete, refresh the current page data
      if (willPageBeIncomplete) {
        // Silently refresh the current page to get the missing items
        const queryParams = new URLSearchParams();
        queryParams.append('page', invoiceListData!.pagination.page.toString());
        queryParams.append('pageSize', invoiceListData!.pagination.pageSize.toString());
        
        try {
          const response = await fetch(`${INVOICE_ENDPOINTS.LIST}?${queryParams.toString()}`, {
            headers: getAuthHeaders(token),
          });
          
          if (response.ok) {
            const refreshedData = await response.json();
            setInvoiceListData(refreshedData);
          }
        } catch (error) {
          // Failed to refresh page data
        }
      }
      
      toast.success(t('success.invoiceDeleted'), { id: toastId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.anErrorOccurred');
      toast.error(errorMessage, { id: toastId });
    }
  }, [token, invoices, invoiceListData, t, optimisticallyRemoveInvoice, optimisticallyAddInvoice]);

  const handleDownloadPdf = useCallback(async (id: number) => {
    const toastId = toast.loading(t('common.downloadingPDF'));
    try {
      const response = await fetch(INVOICE_ENDPOINTS.PDF(id), {
        headers: getAuthHeaders(token),
      });

      if (response.status === 401) {
        tokenManager.clearAuthData();
        setToken(null);
        toast.error(t('errors.sessionExpired'), { id: toastId });
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: t('errors.failedToDownloadPDF') }));
        throw new Error(errorData.message || t('errors.failedToDownloadPDF'));
      }
      const data = await response.json();
      window.open(data.url, '_blank');
      toast.success(t('success.pdfReady'), { id: toastId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.anErrorOccurred');
      toast.error(errorMessage, { id: toastId });
    }
  }, [token, t]);

  const handleSubmitInvoice = useCallback(async (id: number) => {
    const toastId = toast.loading(t('common.submittingInvoice'));
    
    // Store original invoice for rollback
    const originalInvoice = invoices.find(inv => inv.id === id);
    if (!originalInvoice) {
      toast.error(t('errors.invoiceNotFound'), { id: toastId });
      return;
    }

    try {
      // Optimistically update status to "Awaiting Clearance"
      optimisticallyUpdateInvoiceStatus(id, 2);

      const response = await fetch(INVOICE_ENDPOINTS.SUBMIT(id), {
        method: "POST",
        headers: getSecureHeaders(token),
      });

      if (response.status === 401) {
        tokenManager.clearAuthData();
        setToken(null);
        // Revert optimistic update
        optimisticallyUpdateInvoice(originalInvoice);
        toast.error(t('errors.sessionExpired'), { id: toastId });
        return;
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        // Revert optimistic update
        optimisticallyUpdateInvoice(originalInvoice);
        throw new Error(errorData.message || t('errors.failedToSubmitInvoice'));
      }
      
      // Check if response has content before trying to parse
      const responseText = await response.text();
      if (responseText.trim()) {
        try {
          const result = JSON.parse(responseText);
          // Update with server response to get the DGI submission ID
          if (result && result.dgiSubmissionId) {
            optimisticallyUpdateInvoiceStatus(id, 2, result.dgiSubmissionId);
          }
        } catch (parseError) {
          // If response is not valid JSON, keep the optimistic update
        }
      } else {
        // If response is empty, keep the optimistic update
      }
      
      toast.success(t('success.invoiceSubmitted'), { id: toastId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.anErrorOccurred');
      toast.error(errorMessage, { id: toastId });
    }
  }, [token, invoices, t, optimisticallyUpdateInvoiceStatus, optimisticallyUpdateInvoice]);

  const handleImportCSV = useCallback(async (file: File) => {
    setImportLoading(true);
    const toastId = toast.loading(t('common.importingCSV'));
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(INVOICE_ENDPOINTS.IMPORT, {
        method: "POST",
        headers: getSecureHeaders(token),
        body: formData,
      });

      const data = await response.json();

      if (response.status === 401) {
        tokenManager.clearAuthData();
        setToken(null);
        return;
      }

      if (!response.ok) {
        let errorMessages: string[] = [];
        
        // Handle general errors
        if (data.errors && Array.isArray(data.errors)) {
          errorMessages = [...data.errors];
        }
        
        // Handle row-specific errors
        if (data.rowErrors && Array.isArray(data.rowErrors)) {
          const rowErrorMessages = data.rowErrors.map((rowError: { rowNumber: number; errors: string[] }) => {
            return `Row ${rowError.rowNumber}:\n${rowError.errors.join('\n')}`;
          });
          errorMessages = [...errorMessages, ...rowErrorMessages];
        }

        if (errorMessages.length > 0) {
          throw new Error(errorMessages.join('\n'));
        }
        
        throw new Error(t('errors.failedToImportCSV'));
      }
      
      await fetchInvoices();
      toast.success(t('success.csvImported'), { id: toastId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.anErrorOccurred');
      // If the error message contains multiple lines (from array of errors), show them in a more readable format
      const displayMessage = errorMessage.includes('\n') 
        ? `${t('errors.failedToImportCSV')}:\n${errorMessage}`
        : `${t('errors.failedToImportCSV')}: ${errorMessage}`;
      toast.error(displayMessage, { 
        id: toastId,
        duration: 5000, // Show for 5 seconds since there might be multiple errors
      });
    } finally {
      setImportLoading(false);
    }
  }, [token, t, fetchInvoices]);

  const handleBulkDelete = useCallback(async (ids: number[]) => {
    const toastId = toast.loading(t('invoice.bulk.deleting', { count: ids.length }));
    
    // Store original data for rollback
    const originalData = invoiceListData;
    const originalInvoices = invoices.filter(inv => ids.includes(inv.id));
    
    // Check if this bulk deletion will make the page incomplete
    const willPageBeIncomplete = invoiceListData && 
      invoiceListData.invoices.length === invoiceListData.pagination.pageSize && 
      ids.length > 0 && 
      invoiceListData.pagination.page < invoiceListData.pagination.totalPages;
    
    try {
      // Optimistically remove all invoices from both states
      ids.forEach(id => optimisticallyRemoveInvoice(id));
      
      // Optimistically update the server-side data
      if (invoiceListData) {
        setInvoiceListData((prev: any) => {
          if (!prev) return prev;
          const updatedInvoices = prev.invoices.filter((inv: any) => !ids.includes(inv.id));
          return {
            ...prev,
            invoices: updatedInvoices,
            pagination: {
              ...prev.pagination,
              totalItems: prev.pagination.totalItems - ids.length,
              totalPages: Math.ceil((prev.pagination.totalItems - ids.length) / prev.pagination.pageSize)
            }
          };
        });
      }

      // Perform all delete operations
      await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(INVOICE_ENDPOINTS.DELETE(id), {
            method: "DELETE",
            headers: getSecureHeaders(token),
          });

          if (response.status === 401) {
            tokenManager.clearAuthData();
            setToken(null);
            throw new Error('Session expired');
          }

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: t('errors.failedToDeleteInvoice') }));
            throw new Error(errorData.message || t('errors.failedToDeleteInvoice'));
          }
        })
      );
      
      // If the page will be incomplete, refresh the current page data
      if (willPageBeIncomplete) {
        // Silently refresh the current page to get the missing items
        const queryParams = new URLSearchParams();
        queryParams.append('page', invoiceListData!.pagination.page.toString());
        queryParams.append('pageSize', invoiceListData!.pagination.pageSize.toString());
        
        try {
          const response = await fetch(`${INVOICE_ENDPOINTS.LIST}?${queryParams.toString()}`, {
            headers: getAuthHeaders(token),
          });
          
          if (response.ok) {
            const refreshedData = await response.json();
            setInvoiceListData(refreshedData);
          }
        } catch (error) {
          // Failed to refresh page data
        }
      }
      
      toast.success(t('success.bulkInvoicesDeleted', { count: ids.length }), { id: toastId });
    } catch (err) {
      // Revert all optimistic updates
      originalInvoices.forEach(invoice => optimisticallyAddInvoice(invoice));
      setInvoiceListData(originalData);
      
      const errorMessage = err instanceof Error ? err.message : t('errors.anErrorOccurred');
      toast.error(errorMessage, { id: toastId });
    }
  }, [token, invoices, invoiceListData, t, optimisticallyRemoveInvoice, optimisticallyAddInvoice]);

  const handleBulkSubmit = useCallback(async (ids: number[]) => {
    const toastId = toast.loading(t('invoice.bulk.submitting', { count: ids.length }));
    
    // Store original invoices for rollback
    const originalInvoices = invoices.filter(inv => ids.includes(inv.id));
    
    try {
      // Optimistically update all invoices to "Awaiting Clearance"
      ids.forEach(id => optimisticallyUpdateInvoiceStatus(id, 2));

      // Perform all submit operations
      const results = await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(INVOICE_ENDPOINTS.SUBMIT(id), {
            method: "POST",
            headers: getSecureHeaders(token),
          });

          if (response.status === 401) {
            tokenManager.clearAuthData();
            setToken(null);
            throw new Error('Session expired');
          }

          if (!response.ok) {
            let errorData;
            try {
              errorData = await response.json();
            } catch {
              errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
            }
            throw new Error(errorData.message || t('errors.failedToSubmitInvoice'));
          }

          // Check if response has content before trying to parse
          const responseText = await response.text();
          if (responseText.trim()) {
            try {
              const result = JSON.parse(responseText);
              return result;
            } catch (parseError) {
              // If response is not valid JSON, return empty object
              return {};
            }
          } else {
            // If response is empty, return empty object
            return {};
          }
        })
      );
      
      // Update with server responses to get DGI submission IDs
      results.forEach((result, index) => {
        if (result.dgiSubmissionId) {
          optimisticallyUpdateInvoiceStatus(ids[index], 2, result.dgiSubmissionId);
        }
      });
      
      toast.success(t('success.bulkInvoicesSubmitted', { count: ids.length }), { id: toastId });
    } catch (err) {
      // Revert all optimistic updates
      originalInvoices.forEach(invoice => optimisticallyUpdateInvoice(invoice));
      
      const errorMessage = err instanceof Error ? err.message : t('errors.anErrorOccurred');
      toast.error(errorMessage, { id: toastId });
    }
  }, [token, invoices, t, optimisticallyUpdateInvoiceStatus, optimisticallyUpdateInvoice]);

  const toggleLanguage = useCallback(() => {
    const newLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(newLang);
  }, [i18n]);

  // ─── RENDER NAVBAR ─────────────────────────────────────────────────────────
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const renderNavbar = () => {
    const isAdmin = userRole === 'Admin';
    const isManager = userRole === 'Manager';
    const canAccessUsers = isAdmin || isManager;

    return (
      <nav className="sticky top-0 z-40 bg-gradient-to-r from-white/90 via-blue-50/80 to-white/90 backdrop-blur border-b border-gray-200 shadow-sm rounded-b-2xl">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <img
                  src={token ? APP_CONFIG.logo : APP_CONFIG.logoH}
                  alt={`${APP_CONFIG.title} Logo`}
                  className="h-8 w-auto"
                />
              </div>
              {token && (
                <>
                  <button
                    className="sm:hidden ml-2 p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => setMobileMenuOpen((open) => !open)}
                    aria-label="Toggle navigation menu"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <div className={`hidden sm:flex sm:ml-8 sm:space-x-2 transition-all duration-200`}>
                    <NavLink
                      to="/"
                      className={({ isActive }) =>
                        `inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 relative
                        ${isActive ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"}
                        after:absolute after:left-3 after:right-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-blue-500 after:scale-x-0 after:transition-transform after:duration-200
                        hover:after:scale-x-100 focus:after:scale-x-100 ${isActive ? 'after:scale-x-100' : ''}`
                      }
                    >
                      <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      {t('common.dashboard')}
                    </NavLink>
                    <NavLink
                      to="/invoices"
                      className={({ isActive }) =>
                        `inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 relative
                        ${isActive ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"}
                        after:absolute after:left-3 after:right-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-blue-500 after:scale-x-0 after:transition-transform after:duration-200
                        hover:after:scale-x-100 focus:after:scale-x-100 ${isActive ? 'after:scale-x-100' : ''}`
                      }
                    >
                      <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {t('common.invoices')}
                    </NavLink>
                    <NavLink
                      to="/quotes"
                      className={({ isActive }) =>
                        `inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 relative
                        ${isActive ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"}
                        after:absolute after:left-3 after:right-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-blue-500 after:scale-x-0 after:transition-transform after:duration-200
                        hover:after:scale-x-100 focus:after:scale-x-100 ${isActive ? 'after:scale-x-100' : ''}`
                      }
                    >
                      <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      {t('common.quotes')}
                    </NavLink>
                    <NavLink
                      to="/customers"
                      className={({ isActive }) =>
                        `inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 relative
                        ${isActive ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"}
                        after:absolute after:left-3 after:right-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-blue-500 after:scale-x-0 after:transition-transform after:duration-200
                        hover:after:scale-x-100 focus:after:scale-x-100 ${isActive ? 'after:scale-x-100' : ''}`
                      }
                    >
                      <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      {t('common.customers')}
                    </NavLink>
                    {canAccessUsers && (
                      <NavLink
                        to="/users"
                        className={({ isActive }) =>
                          `inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 relative
                          ${isActive ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"}
                          after:absolute after:left-3 after:right-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-blue-500 after:scale-x-0 after:transition-transform after:duration-200
                          hover:after:scale-x-100 focus:after:scale-x-100 ${isActive ? 'after:scale-x-100' : ''}`
                        }
                      >
                        <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        {t('common.users')}
                      </NavLink>
                    )}
                  </div>
                  {/* Mobile menu */}
                  {mobileMenuOpen && (
                    <div className="absolute left-0 top-16 w-full bg-white/95 shadow-lg rounded-b-2xl border-t border-gray-200 flex flex-col space-y-1 py-2 px-2 sm:hidden animate-fade-in z-50 transition-all duration-300">
                      <NavLink
                        to="/"
                        className={({ isActive }) =>
                          `inline-flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors duration-150 ${
                            isActive
                              ? "bg-blue-50 text-blue-700 shadow-sm"
                              : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                          }`
                        }
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        {t('common.dashboard')}
                      </NavLink>
                      <NavLink
                        to="/invoices"
                        className={({ isActive }) =>
                          `inline-flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors duration-150 ${
                            isActive
                              ? "bg-blue-50 text-blue-700 shadow-sm"
                              : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                          }`
                        }
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {t('common.invoices')}
                      </NavLink>
                      <NavLink
                        to="/quotes"
                        className={({ isActive }) =>
                          `inline-flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors duration-150 ${
                            isActive
                              ? "bg-blue-50 text-blue-700 shadow-sm"
                              : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                          }`
                        }
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        {t('common.quotes')}
                      </NavLink>
                      <NavLink
                        to="/customers"
                        className={({ isActive }) =>
                          `inline-flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors duration-150 ${
                            isActive
                              ? "bg-blue-50 text-blue-700 shadow-sm"
                              : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                          }`
                        }
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {t('common.customers')}
                      </NavLink>
                      {canAccessUsers && (
                        <NavLink
                          to="/users"
                          className={({ isActive }) =>
                            `inline-flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors duration-150 ${
                              isActive
                                ? "bg-blue-50 text-blue-700 shadow-sm"
                                : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                            }`
                          }
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {t('common.users')}
                        </NavLink>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={toggleLanguage}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white/80 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transform hover:scale-105"
              >
                {i18n.language === 'en' ? 'FR' : 'EN'}
              </button>
              {token && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((open) => !open)}
                    className="flex items-center space-x-2 sm:space-x-3 px-3 py-2 text-sm font-medium text-gray-700 bg-white/80 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transform hover:scale-105"
                    aria-haspopup="true"
                    aria-expanded={dropdownOpen}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="max-w-[110px] sm:max-w-[150px] truncate">{userEmail}</span>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform duration-150 ${dropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-lg z-50 py-1 animate-fadeIn">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="font-medium text-gray-900 truncate">{userEmail}</div>
                        <div className="text-sm text-gray-500 mt-0.5 flex items-center">
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            userRole === 'Admin' ? 'bg-indigo-400' :
                            userRole === 'Manager' ? 'bg-amber-400' :
                            'bg-green-400'
                          }`}></span>
                          <span className="capitalize">{userRole}</span>
                        </div>
                      </div>
                      {company && (
                        <div className="px-4 py-3 border-b border-gray-100">
                          <div className="font-medium text-gray-900 truncate flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 11-2 0V4H6v12a1 1 0 11-2 0V4zm5 3a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zm-1 4a1 1 0 100 2h2a1 1 0 100-2H8zm2 3a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                            </svg>
                            {company.name}
                          </div>
                          <div className="text-sm text-gray-500 mt-1 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                            </svg>
                            <span className="truncate">{company.ICE ? `ICE: ${company.ICE}` : 'ICE:'}</span>
                          </div>
                        </div>
                      )}
                      <NavLink
                        to="/profile"
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 transition-colors duration-150"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>{t('common.profile')}</span>
                      </NavLink>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 transition-colors duration-150"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
                        </svg>
                        <span>{t('common.logout')}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    );
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary
      fallback={
        <ErrorPage
          title="Application Error"
          message="Something went wrong in the application. Please try refreshing the page."
          onRetry={() => window.location.reload()}
        />
      }
    >
      <BrowserRouter>
        <div className="min-h-screen bg-gray-100">
          <Toaster position="top-right" />
          {renderNavbar()}

          {!token ? (
            <Routes>
              <Route
                path="/login"
                element={
                  <LoginPage
                    onLogin={handleLogin}
                    onToggleLanguage={toggleLanguage}
                    currentLanguage={i18n.language}
                  />
                }
              />
              <Route
                path="/register"
                element={
                  <RegisterPage
                    onToggleLanguage={toggleLanguage}
                    currentLanguage={i18n.language}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          ) : (
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              <Routes>
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Dashboard
                        stats={dashboardStats}
                        loading={dashboardLoading}
                        onRefresh={fetchDashboardStats}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices"
                  element={
                    <ProtectedRoute>
                      <div>
                        <div className="mb-6 flex items-center justify-between">
                          <ImportCSV onImport={handleImportCSV} loading={importLoading} />
                          <button
                            onClick={() => setShowInvoiceForm(true)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors ${
                              importLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {t('common.newInvoice')}
                          </button>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200">
                          <InvoiceList
                            data={invoiceListData}
                            loading={loading}
                            onDelete={handleDeleteInvoice}
                            onDownloadPdf={handleDownloadPdf}
                            onSubmit={handleSubmitInvoice}
                            onCreateInvoice={handleCreateInvoice}
                            onUpdateInvoice={handleUpdateInvoice}
                            onRefreshInvoices={fetchInvoices}
                            disabled={importLoading}
                            importLoading={importLoading}
                            onImportCSV={handleImportCSV}
                            onBulkDelete={handleBulkDelete}
                            onBulkSubmit={handleBulkSubmit}
                            onUpdateInvoiceStatus={optimisticallyUpdateInvoiceStatus}
                          />
                        </div>

                        {showInvoiceForm && (
                          <InvoiceForm
                            onSubmit={handleCreateInvoice}
                            onClose={() => setShowInvoiceForm(false)}
                            disabled={importLoading}
                          />
                        )}
                      </div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/quotes"
                  element={
                    <ProtectedRoute>
                      <QuoteManagement token={token} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                      <Users token={token} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <CompanyProfile company={company} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customers"
                  element={
                    <ProtectedRoute>
                      <CustomerCRUD token={token} />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          )}
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
