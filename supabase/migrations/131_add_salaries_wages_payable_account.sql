-- Migration 131: Add Salaries & Wages Payable account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM chart_of_accounts
    WHERE account_name = 'Salaries & Wages Payable'
  ) THEN
    INSERT INTO chart_of_accounts (
      account_code,
      account_name,
      account_type,
      description,
      is_active
    ) VALUES (
      '2103',
      'Salaries & Wages Payable',
      'liability',
      'Accrued payroll liability from submitted attendance sheets',
      true
    );
  END IF;
END $$;
