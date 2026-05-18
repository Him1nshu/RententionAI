# n8n Retention Workflow

Use the app's n8n payload preview to test a webhook workflow.

## Suggested n8n flow

1. Webhook trigger receives `customers`.
2. Filter customers where `risk_score >= 70`.
3. Split in batches.
4. If `channel` is `WhatsApp`, send an approved WhatsApp template through Meta Cloud API, Twilio, WATI, Interakt, or Gupshup.
5. If no reply after a wait period, send SMS or create a customer-care task.
6. If the customer replies negatively or asks for help, create a high-priority callback task.
7. Send the final status back to your app when you add a backend.

## Example webhook payload

```json
{
  "source": "RetainIQ Telecom Churn Studio",
  "channel": "WhatsApp",
  "threshold_percent": 70,
  "customers": [
    {
      "customer_id": "CUST0002",
      "phone_number": "919876540002",
      "risk_score": 87.4,
      "risk_level": "Critical",
      "reasons": ["Complaints 90d", "Network Issue Count 90d"],
      "suggested_offer": "Network care callback + service credit"
    }
  ]
}
```

## Compliance note

Use only opted-in customers for WhatsApp or promotional SMS. WhatsApp Business normally requires approved template messages for outbound business-initiated conversations.
