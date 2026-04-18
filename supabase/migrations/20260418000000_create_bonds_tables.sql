-- Create bonds table
CREATE TABLE IF NOT EXISTS bonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Bond Details
  bond_name TEXT NOT NULL,
  isin TEXT NOT NULL, -- International Securities Identification Number
  issuer TEXT NOT NULL, -- Government/Corporate issuer
  bond_type TEXT NOT NULL CHECK (bond_type IN ('Government', 'Corporate', 'Tax-Free', 'Infrastructure', 'PSU')),
  
  -- Investment Details
  face_value DECIMAL(15, 2) NOT NULL DEFAULT 1000,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchase_price DECIMAL(15, 2) NOT NULL, -- Price per bond
  current_price DECIMAL(15, 2) NOT NULL, -- Current market price
  total_invested DECIMAL(15, 2) NOT NULL, -- Total amount invested
  current_value DECIMAL(15, 2) NOT NULL, -- Current market value
  
  -- Yield & Returns
  coupon_rate DECIMAL(5, 2) NOT NULL, -- Annual interest rate (%)
  ytm DECIMAL(5, 2), -- Yield to Maturity (%)
  accrued_interest DECIMAL(15, 2) DEFAULT 0, -- Interest earned but not paid
  total_interest_earned DECIMAL(15, 2) DEFAULT 0, -- Total interest received
  
  -- Dates
  purchase_date DATE NOT NULL,
  maturity_date DATE NOT NULL,
  next_interest_date DATE, -- Next coupon payment date
  interest_frequency TEXT DEFAULT 'Semi-Annual' CHECK (interest_frequency IN ('Monthly', 'Quarterly', 'Semi-Annual', 'Annual')),
  
  -- Status & Ratings
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Matured', 'Sold')),
  credit_rating TEXT, -- AAA, AA+, etc.
  
  -- Platform Details
  platform TEXT DEFAULT 'Wint', -- Wint, Goldenpi, IndiaBonds, etc.
  demat_account TEXT, -- Demat account number
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bond_transactions table for tracking interest payments and trades
CREATE TABLE IF NOT EXISTS bond_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bond_id UUID REFERENCES bonds(id) ON DELETE CASCADE,
  
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('BUY', 'SELL', 'INTEREST', 'MATURITY')),
  transaction_date DATE NOT NULL,
  
  -- Transaction Details
  quantity INTEGER,
  price_per_bond DECIMAL(15, 2),
  amount DECIMAL(15, 2) NOT NULL,
  
  -- Interest Payment Details
  interest_amount DECIMAL(15, 2),
  interest_period_start DATE,
  interest_period_end DATE,
  
  -- Account Impact
  account_id UUID REFERENCES accounts(id),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_bonds_user_id ON bonds(user_id);
CREATE INDEX idx_bonds_status ON bonds(status);
CREATE INDEX idx_bonds_maturity_date ON bonds(maturity_date);
CREATE INDEX idx_bond_transactions_user_id ON bond_transactions(user_id);
CREATE INDEX idx_bond_transactions_bond_id ON bond_transactions(bond_id);
CREATE INDEX idx_bond_transactions_date ON bond_transactions(transaction_date);

-- Enable RLS
ALTER TABLE bonds ENABLE ROW LEVEL SECURITY;
ALTER TABLE bond_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bonds
CREATE POLICY "Users can view their own bonds"
  ON bonds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bonds"
  ON bonds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bonds"
  ON bonds FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bonds"
  ON bonds FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for bond_transactions
CREATE POLICY "Users can view their own bond transactions"
  ON bond_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bond transactions"
  ON bond_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE bonds;
ALTER PUBLICATION supabase_realtime ADD TABLE bond_transactions;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bonds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER bonds_updated_at
  BEFORE UPDATE ON bonds
  FOR EACH ROW
  EXECUTE FUNCTION update_bonds_updated_at();

-- Function to calculate accrued interest
CREATE OR REPLACE FUNCTION calculate_accrued_interest(
  p_bond_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  v_coupon_rate DECIMAL;
  v_face_value DECIMAL;
  v_quantity INTEGER;
  v_last_interest_date DATE;
  v_next_interest_date DATE;
  v_days_elapsed INTEGER;
  v_days_in_period INTEGER;
  v_accrued DECIMAL;
BEGIN
  SELECT 
    coupon_rate, 
    face_value, 
    quantity,
    COALESCE(
      (SELECT MAX(transaction_date) 
       FROM bond_transactions 
       WHERE bond_id = p_bond_id AND transaction_type = 'INTEREST'),
      purchase_date
    ),
    next_interest_date
  INTO 
    v_coupon_rate, 
    v_face_value, 
    v_quantity,
    v_last_interest_date,
    v_next_interest_date
  FROM bonds
  WHERE id = p_bond_id;
  
  v_days_elapsed := CURRENT_DATE - v_last_interest_date;
  v_days_in_period := v_next_interest_date - v_last_interest_date;
  
  -- Calculate accrued interest
  v_accrued := (v_face_value * v_quantity * v_coupon_rate / 100) * (v_days_elapsed::DECIMAL / 365);
  
  RETURN ROUND(v_accrued, 2);
END;
$$ LANGUAGE plpgsql;
