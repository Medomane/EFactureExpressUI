// Invoice-specific permission utilities
import { UserRole } from '../../../utils/shared.permissions';

export type InvoiceStatus = 0 | 1 | 2 | 3 | 4; // Draft, Ready, AwaitingClearance, Validated, Rejected

// Invoice status constants
export const INVOICE_STATUS = {
  DRAFT: 0,
  READY: 1,
  AWAITING_CLEARANCE: 2,
  VALIDATED: 3,
  REJECTED: 4
} as const;

// Global capabilities
export const canCreateInvoice = (userRole: UserRole): boolean => {
  return ['Admin', 'Manager', 'Clerk'].includes(userRole);
};

// Core permission functions
export const canModifyInvoice = (userRole: UserRole, invoiceStatus: InvoiceStatus): boolean => {
  switch (userRole) {
    case 'Clerk':
      // Clerks can only modify Draft invoices
      return invoiceStatus === INVOICE_STATUS.DRAFT;
    
    case 'Manager':
    case 'Admin':
      // Managers and Admins can modify Draft, Ready, and Rejected invoices
      return invoiceStatus === INVOICE_STATUS.DRAFT ||
             invoiceStatus === INVOICE_STATUS.READY ||
             invoiceStatus === INVOICE_STATUS.REJECTED;
    
    default:
      return false;
  }
};

export const canDeleteInvoice = (userRole: UserRole, invoiceStatus: InvoiceStatus): boolean => {
  // Same rules as modify for deletion
  return canModifyInvoice(userRole, invoiceStatus);
};

export const canChangeInvoiceStatus = (userRole: UserRole, invoiceStatus: InvoiceStatus): boolean => {
  switch (userRole) {
    case 'Clerk':
      // Clerks cannot change status at all
      return false;
    
    case 'Manager':
    case 'Admin':
      // Managers and Admins can change status for Draft, Ready, and Rejected invoices
      return invoiceStatus === INVOICE_STATUS.DRAFT ||
             invoiceStatus === INVOICE_STATUS.READY ||
             invoiceStatus === INVOICE_STATUS.REJECTED;
    
    default:
      return false;
  }
};

export const canSubmitInvoice = (userRole: UserRole, invoiceStatus: InvoiceStatus): boolean => {
  // Only Managers and Admins can submit, and only Ready invoices
  return (userRole === 'Manager' || userRole === 'Admin') && 
         invoiceStatus === INVOICE_STATUS.READY;
};

export const canPerformDGIStatusCheck = (userRole: UserRole, invoiceStatus: InvoiceStatus): boolean => {
  // Only Managers and Admins can check DGI status for AwaitingClearance invoices
  return (userRole === 'Manager' || userRole === 'Admin') && 
         invoiceStatus === INVOICE_STATUS.AWAITING_CLEARANCE;
};

export const canAccessRejectionReason = (userRole: UserRole, invoiceStatus: InvoiceStatus): boolean => {
  // All roles can view rejection reason for rejected invoices
  return invoiceStatus === INVOICE_STATUS.REJECTED;
};

// Status transition validation
export const getValidStatusTransitions = (userRole: UserRole, currentStatus: InvoiceStatus): InvoiceStatus[] => {
  if (userRole === 'Clerk') {
    // Clerks cannot change status
    return [currentStatus];
  }

  switch (currentStatus) {
    case INVOICE_STATUS.DRAFT:
      // Draft can go to Ready
      return [INVOICE_STATUS.DRAFT, INVOICE_STATUS.READY];
    
    case INVOICE_STATUS.READY:
      // Ready can go back to Draft or stay Ready
      return [INVOICE_STATUS.DRAFT, INVOICE_STATUS.READY];
    
    case INVOICE_STATUS.AWAITING_CLEARANCE:
      // AwaitingClearance cannot be changed manually (only by DGI response)
      return [INVOICE_STATUS.AWAITING_CLEARANCE];
    
    case INVOICE_STATUS.VALIDATED:
      // Validated is immutable
      return [INVOICE_STATUS.VALIDATED];
    
    case INVOICE_STATUS.REJECTED:
      // Rejected can go back to Draft
      return [INVOICE_STATUS.DRAFT, INVOICE_STATUS.REJECTED];
    
    default:
      return [currentStatus];
  }
};

export const canTransitionToStatus = (
  userRole: UserRole, 
  currentStatus: InvoiceStatus, 
  targetStatus: InvoiceStatus
): boolean => {
  const validTransitions = getValidStatusTransitions(userRole, currentStatus);
  return validTransitions.includes(targetStatus);
};

// Bulk operations
export const canSelectForBulkOperation = (
  userRole: UserRole, 
  invoiceStatus: InvoiceStatus, 
  operation: 'delete' | 'submit'
): boolean => {
  if (operation === 'delete') {
    return canDeleteInvoice(userRole, invoiceStatus);
  }
  
  if (operation === 'submit') {
    return canSubmitInvoice(userRole, invoiceStatus);
  }
  
  return false;
};

// UI helper functions
export const getInvoiceActionPermissions = (userRole: UserRole, invoiceStatus: InvoiceStatus) => {
  return {
    canEdit: canModifyInvoice(userRole, invoiceStatus),
    canDelete: canDeleteInvoice(userRole, invoiceStatus),
    canSubmit: canSubmitInvoice(userRole, invoiceStatus),
    canChangeStatus: canChangeInvoiceStatus(userRole, invoiceStatus),
    canCheckDGIStatus: canPerformDGIStatusCheck(userRole, invoiceStatus),
    canViewRejectionReason: canAccessRejectionReason(userRole, invoiceStatus),
    validStatusTransitions: getValidStatusTransitions(userRole, invoiceStatus)
  };
};

// Status display helpers
export const getStatusDisplayInfo = (status: InvoiceStatus) => {
  switch (status) {
    case INVOICE_STATUS.DRAFT:
      return { key: 'draft', color: 'gray', mutable: true };
    case INVOICE_STATUS.READY:
      return { key: 'ready', color: 'blue', mutable: true };
    case INVOICE_STATUS.AWAITING_CLEARANCE:
      return { key: 'awaitingClearance', color: 'yellow', mutable: false };
    case INVOICE_STATUS.VALIDATED:
      return { key: 'validated', color: 'green', mutable: false };
    case INVOICE_STATUS.REJECTED:
      return { key: 'rejected', color: 'red', mutable: true };
    default:
      return { key: 'unknown', color: 'gray', mutable: false };
  }
};