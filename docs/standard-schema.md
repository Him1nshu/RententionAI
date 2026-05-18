# RetainIQ Standard Telecom Schema

Different telecom companies will upload different column names. RetainIQ maps those raw columns into this internal schema before validation, training, dashboards, and automation.

## Required fields

- `customer_id`: unique customer/subscriber/account identifier.
- `churned`: historical training label. Accepted values include `Yes`, `No`, `1`, `0`, `True`, `False`, `Churned`, `Active`, `Left`, and `Stayed`.

## Recommended fields

- `phone_number`: needed for WhatsApp or SMS workflows.
- `tenure_months`: customer age with the company.
- `monthly_charge_inr`: ARPU or monthly bill amount.
- `plan_type`: prepaid, postpaid, broadband, family plan, or similar.
- `support_tickets_90d`: recent service/support friction.
- `complaints_90d`: recent complaint count.
- `network_issue_count_90d`: outages, call drops, or network complaints.
- `avg_data_usage_gb`: average data usage.
- `avg_call_minutes`: average voice usage.
- `late_payment_count_6m`: payment risk.
- `whatsapp_opt_in`: consent field for retention messaging.

## Optional dashboard fields

- `state`, `city`, `age`, `gender`, `connection_type`, `payment_method`, `autopay_enabled`, `competitor_offer_seen`, `satisfaction_score`, `nps_score`.

## Upload strategy

For MVP, upload one customer-level CSV. Later versions can support separate billing, usage, complaints, and campaign-response files joined by `customer_id` or `phone_number`.
