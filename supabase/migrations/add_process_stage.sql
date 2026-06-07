-- Add process_stage column to detail tables
ALTER TABLE consultation_battery_details
  ADD COLUMN IF NOT EXISTS process_stage text;

ALTER TABLE consultation_tire_details
  ADD COLUMN IF NOT EXISTS process_stage text;

ALTER TABLE consultation_forklift_details
  ADD COLUMN IF NOT EXISTS process_stage text;

ALTER TABLE consultation_export_details
  ADD COLUMN IF NOT EXISTS process_stage text;

-- Copy existing status values to process_stage
UPDATE consultation_tire_details
  SET process_stage = CASE
    WHEN process_status IN ('inquiry_received','size_confirming')        THEN 'consulting'
    WHEN process_status IN ('quote_sent','proposal')                     THEN 'quote'
    WHEN process_status IN ('waiting_order','waiting_payment')           THEN 'contract'
    WHEN process_status IN ('delivery_or_replacement','delivered')       THEN 'delivery'
    WHEN process_status IN ('completed','invoiced')                      THEN 'invoiced'
    WHEN process_status IS NOT NULL                                      THEN process_status
    ELSE NULL
  END
WHERE process_stage IS NULL AND process_status IS NOT NULL;

UPDATE consultation_forklift_details
  SET process_stage = CASE
    WHEN forklift_status IN ('consulting')                               THEN 'consulting'
    WHEN forklift_status IN ('quote')                                    THEN 'quote'
    WHEN forklift_status IN ('contract')                                 THEN 'contract'
    WHEN forklift_status IN ('delivery')                                 THEN 'delivery'
    WHEN forklift_status IN ('invoiced','completed')                     THEN 'invoiced'
    WHEN forklift_status IS NOT NULL                                     THEN forklift_status
    ELSE NULL
  END
WHERE process_stage IS NULL AND forklift_status IS NOT NULL;
