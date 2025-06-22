# Domain Verification Guide for MS Foods

## Step 1: Add Domain to Resend
1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Enter: `msfoods.pk`
4. Follow the DNS setup instructions

## Step 2: Add DNS Records
Add these records to your domain's DNS:

### SPF Record
```
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all
```

### DKIM Record
```
Type: TXT
Name: resend._domainkey
Value: (provided by Resend)
```

### DMARC Record
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@msfoods.pk
```

## Step 3: Update Email Configuration
Once verified, update your .env file:
```
EMAIL_FROM=noreply@msfoods.pk
```

## Step 4: Test Deliverability
Use tools like:
- mail-tester.com
- mxtoolbox.com
- dkimvalidator.com 