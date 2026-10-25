export type UserRole = 'boss' | 'employee';

export type ApprovalStatus =
  | 'draft'
  | 'pending'
  | 'revision'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid';

export type PaymentSource = 'personal' | 'company';

export type PaymentMethod = 'cash' | 'bank_transfer';

export type HistoryAction =
  | 'created'
  | 'submitted'
  | 'resubmitted'
  | 'revision_requested'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'payment_recorded';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  employee_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReimbursementFile {
  id: string;
  reimbursement_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  signed_url?: string; // computed for preview
}

export interface ApprovalHistoryItem {
  id: string;
  reimbursement_id: string;
  actor_id: string;
  action: HistoryAction;
  note: string | null;
  previous_status: string | null;
  new_status: string | null;
  created_at: string;
  actor?: Profile;
}

export interface Payment {
  id: string;
  reimbursement_id: string;
  recorded_by: string;
  amount_paid: number;
  paid_at: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  recorder?: Profile;
}

export interface Reimbursement {
  id: string;
  claim_number: string;
  employee_id: string;
  category_id: string;
  expense_date: string;
  amount: number;
  payment_source: PaymentSource;
  description: string;
  approval_status: ApprovalStatus;
  payment_status: PaymentStatus;
  submitted_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  employee?: Profile;
  category?: Category;
  decider?: Profile;
  files?: ReimbursementFile[];
  history?: ApprovalHistoryItem[];
  payment?: Payment;
}
